<script context="module" lang="ts">
	function parseSections(text: string): Record<string, string> {
		if (!text) return {};
		const map: Record<string, string> = {};
		const parts = text.split(/^## /gm).filter(Boolean);
		for (const part of parts) {
			const nl = part.indexOf('\n');
			if (nl === -1) continue;
			const key = part.slice(0, nl).trim().toLowerCase();
			map[key] = part.slice(nl + 1).trim();
		}
		return map;
	}

	function renderBody(text: string): string {
		if (!text) return '';
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
	import { ArrowLeft, Ruler, Sparkles, Loader2, Check, Download, Camera, ChevronDown, Zap, RotateCcw, RefreshCw, Scissors, MessageCircle, TrendingUp, AlertTriangle } from 'lucide-svelte';

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

	// Editable body profile (auto-filled from MLP, customer can override)
	let shoulder = $state('');
	let armLength = $state('');
	let legLength = $state('');
	let profileLoading = $state(false);
	let profilePredicted = $state(false); // true = values came from MLP, not user
	let showBodyFields = $state(false);

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

	// Parse completed text into sections for visual components
	const sec = $derived(parseSections(refinedText || streamedText));

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
					if (eventType === 'deterministic') { deterministicResult = payload; profile = payload.profile; chartData = payload.chart; hasDxf = payload.has_dxf ?? false; analysisStep = 2; }
					else if (eventType === 'chunk') { if (analysisStep < 3) analysisStep = 3; if (isRefining) refinedText += payload; else streamedText += payload; }
					else if (eventType === 'error') { errorMsg = payload.message; }
				} catch {}
			}
		}
	}

	function startAnalysis() { analysisStep = 1; phase = 'analyzing'; isStreaming = true; streamedText = ''; errorMsg = ''; saveProfile(); startStreaming(); }

	async function startStreaming() {
		try {
			const res = await fetch('/api/ai/size-intelligence/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), height: height ? parseFloat(height) : undefined, source: 'tape_measure' }) });
			if (!res.ok) { errorMsg = 'Something went wrong.'; isStreaming = false; return; }
			await consumeStream(res);
		} catch (e: any) { errorMsg = e.message || 'Connection failed.'; }
		finally { isStreaming = false; if (!errorMsg) phase = 'results'; }
	}

	async function refineWithPreferences() {
		if (!hasPreferences) return; isRefining = true; refinedText = ''; errorMsg = '';
		try {
			const res = await fetch('/api/ai/size-intelligence/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), height: height ? parseFloat(height) : undefined, source: 'tape_measure',
					preferences: { fit_preference: fitPreference || undefined, bust_preference: bustPref || undefined, waist_preference: waistPref || undefined, hip_preference: hipPref || undefined, length_preference: lengthPref || undefined, fabric_stretch: fabricStretch || undefined },
					previous_recommendation: streamedText || undefined }) });
			if (!res.ok) { errorMsg = 'Refinement failed.'; isRefining = false; return; }
			await consumeStream(res);
		} catch (e: any) { errorMsg = e.message || 'Connection failed.'; }
		finally {
			isRefining = false;
			showPreferences = false;
			// Force scroll after DOM settles
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					document.documentElement.scrollTop = 0;
					document.body.scrollTop = 0;
					window.scrollTo(0, 0);
				});
			});
		}
	}

	let customFitFiles = $state<any[]>([]);

	async function calculateCustomFit() {
		customFitLoading = true; customFitError = ''; customFitGrading = null; customFitFiles = [];
		try {
			// First get grading preview
			let res = await fetch('/api/patterns/generate-custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip) }) });
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
			const json = await res.json();
			customFitGrading = json.grading; customFitError = json.error || '';

			// Then generate all formats to get file list
			if (!customFitError) {
				res = await fetch('/api/patterns/generate-custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), generate: true }) });
				if (res.ok) {
					const gen = await res.json();
					customFitFiles = gen.files || [];
				}
			}
		} catch (e: any) { customFitError = e.message; } finally { customFitLoading = false; }
	}

	let downloadingFormat = $state('');
	async function downloadCustomFile(format: string) {
		downloadingFormat = format;
		try {
			const res = await fetch('/api/patterns/generate-custom', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), generate: true, format }) });
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob(); const cd = res.headers.get('content-disposition');
			const filename = cd?.match(/filename="(.+)"/)?.[1] || `${pattern.pattern_slug}-custom.pdf`;
			const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
		} catch (e: any) { customFitError = e.message; } finally { downloadingFormat = ''; }
	}

	function reset() { phase = 'entry'; deterministicResult = null; streamedText = ''; refinedText = ''; profile = null; chartData = null; errorMsg = ''; showPreferences = false; sizeLocked = false; showCustomFit = false; customFitGrading = null; analysisStep = 0; fitPreference = bustPref = waistPref = hipPref = lengthPref = fabricStretch = ''; }
	$effect(() => { if (savedProfile && bust && waist && hip) phase = 'measurements'; });

	// Auto-predict body profile when all 4 measurements are filled
	async function predictProfile() {
		if (!bust || !waist || !hip || !height) return;
		profileLoading = true;
		try {
			const res = await fetch('/api/ai/body-profile', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), height: parseFloat(height) })
			});
			if (res.ok) {
				const { profile: p } = await res.json();
				// Only auto-fill if user hasn't manually entered values
				if (!shoulder) { shoulder = p.shoulder_cm?.toString() ?? ''; profilePredicted = true; }
				if (!armLength) { armLength = p.arm_length_cm?.toString() ?? ''; }
				if (!legLength) { legLength = p.leg_length_cm?.toString() ?? ''; }
				showBodyFields = true;
			}
		} catch {} finally { profileLoading = false; }
	}

	// Save measurement profile after successful analysis
	async function saveProfile() {
		try {
			await fetch('/profile/measurements?/save', {
				method: 'POST',
				body: new URLSearchParams({
					name: 'Sizing Assistant',
					bust_cm: bust, waist_cm: waist, hip_cm: hip, height_cm: height,
					shoulder_width_cm: shoulder, arm_length_cm: armLength, inseam_cm: legLength,
					source: 'manual'
				})
			});
		} catch {} // Silent — non-critical
	}
</script>

<svelte:head><title>Find Your Size — {pattern.pattern_name}</title></svelte:head>

<div class="sz">
	<a href="/patterns/{pattern.pattern_slug}" class="sz-back"><ArrowLeft class="w-4 h-4" strokeWidth={1.5} />{pattern.pattern_name}</a>

	<!-- ENTRY -->
	{#if phase === 'entry'}
		<div class="fade-in">
			<div class="sz-hero">
				<div class="sz-hero-icon"><Sparkles class="w-7 h-7" strokeWidth={1.5} /></div>
				<h1>Find Your<br/>Perfect Size</h1>
				<p>{pattern.pattern_name}</p>
			</div>
			<div class="sz-paths">
				<button onclick={() => phase = 'measurements'} class="sz-path main">
					<div class="sz-path-ico"><Ruler class="w-5 h-5" strokeWidth={1.5} /></div>
					<div><strong>Measure yourself</strong><span>Bust, waist, hip & height</span></div>
					<em class="pill green">Accurate</em>
				</button>
				<button onclick={() => phase = 'photo'} class="sz-path alt">
					<div class="sz-path-ico muted"><Camera class="w-5 h-5" strokeWidth={1.5} /></div>
					<div><strong>Upload a photo</strong><span>Body estimation</span></div>
					<em class="pill amber">Beta</em>
				</button>
			</div>
		</div>

	{:else if phase === 'photo'}
		<div class="fade-in" style="text-align:center">
			<h1 class="sz-h1">Photo Measurement</h1>
			<p class="sz-muted mb-6">Use our <a href="/profile/measurements/photo" class="text-rosys-500 underline">photo tool</a>, then return here.</p>
			<button onclick={() => phase = 'measurements'} class="btn-soft w-full">Use tape measure</button>
		</div>

	<!-- MEASUREMENTS -->
	{:else if phase === 'measurements'}
		<div class="fade-in">
			<div class="sz-section-head">
				<div class="sz-section-ico"><Ruler class="w-5 h-5" strokeWidth={1.5} /></div>
				<div><h1 class="sz-h1">Your Measurements</h1><p class="sz-muted">Soft tape — snug but not tight</p></div>
			</div>
			<div class="fields">
				{#each [
					{ id: 'bust', label: 'Bust', ph: '88', get: () => bust, set: (v: string) => bust = v },
					{ id: 'waist', label: 'Waist', ph: '72', get: () => waist, set: (v: string) => waist = v },
					{ id: 'hip', label: 'Hip', ph: '92', get: () => hip, set: (v: string) => hip = v },
					{ id: 'height', label: 'Height', ph: '168', get: () => height, set: (v: string) => height = v, opt: true },
				] as f}
					<div>
						<label for={f.id}>{f.label}{#if f.opt}<span class="opt"> · optional</span>{/if}</label>
						<div class="input-wrap">
							<input id={f.id} type="number" inputmode="numeric" placeholder={f.ph} value={f.get()} oninput={(e) => f.set((e.target as HTMLInputElement).value)} />
							<span class="unit">cm</span>
						</div>
					</div>
				{/each}
			</div>
			<!-- Body profile section (auto-predicted, editable) -->
			{#if canSubmit && height}
				{#if !showBodyFields && !profileLoading}
					<button onclick={predictProfile} class="body-predict-btn">
						<Zap class="w-4 h-4 text-violet-500" strokeWidth={1.5} />
						<span>Predict full body profile</span>
						<span class="sz-muted">shoulder, arms, legs</span>
					</button>
				{/if}

				{#if profileLoading}
					<div class="body-loading"><Loader2 class="w-4 h-4 animate-spin text-violet-400" strokeWidth={2} /><span class="sz-muted">Predicting body profile...</span></div>
				{/if}

				{#if showBodyFields}
					<div class="body-fields page-enter">
						<div class="body-fields-head">
							<span class="pref-title">Body profile</span>
							{#if profilePredicted}<span class="pill violet" style="font-size:9px">Auto-predicted</span>{/if}
						</div>
						<div class="body-fields-grid">
							{#each [
								{ id: 'shoulder', label: 'Shoulder', ph: '38', get: () => shoulder, set: (v: string) => { shoulder = v; profilePredicted = false; } },
								{ id: 'arm', label: 'Arm length', ph: '60', get: () => armLength, set: (v: string) => { armLength = v; profilePredicted = false; } },
								{ id: 'leg', label: 'Leg length', ph: '75', get: () => legLength, set: (v: string) => { legLength = v; profilePredicted = false; } },
							] as f}
								<div>
									<label for={f.id} class="body-field-label">{f.label}</label>
									<div class="input-wrap">
										<input id={f.id} type="number" inputmode="numeric" placeholder={f.ph} value={f.get()} oninput={(e) => f.set((e.target as HTMLInputElement).value)} class="body-input" />
										<span class="unit">cm</span>
									</div>
								</div>
							{/each}
						</div>
						<p class="body-note">
							{#if profilePredicted}Predicted from 59,000 body records. Edit any value to override.
							{:else}Using your custom values.{/if}
						</p>
					</div>
				{/if}
			{/if}

			{#if errorMsg}<p class="err">{errorMsg}</p>{/if}
			<button disabled={!canSubmit} onclick={startAnalysis} class="btn-primary w-full"><Sparkles class="w-5 h-5" strokeWidth={2} />Analyze my fit</button>
			{#if savedProfile}<p class="sz-note"><Check class="w-3 h-3 inline text-emerald-500" strokeWidth={2} /> Saved measurements loaded</p>{/if}
			<button onclick={() => phase = 'entry'} class="btn-ghost w-full mt-1"><ArrowLeft class="w-3.5 h-3.5" strokeWidth={1.5} /> Back</button>
		</div>

	<!-- ANALYZING — Perplexity-style live data surfacing -->
	{:else if phase === 'analyzing'}
		<div class="fade-in">
			<!-- Header -->
			<div class="an-header">
				<div class="an-orb"><div class="an-orb-inner"></div></div>
				<div>
					<h1 class="an-title">Analyzing {pattern.pattern_name}</h1>
					<p class="an-sub">Finding your perfect fit</p>
				</div>
			</div>

			<!-- Live steps with data cards surfacing -->
			<div class="an-timeline">
				<!-- Step 1: Size chart comparison -->
				<div class="an-step" class:an-done={analysisStep >= 2} class:an-active={analysisStep < 2}>
					<div class="an-step-line">
						<div class="an-dot">{#if analysisStep >= 2}<Check class="w-3 h-3" strokeWidth={3} />{:else}<Loader2 class="w-3 h-3 animate-spin" strokeWidth={2} />{/if}</div>
					</div>
					<div class="an-step-body">
						<span class="an-step-title">Comparing against size chart</span>
						{#if analysisStep >= 2 && deterministicResult}
							<div class="an-data-card page-enter">
								<div class="an-data-row">
									<span>Best match</span>
									<strong class="text-emerald-600">{deterministicResult.recommended_size}</strong>
								</div>
								<div class="an-data-row">
									<span>Match confidence</span>
									<span class="an-score">{(100 - deterministicResult.score).toFixed(0)}%</span>
								</div>
								{#if deterministicResult.between_sizes}
									<div class="an-data-row">
										<span>Between sizes</span>
										<span>{deterministicResult.lower_size} — {deterministicResult.upper_size}</span>
									</div>
								{/if}
								{#if deterministicResult.fit}
									<div class="an-fit-row">
										{#each [{l:'Bust',d:deterministicResult.fit.bust},{l:'Waist',d:deterministicResult.fit.waist},{l:'Hip',d:deterministicResult.fit.hip}] as {l,d}}
											{#if d}<div class="an-fit-chip"><span class="an-fit-chip-label">{l}</span><span class="an-fit-chip-tag {d.fit}">{d.fit}</span></div>{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<!-- Step 2: Body profile -->
				<div class="an-step" class:an-done={analysisStep >= 2} class:an-active={analysisStep === 1} class:an-pending={analysisStep < 1}>
					<div class="an-step-line">
						<div class="an-dot">{#if analysisStep >= 2}<Check class="w-3 h-3" strokeWidth={3} />{:else if analysisStep >= 1}<Loader2 class="w-3 h-3 animate-spin" strokeWidth={2} />{:else}<span class="an-dot-num">2</span>{/if}</div>
					</div>
					<div class="an-step-body">
						<span class="an-step-title">Building body profile</span>
						{#if analysisStep >= 2 && profile}
							<div class="an-data-card page-enter">
								<div class="an-profile-chips">
									{#each [{l:'Shoulder',v:profile.shoulder_cm},{l:'Arm',v:profile.arm_length_cm},{l:'Leg',v:profile.leg_length_cm}] as m}
										{#if m.v}<div class="an-profile-chip"><span class="an-profile-val">{m.v}</span><span class="an-profile-label">{m.l}</span></div>{/if}
									{/each}
								</div>
								<span class="an-data-note">Predicted from 59,000 body measurement records</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Step 3: Recommendation -->
				<div class="an-step" class:an-done={!isStreaming && analysisStep >= 3} class:an-active={isStreaming && analysisStep >= 3} class:an-pending={analysisStep < 3}>
					<div class="an-step-line">
						<div class="an-dot">{#if !isStreaming && analysisStep >= 3}<Check class="w-3 h-3" strokeWidth={3} />{:else if analysisStep >= 3}<Loader2 class="w-3 h-3 animate-spin" strokeWidth={2} />{:else}<span class="an-dot-num">3</span>{/if}</div>
					</div>
					<div class="an-step-body">
						<span class="an-step-title">Generating your recommendation</span>
						{#if analysisStep >= 3}
							<div class="an-data-card page-enter">
								{#if deterministicResult?.ease}
									<div class="an-data-row">
										<span>Ease at {recommendedSize || deterministicResult?.recommended_size}</span>
										<span>{deterministicResult.ease.bust_cm != null ? `Bust ${deterministicResult.ease.bust_cm > 0 ? '+' : ''}${deterministicResult.ease.bust_cm.toFixed(0)}cm` : ''}</span>
									</div>
								{/if}
								{#if chartData?.finished?.length > 0}
									{@const recFinished = chartData.finished.find((r: any) => r.size === (recommendedSize || deterministicResult?.recommended_size))}
									{#if recFinished}
										<div class="an-data-row">
											<span>Finished bust</span>
											<span>{recFinished.bust_cm}cm</span>
										</div>
										{#if recFinished.full_length_cm}
											<div class="an-data-row">
												<span>Garment length</span>
												<span>{recFinished.full_length_cm}cm</span>
											</div>
										{/if}
									{/if}
								{/if}
								<div class="an-thinking">
									<div class="an-thinking-bar"><div class="an-thinking-fill"></div></div>
									<span>Analyzing fit, adjustments & fabric...</span>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			{#if errorMsg}<div class="err-box">{errorMsg}</div>{/if}
		</div>

	<!-- RESULTS — visual components, no raw text -->
	{:else if phase === 'results'}
		<!-- Refining overlay -->
		{#if isRefining}
			<div class="refine-overlay">
				<div class="refine-modal">
					<div class="refine-orb"><div class="refine-orb-inner"></div></div>
					<h2 class="refine-title">Updating your recommendation</h2>
					<p class="refine-sub">Re-analyzing with your preferences...</p>
					<div class="refine-bar"><div class="refine-bar-fill"></div></div>
				</div>
			</div>
		{/if}
		<div class="fade-in results" class:results-blur={isRefining}>

			<!-- SIZE HERO -->
			{#if recommendedSize}
				<div class="size-hero">
					<div class="size-badge">
						<span class="size-pattern">{deterministicResult?.pattern_name}</span>
						<span class="size-number">{recommendedSize}</span>
					</div>
					<div class="size-strip">
						{#each (chartData?.sizes ?? sizes).length > 0 ? (chartData?.sizes ?? sizes) : ['XXS','XS','S','M','L','XL','XXL'] as s}
							<span class="pip" class:on={s === recommendedSize}>{s}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if deterministicResult?.between_sizes}
				<div class="between-card">↕ Between <strong>{deterministicResult.lower_size}</strong> and <strong>{deterministicResult.upper_size}</strong></div>
			{/if}

			<!-- FIT VISUALIZATION -->
			{#if deterministicResult?.fit}
				<div class="fit-grid">
					{#each [
						{ label: 'Bust', d: deterministicResult.fit.bust },
						{ label: 'Waist', d: deterministicResult.fit.waist },
						{ label: 'Hip', d: deterministicResult.fit.hip },
					] as { label, d }}
						{#if d}
							<div class="fit-card">
								<div class="fit-head">
									<span class="fit-name">{label}</span>
									<span class="fit-tag {d.fit}">{d.fit}</span>
								</div>
								<div class="fit-num">{d.user_cm}<small>cm</small></div>
								{#if d.chart_cm}
									<div class="fit-compare">
										<span>Chart: {d.chart_cm}cm</span>
										<span class="fit-diff {d.diff_cm >= 0 ? 'pos' : 'neg'}">{d.diff_cm >= 0 ? '+' : ''}{d.diff_cm}cm</span>
									</div>
								{/if}
								<div class="fit-bar"><div class="fit-bar-fill {d.fit}" style="width:{Math.min(100, Math.max(8, 50 + (d.diff_cm || 0) * 4))}%"></div></div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- RECOMMENDATION CARDS (from parsed AI sections) -->
			<div class="rec-cards">
				<!-- Why this size -->
				{#if sec['why this size']}
					<div class="rec-card">
						<div class="rec-icon"><TrendingUp class="w-4 h-4" strokeWidth={1.5} /></div>
						<div>
							<span class="rec-label">Why this size</span>
							<div class="rec-body">{@html renderBody(sec['why this size'])}</div>
						</div>
					</div>
				{/if}

				<!-- Updated recommendation (refinement) -->
				{#if sec['updated recommendation']}
					<div class="rec-card updated">
						<div class="rec-icon updated-icon"><RefreshCw class="w-4 h-4" strokeWidth={1.5} /></div>
						<div>
							<span class="rec-label">Updated recommendation</span>
							<div class="rec-body">{@html renderBody(sec['updated recommendation'])}</div>
						</div>
					</div>
				{/if}
				{#if sec['what changed']}
					<div class="rec-card changed">
						<div class="rec-icon"><AlertTriangle class="w-4 h-4" strokeWidth={1.5} /></div>
						<div>
							<span class="rec-label">What changed</span>
							<div class="rec-body">{@html renderBody(sec['what changed'])}</div>
						</div>
					</div>
				{/if}

				<!-- Between sizes -->
				{#if sec['between sizes?'] && !sec['between sizes?'].toLowerCase().includes('solidly')}
					<div class="rec-card between">
						<span class="rec-label">Between sizes</span>
						<div class="rec-body">{@html renderBody(sec['between sizes?'])}</div>
					</div>
				{/if}

				<!-- Fit by measurement -->
				{#if sec['fit by measurement']}
					<div class="rec-card fit-detail">
						<span class="rec-label">Fit by measurement</span>
						<div class="rec-body">{@html renderBody(sec['fit by measurement'])}</div>
					</div>
				{/if}

				<!-- Updated fit -->
				{#if sec['updated fit']}
					<div class="rec-card fit-detail">
						<span class="rec-label">Updated fit</span>
						<div class="rec-body">{@html renderBody(sec['updated fit'])}</div>
					</div>
				{/if}

				<!-- Adjustments -->
				{#if sec['adjustments to consider'] || sec['adjustments']}
					<div class="rec-card adjust">
						<div class="rec-icon adjust-icon"><Ruler class="w-4 h-4" strokeWidth={1.5} /></div>
						<div>
							<span class="rec-label">Adjustments</span>
							<div class="rec-body">{@html renderBody(sec['adjustments to consider'] || sec['adjustments'] || '')}</div>
						</div>
					</div>
				{/if}

				<!-- Garment notes (collapsed) -->
				{#if sec['garment notes']}
					<details class="rec-details">
						<summary><Scissors class="w-3.5 h-3.5 inline" strokeWidth={1.5} /> Pattern & fabric notes</summary>
						<div class="rec-body">{@html renderBody(sec['garment notes'])}</div>
					</details>
				{/if}
			</div>

			<!-- DATA PANELS -->
			<div class="panels">
				{#if chartData?.finished?.length > 0}
					<button onclick={() => showFinished = !showFinished} class="panel-btn">
						<Ruler class="w-4 h-4 text-rosys-400" strokeWidth={1.5} /><span>Finished garment measurements</span>
						<ChevronDown class="w-3.5 h-3.5 ml-auto text-rosys-fg-faint transition-transform {showFinished ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showFinished}
						<div class="panel-content page-enter overflow-x-auto">
							<table class="tbl"><thead><tr><th></th>{#each chartData.sizes as s, i}<th class:hl={i === highlightedIndex}>{s}</th>{/each}</tr></thead>
								<tbody>{#each [{k:'bust_cm',l:'Bust'},{k:'waist_cm',l:'Waist'},{k:'hip_cm',l:'Hip'},{k:'full_length_cm',l:'Length'},{k:'sleeve_length_cm',l:'Sleeve'}] as c}{@const has = chartData.finished.some((r: any) => r[c.k])}{#if has}<tr><td class="tl">{c.l}</td>{#each chartData.finished as row, i}<td class:hl={i === highlightedIndex}>{row[c.k] ? Number(row[c.k]) : '—'}</td>{/each}</tr>{/if}{/each}</tbody>
							</table>
						</div>
					{/if}
				{/if}

				{#if profile}
					<button onclick={() => showProfile = !showProfile} class="panel-btn">
						<Zap class="w-4 h-4 text-violet-400" strokeWidth={1.5} /><span>Body profile <span class="sz-muted">· 59K records</span></span>
						<ChevronDown class="w-3.5 h-3.5 ml-auto text-rosys-fg-faint transition-transform {showProfile ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showProfile}
						<div class="panel-content page-enter">
							<div class="profile-grid">
								{#each [{l:'Shoulder',v:profile.shoulder_cm,u:'cm'},{l:'Arm',v:profile.arm_length_cm,u:'cm'},{l:'Arm circ.',v:profile.arm_circ_cm,u:'cm'},{l:'Leg',v:profile.leg_length_cm,u:'cm'},{l:'Weight',v:profile.weight_kg,u:'kg'},{l:'Neck',v:profile.neck_cm,u:'cm'}] as m}
									{#if m.v}<div class="profile-cell"><span class="profile-num">{m.v}<small>{m.u}</small></span><span class="profile-lbl">{m.l}</span></div>{/if}
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				{#if hasChart}
					<button onclick={() => showChart = !showChart} class="panel-btn">
						<span class="w-4 h-4 text-[11px] font-bold text-rosys-fg-faint">#</span><span>Body size chart</span>
						<ChevronDown class="w-3.5 h-3.5 ml-auto text-rosys-fg-faint transition-transform {showChart ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showChart}
						<div class="panel-content page-enter overflow-x-auto">
							<table class="tbl"><thead><tr><th></th>{#each sizes as s, i}<th class:hl={i === highlightedIndex}>{s}</th>{/each}</tr></thead>
								<tbody>{#each ['bust_cm','waist_cm','hip_cm'] as key}{@const l = key==='bust_cm'?'Bust':key==='waist_cm'?'Waist':'Hip'}<tr><td class="tl">{l}</td>{#each bodyRows as row, i}<td class:hl={i === highlightedIndex}>{(row as any)[key] ? Number((row as any)[key]) : '—'}</td>{/each}</tr>{/each}</tbody>
							</table>
						</div>
					{/if}
				{/if}
			</div>

			<!-- FINE-TUNE -->
			{#if !sizeLocked}
				<div class="fine-tune-section">
					<button onclick={() => showPreferences = !showPreferences} class="fine-tune-btn">
						<div class="fine-tune-left">
							<div class="fine-tune-ico"><MessageCircle class="w-4 h-4" strokeWidth={1.5} /></div>
							<div>
								<strong>Fine-tune your fit</strong>
								<span>Tell us how you like it — optional</span>
							</div>
						</div>
						<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showPreferences ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>

					{#if showPreferences}
						<div class="prefs page-enter">
							{#each [
								{ title: 'Overall fit', opts: ['Fitted & close', 'Comfortable ease', 'Loose & relaxed'], get: () => fitPreference, set: (v: string) => fitPreference = v },
								{ title: 'Length', opts: ['Shorter', 'As designed', 'Longer'], get: () => lengthPref, set: (v: string) => lengthPref = v },
								{ title: 'Fabric', opts: ['Woven (no stretch)', 'Light stretch', 'Stretch knit'], get: () => fabricStretch, set: (v: string) => fabricStretch = v },
							] as group}
								<div class="pref-group">
									<span class="pref-title">{group.title}</span>
									<div class="pref-chips">{#each group.opts as opt}<button onclick={() => group.set(group.get() === opt ? '' : opt)} class="chip" class:chip-on={group.get() === opt}>{opt}</button>{/each}</div>
								</div>
							{/each}

							<div class="pref-group">
								<span class="pref-title">By area</span>
								{#each [{l:'Bust',g:()=>bustPref,s:(v:string)=>bustPref=v,o:['More room','As fitted as possible']},{l:'Waist',g:()=>waistPref,s:(v:string)=>waistPref=v,o:['More room','Defined waist']},{l:'Hip',g:()=>hipPref,s:(v:string)=>hipPref=v,o:['More room','Slim through hip']}] as a}
									<div class="pref-area-row">
										<span class="pref-area-label">{a.l}</span>
										{#each a.o as opt}<button onclick={() => a.s(a.g() === opt ? '' : opt)} class="chip" class:chip-on={a.g() === opt}>{opt}</button>{/each}
									</div>
								{/each}
							</div>

							<button disabled={!hasPreferences || isRefining} onclick={refineWithPreferences} class="btn-primary w-full">
								{#if isRefining}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Updating...{:else}<RefreshCw class="w-4 h-4" strokeWidth={2} />Update recommendation{/if}
							</button>
						</div>
					{/if}
				</div>

				<button onclick={() => { sizeLocked = true; showPreferences = false; }} class="btn-lock w-full">
					<Check class="w-5 h-5" strokeWidth={2.5} />Lock in size {recommendedSize}
				</button>
			{/if}

			<!-- DOWNLOADS -->
			{#if sizeLocked}
				<div class="locked-banner"><Check class="w-5 h-5 text-emerald-500" strokeWidth={2.5} /><div><strong>Size {recommendedSize} confirmed</strong><span class="sz-muted block">Ready to download</span></div></div>

				<div class="download-card">
					<span class="card-label">Download Pattern</span>
					<span class="sz-muted block mb-3">Size {recommendedSize} — single-size PDF</span>
					<div class="dl-grid">
						{#each [{f:'a0',l:'A0',s:'Print shop'},{f:'a4',l:'A4',s:'Home'},{f:'us_letter',l:'US Letter',s:'Home'}] as dl}
							<a href="/api/patterns/single-size?slug={pattern.pattern_slug}&size={recommendedSize}&format={dl.f}" class="dl-btn">
								<Download class="w-4 h-4" strokeWidth={1.5} /><strong>{dl.l}</strong><span>{dl.s}</span>
							</a>
						{/each}
					</div>
				</div>

				{#if hasDxf}
					<button onclick={() => { showCustomFit = !showCustomFit; if (showCustomFit && !customFitGrading) calculateCustomFit(); }} class="custom-btn">
						<Scissors class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
						<div><strong>Custom-fit pattern</strong><em class="pill violet">Beta</em></div>
						<ChevronDown class="w-4 h-4 ml-auto text-violet-300 transition-transform {showCustomFit ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>
					{#if showCustomFit}
						<div class="custom-panel page-enter">
							{#if customFitLoading && !customFitGrading}
								<div class="custom-loading"><Loader2 class="w-5 h-5 animate-spin text-violet-500" strokeWidth={2} /><span>Calculating...</span></div>
							{:else if customFitGrading}
								<div class="overflow-x-auto mb-4">
									<table class="tbl"><thead><tr><th></th><th>Pattern ({customFitGrading.sample_size})</th><th class="tv">Custom</th><th>Delta</th></tr></thead>
										<tbody>{#each [{l:'Bust',s:customFitGrading.sample_finished.bust_cm,c:customFitGrading.custom_finished.bust_cm,d:customFitGrading.adjustments.bust_delta_cm},{l:'Waist',s:customFitGrading.sample_finished.waist_cm,c:customFitGrading.custom_finished.waist_cm,d:customFitGrading.adjustments.waist_delta_cm},{l:'Hip',s:customFitGrading.sample_finished.hip_cm,c:customFitGrading.custom_finished.hip_cm,d:customFitGrading.adjustments.hip_delta_cm},{l:'Length',s:customFitGrading.sample_finished.full_length_cm,c:customFitGrading.custom_finished.full_length_cm,d:customFitGrading.adjustments.length_delta_cm}] as r}
											<tr><td class="tl">{r.l}</td><td>{r.s !== null ? `${r.s}cm` : '—'}</td><td class="tdv">{r.c !== null ? `${typeof r.c === 'number' ? r.c.toFixed(1) : r.c}cm` : '—'}</td><td class="{r.d && r.d !== 0 ? (r.d > 0 ? 'text-blue-600' : 'text-amber-600') : ''}">{r.d !== null ? `${r.d > 0 ? '+' : ''}${r.d.toFixed(1)}cm` : '—'}</td></tr>
										{/each}</tbody>
									</table>
								</div>
								{#if customFitError}<div class="err-box mb-3">{customFitError}</div>
								{:else}
									<span class="card-label mb-2 block">Download custom-fit pattern</span>
									<div class="dl-grid">
										{#each [
											{ f: 'a0', l: 'A0', s: 'Print shop' },
											{ f: 'a4', l: 'A4', s: 'Home' },
											{ f: 'us_letter', l: 'US Letter', s: 'Home' },
										] as dl}
											<button onclick={() => downloadCustomFile(dl.f)} disabled={!!downloadingFormat} class="dl-btn custom-dl-btn">
												{#if downloadingFormat === dl.f}
													<Loader2 class="w-4 h-4 animate-spin text-violet-400" strokeWidth={2} />
												{:else}
													<Download class="w-4 h-4 text-violet-400" strokeWidth={1.5} />
												{/if}
												<strong>{dl.l}</strong>
												<span>{dl.s}</span>
											</button>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				{/if}
			{/if}

			<button onclick={reset} class="btn-ghost w-full mt-4"><RotateCcw class="w-3.5 h-3.5" strokeWidth={1.5} />Start over</button>
		</div>
	{/if}
</div>

<style>
	/* Page */
	.sz { max-width: 480px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
	@media (min-width: 768px) { .sz { padding: 3rem 2rem 4rem; max-width: 520px; } }
	.sz-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-faint); margin-bottom: 2.5rem; transition: color 0.15s; }
	.sz-back:hover { color: var(--color-rosys-500); }
	.fade-in { animation: fadeUp 0.35s ease-out; }
	@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; } }

	/* Hero */
	.sz-hero { text-align: center; margin-bottom: 2.5rem; }
	.sz-hero-icon { width: 56px; height: 56px; border-radius: 18px; margin: 0 auto 1rem; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 30%, transparent); }
	.sz-hero h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.1; color: var(--color-rosys-fg); }
	.sz-hero p { font-size: 15px; color: var(--color-rosys-fg-muted); margin-top: 0.5rem; }

	/* Paths */
	.sz-paths { display: flex; flex-direction: column; gap: 10px; }
	.sz-path { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 16px; border: 1px solid; text-align: left; width: 100%; cursor: pointer; transition: all 0.15s; }
	.sz-path:active { transform: scale(0.98); }
	.sz-path.main { background: white; border-color: color-mix(in srgb, var(--color-rosys-border) 60%, transparent); }
	.sz-path.main:hover { border-color: var(--color-rosys-300); background: var(--color-rosys-50); }
	.sz-path.alt { background: color-mix(in srgb, white 80%, transparent); border-color: color-mix(in srgb, var(--color-rosys-border) 30%, transparent); opacity: 0.8; }
	.sz-path.alt:hover { opacity: 1; background: white; }
	.sz-path-ico { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--color-rosys-500) 25%, transparent); }
	.sz-path-ico.muted { background: linear-gradient(135deg, #9ca3af, #6b7280); box-shadow: none; }
	.sz-path div:not(.sz-path-ico) { flex: 1; }
	.sz-path strong { display: block; font-size: 16px; color: var(--color-rosys-fg); }
	.sz-path span { display: block; font-size: 13px; color: var(--color-rosys-fg-muted); margin-top: 2px; }

	/* Pills */
	.pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; flex-shrink: 0; font-style: normal; }
	.green { background: #ecfdf5; color: #059669; }
	.amber { background: #fffbeb; color: #d97706; }
	.violet { background: #f5f3ff; color: #7c3aed; margin-left: 6px; }

	/* Section head */
	.sz-section-head { display: flex; align-items: center; gap: 14px; margin-bottom: 2rem; }
	.sz-section-ico { width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 25%, transparent); }
	.sz-h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-rosys-fg); margin: 0; }
	.sz-muted { font-size: 13px; color: var(--color-rosys-fg-faint); }
	.sz-note { text-align: center; font-size: 12px; color: var(--color-rosys-fg-faint); margin-top: 10px; }

	/* Form */
	.fields { display: flex; flex-direction: column; gap: 14px; margin-bottom: 1.5rem; }
	.fields label { display: block; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg); margin-bottom: 6px; }
	.opt { font-weight: 400; color: var(--color-rosys-fg-faint); }
	.input-wrap { position: relative; }
	.fields input { width: 100%; padding: 14px 50px 14px 18px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 60%, transparent); font-size: 17px; color: var(--color-rosys-fg); background: white; outline: none; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
	.fields input:focus { border-color: var(--color-rosys-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-rosys-400) 12%, transparent); }
	.fields input::placeholder { color: color-mix(in srgb, var(--color-rosys-fg-faint) 40%, transparent); }
	.unit { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--color-rosys-fg-faint); pointer-events: none; }

	/* Body profile fields */
	.body-predict-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px dashed color-mix(in srgb, var(--color-rosys-border) 60%, transparent); background: var(--color-warm-50); cursor: pointer; transition: all 0.15s; margin-bottom: 6px; }
	.body-predict-btn:hover { border-color: #c4b5fd; background: #f5f3ff; }
	.body-predict-btn span:first-of-type { font-size: 13px; font-weight: 500; color: var(--color-rosys-fg); }
	.body-loading { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 14px; }
	.body-fields { background: var(--color-warm-50); border-radius: 14px; padding: 16px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent); margin-bottom: 6px; }
	.body-fields-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
	.body-fields-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.body-field-label { display: block; font-size: 11px; font-weight: 500; color: var(--color-rosys-fg-muted); margin-bottom: 4px; }
	.body-input { width: 100%; padding: 10px 36px 10px 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 50%, transparent); font-size: 15px; color: var(--color-rosys-fg); background: white; outline: none; transition: all 0.15s; }
	.body-input:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.1); }
	.body-note { font-size: 11px; color: var(--color-rosys-fg-faint); margin-top: 8px; }

	/* Buttons */
	.btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 24px; border-radius: 16px; font-size: 16px; font-weight: 600; color: white; border: none; cursor: pointer; background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: 0 4px 16px -2px color-mix(in srgb, var(--color-rosys-500) 30%, transparent); transition: all 0.15s; }
	.btn-primary:hover { box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--color-rosys-500) 40%, transparent); }
	.btn-primary:active { transform: scale(0.98); }
	.btn-primary:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
	.btn-lock { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 600; color: white; border: none; cursor: pointer; margin-top: 8px; background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 4px 16px -2px rgba(5,150,105,0.3); transition: all 0.15s; }
	.btn-lock:hover { box-shadow: 0 8px 24px -4px rgba(5,150,105,0.4); }
	.btn-lock:active { transform: scale(0.98); }
	.btn-violet { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 14px; font-size: 14px; font-weight: 600; color: white; border: none; cursor: pointer; background: linear-gradient(135deg, #7c3aed, #6d28d9); transition: all 0.15s; }
	.btn-violet:disabled { opacity: 0.4; cursor: not-allowed; }
	.btn-soft { padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600; color: var(--color-rosys-600); background: var(--color-rosys-50); border: none; cursor: pointer; }
	.btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-faint); background: none; border: none; cursor: pointer; }
	.btn-ghost:hover { color: var(--color-rosys-500); }
	.err { color: var(--color-rosys-500); font-size: 13px; text-align: center; margin-bottom: 12px; }
	.err-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px; color: #dc2626; font-size: 13px; margin-top: 16px; }

	/* ANALYZING — Perplexity-style timeline */
	.an-header { display: flex; align-items: center; gap: 16px; margin-bottom: 2rem; }
	.an-orb { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--color-rosys-100), var(--color-rosys-200)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.an-orb-inner { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, var(--color-rosys-400), var(--color-rosys-500)); animation: orbPulse 2s ease-in-out infinite; }
	@keyframes orbPulse { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } }
	.an-title { font-size: 20px; font-weight: 700; color: var(--color-rosys-fg); letter-spacing: -0.02em; margin: 0; }
	.an-sub { font-size: 13px; color: var(--color-rosys-fg-faint); margin: 2px 0 0; }

	.an-timeline { display: flex; flex-direction: column; gap: 0; }

	.an-step { display: flex; gap: 0; opacity: 0.35; transition: opacity 0.4s ease; }
	.an-step.an-done, .an-step.an-active { opacity: 1; }

	.an-step-line { display: flex; flex-direction: column; align-items: center; width: 32px; flex-shrink: 0; padding-top: 2px; }
	.an-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--color-warm-200); color: var(--color-rosys-fg-faint); transition: all 0.3s; }
	.an-done .an-dot { background: #059669; color: white; }
	.an-active .an-dot { background: var(--color-rosys-500); color: white; }
	.an-dot-num { font-size: 11px; font-weight: 600; }

	.an-step-body { flex: 1; padding: 0 0 24px 12px; border-left: 2px solid var(--color-warm-200); margin-left: -1px; }
	.an-step:last-child .an-step-body { border-left-color: transparent; }
	.an-done .an-step-body { border-left-color: #a7f3d0; }
	.an-active .an-step-body { border-left-color: color-mix(in srgb, var(--color-rosys-300) 50%, transparent); }

	.an-step-title { display: block; font-size: 14px; font-weight: 600; color: var(--color-rosys-fg); margin-bottom: 8px; padding-top: 2px; }
	.an-pending .an-step-title { color: var(--color-rosys-fg-faint); }

	.an-data-card { background: white; border-radius: 12px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 35%, transparent); box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
	.an-data-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 15%, transparent); }
	.an-data-row:last-child { border-bottom: none; }
	.an-data-row span { color: var(--color-rosys-fg-muted); }
	.an-data-row strong { color: var(--color-rosys-fg); }
	.an-score { font-weight: 700; color: #059669; }
	.an-data-note { font-size: 10px; color: var(--color-rosys-fg-faint); margin-top: 6px; display: block; }

	.an-fit-row { display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid color-mix(in srgb, var(--color-rosys-border) 15%, transparent); }
	.an-fit-chip { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; background: var(--color-warm-50); }
	.an-fit-chip-label { font-size: 11px; color: var(--color-rosys-fg-muted); }
	.an-fit-chip-tag { font-size: 10px; font-weight: 700; text-transform: capitalize; padding: 1px 5px; border-radius: 4px; }
	.an-fit-chip-tag.exact { background: #ecfdf5; color: #059669; }
	.an-fit-chip-tag.comfortable { background: #eff6ff; color: #2563eb; }
	.an-fit-chip-tag.tight { background: #fffbeb; color: #d97706; }
	.an-fit-chip-tag.loose { background: #f5f3ff; color: #7c3aed; }

	.an-profile-chips { display: flex; gap: 8px; }
	.an-profile-chip { text-align: center; flex: 1; padding: 8px 4px; border-radius: 8px; background: var(--color-warm-50); }
	.an-profile-val { display: block; font-size: 16px; font-weight: 700; color: var(--color-rosys-fg); }
	.an-profile-label { font-size: 10px; color: var(--color-rosys-fg-faint); }

	.an-thinking { margin-top: 10px; }
	.an-thinking span { font-size: 12px; color: var(--color-rosys-fg-faint); display: block; margin-top: 6px; }
	.an-thinking-bar { height: 3px; border-radius: 2px; background: var(--color-warm-200); overflow: hidden; }
	.an-thinking-fill { height: 100%; width: 40%; border-radius: 2px; background: linear-gradient(90deg, var(--color-rosys-300), var(--color-rosys-500)); animation: thinkSlide 2s ease-in-out infinite; }
	@keyframes thinkSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }

	/* Refine overlay */
	.refine-overlay {
		position: fixed; inset: 0; z-index: 50;
		display: flex; align-items: center; justify-content: center;
		background: rgba(0,0,0,0.2);
		backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
		animation: fadeIn 0.25s ease-out;
	}
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	.refine-modal {
		background: white; border-radius: 20px; padding: 32px 36px;
		box-shadow: 0 20px 60px rgba(0,0,0,0.15); text-align: center;
		max-width: 320px; width: 90%; animation: modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1);
	}
	@keyframes modalPop { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
	.refine-orb { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--color-rosys-100), var(--color-rosys-200)); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
	.refine-orb-inner { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, var(--color-rosys-400), var(--color-rosys-500)); animation: orbPulse 1.5s ease-in-out infinite; }
	.refine-title { font-size: 17px; font-weight: 700; color: var(--color-rosys-fg); margin: 0 0 4px; letter-spacing: -0.02em; }
	.refine-sub { font-size: 13px; color: var(--color-rosys-fg-muted); margin: 0 0 18px; }
	.refine-bar { height: 3px; border-radius: 2px; background: var(--color-warm-200); overflow: hidden; }
	.refine-bar-fill { height: 100%; width: 40%; border-radius: 2px; background: linear-gradient(90deg, var(--color-rosys-300), var(--color-rosys-500)); animation: thinkSlide 1.8s ease-in-out infinite; }
	.results-blur { filter: blur(4px); pointer-events: none; transition: filter 0.25s ease; }

	/* RESULTS */
	.results > * { animation: fadeUp 0.3s ease-out both; }
	.results > :nth-child(2) { animation-delay: 0.05s; }
	.results > :nth-child(3) { animation-delay: 0.1s; }
	.results > :nth-child(4) { animation-delay: 0.15s; }
	.results > :nth-child(5) { animation-delay: 0.2s; }

	/* Size hero */
	.size-hero { text-align: center; margin-bottom: 1.5rem; }
	.size-badge { display: inline-flex; flex-direction: column; align-items: center; padding: 22px 44px; border-radius: 22px; background: linear-gradient(145deg, #059669, #047857); box-shadow: 0 16px 40px -10px rgba(5,150,105,0.4); animation: pop 0.5s cubic-bezier(0.34,1.56,0.64,1); }
	@keyframes pop { from { opacity: 0; transform: scale(0.75); } to { opacity: 1; transform: scale(1); } }
	.size-pattern { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.6); font-weight: 600; }
	.size-number { font-size: 52px; font-weight: 800; color: white; letter-spacing: -0.04em; line-height: 1; }
	.size-strip { display: flex; justify-content: center; gap: 5px; margin-top: 14px; }
	.pip { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; background: var(--color-warm-100); color: var(--color-rosys-fg-faint); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); transition: all 0.2s; }
	.pip.on { background: #059669; color: white; border-color: #059669; transform: scale(1.2); box-shadow: 0 3px 10px rgba(5,150,105,0.35); }

	.between-card { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a40; margin-bottom: 16px; font-size: 13px; color: #92400e; }

	/* Fit cards */
	.fit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
	.fit-card { padding: 14px 12px 10px; border-radius: 14px; background: white; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent); }
	.fit-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
	.fit-name { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-rosys-fg-faint); }
	.fit-num { font-size: 24px; font-weight: 800; color: var(--color-rosys-fg); letter-spacing: -0.02em; }
	.fit-num small { font-size: 12px; font-weight: 400; color: var(--color-rosys-fg-faint); }
	.fit-compare { display: flex; justify-content: space-between; font-size: 10px; color: var(--color-rosys-fg-faint); margin-top: 4px; }
	.fit-diff.pos { color: #059669; }
	.fit-diff.neg { color: #dc2626; }
	.fit-tag { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 6px; text-transform: capitalize; }
	.fit-tag.exact { background: #ecfdf5; color: #059669; }
	.fit-tag.comfortable { background: #eff6ff; color: #2563eb; }
	.fit-tag.tight { background: #fffbeb; color: #d97706; }
	.fit-tag.loose { background: #f5f3ff; color: #7c3aed; }
	.fit-bar { height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--color-rosys-border) 30%, transparent); margin-top: 8px; overflow: hidden; }
	.fit-bar-fill { height: 100%; border-radius: 2px; transition: width 0.8s ease; }
	.fit-bar-fill.exact { background: #059669; }
	.fit-bar-fill.comfortable { background: #2563eb; }
	.fit-bar-fill.tight { background: #d97706; }
	.fit-bar-fill.loose { background: #7c3aed; }

	/* Recommendation cards */
	.rec-cards { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
	.rec-card { display: flex; gap: 12px; padding: 16px; border-radius: 14px; background: white; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent); }
	.rec-card.updated { background: var(--color-rosys-50); border-color: color-mix(in srgb, var(--color-rosys-200) 50%, transparent); }
	.rec-card.changed { background: #fffbeb; border-color: #fde68a30; }
	.rec-card.between { background: #fffbeb; border-color: #fde68a30; padding: 14px 16px; }
	.rec-card.fit-detail { padding: 14px 16px; flex-direction: column; }
	.rec-card.adjust { background: #eff6ff; border-color: #bfdbfe30; }
	.rec-icon { width: 28px; height: 28px; border-radius: 8px; background: color-mix(in srgb, var(--color-rosys-100) 60%, white); display: flex; align-items: center; justify-content: center; color: var(--color-rosys-400); flex-shrink: 0; }
	.rec-icon.updated-icon { background: var(--color-rosys-100); color: var(--color-rosys-500); }
	.rec-icon.adjust-icon { background: #dbeafe; color: #3b82f6; }
	.rec-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-rosys-fg-faint); margin-bottom: 4px; }
	.rec-details { padding: 14px 16px; border-radius: 14px; background: var(--color-warm-50); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 20%, transparent); }
	.rec-details summary { font-size: 13px; font-weight: 500; color: var(--color-rosys-fg-muted); cursor: pointer; display: flex; align-items: center; gap: 6px; }
	.rec-details[open] summary { margin-bottom: 8px; }

	/* Panels */
	.panels { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
	.panel-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; background: white; border: none; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--color-rosys-fg); border-radius: 12px; transition: background 0.15s; text-align: left; }
	.panel-btn:hover { background: var(--color-warm-50); }
	.panel-content { padding: 0 16px 16px; }

	/* Tables */
	.tbl { width: 100%; font-size: 12px; border-collapse: collapse; }
	.tbl th { padding: 6px; text-align: center; font-weight: 500; color: var(--color-rosys-fg-faint); border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); }
	.tbl td { padding: 6px; text-align: center; color: var(--color-rosys-fg); border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 15%, transparent); }
	.tbl th:first-child, .tbl td:first-child { text-align: left; }
	:global(.hl) { color: #059669 !important; font-weight: 700 !important; }
	:global(.tl) { color: var(--color-rosys-fg-muted); font-weight: 500; }
	:global(.tv) { color: #7c3aed !important; font-weight: 700 !important; }
	:global(.tdv) { color: #7c3aed; font-weight: 600; background: color-mix(in srgb, #7c3aed 5%, transparent); }

	/* Profile */
	.profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.profile-cell { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: 10px; background: var(--color-warm-50); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 25%, transparent); }
	.profile-num { font-size: 18px; font-weight: 700; color: var(--color-rosys-fg); }
	.profile-num small { font-size: 11px; font-weight: 400; color: var(--color-rosys-fg-faint); }
	.profile-lbl { font-size: 10px; color: var(--color-rosys-fg-faint); }

	/* Fine-tune */
	.fine-tune-section { margin-bottom: 8px; }
	.fine-tune-btn {
		display: flex; align-items: center; justify-content: space-between; width: 100%;
		padding: 18px 20px; border-radius: 16px; border: none; cursor: pointer;
		background: linear-gradient(135deg, color-mix(in srgb, var(--color-rosys-50) 80%, white), white);
		border: 1px solid color-mix(in srgb, var(--color-rosys-200) 50%, transparent);
		transition: all 0.15s; text-align: left;
	}
	.fine-tune-btn:hover { border-color: var(--color-rosys-300); box-shadow: 0 2px 12px rgba(232,54,109,0.06); }
	.fine-tune-left { display: flex; align-items: center; gap: 12px; }
	.fine-tune-ico { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--color-rosys-400), var(--color-rosys-500)); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
	.fine-tune-btn strong { display: block; font-size: 14px; color: var(--color-rosys-fg); }
	.fine-tune-btn span { display: block; font-size: 12px; color: var(--color-rosys-fg-faint); margin-top: 1px; }

	.prefs { background: white; border-radius: 16px; padding: 20px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 30%, transparent); margin-top: 10px; margin-bottom: 12px; }
	.pref-group { margin-bottom: 18px; }
	.pref-group:last-of-type { margin-bottom: 20px; }
	.pref-title { display: block; font-size: 12px; font-weight: 600; color: var(--color-rosys-fg); margin-bottom: 8px; }
	.pref-chips { display: flex; gap: 6px; flex-wrap: wrap; }
	.pref-area-row { display: grid; grid-template-columns: 50px 1fr 1fr; gap: 6px; align-items: center; margin-bottom: 6px; }
	.pref-area-label { font-size: 12px; font-weight: 500; color: var(--color-rosys-fg-muted); }

	.chip { flex: 1; min-width: 0; padding: 11px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; background: var(--color-warm-50); color: var(--color-rosys-fg-muted); border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); text-align: center; }
	.chip:hover { border-color: var(--color-rosys-300); background: var(--color-rosys-50); }
	.chip-sm { font-size: 11px; padding: 9px 6px; }
	:global(.chip-on) { background: var(--color-rosys-500) !important; color: white !important; border-color: var(--color-rosys-500) !important; box-shadow: 0 3px 10px -2px color-mix(in srgb, var(--color-rosys-500) 35%, transparent); }

	/* Downloads */
	.locked-banner { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 14px; background: #ecfdf5; border: 1px solid #a7f3d040; margin-bottom: 16px; font-size: 14px; }
	.locked-banner strong { display: block; }
	.download-card { background: white; border-radius: 16px; padding: 20px; border: 1px solid color-mix(in srgb, var(--color-rosys-border) 40%, transparent); margin-bottom: 16px; }
	.card-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-rosys-fg-faint); }
	.dl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.dl-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px; border-radius: 12px; background: var(--color-rosys-50); border: 1px solid color-mix(in srgb, var(--color-rosys-200) 50%, transparent); color: var(--color-rosys-fg); text-decoration: none; transition: all 0.15s; text-align: center; }
	.dl-btn:hover { background: var(--color-rosys-100); border-color: var(--color-rosys-300); }
	.dl-btn:active { transform: scale(0.96); }
	.dl-btn strong { font-size: 14px; }
	.dl-btn span { font-size: 10px; color: var(--color-rosys-fg-faint); }
	.dl-btn :global(svg) { color: var(--color-rosys-400); }

	/* Custom fit */
	.custom-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 18px 20px; border-radius: 14px; border: 1px solid #ddd6fe50; cursor: pointer; background: linear-gradient(135deg, #f5f3ff, #ede9fe80); transition: all 0.15s; text-align: left; margin-bottom: 12px; }
	.custom-btn:hover { border-color: #c4b5fd; }
	.custom-btn strong { font-size: 14px; color: var(--color-rosys-fg); }
	.custom-panel { background: white; border-radius: 16px; padding: 20px; border: 1px solid #ddd6fe30; margin-bottom: 16px; }
	.custom-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 24px 0; font-size: 14px; color: var(--color-rosys-fg-muted); }
	.custom-dl-btn { background: linear-gradient(to bottom, #faf5ff, white) !important; border-color: #ddd6fe80 !important; cursor: pointer; }
	.custom-dl-btn:hover { background: #f5f3ff !important; border-color: #c4b5fd !important; }
	.custom-dl-btn :global(svg) { color: #a78bfa !important; }

	/* Prose */
	:global(.rec-body p) { font-size: 14px; line-height: 1.65; color: var(--color-rosys-fg-secondary); margin-bottom: 2px; }
	:global(.rec-body strong) { color: var(--color-rosys-fg); font-weight: 600; }
	:global(.rec-body ul) { list-style: none; padding: 0; margin: 0; }
	:global(.rec-body li) { font-size: 14px; line-height: 1.65; color: var(--color-rosys-fg-secondary); padding: 4px 0; border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 12%, transparent); }
	:global(.rec-body li:last-child) { border-bottom: none; }
</style>
