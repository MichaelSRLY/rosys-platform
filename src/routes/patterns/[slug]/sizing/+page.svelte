<script context="module" lang="ts">
	function renderMarkdown(text: string): string {
		return text
			.replace(/^## (.+)$/gm, '<h2>$1</h2>')
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/^- (.+)$/gm, '<li>$1</li>')
			.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
			.replace(/<\/ul>\s*<ul>/g, '')
			.replace(/^(?!<[hul])((?!<\/[hul]).+)$/gm, '<p>$1</p>')
			.replace(/\n\n+/g, '\n');
	}
</script>

<script lang="ts">
	import { ArrowLeft, Ruler, Sparkles, Loader2, Check, Download, Camera, ChevronDown, Zap, RotateCcw, RefreshCw, Scissors, MessageCircle } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, chart, rawSizeChart, savedProfile } = data;

	const sizes = chart?.sizes ?? [];
	const bodyRows = chart?.body ?? [];
	const hasChart = sizes.length > 0;

	type Phase = 'entry' | 'measurements' | 'photo' | 'body-profile' | 'analyzing' | 'results';

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

	// Analysis step tracking
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

				let eventType = '';
				let eventData = '';

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
						if (isRefining) {
							refinedText += payload;
						} else {
							streamedText += payload;
						}
					} else if (eventType === 'error') {
						errorMsg = payload.message;
					} else if (eventType === 'done') {
						// handled after loop
					}
				} catch {}
			}
		}
	}

	function startAnalysis() {
		analysisStep = 1;
		phase = 'analyzing';
		isStreaming = true;
		streamedText = '';
		errorMsg = '';
		startStreaming();
	}

	async function startStreaming() {
		try {
			const res = await fetch('/api/ai/size-intelligence/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pattern_slug: pattern.pattern_slug,
					bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip),
					height: height ? parseFloat(height) : undefined,
					source: 'tape_measure'
				})
			});

			if (!res.ok) { errorMsg = 'Something went wrong.'; isStreaming = false; return; }
			await consumeStream(res);
		} catch (e: any) {
			errorMsg = e.message || 'Connection failed.';
		} finally {
			isStreaming = false;
			if (!errorMsg) phase = 'results';
		}
	}

	async function refineWithPreferences() {
		if (!hasPreferences) return;
		isRefining = true;
		refinedText = '';
		errorMsg = '';

		try {
			const res = await fetch('/api/ai/size-intelligence/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pattern_slug: pattern.pattern_slug,
					bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip),
					height: height ? parseFloat(height) : undefined,
					source: 'tape_measure',
					preferences: {
						fit_preference: fitPreference || undefined,
						bust_preference: bustPref || undefined,
						waist_preference: waistPref || undefined,
						hip_preference: hipPref || undefined,
						length_preference: lengthPref || undefined,
						fabric_stretch: fabricStretch || undefined,
					},
					previous_recommendation: streamedText || undefined,
				})
			});

			if (!res.ok) { errorMsg = 'Refinement failed.'; isRefining = false; return; }
			await consumeStream(res);
		} catch (e: any) {
			errorMsg = e.message || 'Connection failed.';
		} finally {
			isRefining = false;
		}
	}

	async function calculateCustomFit() {
		customFitLoading = true;
		customFitError = '';
		customFitGrading = null;

		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip) })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
			const json = await res.json();
			customFitGrading = json.grading;
			customFitError = json.error || '';
		} catch (e: any) {
			customFitError = e.message || 'Could not calculate.';
		} finally {
			customFitLoading = false;
		}
	}

	async function downloadCustomDxf() {
		customFitLoading = true;
		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), generate: true })
			});
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob();
			const cd = res.headers.get('content-disposition');
			const filename = cd?.match(/filename="(.+)"/)?.[1] || `${pattern.pattern_slug}-custom.dxf`;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url; a.download = filename; a.click();
			URL.revokeObjectURL(url);
		} catch (e: any) {
			customFitError = e.message;
		} finally {
			customFitLoading = false;
		}
	}

	function reset() {
		phase = 'entry';
		deterministicResult = null;
		streamedText = '';
		refinedText = '';
		profile = null;
		chartData = null;
		errorMsg = '';
		showPreferences = false;
		sizeLocked = false;
		showCustomFit = false;
		customFitGrading = null;
		analysisStep = 0;
		fitPreference = bustPref = waistPref = hipPref = lengthPref = fabricStretch = '';
	}

	$effect(() => {
		if (savedProfile && bust && waist && hip) phase = 'measurements';
	});
</script>

<svelte:head>
	<title>Find Your Size — {pattern.pattern_name}</title>
</svelte:head>

<div class="sz-page">

	<a href="/patterns/{pattern.pattern_slug}" class="sz-back">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<!-- ═══ ENTRY ═══ -->
	{#if phase === 'entry'}
		<div class="sz-enter">
			<div class="sz-hero">
				<div class="sz-hero-badge">
					<Sparkles class="w-7 h-7" strokeWidth={1.5} />
				</div>
				<h1 class="sz-hero-title">Find Your<br />Perfect Size</h1>
				<p class="sz-hero-sub">{pattern.pattern_name}</p>
			</div>

			<div class="sz-paths">
				<button type="button" onclick={() => phase = 'measurements'} class="sz-path-card sz-path-primary">
					<div class="sz-path-icon"><Ruler class="w-5 h-5" strokeWidth={1.5} /></div>
					<div class="sz-path-content">
						<span class="sz-path-title">Measure yourself</span>
						<span class="sz-path-desc">Bust, waist, hip & height</span>
					</div>
					<span class="sz-badge-green">Accurate</span>
				</button>

				<button type="button" onclick={() => phase = 'photo'} class="sz-path-card sz-path-secondary">
					<div class="sz-path-icon sz-path-icon-muted"><Camera class="w-5 h-5" strokeWidth={1.5} /></div>
					<div class="sz-path-content">
						<span class="sz-path-title">Upload a photo</span>
						<span class="sz-path-desc">AI body estimation</span>
					</div>
					<span class="sz-badge-amber">Beta</span>
				</button>
			</div>
		</div>

	<!-- ═══ PHOTO ═══ -->
	{:else if phase === 'photo'}
		<div class="sz-enter">
			<h1 class="sz-section-title">Photo Measurement</h1>
			<p class="sz-section-desc mb-6">
				Use our <a href="/profile/measurements/photo" class="text-rosys-500 underline">photo tool</a> to estimate measurements, then return here.
			</p>
			<button type="button" onclick={() => phase = 'measurements'} class="sz-btn-outline w-full">Use tape measure instead</button>
		</div>

	<!-- ═══ MEASUREMENTS ═══ -->
	{:else if phase === 'measurements'}
		<div class="sz-enter">
			<div class="sz-section-header">
				<div class="sz-section-icon"><Ruler class="w-5 h-5" strokeWidth={1.5} /></div>
				<div>
					<h1 class="sz-section-title">Your Measurements</h1>
					<p class="sz-section-desc">Soft tape — snug but not tight</p>
				</div>
			</div>

			<div class="sz-form">
				{#each [
					{ id: 'bust', label: 'Bust', ph: '88', get: () => bust, set: (v: string) => bust = v },
					{ id: 'waist', label: 'Waist', ph: '72', get: () => waist, set: (v: string) => waist = v },
					{ id: 'hip', label: 'Hip', ph: '92', get: () => hip, set: (v: string) => hip = v },
					{ id: 'height', label: 'Height', ph: '168', get: () => height, set: (v: string) => height = v, opt: true },
				] as f}
					<div class="sz-field">
						<label for={f.id} class="sz-label">
							{f.label}{#if f.opt}<span class="sz-label-opt"> (optional)</span>{/if}
						</label>
						<div class="sz-input-wrap">
							<input id={f.id} type="number" inputmode="numeric" placeholder={f.ph} value={f.get()} oninput={(e) => f.set((e.target as HTMLInputElement).value)} class="sz-input" />
							<span class="sz-input-unit">cm</span>
						</div>
					</div>
				{/each}
			</div>

			{#if errorMsg}<p class="sz-error">{errorMsg}</p>{/if}

			<button type="button" disabled={!canSubmit} onclick={startAnalysis} class="sz-btn-primary w-full">
				<Sparkles class="w-5 h-5" strokeWidth={2} />
				Analyze my fit
			</button>

			{#if savedProfile}
				<p class="sz-saved-note"><Check class="w-3 h-3 inline text-emerald-500" strokeWidth={2} /> Saved measurements loaded</p>
			{/if}

			<button type="button" onclick={() => phase = 'entry'} class="sz-btn-ghost w-full mt-2">
				<ArrowLeft class="w-3.5 h-3.5" strokeWidth={1.5} /> Back
			</button>
		</div>

	<!-- ═══ ANALYZING ═══ -->
	{:else if phase === 'analyzing'}
		<div class="sz-enter">
			<!-- Analysis progress -->
			<div class="sz-analysis-container">
				<!-- Steps indicator -->
				<div class="sz-steps">
					{#each [
						{ label: 'Matching sizes', done: analysisStep >= 2 },
						{ label: 'Body profile', done: analysisStep >= 2 },
						{ label: 'AI analysis', done: !isStreaming && analysisStep >= 3 },
					] as step, i}
						<div class="sz-step" class:sz-step-done={step.done} class:sz-step-active={!step.done && analysisStep >= i + 1}>
							<div class="sz-step-dot">
								{#if step.done}
									<Check class="w-3 h-3" strokeWidth={3} />
								{:else if !step.done && analysisStep >= i + 1}
									<Loader2 class="w-3 h-3 animate-spin" strokeWidth={2.5} />
								{/if}
							</div>
							<span class="sz-step-label">{step.label}</span>
						</div>
					{/each}
				</div>

				<!-- Size badge (appears with deterministic result) -->
				{#if recommendedSize}
					<div class="sz-size-reveal">
						<div class="sz-size-badge">
							<span class="sz-size-pattern">{deterministicResult?.pattern_name}</span>
							<span class="sz-size-value">{recommendedSize}</span>
						</div>
					</div>
				{/if}

				<!-- Streaming AI text -->
				<div class="sz-stream-container">
					{#if streamedText}
						<div class="sz-prose">{@html renderMarkdown(streamedText)}</div>
					{:else if !errorMsg}
						<div class="sz-thinking">
							<div class="sz-thinking-dots">
								<span></span><span></span><span></span>
							</div>
						</div>
					{/if}
					{#if isStreaming}<span class="sz-cursor"></span>{/if}
				</div>

				{#if errorMsg}<div class="sz-error-card">{errorMsg}</div>{/if}
			</div>
		</div>

	<!-- ═══ RESULTS ═══ -->
	{:else if phase === 'results'}
		<div class="sz-enter">

			<!-- Size hero -->
			{#if recommendedSize}
				<div class="sz-result-hero">
					<div class="sz-result-badge">
						<span class="sz-result-pattern">{deterministicResult?.pattern_name}</span>
						<span class="sz-result-size">{recommendedSize}</span>
					</div>
					<div class="sz-size-strip">
						{#each (chartData?.sizes ?? sizes).length > 0 ? (chartData?.sizes ?? sizes) : ['XXS','XS','S','M','L','XL','XXL'] as s}
							<span class="sz-size-pip" class:sz-size-pip-active={s === recommendedSize}>{s}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Between sizes -->
			{#if deterministicResult?.between_sizes}
				<div class="sz-between">
					<span class="sz-between-icon">↕</span>
					<span>Between <strong>{deterministicResult.lower_size}</strong> and <strong>{deterministicResult.upper_size}</strong></span>
				</div>
			{/if}

			<!-- AI Analysis -->
			<div class="sz-card sz-card-analysis">
				<div class="sz-prose">{@html renderMarkdown(refinedText || streamedText)}</div>
			</div>

			<!-- Fit summary strip -->
			{#if deterministicResult?.fit}
				<div class="sz-fit-strip">
					{#each [
						{ label: 'Bust', d: deterministicResult.fit.bust },
						{ label: 'Waist', d: deterministicResult.fit.waist },
						{ label: 'Hip', d: deterministicResult.fit.hip },
					] as { label, d }}
						{#if d}
							<div class="sz-fit-item">
								<span class="sz-fit-label">{label}</span>
								<span class="sz-fit-value">{d.user_cm}</span>
								<span class="sz-fit-tag sz-fit-{d.fit}">{d.fit}</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- Expandable sections -->
			<div class="sz-expandables">
				<!-- Finished measurements -->
				{#if chartData?.finished?.length > 0}
					<button type="button" onclick={() => showFinished = !showFinished} class="sz-expand-trigger">
						<Ruler class="w-4 h-4 text-rosys-400" strokeWidth={1.5} />
						<span>Finished garment measurements</span>
						<ChevronDown class="w-3.5 h-3.5 text-rosys-fg-faint transition-transform {showFinished ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showFinished}
						<div class="sz-expand-content page-enter">
							<div class="overflow-x-auto">
								<table class="sz-table">
									<thead><tr>
										<th></th>
										{#each chartData.sizes as s, i}<th class:sz-th-active={i === highlightedIndex}>{s}</th>{/each}
									</tr></thead>
									<tbody>
										{#each [
											{ key: 'bust_cm', label: 'Bust' }, { key: 'waist_cm', label: 'Waist' },
											{ key: 'hip_cm', label: 'Hip' }, { key: 'full_length_cm', label: 'Length' },
											{ key: 'sleeve_length_cm', label: 'Sleeve' },
										] as col}
											{@const hasData = chartData.finished.some((r: any) => r[col.key])}
											{#if hasData}
												<tr>
													<td class="sz-td-label">{col.label}</td>
													{#each chartData.finished as row, i}
														<td class:sz-td-active={i === highlightedIndex}>{row[col.key] ? Number(row[col.key]) : '—'}</td>
													{/each}
												</tr>
											{/if}
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				{/if}

				<!-- Body profile -->
				{#if profile}
					<button type="button" onclick={() => showProfile = !showProfile} class="sz-expand-trigger">
						<Zap class="w-4 h-4 text-violet-400" strokeWidth={1.5} />
						<span>Body profile <span class="sz-subtle">· predicted from 59K records</span></span>
						<ChevronDown class="w-3.5 h-3.5 text-rosys-fg-faint transition-transform {showProfile ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showProfile}
						<div class="sz-expand-content page-enter">
							<div class="sz-profile-grid">
								{#each [
									{ label: 'Shoulder', value: profile.shoulder_cm, u: 'cm' },
									{ label: 'Arm length', value: profile.arm_length_cm, u: 'cm' },
									{ label: 'Arm circ.', value: profile.arm_circ_cm, u: 'cm' },
									{ label: 'Leg length', value: profile.leg_length_cm, u: 'cm' },
									{ label: 'Weight', value: profile.weight_kg, u: 'kg' },
									{ label: 'Neck', value: profile.neck_cm, u: 'cm' },
								] as m}
									{#if m.value}
										<div class="sz-profile-item">
											<span class="sz-profile-val">{m.value}<span class="sz-profile-unit">{m.u}</span></span>
											<span class="sz-profile-label">{m.label}</span>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				<!-- Size chart reference -->
				{#if hasChart}
					<button type="button" onclick={() => showChart = !showChart} class="sz-expand-trigger">
						<span class="w-4 h-4 text-rosys-fg-faint text-[12px] font-bold">#</span>
						<span>Body size chart</span>
						<ChevronDown class="w-3.5 h-3.5 text-rosys-fg-faint transition-transform {showChart ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showChart}
						<div class="sz-expand-content page-enter overflow-x-auto">
							<table class="sz-table">
								<thead><tr>
									<th></th>
									{#each sizes as s, i}<th class:sz-th-active={i === highlightedIndex}>{s}</th>{/each}
								</tr></thead>
								<tbody>
									{#each ['bust_cm','waist_cm','hip_cm'] as key}
										{@const label = key === 'bust_cm' ? 'Bust' : key === 'waist_cm' ? 'Waist' : 'Hip'}
										<tr>
											<td class="sz-td-label">{label}</td>
											{#each bodyRows as row, i}<td class:sz-td-active={i === highlightedIndex}>{(row as any)[key] ? Number((row as any)[key]) : '—'}</td>{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Preferences -->
			{#if !sizeLocked}
				<button type="button" onclick={() => showPreferences = !showPreferences} class="sz-prefs-trigger">
					<MessageCircle class="w-4 h-4" strokeWidth={1.5} />
					<span>Fine-tune your fit</span>
					<span class="sz-subtle">optional</span>
					<ChevronDown class="w-3.5 h-3.5 ml-auto transition-transform {showPreferences ? 'rotate-180' : ''}" strokeWidth={1.5} />
				</button>

				{#if showPreferences}
					<div class="sz-prefs-panel page-enter">
						<div class="sz-pref-group">
							<span class="sz-pref-title">Overall fit</span>
							<div class="sz-pref-opts">
								{#each ['Fitted & close', 'Comfortable ease', 'Loose & relaxed'] as opt}
									<button type="button" onclick={() => fitPreference = fitPreference === opt ? '' : opt}
										class="sz-pref-btn" class:sz-pref-active={fitPreference === opt}>{opt}</button>
								{/each}
							</div>
						</div>

						<div class="sz-pref-group">
							<span class="sz-pref-title">By area</span>
							{#each [
								{ label: 'Bust', get: () => bustPref, set: (v: string) => bustPref = v, opts: ['More room', 'As fitted as possible'] },
								{ label: 'Waist', get: () => waistPref, set: (v: string) => waistPref = v, opts: ['More room', 'Defined waist'] },
								{ label: 'Hip', get: () => hipPref, set: (v: string) => hipPref = v, opts: ['More room', 'Slim through hip'] },
							] as area}
								<div class="sz-pref-area">
									<span class="sz-pref-area-label">{area.label}</span>
									<div class="sz-pref-opts">
										{#each area.opts as opt}
											<button type="button" onclick={() => area.set(area.get() === opt ? '' : opt)}
												class="sz-pref-btn sz-pref-btn-sm" class:sz-pref-active={area.get() === opt}>{opt}</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>

						<div class="sz-pref-group">
							<span class="sz-pref-title">Length</span>
							<div class="sz-pref-opts">
								{#each ['Shorter', 'As designed', 'Longer'] as opt}
									<button type="button" onclick={() => lengthPref = lengthPref === opt ? '' : opt}
										class="sz-pref-btn" class:sz-pref-active={lengthPref === opt}>{opt}</button>
								{/each}
							</div>
						</div>

						<div class="sz-pref-group">
							<span class="sz-pref-title">Fabric</span>
							<div class="sz-pref-opts">
								{#each ['Woven (no stretch)', 'Light stretch', 'Stretch knit'] as opt}
									<button type="button" onclick={() => fabricStretch = fabricStretch === opt ? '' : opt}
										class="sz-pref-btn" class:sz-pref-active={fabricStretch === opt}>{opt}</button>
								{/each}
							</div>
						</div>

						<button type="button" disabled={!hasPreferences || isRefining} onclick={refineWithPreferences} class="sz-btn-primary w-full">
							{#if isRefining}
								<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Re-analyzing...
							{:else}
								<RefreshCw class="w-4 h-4" strokeWidth={2} />Update recommendation
							{/if}
						</button>
					</div>

					{#if refinedText && !isRefining}
						<div class="sz-card sz-card-refined page-enter">
							<span class="sz-card-label">Updated Analysis</span>
							<div class="sz-prose">{@html renderMarkdown(refinedText)}</div>
						</div>
					{/if}
				{/if}

				<button type="button" onclick={() => { sizeLocked = true; showPreferences = false; }} class="sz-btn-lock">
					<Check class="w-5 h-5" strokeWidth={2.5} />
					Lock in size {recommendedSize}
				</button>
			{/if}

			<!-- Downloads -->
			{#if sizeLocked}
				<div class="sz-locked-banner">
					<Check class="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
					<div>
						<strong>Size {recommendedSize} locked</strong>
						<span class="sz-subtle block">Ready to download</span>
					</div>
				</div>

				<div class="sz-downloads">
					<span class="sz-downloads-title">Download Pattern</span>
					<span class="sz-downloads-sub">Size {recommendedSize} — single-size PDF</span>
					<div class="sz-download-grid">
						{#each [
							{ format: 'a0', label: 'A0', sub: 'Print shop' },
							{ format: 'a4', label: 'A4', sub: 'Home printer' },
							{ format: 'us_letter', label: 'US Letter', sub: 'Home printer' }
						] as dl}
							<a href="/api/patterns/single-size?slug={pattern.pattern_slug}&size={recommendedSize}&format={dl.format}" class="sz-download-btn">
								<Download class="w-4 h-4" strokeWidth={1.5} />
								<strong>{dl.label}</strong>
								<span>{dl.sub}</span>
							</a>
						{/each}
					</div>
				</div>

				<!-- Custom fit -->
				{#if hasDxf}
					<button type="button" onclick={() => { showCustomFit = !showCustomFit; if (showCustomFit && !customFitGrading) calculateCustomFit(); }} class="sz-custom-trigger">
						<div class="sz-custom-trigger-inner">
							<Scissors class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
							<div>
								<strong>Custom-fit pattern</strong>
								<span class="sz-badge-violet">Beta</span>
							</div>
						</div>
						<ChevronDown class="w-4 h-4 text-violet-300 transition-transform {showCustomFit ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>

					{#if showCustomFit}
						<div class="sz-custom-panel page-enter">
							{#if customFitLoading && !customFitGrading}
								<div class="sz-custom-loading">
									<Loader2 class="w-5 h-5 animate-spin text-violet-500" strokeWidth={2} />
									<span>Calculating custom fit...</span>
								</div>
							{:else if customFitGrading}
								<div class="overflow-x-auto mb-4">
									<table class="sz-table">
										<thead><tr>
											<th></th>
											<th>Pattern ({customFitGrading.sample_size})</th>
											<th class="sz-th-violet">Your custom</th>
											<th>Change</th>
										</tr></thead>
										<tbody>
											{#each [
												{ label: 'Bust', s: customFitGrading.sample_finished.bust_cm, c: customFitGrading.custom_finished.bust_cm, d: customFitGrading.adjustments.bust_delta_cm },
												{ label: 'Waist', s: customFitGrading.sample_finished.waist_cm, c: customFitGrading.custom_finished.waist_cm, d: customFitGrading.adjustments.waist_delta_cm },
												{ label: 'Hip', s: customFitGrading.sample_finished.hip_cm, c: customFitGrading.custom_finished.hip_cm, d: customFitGrading.adjustments.hip_delta_cm },
												{ label: 'Length', s: customFitGrading.sample_finished.full_length_cm, c: customFitGrading.custom_finished.full_length_cm, d: customFitGrading.adjustments.length_delta_cm },
											] as row}
												<tr>
													<td class="sz-td-label">{row.label}</td>
													<td>{row.s !== null ? `${row.s}cm` : '—'}</td>
													<td class="sz-td-violet">{row.c !== null ? `${typeof row.c === 'number' ? row.c.toFixed(1) : row.c}cm` : '—'}</td>
													<td class="{row.d && row.d !== 0 ? (row.d > 0 ? 'text-blue-600' : 'text-amber-600') : ''}">{row.d !== null ? `${row.d > 0 ? '+' : ''}${row.d.toFixed(1)}cm` : '—'}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<div class="flex items-center gap-2 mb-4">
									<span class="sz-confidence-tag sz-confidence-{customFitGrading.confidence}">{customFitGrading.confidence}</span>
									<span class="sz-subtle">Scale: {((customFitGrading.scale_width-1)*100).toFixed(1)}% W · {((customFitGrading.scale_height-1)*100).toFixed(1)}% H</span>
								</div>

								{#if customFitGrading.warnings.length > 0}
									{#each customFitGrading.warnings as warning}
										<div class="sz-warning mb-2">⚠ {warning}</div>
									{/each}
								{/if}

								{#if customFitError}
									<div class="sz-error-card mb-3">{customFitError}</div>
								{:else}
									<button type="button" disabled={customFitLoading} onclick={downloadCustomDxf} class="sz-btn-violet w-full">
										{#if customFitLoading}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Generating...
										{:else}<Download class="w-4 h-4" strokeWidth={2} />Download Custom DXF{/if}
									</button>
								{/if}

								<p class="sz-subtle mt-3 text-[11px] leading-relaxed">
									Proportionally scaled from base pattern. Validated within ±1mm.
								</p>
							{/if}
						</div>
					{/if}
				{/if}
			{/if}

			<button type="button" onclick={reset} class="sz-btn-ghost w-full mt-4">
				<RotateCcw class="w-3.5 h-3.5" strokeWidth={1.5} />
				Start over
			</button>
		</div>
	{/if}
</div>

<style>
	/* ─── Page Shell ─── */
	.sz-page { max-width: 480px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
	@media (min-width: 768px) { .sz-page { padding: 3rem 2rem 4rem; max-width: 520px; } }

	.sz-back {
		display: inline-flex; align-items: center; gap: 6px;
		font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-faint);
		margin-bottom: 2.5rem; transition: color 0.15s;
	}
	.sz-back:hover { color: var(--color-rosys-500); }

	.sz-enter { animation: fadeUp 0.35s ease-out; }
	@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

	/* ─── Hero ─── */
	.sz-hero { text-align: center; margin-bottom: 2.5rem; }
	.sz-hero-badge {
		width: 56px; height: 56px; border-radius: 18px; margin: 0 auto 1rem;
		background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600));
		display: flex; align-items: center; justify-content: center; color: white;
		box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 30%, transparent);
	}
	.sz-hero-title {
		font-size: 32px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.1;
		color: var(--color-rosys-fg);
	}
	.sz-hero-sub { font-size: 15px; color: var(--color-rosys-fg-muted); margin-top: 0.5rem; }

	/* ─── Entry paths ─── */
	.sz-paths { display: flex; flex-direction: column; gap: 10px; }
	.sz-path-card {
		display: flex; align-items: center; gap: 14px; padding: 18px 20px;
		border-radius: 16px; border: 1px solid; text-align: left; width: 100%;
		transition: all 0.15s; cursor: pointer;
	}
	.sz-path-card:active { transform: scale(0.98); }
	.sz-path-primary { background: white; border-color: color-mix(in srgb, var(--color-rosys-border) 60%, transparent); }
	.sz-path-primary:hover { border-color: var(--color-rosys-300); background: var(--color-rosys-50); }
	.sz-path-secondary { background: color-mix(in srgb, white 80%, transparent); border-color: color-mix(in srgb, var(--color-rosys-border) 30%, transparent); opacity: 0.8; }
	.sz-path-secondary:hover { opacity: 1; background: white; }
	.sz-path-icon {
		width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
		background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600));
		display: flex; align-items: center; justify-content: center; color: white;
		box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--color-rosys-500) 25%, transparent);
	}
	.sz-path-icon-muted { background: linear-gradient(135deg, #9ca3af, #6b7280); box-shadow: none; }
	.sz-path-content { flex: 1; min-width: 0; }
	.sz-path-title { display: block; font-size: 16px; font-weight: 600; color: var(--color-rosys-fg); }
	.sz-path-desc { display: block; font-size: 13px; color: var(--color-rosys-fg-muted); margin-top: 2px; }

	/* ─── Badges ─── */
	.sz-badge-green { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: #ecfdf5; color: #059669; flex-shrink: 0; }
	.sz-badge-amber { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: #fffbeb; color: #d97706; flex-shrink: 0; }
	.sz-badge-violet { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: #f5f3ff; color: #7c3aed; margin-left: 6px; }

	/* ─── Section headers ─── */
	.sz-section-header { display: flex; align-items: center; gap: 14px; margin-bottom: 2rem; }
	.sz-section-icon {
		width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
		background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600));
		display: flex; align-items: center; justify-content: center; color: white;
		box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 25%, transparent);
	}
	.sz-section-title { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-rosys-fg); margin: 0; }
	.sz-section-desc { font-size: 14px; color: var(--color-rosys-fg-muted); margin: 2px 0 0; }

	/* ─── Form ─── */
	.sz-form { display: flex; flex-direction: column; gap: 14px; margin-bottom: 1.5rem; }
	.sz-field {}
	.sz-label { display: block; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg); margin-bottom: 6px; }
	.sz-label-opt { font-weight: 400; color: var(--color-rosys-fg-faint); }
	.sz-input-wrap { position: relative; }
	.sz-input {
		width: 100%; padding: 14px 50px 14px 18px; border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--color-rosys-border) 60%, transparent);
		font-size: 17px; color: var(--color-rosys-fg); background: white;
		transition: all 0.15s; outline: none;
		box-shadow: 0 1px 3px rgba(0,0,0,0.03);
	}
	.sz-input::placeholder { color: color-mix(in srgb, var(--color-rosys-fg-faint) 40%, transparent); }
	.sz-input:focus { border-color: var(--color-rosys-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-rosys-400) 12%, transparent); }
	.sz-input-unit { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--color-rosys-fg-faint); pointer-events: none; }

	/* ─── Buttons ─── */
	.sz-btn-primary {
		display: inline-flex; align-items: center; justify-content: center; gap: 8px;
		padding: 16px 24px; border-radius: 16px; font-size: 16px; font-weight: 600;
		color: white; border: none; cursor: pointer;
		background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600));
		box-shadow: 0 4px 16px -2px color-mix(in srgb, var(--color-rosys-500) 30%, transparent);
		transition: all 0.15s;
	}
	.sz-btn-primary:hover { box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 40%, transparent); }
	.sz-btn-primary:active { transform: scale(0.98); }
	.sz-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }

	.sz-btn-lock {
		display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
		padding: 16px 24px; border-radius: 16px; font-size: 16px; font-weight: 600;
		color: white; border: none; cursor: pointer; margin-top: 8px;
		background: linear-gradient(135deg, #059669, #047857);
		box-shadow: 0 4px 16px -2px rgba(5, 150, 105, 0.3);
		transition: all 0.15s;
	}
	.sz-btn-lock:hover { box-shadow: 0 8px 24px -4px rgba(5, 150, 105, 0.4); }
	.sz-btn-lock:active { transform: scale(0.98); }

	.sz-btn-violet {
		display: inline-flex; align-items: center; justify-content: center; gap: 8px;
		padding: 14px 20px; border-radius: 14px; font-size: 14px; font-weight: 600;
		color: white; border: none; cursor: pointer;
		background: linear-gradient(135deg, #7c3aed, #6d28d9);
		box-shadow: 0 4px 12px -2px rgba(124, 58, 237, 0.25);
		transition: all 0.15s;
	}
	.sz-btn-violet:hover { box-shadow: 0 6px 16px -2px rgba(124, 58, 237, 0.35); }
	.sz-btn-violet:active { transform: scale(0.98); }
	.sz-btn-violet:disabled { opacity: 0.4; cursor: not-allowed; }

	.sz-btn-outline {
		padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 600;
		color: var(--color-rosys-600); background: var(--color-rosys-50);
		border: none; cursor: pointer; transition: all 0.15s;
	}
	.sz-btn-outline:hover { background: var(--color-rosys-100); }

	.sz-btn-ghost {
		display: inline-flex; align-items: center; justify-content: center; gap: 6px;
		padding: 10px; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-faint);
		background: none; border: none; cursor: pointer; transition: color 0.15s;
	}
	.sz-btn-ghost:hover { color: var(--color-rosys-500); }

	.sz-saved-note { text-align: center; font-size: 12px; color: var(--color-rosys-fg-faint); margin-top: 10px; }
	.sz-error { color: var(--color-rosys-500); font-size: 13px; text-align: center; margin-bottom: 12px; }
	.sz-error-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 16px; color: #dc2626; font-size: 13px; }

	/* ─── Analysis progress ─── */
	.sz-analysis-container { }

	.sz-steps {
		display: flex; align-items: center; gap: 6px; margin-bottom: 2rem;
		padding: 12px 16px; border-radius: 12px;
		background: color-mix(in srgb, var(--color-warm-100) 70%, transparent);
	}
	.sz-step { display: flex; align-items: center; gap: 6px; flex: 1; }
	.sz-step-dot {
		width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
		display: flex; align-items: center; justify-content: center;
		background: color-mix(in srgb, var(--color-rosys-border) 60%, transparent);
		color: var(--color-rosys-fg-faint); transition: all 0.3s;
	}
	.sz-step-done .sz-step-dot { background: #059669; color: white; }
	.sz-step-active .sz-step-dot { background: var(--color-rosys-500); color: white; }
	.sz-step-label { font-size: 11px; font-weight: 500; color: var(--color-rosys-fg-faint); white-space: nowrap; }
	.sz-step-done .sz-step-label { color: var(--color-rosys-fg); }
	.sz-step-active .sz-step-label { color: var(--color-rosys-fg); }

	/* ─── Size reveal ─── */
	.sz-size-reveal { text-align: center; margin-bottom: 1.5rem; animation: sizeReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
	@keyframes sizeReveal { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }

	.sz-size-badge, .sz-result-badge {
		display: inline-flex; flex-direction: column; align-items: center;
		padding: 20px 40px; border-radius: 20px;
		background: linear-gradient(145deg, #059669, #047857);
		box-shadow: 0 12px 32px -8px rgba(5, 150, 105, 0.35);
	}
	.sz-size-pattern, .sz-result-pattern { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.65); font-weight: 600; }
	.sz-size-value, .sz-result-size { font-size: 48px; font-weight: 800; color: white; letter-spacing: -0.04em; line-height: 1; }
	.sz-result-hero { text-align: center; margin-bottom: 1.5rem; }

	.sz-size-strip { display: flex; justify-content: center; gap: 5px; margin-top: 14px; }
	.sz-size-pip {
		width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
		font-size: 10px; font-weight: 600; transition: all 0.2s;
		background: var(--color-warm-100); color: var(--color-rosys-fg-faint); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent);
	}
	.sz-size-pip-active { background: #059669; color: white; border-color: #059669; transform: scale(1.15); box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3); }

	/* ─── Between sizes ─── */
	.sz-between {
		display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px;
		background: #fffbeb; border: 1px solid #fde68a40; margin-bottom: 16px;
		font-size: 13px; color: #92400e;
	}
	.sz-between-icon { font-size: 18px; }

	/* ─── Cards ─── */
	.sz-card {
		background: white; border-radius: 16px; padding: 20px;
		border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent);
		box-shadow: 0 1px 4px rgba(0,0,0,0.03); margin-bottom: 16px;
	}
	.sz-card-analysis { }
	.sz-card-refined { background: var(--color-rosys-50); border-color: color-mix(in srgb, var(--color-rosys-200) 50%, transparent); }
	.sz-card-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-rosys-500); margin-bottom: 12px; }

	/* ─── Streaming ─── */
	.sz-stream-container {
		background: white; border-radius: 16px; padding: 20px;
		border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent);
		box-shadow: 0 1px 4px rgba(0,0,0,0.03);
		max-height: 55vh; overflow-y: auto;
	}
	.sz-thinking { display: flex; align-items: center; justify-content: center; padding: 32px 0; }
	.sz-thinking-dots { display: flex; gap: 5px; }
	.sz-thinking-dots span {
		width: 6px; height: 6px; border-radius: 50%; background: var(--color-rosys-300);
		animation: dotPulse 1.4s ease-in-out infinite;
	}
	.sz-thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
	.sz-thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
	@keyframes dotPulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }

	.sz-cursor { display: inline-block; width: 2px; height: 16px; background: var(--color-rosys-400); border-radius: 1px; margin-left: 2px; animation: cursorBlink 0.8s ease infinite; }
	@keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

	/* ─── Fit strip ─── */
	.sz-fit-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
	.sz-fit-item {
		display: flex; flex-direction: column; align-items: center; gap: 2px;
		padding: 12px 8px; border-radius: 12px; background: white;
		border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent);
	}
	.sz-fit-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-rosys-fg-faint); }
	.sz-fit-value { font-size: 18px; font-weight: 700; color: var(--color-rosys-fg); }
	.sz-fit-tag { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 6px; text-transform: capitalize; }
	.sz-fit-exact { background: #ecfdf5; color: #059669; }
	.sz-fit-comfortable { background: #eff6ff; color: #2563eb; }
	.sz-fit-tight { background: #fffbeb; color: #d97706; }
	.sz-fit-loose { background: #f5f3ff; color: #7c3aed; }

	/* ─── Expandable sections ─── */
	.sz-expandables { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
	.sz-expand-trigger {
		display: flex; align-items: center; gap: 10px; width: 100%;
		padding: 14px 16px; background: white; border: none; cursor: pointer;
		font-size: 13px; font-weight: 500; color: var(--color-rosys-fg);
		border-radius: 12px; transition: background 0.15s; text-align: left;
	}
	.sz-expand-trigger:hover { background: var(--color-warm-50); }
	.sz-expand-trigger > :last-child { margin-left: auto; }
	.sz-expand-content { padding: 0 16px 16px; }

	/* ─── Tables ─── */
	.sz-table { width: 100%; font-size: 12px; border-collapse: collapse; }
	.sz-table th { padding: 6px 6px; text-align: center; font-weight: 500; color: var(--color-rosys-fg-faint); border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); }
	.sz-table td { padding: 6px 6px; text-align: center; color: var(--color-rosys-fg); border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 15%, transparent); }
	.sz-table th:first-child, .sz-table td:first-child { text-align: left; }
	.sz-th-active { color: #059669 !important; font-weight: 700 !important; }
	.sz-td-active { color: #059669; font-weight: 600; background: color-mix(in srgb, #059669 5%, transparent); }
	.sz-td-label { color: var(--color-rosys-fg-muted); font-weight: 500; }
	.sz-th-violet { color: #7c3aed !important; font-weight: 700 !important; }
	.sz-td-violet { color: #7c3aed; font-weight: 600; background: color-mix(in srgb, #7c3aed 5%, transparent); }

	/* ─── Profile grid ─── */
	.sz-profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.sz-profile-item {
		display: flex; flex-direction: column; align-items: center; gap: 2px;
		padding: 10px 6px; border-radius: 10px;
		background: var(--color-warm-50); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 25%, transparent);
	}
	.sz-profile-val { font-size: 18px; font-weight: 700; color: var(--color-rosys-fg); }
	.sz-profile-unit { font-size: 11px; font-weight: 400; color: var(--color-rosys-fg-faint); }
	.sz-profile-label { font-size: 10px; color: var(--color-rosys-fg-faint); }

	/* ─── Preferences ─── */
	.sz-prefs-trigger {
		display: flex; align-items: center; gap: 10px; width: 100%;
		padding: 16px 18px; border-radius: 14px; border: none; cursor: pointer;
		background: linear-gradient(135deg, var(--color-rosys-50), white);
		border: 1px solid color-mix(in srgb, var(--color-rosys-200) 50%, transparent);
		font-size: 14px; font-weight: 600; color: var(--color-rosys-fg);
		transition: all 0.15s; text-align: left; margin-bottom: 12px;
	}
	.sz-prefs-trigger:hover { border-color: var(--color-rosys-300); }

	.sz-prefs-panel {
		background: white; border-radius: 16px; padding: 20px;
		border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent);
		margin-bottom: 12px;
	}
	.sz-pref-group { margin-bottom: 16px; }
	.sz-pref-group:last-of-type { margin-bottom: 20px; }
	.sz-pref-title { display: block; font-size: 12px; font-weight: 600; color: var(--color-rosys-fg); margin-bottom: 8px; }
	.sz-pref-opts { display: flex; gap: 6px; flex-wrap: wrap; }

	.sz-pref-btn {
		flex: 1; min-width: 0; padding: 10px 8px; border-radius: 10px;
		font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
		background: var(--color-warm-50); color: var(--color-rosys-fg-muted);
		border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent);
		text-align: center;
	}
	.sz-pref-btn:hover { border-color: var(--color-rosys-300); }
	.sz-pref-btn-sm { font-size: 11px; padding: 8px 6px; }
	:global(.sz-pref-active) {
		background: var(--color-rosys-500) !important; color: white !important;
		border-color: var(--color-rosys-500) !important;
		box-shadow: 0 2px 8px -2px color-mix(in srgb, var(--color-rosys-500) 30%, transparent);
	}

	.sz-pref-area { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
	.sz-pref-area-label { font-size: 11px; color: var(--color-rosys-fg-muted); width: 40px; flex-shrink: 0; }

	/* ─── Downloads ─── */
	.sz-locked-banner {
		display: flex; align-items: center; gap: 12px; padding: 14px 18px;
		border-radius: 14px; background: #ecfdf5; border: 1px solid #a7f3d040;
		margin-bottom: 16px; font-size: 14px; color: var(--color-rosys-fg);
	}
	.sz-locked-banner strong { display: block; }

	.sz-downloads {
		background: white; border-radius: 16px; padding: 20px;
		border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent);
		box-shadow: 0 1px 4px rgba(0,0,0,0.03); margin-bottom: 16px;
	}
	.sz-downloads-title { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-rosys-fg-faint); }
	.sz-downloads-sub { display: block; font-size: 13px; color: var(--color-rosys-fg-muted); margin: 4px 0 14px; }
	.sz-download-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.sz-download-btn {
		display: flex; flex-direction: column; align-items: center; gap: 4px;
		padding: 14px 8px; border-radius: 12px;
		background: var(--color-rosys-50); border: 1px solid color-mix(in srgb, var(--color-rosys-200) 50%, transparent);
		color: var(--color-rosys-fg); text-decoration: none; transition: all 0.15s; text-align: center;
	}
	.sz-download-btn:hover { background: var(--color-rosys-100); border-color: var(--color-rosys-300); }
	.sz-download-btn:active { transform: scale(0.96); }
	.sz-download-btn strong { font-size: 14px; }
	.sz-download-btn span { font-size: 10px; color: var(--color-rosys-fg-faint); }
	.sz-download-btn :global(svg) { color: var(--color-rosys-400); }

	/* ─── Custom fit ─── */
	.sz-custom-trigger {
		display: flex; align-items: center; justify-content: space-between; width: 100%;
		padding: 18px 20px; border-radius: 14px; border: none; cursor: pointer;
		background: linear-gradient(135deg, #f5f3ff, #ede9fe80);
		border: 1px solid #ddd6fe50; transition: all 0.15s; text-align: left; margin-bottom: 12px;
	}
	.sz-custom-trigger:hover { border-color: #c4b5fd; }
	.sz-custom-trigger-inner { display: flex; align-items: center; gap: 12px; }
	.sz-custom-trigger-inner strong { font-size: 14px; color: var(--color-rosys-fg); }

	.sz-custom-panel {
		background: white; border-radius: 16px; padding: 20px;
		border: 1px solid #ddd6fe30; margin-bottom: 16px;
	}
	.sz-custom-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 24px 0; font-size: 14px; color: var(--color-rosys-fg-muted); }

	.sz-confidence-tag { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 8px; text-transform: capitalize; }
	.sz-confidence-high { background: #ecfdf5; color: #059669; }
	.sz-confidence-medium { background: #fffbeb; color: #d97706; }
	.sz-confidence-low { background: #fef2f2; color: #dc2626; }

	.sz-warning { padding: 10px 14px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a40; font-size: 12px; color: #92400e; }

	/* ─── Utilities ─── */
	.sz-subtle { font-size: 12px; color: var(--color-rosys-fg-faint); font-weight: 400; }

	/* ─── Prose (AI output) ─── */
	:global(.sz-prose h2) {
		font-size: 11px; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.1em; color: var(--color-rosys-fg-faint);
		margin: 1.5rem 0 0.5rem; padding-bottom: 6px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 25%, transparent);
	}
	:global(.sz-prose h2:first-child) { margin-top: 0; }
	:global(.sz-prose p) { font-size: 14px; line-height: 1.65; color: var(--color-rosys-fg-secondary); margin-bottom: 4px; }
	:global(.sz-prose strong) { color: var(--color-rosys-fg); font-weight: 600; }
	:global(.sz-prose ul) { list-style: none; padding: 0; margin: 0; }
	:global(.sz-prose li) {
		font-size: 14px; line-height: 1.65; color: var(--color-rosys-fg-secondary);
		padding: 6px 0; border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 15%, transparent);
	}
	:global(.sz-prose li:last-child) { border-bottom: none; }
</style>
