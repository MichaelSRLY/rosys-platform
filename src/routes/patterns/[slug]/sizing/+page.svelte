<script context="module" lang="ts">
	/** Split streamed markdown into sections by ## headers */
	function parseSections(text: string): { title: string; body: string }[] {
		if (!text) return [];
		const parts = text.split(/^## /gm).filter(Boolean);
		return parts.map(part => {
			const newline = part.indexOf('\n');
			if (newline === -1) return { title: part.trim(), body: '' };
			return {
				title: part.slice(0, newline).trim(),
				body: part.slice(newline + 1).trim()
			};
		});
	}

	/** Render body text with inline bold */
	function renderBody(text: string): string {
		return text
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/^- (.+)$/gm, '<li>$1</li>')
			.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
			.replace(/<\/ul>\s*<ul>/g, '')
			.replace(/^(?!<[hul])((?!<\/[hul]).+)$/gm, '<p>$1</p>')
			.replace(/\n\n+/g, '\n');
	}
</script>

<script lang="ts">
	import { ArrowLeft, Ruler, Sparkles, Loader2, Check, Download, Camera, ChevronDown, Zap, RotateCcw, RefreshCw, Scissors, MessageCircle, TrendingUp, AlertCircle } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, chart, rawSizeChart, savedProfile } = data;

	const sizes = chart?.sizes ?? [];
	const bodyRows = chart?.body ?? [];
	const hasChart = sizes.length > 0;

	type Phase = 'entry' | 'measurements' | 'photo' | 'analyzing' | 'results';

	let phase = $state<Phase>('entry');
	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');
	let height = $state(savedProfile?.height_cm?.toString() ?? '');
	let errorMsg = $state('');

	let deterministicResult = $state<any>(null);
	let streamedText = $state('');
	let isStreaming = $state(false);
	let profile = $state<any>(null);
	let chartData = $state<any>(null);
	let hasDxf = $state(false);

	let showPreferences = $state(false);
	let fitPreference = $state('');
	let bustPref = $state('');
	let waistPref = $state('');
	let hipPref = $state('');
	let lengthPref = $state('');
	let fabricStretch = $state('');
	let isRefining = $state(false);
	let refinedText = $state('');

	let showChart = $state(false);
	let showProfile = $state(false);
	let showFinished = $state(false);
	let sizeLocked = $state(false);

	let showCustomFit = $state(false);
	let customFitLoading = $state(false);
	let customFitGrading = $state<any>(null);
	let customFitError = $state('');

	let analysisStep = $state(0);

	const canSubmit = $derived(!!(bust && waist && hip));

	function extractSizeFromText(text: string): string | null {
		if (!text) return null;
		const m = text.match(/Size\s+([A-Z0-9]{1,4})\b/i);
		return m ? m[1].toUpperCase() : null;
	}
	const aiSize = $derived(extractSizeFromText(refinedText) ?? extractSizeFromText(streamedText));
	const recommendedSize = $derived(aiSize ?? deterministicResult?.recommended_size ?? null);
	const highlightedIndex = $derived(recommendedSize ? (chartData?.sizes ?? sizes).indexOf(recommendedSize) : -1);
	const hasPreferences = $derived(!!(fitPreference || bustPref || waistPref || hipPref || lengthPref || fabricStretch));

	// Parse streamed text into visual sections
	const sections = $derived(parseSections(refinedText || streamedText));
	const summarySection = $derived(sections.find(s => s.title.toLowerCase().includes('why')));
	const fitSection = $derived(sections.find(s => s.title.toLowerCase().includes('fit by')));
	const betweenSection = $derived(sections.find(s => s.title.toLowerCase().includes('between')));
	const adjustSection = $derived(sections.find(s => s.title.toLowerCase().includes('adjust')));
	const notesSection = $derived(sections.find(s => s.title.toLowerCase().includes('note') || s.title.toLowerCase().includes('garment')));
	const updatedSection = $derived(sections.find(s => s.title.toLowerCase().includes('updated') && s.title.toLowerCase().includes('recommendation')));
	const changedSection = $derived(sections.find(s => s.title.toLowerCase().includes('changed')));

	async function consumeStream(res: Response) {
		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			while (buffer.includes('\n\n')) {
				const blockEnd = buffer.indexOf('\n\n');
				const block = buffer.slice(0, blockEnd);
				buffer = buffer.slice(blockEnd + 2);
				let eventType = '', eventData = '';
				for (const line of block.split('\n')) {
					if (line.startsWith('event: ')) eventType = line.slice(7);
					else if (line.startsWith('data: ')) eventData = line.slice(6);
				}
				if (!eventType || !eventData) continue;
				try {
					const payload = JSON.parse(eventData);
					if (eventType === 'deterministic') {
						deterministicResult = payload;
						profile = payload.profile;
						chartData = payload.chart;
						hasDxf = payload.has_dxf ?? false;
						analysisStep = 2;
					} else if (eventType === 'chunk') {
						if (analysisStep < 3) analysisStep = 3;
						if (isRefining) refinedText += payload;
						else streamedText += payload;
					} else if (eventType === 'error') {
						errorMsg = payload.message;
					}
				} catch {}
			}
		}
	}

	function startAnalysis() {
		analysisStep = 1; phase = 'analyzing'; isStreaming = true; streamedText = ''; errorMsg = '';
		startStreaming();
	}

	async function startStreaming() {
		try {
			const res = await fetch('/api/ai/size-intelligence/stream', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), height: height ? parseFloat(height) : undefined, source: 'tape_measure' })
			});
			if (!res.ok) { errorMsg = 'Something went wrong.'; isStreaming = false; return; }
			await consumeStream(res);
		} catch (e: any) { errorMsg = e.message || 'Connection failed.'; }
		finally { isStreaming = false; if (!errorMsg) phase = 'results'; }
	}

	async function refineWithPreferences() {
		if (!hasPreferences) return;
		isRefining = true; refinedText = ''; errorMsg = '';
		try {
			const res = await fetch('/api/ai/size-intelligence/stream', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), height: height ? parseFloat(height) : undefined, source: 'tape_measure',
					preferences: { fit_preference: fitPreference || undefined, bust_preference: bustPref || undefined, waist_preference: waistPref || undefined, hip_preference: hipPref || undefined, length_preference: lengthPref || undefined, fabric_stretch: fabricStretch || undefined },
					previous_recommendation: streamedText || undefined })
			});
			if (!res.ok) { errorMsg = 'Refinement failed.'; isRefining = false; return; }
			await consumeStream(res);
		} catch (e: any) { errorMsg = e.message || 'Connection failed.'; }
		finally { isRefining = false; }
	}

	async function calculateCustomFit() {
		customFitLoading = true; customFitError = ''; customFitGrading = null;
		try {
			const res = await fetch('/api/patterns/generate-custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip) }) });
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
			const json = await res.json(); customFitGrading = json.grading; customFitError = json.error || '';
		} catch (e: any) { customFitError = e.message || 'Could not calculate.'; }
		finally { customFitLoading = false; }
	}

	async function downloadCustomDxf() {
		customFitLoading = true;
		try {
			const res = await fetch('/api/patterns/generate-custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), generate: true }) });
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob(); const cd = res.headers.get('content-disposition');
			const filename = cd?.match(/filename="(.+)"/)?.[1] || `${pattern.pattern_slug}-custom.dxf`;
			const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
		} catch (e: any) { customFitError = e.message; }
		finally { customFitLoading = false; }
	}

	function reset() {
		phase = 'entry'; deterministicResult = null; streamedText = ''; refinedText = ''; profile = null; chartData = null; errorMsg = '';
		showPreferences = false; sizeLocked = false; showCustomFit = false; customFitGrading = null; analysisStep = 0;
		fitPreference = bustPref = waistPref = hipPref = lengthPref = fabricStretch = '';
	}

	$effect(() => { if (savedProfile && bust && waist && hip) phase = 'measurements'; });
</script>

<svelte:head><title>Find Your Size — {pattern.pattern_name}</title></svelte:head>

<div class="sz-page">

	<a href="/patterns/{pattern.pattern_slug}" class="sz-back">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />{pattern.pattern_name}
	</a>

	<!-- ═══ ENTRY ═══ -->
	{#if phase === 'entry'}
		<div class="sz-anim">
			<div class="sz-hero">
				<div class="sz-hero-icon"><Sparkles class="w-7 h-7" strokeWidth={1.5} /></div>
				<h1 class="sz-hero-title">Find Your<br/>Perfect Size</h1>
				<p class="sz-hero-sub">{pattern.pattern_name}</p>
			</div>
			<div class="sz-paths">
				<button type="button" onclick={() => phase = 'measurements'} class="sz-path sz-path-main">
					<div class="sz-path-icon"><Ruler class="w-5 h-5" strokeWidth={1.5} /></div>
					<div class="sz-path-text"><strong>Measure yourself</strong><span>Bust, waist, hip & height</span></div>
					<span class="sz-pill sz-pill-green">Accurate</span>
				</button>
				<button type="button" onclick={() => phase = 'photo'} class="sz-path sz-path-alt">
					<div class="sz-path-icon sz-path-icon-muted"><Camera class="w-5 h-5" strokeWidth={1.5} /></div>
					<div class="sz-path-text"><strong>Upload a photo</strong><span>Body estimation</span></div>
					<span class="sz-pill sz-pill-amber">Beta</span>
				</button>
			</div>
		</div>

	{:else if phase === 'photo'}
		<div class="sz-anim text-center">
			<h1 class="sz-title mb-2">Photo Measurement</h1>
			<p class="sz-sub mb-6">Use our <a href="/profile/measurements/photo" class="text-rosys-500 underline">photo tool</a>, then return here.</p>
			<button type="button" onclick={() => phase = 'measurements'} class="sz-btn-soft w-full">Use tape measure instead</button>
		</div>

	<!-- ═══ MEASUREMENTS ═══ -->
	{:else if phase === 'measurements'}
		<div class="sz-anim">
			<div class="sz-header">
				<div class="sz-header-icon"><Ruler class="w-5 h-5" strokeWidth={1.5} /></div>
				<div><h1 class="sz-title">Your Measurements</h1><p class="sz-sub">Soft tape — snug but not tight</p></div>
			</div>

			<div class="sz-form">
				{#each [
					{ id: 'bust', label: 'Bust', ph: '88', get: () => bust, set: (v: string) => bust = v },
					{ id: 'waist', label: 'Waist', ph: '72', get: () => waist, set: (v: string) => waist = v },
					{ id: 'hip', label: 'Hip', ph: '92', get: () => hip, set: (v: string) => hip = v },
					{ id: 'height', label: 'Height', ph: '168', get: () => height, set: (v: string) => height = v, opt: true },
				] as f}
					<div class="sz-field">
						<label for={f.id} class="sz-label">{f.label}{#if f.opt}<span class="sz-label-opt"> · optional</span>{/if}</label>
						<div class="sz-input-wrap">
							<input id={f.id} type="number" inputmode="numeric" placeholder={f.ph} value={f.get()} oninput={(e) => f.set((e.target as HTMLInputElement).value)} class="sz-input" />
							<span class="sz-unit">cm</span>
						</div>
					</div>
				{/each}
			</div>

			{#if errorMsg}<p class="sz-error">{errorMsg}</p>{/if}

			<button type="button" disabled={!canSubmit} onclick={startAnalysis} class="sz-btn w-full">
				<Sparkles class="w-5 h-5" strokeWidth={2} />Analyze my fit
			</button>

			{#if savedProfile}<p class="sz-note"><Check class="w-3 h-3 inline text-emerald-500" strokeWidth={2} /> Saved measurements loaded</p>{/if}
			<button type="button" onclick={() => phase = 'entry'} class="sz-btn-ghost w-full mt-1"><ArrowLeft class="w-3.5 h-3.5" strokeWidth={1.5} /> Back</button>
		</div>

	<!-- ═══ ANALYZING ═══ -->
	{:else if phase === 'analyzing'}
		<div class="sz-anim">
			<!-- Steps -->
			<div class="sz-steps">
				{#each [
					{ label: 'Matching sizes', done: analysisStep >= 2 },
					{ label: 'Body profile', done: analysisStep >= 2 },
					{ label: 'Generating recommendation', done: !isStreaming && analysisStep >= 3 },
				] as step, i}
					<div class="sz-step" class:done={step.done} class:active={!step.done && analysisStep >= i + 1}>
						<div class="sz-step-dot">
							{#if step.done}<Check class="w-3 h-3" strokeWidth={3} />
							{:else if !step.done && analysisStep >= i + 1}<Loader2 class="w-3 h-3 animate-spin" strokeWidth={2.5} />{/if}
						</div>
						<span class="sz-step-text">{step.label}</span>
					</div>
				{/each}
			</div>

			<!-- Size badge -->
			{#if recommendedSize}
				<div class="sz-badge-reveal">
					<div class="sz-badge">
						<span class="sz-badge-label">{deterministicResult?.pattern_name}</span>
						<span class="sz-badge-size">{recommendedSize}</span>
					</div>
				</div>
			{/if}

			<!-- Streaming sections appear as cards -->
			{#if sections.length > 0}
				<div class="sz-stream-sections">
					{#each sections as sec, i}
						<div class="sz-section-card sz-anim" style="animation-delay: {i * 0.05}s">
							<span class="sz-section-label">{sec.title}</span>
							<div class="sz-prose">{@html renderBody(sec.body)}</div>
						</div>
					{/each}
					{#if isStreaming}<span class="sz-cursor"></span>{/if}
				</div>
			{:else if !errorMsg}
				<div class="sz-thinking"><div class="sz-dots"><span></span><span></span><span></span></div></div>
			{/if}

			{#if errorMsg}<div class="sz-error-box">{errorMsg}</div>{/if}
		</div>

	<!-- ═══ RESULTS ═══ -->
	{:else if phase === 'results'}
		<div class="sz-anim">

			<!-- Size hero -->
			{#if recommendedSize}
				<div class="sz-result-top">
					<div class="sz-badge">
						<span class="sz-badge-label">{deterministicResult?.pattern_name}</span>
						<span class="sz-badge-size">{recommendedSize}</span>
					</div>
					<div class="sz-size-row">
						{#each (chartData?.sizes ?? sizes).length > 0 ? (chartData?.sizes ?? sizes) : ['XXS','XS','S','M','L','XL','XXL'] as s}
							<span class="sz-pip" class:sz-pip-on={s === recommendedSize}>{s}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Between sizes -->
			{#if deterministicResult?.between_sizes}
				<div class="sz-between">↕ Between <strong>{deterministicResult.lower_size}</strong> and <strong>{deterministicResult.upper_size}</strong></div>
			{/if}

			<!-- Fit analysis cards (from deterministic data) -->
			{#if deterministicResult?.fit}
				<div class="sz-fit-cards">
					{#each [
						{ label: 'Bust', d: deterministicResult.fit.bust },
						{ label: 'Waist', d: deterministicResult.fit.waist },
						{ label: 'Hip', d: deterministicResult.fit.hip },
					] as { label, d }}
						{#if d}
							<div class="sz-fit-card">
								<div class="sz-fit-top">
									<span class="sz-fit-label">{label}</span>
									<span class="sz-fit-tag sz-fit-{d.fit}">{d.fit}</span>
								</div>
								<span class="sz-fit-val">{d.user_cm}<small>cm</small></span>
								{#if d.diff_cm !== undefined}
									<div class="sz-fit-bar">
										<div class="sz-fit-bar-fill sz-fit-bar-{d.fit}" style="width: {Math.min(100, Math.max(10, 50 + d.diff_cm * 5))}%"></div>
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- Recommendation narrative (sectioned cards) -->
			{#if sections.length > 0}
				<div class="sz-narrative">
					<!-- Summary / Why this size -->
					{#if summarySection}
						<div class="sz-card-narrative">
							<TrendingUp class="w-4 h-4 text-rosys-400 shrink-0 mt-0.5" strokeWidth={1.5} />
							<div class="sz-prose">{@html renderBody(summarySection.body)}</div>
						</div>
					{/if}

					<!-- Updated recommendation (from refinement) -->
					{#if updatedSection}
						<div class="sz-card-updated">
							<span class="sz-card-tag">Updated</span>
							<div class="sz-prose">{@html renderBody(updatedSection.body)}</div>
						</div>
					{/if}
					{#if changedSection}
						<div class="sz-card-changed">
							<span class="sz-card-tag">What changed</span>
							<div class="sz-prose">{@html renderBody(changedSection.body)}</div>
						</div>
					{/if}

					<!-- Between sizes -->
					{#if betweenSection && betweenSection.body}
						<div class="sz-card-between">
							<span class="sz-card-tag">Between sizes?</span>
							<div class="sz-prose">{@html renderBody(betweenSection.body)}</div>
						</div>
					{/if}

					<!-- Adjustments -->
					{#if adjustSection && adjustSection.body}
						<div class="sz-card-adjust">
							<Ruler class="w-4 h-4 text-blue-400 shrink-0 mt-0.5" strokeWidth={1.5} />
							<div>
								<span class="sz-card-tag">Adjustments</span>
								<div class="sz-prose">{@html renderBody(adjustSection.body)}</div>
							</div>
						</div>
					{/if}

					<!-- Garment notes -->
					{#if notesSection && notesSection.body}
						<details class="sz-card-details">
							<summary>Pattern & fabric notes</summary>
							<div class="sz-prose">{@html renderBody(notesSection.body)}</div>
						</details>
					{/if}
				</div>
			{/if}

			<!-- Expandable data panels -->
			<div class="sz-panels">
				{#if chartData?.finished?.length > 0}
					<button type="button" onclick={() => showFinished = !showFinished} class="sz-panel-trigger">
						<Ruler class="w-4 h-4 text-rosys-400" strokeWidth={1.5} />
						<span>Finished garment measurements</span>
						<ChevronDown class="w-3.5 h-3.5 ml-auto text-rosys-fg-faint transition-transform {showFinished ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showFinished}
						<div class="sz-panel-body page-enter overflow-x-auto">
							<table class="sz-table">
								<thead><tr><th></th>{#each chartData.sizes as s, i}<th class:sz-th-hl={i === highlightedIndex}>{s}</th>{/each}</tr></thead>
								<tbody>
									{#each [{key:'bust_cm',l:'Bust'},{key:'waist_cm',l:'Waist'},{key:'hip_cm',l:'Hip'},{key:'full_length_cm',l:'Length'},{key:'sleeve_length_cm',l:'Sleeve'}] as col}
										{@const has = chartData.finished.some((r: any) => r[col.key])}
										{#if has}<tr><td class="sz-td-l">{col.l}</td>{#each chartData.finished as row, i}<td class:sz-td-hl={i === highlightedIndex}>{row[col.key] ? Number(row[col.key]) : '—'}</td>{/each}</tr>{/if}
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}

				{#if profile}
					<button type="button" onclick={() => showProfile = !showProfile} class="sz-panel-trigger">
						<Zap class="w-4 h-4 text-violet-400" strokeWidth={1.5} />
						<span>Body profile <span class="sz-muted">· 59K records</span></span>
						<ChevronDown class="w-3.5 h-3.5 ml-auto text-rosys-fg-faint transition-transform {showProfile ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showProfile}
						<div class="sz-panel-body page-enter">
							<div class="sz-profile-grid">
								{#each [{l:'Shoulder',v:profile.shoulder_cm,u:'cm'},{l:'Arm',v:profile.arm_length_cm,u:'cm'},{l:'Arm circ.',v:profile.arm_circ_cm,u:'cm'},{l:'Leg',v:profile.leg_length_cm,u:'cm'},{l:'Weight',v:profile.weight_kg,u:'kg'},{l:'Neck',v:profile.neck_cm,u:'cm'}] as m}
									{#if m.v}<div class="sz-profile-cell"><span class="sz-profile-num">{m.v}<small>{m.u}</small></span><span class="sz-profile-lbl">{m.l}</span></div>{/if}
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				{#if hasChart}
					<button type="button" onclick={() => showChart = !showChart} class="sz-panel-trigger">
						<span class="w-4 h-4 text-rosys-fg-faint text-[11px] font-bold">#</span>
						<span>Body size chart</span>
						<ChevronDown class="w-3.5 h-3.5 ml-auto text-rosys-fg-faint transition-transform {showChart ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showChart}
						<div class="sz-panel-body page-enter overflow-x-auto">
							<table class="sz-table">
								<thead><tr><th></th>{#each sizes as s, i}<th class:sz-th-hl={i === highlightedIndex}>{s}</th>{/each}</tr></thead>
								<tbody>{#each ['bust_cm','waist_cm','hip_cm'] as key}{@const l = key==='bust_cm'?'Bust':key==='waist_cm'?'Waist':'Hip'}<tr><td class="sz-td-l">{l}</td>{#each bodyRows as row, i}<td class:sz-td-hl={i === highlightedIndex}>{(row as any)[key] ? Number((row as any)[key]) : '—'}</td>{/each}</tr>{/each}</tbody>
							</table>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Fine-tune preferences -->
			{#if !sizeLocked}
				<button type="button" onclick={() => showPreferences = !showPreferences} class="sz-prefs-btn">
					<MessageCircle class="w-4 h-4" strokeWidth={1.5} />
					<span>Fine-tune your fit</span>
					<span class="sz-muted">optional</span>
					<ChevronDown class="w-3.5 h-3.5 ml-auto transition-transform {showPreferences ? 'rotate-180' : ''}" strokeWidth={1.5} />
				</button>

				{#if showPreferences}
					<div class="sz-prefs page-enter">
						<div class="sz-pref-section">
							<span class="sz-pref-label">Overall fit</span>
							<div class="sz-pref-row">
								{#each ['Fitted & close', 'Comfortable ease', 'Loose & relaxed'] as opt}
									<button type="button" onclick={() => fitPreference = fitPreference === opt ? '' : opt}
										class="sz-chip" class:sz-chip-on={fitPreference === opt}>{opt}</button>
								{/each}
							</div>
						</div>
						<div class="sz-pref-section">
							<span class="sz-pref-label">By area</span>
							{#each [{l:'Bust',g:()=>bustPref,s:(v:string)=>bustPref=v,o:['More room','As fitted as possible']},{l:'Waist',g:()=>waistPref,s:(v:string)=>waistPref=v,o:['More room','Defined waist']},{l:'Hip',g:()=>hipPref,s:(v:string)=>hipPref=v,o:['More room','Slim through hip']}] as a}
								<div class="sz-pref-area"><span class="sz-pref-area-lbl">{a.l}</span><div class="sz-pref-row">{#each a.o as opt}<button type="button" onclick={() => a.s(a.g() === opt ? '' : opt)} class="sz-chip sz-chip-sm" class:sz-chip-on={a.g() === opt}>{opt}</button>{/each}</div></div>
							{/each}
						</div>
						<div class="sz-pref-section">
							<span class="sz-pref-label">Length</span>
							<div class="sz-pref-row">{#each ['Shorter','As designed','Longer'] as opt}<button type="button" onclick={() => lengthPref = lengthPref === opt ? '' : opt} class="sz-chip" class:sz-chip-on={lengthPref === opt}>{opt}</button>{/each}</div>
						</div>
						<div class="sz-pref-section">
							<span class="sz-pref-label">Fabric</span>
							<div class="sz-pref-row">{#each ['Woven (no stretch)','Light stretch','Stretch knit'] as opt}<button type="button" onclick={() => fabricStretch = fabricStretch === opt ? '' : opt} class="sz-chip" class:sz-chip-on={fabricStretch === opt}>{opt}</button>{/each}</div>
						</div>
						<button type="button" disabled={!hasPreferences || isRefining} onclick={refineWithPreferences} class="sz-btn w-full">
							{#if isRefining}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Updating...{:else}<RefreshCw class="w-4 h-4" strokeWidth={2} />Update recommendation{/if}
						</button>
					</div>
				{/if}

				<button type="button" onclick={() => { sizeLocked = true; showPreferences = false; }} class="sz-btn-lock w-full">
					<Check class="w-5 h-5" strokeWidth={2.5} />Lock in size {recommendedSize}
				</button>
			{/if}

			<!-- Downloads -->
			{#if sizeLocked}
				<div class="sz-locked">
					<Check class="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
					<div><strong>Size {recommendedSize} confirmed</strong><span class="sz-muted block">Ready to download</span></div>
				</div>

				<div class="sz-downloads">
					<span class="sz-section-label">Download Pattern</span>
					<span class="sz-muted block mb-3">Size {recommendedSize} — single-size PDF</span>
					<div class="sz-dl-grid">
						{#each [{f:'a0',l:'A0',s:'Print shop'},{f:'a4',l:'A4',s:'Home'},{f:'us_letter',l:'US Letter',s:'Home'}] as dl}
							<a href="/api/patterns/single-size?slug={pattern.pattern_slug}&size={recommendedSize}&format={dl.f}" class="sz-dl-btn">
								<Download class="w-4 h-4" strokeWidth={1.5} /><strong>{dl.l}</strong><span>{dl.s}</span>
							</a>
						{/each}
					</div>
				</div>

				{#if hasDxf}
					<button type="button" onclick={() => { showCustomFit = !showCustomFit; if (showCustomFit && !customFitGrading) calculateCustomFit(); }} class="sz-custom-btn">
						<Scissors class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
						<div><strong>Custom-fit pattern</strong><span class="sz-pill sz-pill-violet">Beta</span></div>
						<ChevronDown class="w-4 h-4 ml-auto text-violet-300 transition-transform {showCustomFit ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>

					{#if showCustomFit}
						<div class="sz-custom-panel page-enter">
							{#if customFitLoading && !customFitGrading}
								<div class="sz-custom-loading"><Loader2 class="w-5 h-5 animate-spin text-violet-500" strokeWidth={2} /><span>Calculating...</span></div>
							{:else if customFitGrading}
								<div class="overflow-x-auto mb-4">
									<table class="sz-table"><thead><tr><th></th><th>Pattern ({customFitGrading.sample_size})</th><th class="sz-th-v">Custom</th><th>Delta</th></tr></thead>
										<tbody>{#each [{l:'Bust',s:customFitGrading.sample_finished.bust_cm,c:customFitGrading.custom_finished.bust_cm,d:customFitGrading.adjustments.bust_delta_cm},{l:'Waist',s:customFitGrading.sample_finished.waist_cm,c:customFitGrading.custom_finished.waist_cm,d:customFitGrading.adjustments.waist_delta_cm},{l:'Hip',s:customFitGrading.sample_finished.hip_cm,c:customFitGrading.custom_finished.hip_cm,d:customFitGrading.adjustments.hip_delta_cm},{l:'Length',s:customFitGrading.sample_finished.full_length_cm,c:customFitGrading.custom_finished.full_length_cm,d:customFitGrading.adjustments.length_delta_cm}] as r}
											<tr><td class="sz-td-l">{r.l}</td><td>{r.s !== null ? `${r.s}cm` : '—'}</td><td class="sz-td-v">{r.c !== null ? `${typeof r.c === 'number' ? r.c.toFixed(1) : r.c}cm` : '—'}</td><td class="{r.d && r.d !== 0 ? (r.d > 0 ? 'text-blue-600' : 'text-amber-600') : ''}">{r.d !== null ? `${r.d > 0 ? '+' : ''}${r.d.toFixed(1)}cm` : '—'}</td></tr>
										{/each}</tbody>
									</table>
								</div>
								{#if customFitError}<div class="sz-error-box mb-3">{customFitError}</div>
								{:else}<button type="button" disabled={customFitLoading} onclick={downloadCustomDxf} class="sz-btn-violet w-full">
									{#if customFitLoading}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Generating...{:else}<Download class="w-4 h-4" strokeWidth={2} />Download Custom DXF{/if}
								</button>{/if}
							{/if}
						</div>
					{/if}
				{/if}
			{/if}

			<button type="button" onclick={reset} class="sz-btn-ghost w-full mt-4"><RotateCcw class="w-3.5 h-3.5" strokeWidth={1.5} />Start over</button>
		</div>
	{/if}
</div>

<style>
	.sz-page { max-width: 480px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
	@media (min-width: 768px) { .sz-page { padding: 3rem 2rem 4rem; max-width: 520px; } }
	.sz-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-faint); margin-bottom: 2.5rem; transition: color 0.15s; }
	.sz-back:hover { color: var(--color-rosys-500); }
	.sz-anim { animation: up 0.35s ease-out; }
	@keyframes up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

	/* Hero */
	.sz-hero { text-align: center; margin-bottom: 2.5rem; }
	.sz-hero-icon { width: 56px; height: 56px; border-radius: 18px; margin: 0 auto 1rem; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 30%, transparent); }
	.sz-hero-title { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.1; color: var(--color-rosys-fg); }
	.sz-hero-sub { font-size: 15px; color: var(--color-rosys-fg-muted); margin-top: 0.5rem; }

	/* Paths */
	.sz-paths { display: flex; flex-direction: column; gap: 10px; }
	.sz-path { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 16px; border: 1px solid; text-align: left; width: 100%; cursor: pointer; transition: all 0.15s; }
	.sz-path:active { transform: scale(0.98); }
	.sz-path-main { background: white; border-color: color-mix(in srgb, var(--color-rosys-border) 60%, transparent); }
	.sz-path-main:hover { border-color: var(--color-rosys-300); background: var(--color-rosys-50); }
	.sz-path-alt { background: color-mix(in srgb, white 80%, transparent); border-color: color-mix(in srgb, var(--color-rosys-border) 30%, transparent); opacity: 0.8; }
	.sz-path-alt:hover { opacity: 1; background: white; }
	.sz-path-icon { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--color-rosys-500) 25%, transparent); }
	.sz-path-icon-muted { background: linear-gradient(135deg, #9ca3af, #6b7280); box-shadow: none; }
	.sz-path-text { flex: 1; }
	.sz-path-text strong { display: block; font-size: 16px; color: var(--color-rosys-fg); }
	.sz-path-text span { display: block; font-size: 13px; color: var(--color-rosys-fg-muted); margin-top: 2px; }

	/* Pills */
	.sz-pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; flex-shrink: 0; }
	.sz-pill-green { background: #ecfdf5; color: #059669; }
	.sz-pill-amber { background: #fffbeb; color: #d97706; }
	.sz-pill-violet { background: #f5f3ff; color: #7c3aed; margin-left: 6px; }

	/* Headers */
	.sz-header { display: flex; align-items: center; gap: 14px; margin-bottom: 2rem; }
	.sz-header-icon { width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 25%, transparent); }
	.sz-title { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-rosys-fg); margin: 0; }
	.sz-sub { font-size: 14px; color: var(--color-rosys-fg-muted); margin: 2px 0 0; }

	/* Form */
	.sz-form { display: flex; flex-direction: column; gap: 14px; margin-bottom: 1.5rem; }
	.sz-label { display: block; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg); margin-bottom: 6px; }
	.sz-label-opt { font-weight: 400; color: var(--color-rosys-fg-faint); }
	.sz-input-wrap { position: relative; }
	.sz-input { width: 100%; padding: 14px 50px 14px 18px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 60%, transparent); font-size: 17px; color: var(--color-rosys-fg); background: white; transition: all 0.15s; outline: none; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
	.sz-input::placeholder { color: color-mix(in srgb, var(--color-rosys-fg-faint) 40%, transparent); }
	.sz-input:focus { border-color: var(--color-rosys-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-rosys-400) 12%, transparent); }
	.sz-unit { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--color-rosys-fg-faint); pointer-events: none; }

	/* Buttons */
	.sz-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 24px; border-radius: 16px; font-size: 16px; font-weight: 600; color: white; border: none; cursor: pointer; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: 0 4px 16px -2px color-mix(in srgb, var(--color-rosys-500) 30%, transparent); transition: all 0.15s; }
	.sz-btn:hover { box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 40%, transparent); }
	.sz-btn:active { transform: scale(0.98); }
	.sz-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
	.sz-btn-lock { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 600; color: white; border: none; cursor: pointer; margin-top: 8px; background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 4px 16px -2px rgba(5,150,105,0.3); transition: all 0.15s; }
	.sz-btn-lock:hover { box-shadow: 0 8px 24px -4px rgba(5,150,105,0.4); }
	.sz-btn-lock:active { transform: scale(0.98); }
	.sz-btn-violet { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 14px; font-size: 14px; font-weight: 600; color: white; border: none; cursor: pointer; background: linear-gradient(135deg, #7c3aed, #6d28d9); box-shadow: 0 4px 12px -2px rgba(124,58,237,0.25); transition: all 0.15s; }
	.sz-btn-violet:disabled { opacity: 0.4; cursor: not-allowed; }
	.sz-btn-soft { padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; color: var(--color-rosys-600); background: var(--color-rosys-50); border: none; cursor: pointer; }
	.sz-btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-faint); background: none; border: none; cursor: pointer; }
	.sz-btn-ghost:hover { color: var(--color-rosys-500); }
	.sz-note { text-align: center; font-size: 12px; color: var(--color-rosys-fg-faint); margin-top: 10px; }
	.sz-error { color: var(--color-rosys-500); font-size: 13px; text-align: center; margin-bottom: 12px; }
	.sz-error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px; color: #dc2626; font-size: 13px; }

	/* Steps */
	.sz-steps { display: flex; align-items: center; gap: 6px; margin-bottom: 1.5rem; padding: 12px 16px; border-radius: 12px; background: color-mix(in srgb, var(--color-warm-100) 70%, transparent); }
	.sz-step { display: flex; align-items: center; gap: 6px; flex: 1; }
	.sz-step-dot { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--color-rosys-border) 60%, transparent); color: var(--color-rosys-fg-faint); transition: all 0.3s; }
	.sz-step.done .sz-step-dot { background: #059669; color: white; }
	.sz-step.active .sz-step-dot { background: var(--color-rosys-500); color: white; }
	.sz-step-text { font-size: 11px; font-weight: 500; color: var(--color-rosys-fg-faint); white-space: nowrap; }
	.sz-step.done .sz-step-text, .sz-step.active .sz-step-text { color: var(--color-rosys-fg); }

	/* Badge */
	.sz-badge-reveal { text-align: center; margin-bottom: 1.5rem; animation: pop 0.5s cubic-bezier(0.34,1.56,0.64,1); }
	@keyframes pop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
	.sz-badge { display: inline-flex; flex-direction: column; align-items: center; padding: 20px 40px; border-radius: 20px; background: linear-gradient(145deg, #059669, #047857); box-shadow: 0 12px 32px -8px rgba(5,150,105,0.35); }
	.sz-badge-label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.65); font-weight: 600; }
	.sz-badge-size { font-size: 48px; font-weight: 800; color: white; letter-spacing: -0.04em; line-height: 1; }
	.sz-result-top { text-align: center; margin-bottom: 1.5rem; }
	.sz-size-row { display: flex; justify-content: center; gap: 5px; margin-top: 14px; }
	.sz-pip { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; background: var(--color-warm-100); color: var(--color-rosys-fg-faint); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); transition: all 0.2s; }
	.sz-pip-on { background: #059669; color: white; border-color: #059669; transform: scale(1.15); box-shadow: 0 2px 8px rgba(5,150,105,0.3); }

	/* Between */
	.sz-between { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a40; margin-bottom: 16px; font-size: 13px; color: #92400e; }

	/* Fit cards */
	.sz-fit-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
	.sz-fit-card { padding: 14px 10px; border-radius: 14px; background: white; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent); }
	.sz-fit-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
	.sz-fit-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-rosys-fg-faint); }
	.sz-fit-val { font-size: 22px; font-weight: 700; color: var(--color-rosys-fg); display: block; }
	.sz-fit-val small { font-size: 12px; font-weight: 400; color: var(--color-rosys-fg-faint); margin-left: 1px; }
	.sz-fit-tag { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 6px; text-transform: capitalize; }
	.sz-fit-exact { background: #ecfdf5; color: #059669; }
	.sz-fit-comfortable { background: #eff6ff; color: #2563eb; }
	.sz-fit-tight { background: #fffbeb; color: #d97706; }
	.sz-fit-loose { background: #f5f3ff; color: #7c3aed; }
	.sz-fit-bar { height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--color-rosys-border) 30%, transparent); margin-top: 8px; overflow: hidden; }
	.sz-fit-bar-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
	.sz-fit-bar-exact { background: #059669; }
	.sz-fit-bar-comfortable { background: #2563eb; }
	.sz-fit-bar-tight { background: #d97706; }
	.sz-fit-bar-loose { background: #7c3aed; }

	/* Narrative section cards */
	.sz-narrative { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
	.sz-card-narrative { display: flex; gap: 12px; padding: 16px 18px; border-radius: 14px; background: white; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 35%, transparent); }
	.sz-card-updated { padding: 16px 18px; border-radius: 14px; background: var(--color-rosys-50); border: 1px solid color-mix(in srgb, var(--color-rosys-200) 50%, transparent); }
	.sz-card-changed { padding: 16px 18px; border-radius: 14px; background: white; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 35%, transparent); }
	.sz-card-between { padding: 14px 18px; border-radius: 14px; background: #fffbeb; border: 1px solid #fde68a30; }
	.sz-card-adjust { display: flex; gap: 12px; padding: 16px 18px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe30; }
	.sz-card-tag { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-rosys-fg-faint); margin-bottom: 6px; }
	.sz-card-details { padding: 14px 18px; border-radius: 14px; background: var(--color-warm-50); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 20%, transparent); }
	.sz-card-details summary { font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-muted); cursor: pointer; }
	.sz-card-details[open] summary { margin-bottom: 8px; }

	/* Streaming */
	.sz-stream-sections { display: flex; flex-direction: column; gap: 8px; }
	.sz-section-card { padding: 14px 18px; border-radius: 14px; background: white; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent); }
	.sz-section-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-rosys-fg-faint); margin-bottom: 6px; }
	.sz-thinking { display: flex; align-items: center; justify-content: center; padding: 40px 0; }
	.sz-dots { display: flex; gap: 5px; }
	.sz-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--color-rosys-300); animation: dot 1.4s ease-in-out infinite; }
	.sz-dots span:nth-child(2) { animation-delay: 0.2s; }
	.sz-dots span:nth-child(3) { animation-delay: 0.4s; }
	@keyframes dot { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }
	.sz-cursor { display: inline-block; width: 2px; height: 16px; background: var(--color-rosys-400); border-radius: 1px; margin-left: 2px; animation: blink 0.8s ease infinite; }
	@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

	/* Panels */
	.sz-panels { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
	.sz-panel-trigger { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; background: white; border: none; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg); border-radius: 12px; transition: background 0.15s; text-align: left; }
	.sz-panel-trigger:hover { background: var(--color-warm-50); }
	.sz-panel-body { padding: 0 16px 16px; }

	/* Tables */
	.sz-table { width: 100%; font-size: 12px; border-collapse: collapse; }
	.sz-table th { padding: 6px; text-align: center; font-weight: 500; color: var(--color-rosys-fg-faint); border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); }
	.sz-table td { padding: 6px; text-align: center; color: var(--color-rosys-fg); border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 15%, transparent); }
	.sz-table th:first-child, .sz-table td:first-child { text-align: left; }
	.sz-th-hl { color: #059669 !important; font-weight: 700 !important; }
	.sz-td-hl { color: #059669; font-weight: 600; background: color-mix(in srgb, #059669 5%, transparent); }
	.sz-td-l { color: var(--color-rosys-fg-muted); font-weight: 500; }
	.sz-th-v { color: #7c3aed !important; font-weight: 700 !important; }
	.sz-td-v { color: #7c3aed; font-weight: 600; background: color-mix(in srgb, #7c3aed 5%, transparent); }

	/* Profile */
	.sz-profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.sz-profile-cell { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: 10px; background: var(--color-warm-50); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 25%, transparent); }
	.sz-profile-num { font-size: 18px; font-weight: 700; color: var(--color-rosys-fg); }
	.sz-profile-num small { font-size: 11px; font-weight: 400; color: var(--color-rosys-fg-faint); }
	.sz-profile-lbl { font-size: 10px; color: var(--color-rosys-fg-faint); }

	/* Preferences */
	.sz-prefs-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 16px 18px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--color-rosys-200) 50%, transparent); cursor: pointer; font-size: 14px; font-weight: 600; color: var(--color-rosys-fg); background: linear-gradient(135deg, var(--color-rosys-50), white); transition: all 0.15s; text-align: left; margin-bottom: 12px; }
	.sz-prefs-btn:hover { border-color: var(--color-rosys-300); }
	.sz-prefs { background: white; border-radius: 16px; padding: 20px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent); margin-bottom: 12px; }
	.sz-pref-section { margin-bottom: 16px; }
	.sz-pref-section:last-of-type { margin-bottom: 20px; }
	.sz-pref-label { display: block; font-size: 12px; font-weight: 600; color: var(--color-rosys-fg); margin-bottom: 8px; }
	.sz-pref-row { display: flex; gap: 6px; flex-wrap: wrap; }
	.sz-pref-area { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
	.sz-pref-area-lbl { font-size: 11px; color: var(--color-rosys-fg-muted); width: 40px; flex-shrink: 0; }
	.sz-chip { flex: 1; min-width: 0; padding: 10px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; background: var(--color-warm-50); color: var(--color-rosys-fg-muted); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); text-align: center; }
	.sz-chip:hover { border-color: var(--color-rosys-300); }
	.sz-chip-sm { font-size: 11px; padding: 8px 6px; }
	:global(.sz-chip-on) { background: var(--color-rosys-500) !important; color: white !important; border-color: var(--color-rosys-500) !important; box-shadow: 0 2px 8px -2px color-mix(in srgb, var(--color-rosys-500) 30%, transparent); }

	/* Downloads */
	.sz-locked { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 14px; background: #ecfdf5; border: 1px solid #a7f3d040; margin-bottom: 16px; font-size: 14px; }
	.sz-locked strong { display: block; }
	.sz-downloads { background: white; border-radius: 16px; padding: 20px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); margin-bottom: 16px; }
	.sz-dl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.sz-dl-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px; border-radius: 12px; background: var(--color-rosys-50); border: 1px solid color-mix(in srgb, var(--color-rosys-200) 50%, transparent); color: var(--color-rosys-fg); text-decoration: none; transition: all 0.15s; text-align: center; }
	.sz-dl-btn:hover { background: var(--color-rosys-100); border-color: var(--color-rosys-300); }
	.sz-dl-btn:active { transform: scale(0.96); }
	.sz-dl-btn strong { font-size: 14px; }
	.sz-dl-btn span { font-size: 10px; color: var(--color-rosys-fg-faint); }
	.sz-dl-btn :global(svg) { color: var(--color-rosys-400); }

	/* Custom fit */
	.sz-custom-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 18px 20px; border-radius: 14px; border: 1px solid #ddd6fe50; cursor: pointer; background: linear-gradient(135deg, #f5f3ff, #ede9fe80); transition: all 0.15s; text-align: left; margin-bottom: 12px; }
	.sz-custom-btn:hover { border-color: #c4b5fd; }
	.sz-custom-btn strong { font-size: 14px; color: var(--color-rosys-fg); }
	.sz-custom-panel { background: white; border-radius: 16px; padding: 20px; border: 1px solid #ddd6fe30; margin-bottom: 16px; }
	.sz-custom-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 24px 0; font-size: 14px; color: var(--color-rosys-fg-muted); }

	/* Utils */
	.sz-muted { font-size: 12px; color: var(--color-rosys-fg-faint); font-weight: 400; }

	/* Prose */
	:global(.sz-prose p) { font-size: 14px; line-height: 1.65; color: var(--color-rosys-fg-secondary); margin-bottom: 4px; }
	:global(.sz-prose strong) { color: var(--color-rosys-fg); font-weight: 600; }
	:global(.sz-prose ul) { list-style: none; padding: 0; margin: 0; }
	:global(.sz-prose li) { font-size: 14px; line-height: 1.65; color: var(--color-rosys-fg-secondary); padding: 5px 0; border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 15%, transparent); }
	:global(.sz-prose li:last-child) { border-bottom: none; }
</style>
