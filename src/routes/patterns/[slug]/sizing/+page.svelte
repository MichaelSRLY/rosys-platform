<script context="module" lang="ts">
	/** Convert streamed markdown to HTML */
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
	import BodySilhouette from '$lib/components/sizing/BodySilhouette.svelte';

	let { data } = $props();
	const { pattern, chart, rawSizeChart, savedProfile } = data;

	const sizes = chart?.sizes ?? [];
	const bodyRows = chart?.body ?? [];
	const hasChart = sizes.length > 0;

	// ─── State ───

	type Phase = 'entry' | 'measurements' | 'photo' | 'body-profile' | 'analyzing' | 'results';

	let phase = $state<Phase>('entry');
	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');
	let height = $state(savedProfile?.height_cm?.toString() ?? '');
	let errorMsg = $state('');

	// Streaming / AI state
	let deterministicResult = $state<any>(null);
	let streamedText = $state('');
	let isStreaming = $state(false);
	let profile = $state<any>(null);
	let chartData = $state<any>(null);
	let hasDxf = $state(false);

	// Follow-up preferences (optional)
	let showPreferences = $state(false);
	let fitPreference = $state('');
	let bustPref = $state('');
	let waistPref = $state('');
	let hipPref = $state('');
	let lengthPref = $state('');
	let fabricStretch = $state('');
	let isRefining = $state(false);
	let refinedText = $state('');

	// UI toggles
	let showChart = $state(false);
	let showProfile = $state(false);
	let showFinished = $state(false);
	let sizeLocked = $state(false);

	// Custom-fit state
	let showCustomFit = $state(false);
	let customFitLoading = $state(false);
	let customFitGrading = $state<any>(null);
	let customFitError = $state('');

	// Derived
	const canSubmit = $derived(!!(bust && waist && hip));
	const refinedSize = $derived(() => {
		if (!refinedText) return null;
		const m = refinedText.match(/(?:suggest|recommend)\s+Size\s+([A-Z0-9]{1,4})/i);
		return m ? m[1].toUpperCase() : null;
	});
	const recommendedSize = $derived(refinedSize() ?? deterministicResult?.recommended_size ?? null);
	const highlightedIndex = $derived(recommendedSize ? (chartData?.sizes ?? sizes).indexOf(recommendedSize) : -1);
	const hasPreferences = $derived(!!(fitPreference || bustPref || waistPref || hipPref || lengthPref || fabricStretch));

	// ─── SSE Parser ───

	async function consumeStream(res: Response) {
		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// SSE format: event: <type>\ndata: <json>\n\n
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
					} else if (eventType === 'chunk') {
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

	// ─── Actions ───

	function startBodyProfile() {
		phase = 'body-profile';
		setTimeout(() => startStreaming(), 3000);
	}

	async function startStreaming() {
		phase = 'analyzing';
		isStreaming = true;
		streamedText = '';
		errorMsg = '';

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
					}
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
		fitPreference = bustPref = waistPref = hipPref = lengthPref = fabricStretch = '';
	}

	// Auto-fill if saved measurements
	$effect(() => {
		if (savedProfile && bust && waist && hip) phase = 'measurements';
	});
</script>

<svelte:head>
	<title>Find Your Size — {pattern.pattern_name}</title>
</svelte:head>

<div class="px-5 py-8 md:px-8 md:py-12 max-w-lg mx-auto">

	<!-- Back link -->
	<a href="/patterns/{pattern.pattern_slug}"
		class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-10 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<!-- ═══ ENTRY: Two paths ═══ -->
	{#if phase === 'entry'}
		<div class="page-enter">
			<div class="text-center mb-10">
				<div class="w-14 h-14 rounded-[18px] bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rosys-500/20">
					<Sparkles class="w-6 h-6 text-white" strokeWidth={1.5} />
				</div>
				<h1 class="text-rosys-fg text-[28px] font-bold tracking-[-0.04em] mb-2">Find Your Perfect Size</h1>
				<p class="text-rosys-fg-muted text-[15px] leading-relaxed max-w-xs mx-auto">{pattern.pattern_name}</p>
			</div>

			<div class="space-y-3">
				<button type="button" onclick={() => phase = 'measurements'}
					class="w-full text-left p-5 rounded-2xl border border-rosys-border/40 bg-white hover:bg-rosys-50/30 hover:border-rosys-300 transition-all active:scale-[0.98]">
					<div class="flex items-start gap-4">
						<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center shrink-0 shadow-md shadow-rosys-500/20">
							<Ruler class="w-6 h-6 text-white" strokeWidth={1.5} />
						</div>
						<div>
							<p class="font-semibold text-rosys-fg text-[17px]">Measure yourself</p>
							<p class="text-rosys-fg-muted text-[13px] mt-1 leading-relaxed">Enter bust, waist, hip, and height</p>
							<span class="inline-block mt-2.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Most accurate</span>
						</div>
					</div>
				</button>

				<button type="button" onclick={() => phase = 'photo'}
					class="w-full text-left p-5 rounded-2xl border border-rosys-border/30 bg-white/60 hover:bg-white transition-all active:scale-[0.98] opacity-80">
					<div class="flex items-start gap-4">
						<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shrink-0">
							<Camera class="w-6 h-6 text-white" strokeWidth={1.5} />
						</div>
						<div>
							<p class="font-semibold text-rosys-fg text-[17px]">Upload a photo</p>
							<p class="text-rosys-fg-faint text-[13px] mt-1 leading-relaxed">AI estimates from a full-body photo</p>
							<span class="inline-block mt-2.5 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Beta — less accurate</span>
						</div>
					</div>
				</button>
			</div>
		</div>

	<!-- ═══ PHOTO (beta placeholder) ═══ -->
	{:else if phase === 'photo'}
		<div class="page-enter text-center">
			<h1 class="text-rosys-fg text-[24px] font-bold tracking-[-0.03em] mb-2">Photo Upload</h1>
			<span class="inline-block text-[11px] font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full mb-4">Beta</span>
			<p class="text-rosys-fg-muted text-[14px] leading-relaxed max-w-xs mx-auto mb-6">
				Try our <a href="/profile/measurements/photo" class="text-rosys-500 underline hover:text-rosys-600">photo measurement tool</a>, then come back here with your saved measurements.
			</p>
			<div class="border-2 border-dashed border-rosys-border/40 rounded-2xl p-14 mb-6">
				<Camera class="w-12 h-12 text-rosys-fg-faint/30 mx-auto mb-3" strokeWidth={1} />
				<p class="text-rosys-fg-faint text-[13px]">MediaPipe body estimation available in profile</p>
			</div>
			<button type="button" onclick={() => phase = 'measurements'}
				class="w-full py-3.5 rounded-xl bg-rosys-50 text-rosys-600 font-semibold text-[14px] hover:bg-rosys-100 transition-colors">
				Use tape measure instead
			</button>
		</div>

	<!-- ═══ MEASUREMENTS ═══ -->
	{:else if phase === 'measurements'}
		<div class="page-enter">
			<div class="text-center mb-8">
				<div class="w-14 h-14 rounded-[18px] bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rosys-500/20">
					<Ruler class="w-6 h-6 text-white" strokeWidth={1.5} />
				</div>
				<h1 class="text-rosys-fg text-[28px] font-bold tracking-[-0.04em] mb-2">Your Measurements</h1>
				<p class="text-rosys-fg-muted text-[14px]">Soft tape — snug but not tight</p>
			</div>

			<div class="space-y-4 mb-8">
				{#each [
					{ id: 'bust', label: 'Bust', ph: 'e.g. 88', get: () => bust, set: (v: string) => bust = v },
					{ id: 'waist', label: 'Waist', ph: 'e.g. 72', get: () => waist, set: (v: string) => waist = v },
					{ id: 'hip', label: 'Hip', ph: 'e.g. 92', get: () => hip, set: (v: string) => hip = v },
					{ id: 'height', label: 'Height', ph: 'e.g. 168', get: () => height, set: (v: string) => height = v, opt: true },
				] as f}
					<div>
						<label for={f.id} class="block text-[13px] font-medium text-rosys-fg mb-2">
							{f.label}{#if f.opt}<span class="font-normal text-rosys-fg-faint"> (for length advice)</span>{/if}
						</label>
						<div class="relative">
							<input id={f.id} type="number" inputmode="numeric" placeholder={f.ph} value={f.get()} oninput={(e) => f.set((e.target as HTMLInputElement).value)}
								class="w-full px-5 py-4 rounded-2xl bg-white border border-rosys-border/50 text-[17px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-400 transition-all shadow-sm" />
							<span class="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-rosys-fg-faint">cm</span>
						</div>
					</div>
				{/each}
			</div>

			{#if errorMsg}<p class="text-rosys-500 text-[13px] text-center mb-4">{errorMsg}</p>{/if}

			<button type="button" disabled={!canSubmit} onclick={startBodyProfile}
				class="w-full py-4 rounded-2xl font-semibold text-[16px] text-white bg-gradient-to-r from-rosys-500 to-rosys-600 hover:from-rosys-600 hover:to-rosys-700 active:scale-[0.98] transition-all shadow-lg shadow-rosys-500/20 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2.5">
				<Sparkles class="w-5 h-5" strokeWidth={2} />
				Analyze my fit
			</button>

			{#if savedProfile}
				<p class="text-center text-[12px] text-rosys-fg-faint mt-3"><Check class="w-3 h-3 inline text-emerald-500" strokeWidth={2} /> Using your saved measurements</p>
			{/if}

			<button type="button" onclick={() => phase = 'entry'} class="w-full mt-4 py-2 text-[13px] text-rosys-fg-faint hover:text-rosys-500 transition-colors">
				<ArrowLeft class="w-3.5 h-3.5 inline" strokeWidth={1.5} /> Back
			</button>
		</div>

	<!-- ═══ BODY PROFILE ANIMATION ═══ -->
	{:else if phase === 'body-profile'}
		<div class="page-enter">
			<div class="text-center mb-6">
				<h1 class="text-rosys-fg text-[22px] font-bold tracking-[-0.03em] mb-1">Your Body Profile</h1>
				<p class="text-rosys-fg-faint text-[13px]">Mapping your measurements</p>
			</div>
			<BodySilhouette bust={parseFloat(bust)||0} waist={parseFloat(waist)||0} hips={parseFloat(hip)||0} height={parseFloat(height)||0} />
			<div class="flex items-center justify-center gap-2 text-[13px] text-rosys-fg-faint mt-6">
				<Loader2 class="w-4 h-4 animate-spin text-rosys-400" strokeWidth={2} />
				<span>Preparing AI analysis...</span>
			</div>
		</div>

	<!-- ═══ AI ANALYSIS (streaming) ═══ -->
	{:else if phase === 'analyzing'}
		<div class="page-enter">
			{#if recommendedSize}
				<div class="text-center mb-6">
					<div class="inline-block px-10 py-5 rounded-[20px] bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/25 page-enter">
						<div class="text-white/70 text-[11px] uppercase tracking-[0.15em] font-medium mb-1">{deterministicResult?.pattern_name}</div>
						<div class="text-white text-[46px] font-bold tracking-tight leading-none">{recommendedSize}</div>
					</div>
				</div>
			{/if}

			<h1 class="text-center text-rosys-fg text-[20px] font-bold tracking-[-0.03em] mb-5">Analyzing your fit...</h1>

			<div class="bg-white rounded-2xl border border-rosys-border/30 shadow-sm p-5 mb-6 max-h-[55vh] overflow-y-auto">
				{#if streamedText}
					<div class="sizing-prose">{@html renderMarkdown(streamedText)}</div>
				{:else}
					<div class="flex items-center gap-3 text-rosys-fg-faint py-4">
						<Loader2 class="w-5 h-5 animate-spin text-rosys-400" strokeWidth={2} />
						<span>Thinking about your measurements...</span>
					</div>
				{/if}
				{#if isStreaming}<span class="inline-block w-1.5 h-4 bg-rosys-400 rounded-sm ml-0.5 animate-pulse"></span>{/if}
			</div>

			{#if errorMsg}<div class="bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-[13px] mb-4">{errorMsg}</div>{/if}
		</div>

	<!-- ═══ RESULTS (full recommendation) ═══ -->
	{:else if phase === 'results'}
		<div class="page-enter">

			<!-- ── Size badge ── -->
			{#if recommendedSize}
				<div class="text-center mb-5">
					<div class="inline-block px-10 py-5 rounded-[20px] bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/25">
						<div class="text-white/70 text-[11px] uppercase tracking-[0.15em] font-medium mb-1">{deterministicResult?.pattern_name}</div>
						<div class="text-white text-[46px] font-bold tracking-tight leading-none">{recommendedSize}</div>
					</div>
				</div>

				<div class="flex justify-center gap-1.5 mb-6">
					{#each (chartData?.sizes ?? sizes).length > 0 ? (chartData?.sizes ?? sizes) : ['XXS','XS','S','M','L','XL','XXL'] as s, i}
						<div class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all
							{s === recommendedSize ? 'bg-emerald-500 text-white shadow-md scale-110' : 'bg-warm-100 text-rosys-fg-faint border border-rosys-border/30'}">{s}</div>
					{/each}
				</div>
			{/if}

			<!-- ── Between sizes ── -->
			{#if deterministicResult?.between_sizes}
				<div class="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/30 mb-5">
					<span class="text-[20px] leading-none mt-0.5">↕</span>
					<p class="text-[13px] text-amber-800">Between <strong>{deterministicResult.lower_size}</strong> and <strong>{deterministicResult.upper_size}</strong></p>
				</div>
			{/if}

			<!-- ── AI Analysis (THE STAR) ── -->
			<div class="bg-white rounded-2xl border border-rosys-border/30 shadow-sm p-5 mb-5">
				<div class="sizing-prose">{@html renderMarkdown(refinedText || streamedText)}</div>
			</div>

			<!-- ── Fit badges ── -->
			{#if deterministicResult?.fit}
				<div class="grid grid-cols-3 gap-2 mb-5">
					{#each [
						{ label: 'Bust', d: deterministicResult.fit.bust },
						{ label: 'Waist', d: deterministicResult.fit.waist },
						{ label: 'Hip', d: deterministicResult.fit.hip },
					] as { label, d }}
						{#if d}
							<div class="text-center p-3 rounded-xl bg-white border border-rosys-border/20 shadow-sm">
								<p class="text-[10px] text-rosys-fg-faint uppercase tracking-wider">{label}</p>
								<p class="text-[17px] font-bold text-rosys-fg mt-0.5">{d.user_cm}<span class="text-[11px] font-normal text-rosys-fg-faint ml-0.5">cm</span></p>
								<span class="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize
									{d.fit === 'exact' ? 'text-emerald-700 bg-emerald-50' : d.fit === 'comfortable' ? 'text-blue-700 bg-blue-50' : d.fit === 'tight' ? 'text-amber-700 bg-amber-50' : 'text-violet-700 bg-violet-50'}">{d.fit}</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- ── Finished measurements (the data) ── -->
			{#if chartData?.finished?.length > 0}
				<button type="button" onclick={() => showFinished = !showFinished}
					class="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-rosys-border/30 shadow-sm hover:shadow-md transition-all mb-4">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-xl bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center">
							<Ruler class="w-4 h-4 text-white" strokeWidth={2} />
						</div>
						<div class="text-left">
							<p class="text-[13px] font-semibold text-rosys-fg">Finished Garment Measurements</p>
							<p class="text-[11px] text-rosys-fg-faint">How the actual dress will measure when sewn</p>
						</div>
					</div>
					<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showFinished ? 'rotate-180' : ''}" strokeWidth={1.5} />
				</button>

				{#if showFinished}
					<div class="bg-white rounded-2xl border border-rosys-border/20 shadow-sm p-4 mb-5 page-enter overflow-x-auto">
						<table class="w-full text-[12px]">
							<thead>
								<tr class="border-b border-rosys-border/30">
									<th class="text-left py-1.5 pr-2 text-rosys-fg-faint font-medium"></th>
									{#each chartData.sizes as s, i}
										<th class="text-center py-1.5 px-1 font-semibold {i === highlightedIndex ? 'text-emerald-600' : 'text-rosys-fg'}">{s}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each [
									{ key: 'bust_cm', label: 'Bust' },
									{ key: 'waist_cm', label: 'Waist' },
									{ key: 'hip_cm', label: 'Hip' },
									{ key: 'full_length_cm', label: 'Length' },
									{ key: 'sleeve_length_cm', label: 'Sleeve' },
								] as col}
									{@const hasData = chartData.finished.some((r: any) => r[col.key])}
									{#if hasData}
										<tr class="border-b border-rosys-border/10">
											<td class="py-1.5 pr-2 text-rosys-fg-muted">{col.label}</td>
											{#each chartData.finished as row, i}
												<td class="text-center py-1.5 px-1 {i === highlightedIndex ? 'font-semibold text-emerald-600 bg-emerald-50/30' : 'text-rosys-fg'}">{row[col.key] ? Number(row[col.key]) : '—'}</td>
											{/each}
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
						<p class="text-[10px] text-rosys-fg-faint mt-2">Finished = actual garment dimensions (body + ease)</p>
					</div>
				{/if}
			{/if}

			<!-- ── Body profile (MLP) ── -->
			{#if profile}
				<button type="button" onclick={() => showProfile = !showProfile}
					class="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-rosys-border/30 shadow-sm hover:shadow-md transition-all mb-4">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
							<Zap class="w-4 h-4 text-white" strokeWidth={2} />
						</div>
						<div class="text-left">
							<p class="text-[13px] font-semibold text-rosys-fg">Your Body Profile</p>
							<p class="text-[11px] text-rosys-fg-faint">Predicted from 59,000 body records</p>
						</div>
					</div>
					<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showProfile ? 'rotate-180' : ''}" strokeWidth={1.5} />
				</button>
				{#if showProfile}
					<div class="bg-white rounded-2xl border border-rosys-border/20 shadow-sm p-5 mb-5 page-enter">
						<div class="grid grid-cols-3 gap-3">
							{#each [
								{ label: 'Shoulder', value: profile.shoulder_cm, icon: '↔' },
								{ label: 'Arm Length', value: profile.arm_length_cm, icon: '📏' },
								{ label: 'Arm Circ.', value: profile.arm_circ_cm, icon: '💪' },
								{ label: 'Leg Length', value: profile.leg_length_cm, icon: '🦵' },
								{ label: 'Weight', value: profile.weight_kg, icon: '⚖️', unit: 'kg' },
								{ label: 'Neck', value: profile.neck_cm, icon: '👔' },
							] as m}
								{#if m.value}
									<div class="text-center p-3 rounded-xl bg-gradient-to-b from-warm-50 to-white border border-rosys-border/20">
										<span class="text-[16px]">{m.icon}</span>
										<p class="text-[18px] font-bold text-rosys-fg mt-1">{m.value}</p>
										<p class="text-[10px] text-rosys-fg-faint">{m.unit || 'cm'} · {m.label}</p>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/if}

			<!-- ═══ OPTIONAL: Fit Preferences (follow-up) ═══ -->
			{#if !sizeLocked}
				<button type="button" onclick={() => showPreferences = !showPreferences}
					class="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-rosys-50/80 to-white border border-rosys-200/40 shadow-sm hover:shadow-md transition-all mb-5">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-xl bg-gradient-to-br from-rosys-400 to-rosys-500 flex items-center justify-center">
							<MessageCircle class="w-4 h-4 text-white" strokeWidth={2} />
						</div>
						<div class="text-left">
							<p class="text-[13px] font-semibold text-rosys-fg">Want to fine-tune?</p>
							<p class="text-[11px] text-rosys-fg-faint">Tell us how you like your fit — optional</p>
						</div>
					</div>
					<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showPreferences ? 'rotate-180' : ''}" strokeWidth={1.5} />
				</button>

				{#if showPreferences}
					<div class="bg-white rounded-2xl border border-rosys-border/20 shadow-sm p-5 mb-5 page-enter space-y-4">
						<p class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">How do you like your fit?</p>

						<!-- Overall fit -->
						<div>
							<p class="text-[12px] font-medium text-rosys-fg mb-2">Overall preference</p>
							<div class="flex gap-2">
								{#each ['Fitted & close', 'Comfortable ease', 'Loose & relaxed'] as opt}
									<button type="button" onclick={() => fitPreference = fitPreference === opt ? '' : opt}
										class="flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all border
										{fitPreference === opt ? 'bg-rosys-500 text-white border-rosys-500 shadow-sm' : 'bg-warm-50 text-rosys-fg-muted border-rosys-border/40 hover:border-rosys-300'}">{opt}</button>
								{/each}
							</div>
						</div>

						<!-- Per-measurement -->
						<div>
							<p class="text-[12px] font-medium text-rosys-fg mb-2">Specific areas</p>
							<div class="space-y-2">
								{#each [
									{ label: 'Bust', get: () => bustPref, set: (v: string) => bustPref = v, opts: ['More room', 'As fitted as possible'] },
									{ label: 'Waist', get: () => waistPref, set: (v: string) => waistPref = v, opts: ['More room', 'Defined waist'] },
									{ label: 'Hip', get: () => hipPref, set: (v: string) => hipPref = v, opts: ['More room', 'Slim through hip'] },
								] as area}
									<div class="flex items-center gap-2">
										<span class="text-[11px] text-rosys-fg-muted w-10 shrink-0">{area.label}</span>
										<div class="flex gap-1.5 flex-1">
											{#each area.opts as opt}
												<button type="button" onclick={() => area.set(area.get() === opt ? '' : opt)}
													class="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all border
													{area.get() === opt ? 'bg-rosys-100 text-rosys-700 border-rosys-300' : 'bg-warm-50 text-rosys-fg-faint border-rosys-border/30 hover:border-rosys-200'}">{opt}</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Length -->
						<div>
							<p class="text-[12px] font-medium text-rosys-fg mb-2">Length preference</p>
							<div class="flex gap-2">
								{#each ['Shorter', 'As designed', 'Longer'] as opt}
									<button type="button" onclick={() => lengthPref = lengthPref === opt ? '' : opt}
										class="flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all border
										{lengthPref === opt ? 'bg-rosys-500 text-white border-rosys-500 shadow-sm' : 'bg-warm-50 text-rosys-fg-muted border-rosys-border/40 hover:border-rosys-300'}">{opt}</button>
								{/each}
							</div>
						</div>

						<!-- Fabric -->
						<div>
							<p class="text-[12px] font-medium text-rosys-fg mb-2">Fabric type</p>
							<div class="flex gap-2">
								{#each ['Woven (no stretch)', 'Light stretch', 'Stretch knit'] as opt}
									<button type="button" onclick={() => fabricStretch = fabricStretch === opt ? '' : opt}
										class="flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all border
										{fabricStretch === opt ? 'bg-rosys-500 text-white border-rosys-500 shadow-sm' : 'bg-warm-50 text-rosys-fg-muted border-rosys-border/40 hover:border-rosys-300'}">{opt}</button>
								{/each}
							</div>
						</div>

						<button type="button" disabled={!hasPreferences || isRefining} onclick={refineWithPreferences}
							class="w-full py-3.5 rounded-2xl font-semibold text-[14px] text-white bg-gradient-to-r from-rosys-500 to-rosys-600 active:scale-[0.98] transition-all shadow-lg shadow-rosys-500/20 disabled:opacity-40 inline-flex items-center justify-center gap-2">
							{#if isRefining}
								<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Re-analyzing...
							{:else}
								<RefreshCw class="w-4 h-4" strokeWidth={2} />Update my recommendation
							{/if}
						</button>
					</div>

					<!-- Refined result -->
					{#if refinedText && !isRefining}
						<div class="bg-rosys-50/50 rounded-2xl border border-rosys-200/40 p-5 mb-5 page-enter">
							<p class="text-[11px] font-semibold text-rosys-500 uppercase tracking-[0.1em] mb-3">Updated Analysis</p>
							<div class="sizing-prose">{@html renderMarkdown(refinedText)}</div>
						</div>
					{/if}
				{/if}

				<!-- Lock size button -->
				<button type="button" onclick={() => { sizeLocked = true; showPreferences = false; }}
					class="w-full py-4 rounded-2xl font-semibold text-[16px] text-white bg-gradient-to-r from-emerald-500 to-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 inline-flex items-center justify-center gap-2.5 mb-5">
					<Check class="w-5 h-5" strokeWidth={2.5} />
					Lock in size {recommendedSize}
				</button>
			{/if}

			<!-- ═══ LOCKED: Downloads ═══ -->
			{#if sizeLocked}
				<div class="bg-emerald-50/50 rounded-2xl border border-emerald-200/30 p-4 mb-5 flex items-center gap-3">
					<div class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
						<Check class="w-4 h-4 text-white" strokeWidth={2.5} />
					</div>
					<div>
						<p class="text-[14px] font-semibold text-rosys-fg">Size {recommendedSize} locked</p>
						<p class="text-[12px] text-rosys-fg-muted">Ready to download your pattern</p>
					</div>
				</div>

				<!-- Standard PDF downloads -->
				<div class="bg-white rounded-2xl border border-rosys-border/30 shadow-sm p-5 mb-5">
					<p class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-1">Download Your Pattern</p>
					<p class="text-[13px] text-rosys-fg-muted mb-4">Size <strong>{recommendedSize}</strong> only — clean single-size PDF.</p>
					<div class="grid grid-cols-3 gap-2">
						{#each [
							{ format: 'a0', label: 'A0', sub: 'Print shop' },
							{ format: 'a4', label: 'A4', sub: 'Home' },
							{ format: 'us_letter', label: 'US Letter', sub: 'Home' }
						] as dl}
							<a href="/api/patterns/single-size?slug={pattern.pattern_slug}&size={recommendedSize}&format={dl.format}"
								class="flex flex-col items-center gap-1 py-3.5 px-2 rounded-xl bg-rosys-50/50 hover:bg-rosys-100/60 border border-rosys-200/40 hover:border-rosys-300 active:scale-[0.96] transition-all group">
								<Download class="w-4 h-4 text-rosys-400 group-hover:text-rosys-500" strokeWidth={1.5} />
								<span class="text-[13px] font-semibold text-rosys-fg">{dl.label}</span>
								<span class="text-[10px] text-rosys-fg-faint">{dl.sub}</span>
							</a>
						{/each}
					</div>
				</div>

				<!-- ═══ CUSTOM FIT (special beta) ═══ -->
				{#if hasDxf}
					<button type="button" onclick={() => { showCustomFit = !showCustomFit; if (!customFitGrading && !showCustomFit) return; if (showCustomFit && !customFitGrading) calculateCustomFit(); }}
						class="w-full flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-violet-50 to-violet-100/50 border border-violet-200/50 shadow-sm hover:shadow-md transition-all mb-4">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md shadow-violet-500/15">
								<Scissors class="w-5 h-5 text-white" strokeWidth={1.5} />
							</div>
							<div class="text-left">
								<div class="flex items-center gap-2">
									<p class="text-[14px] font-semibold text-rosys-fg">Want a custom-fit pattern?</p>
									<span class="text-[10px] font-semibold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Beta</span>
								</div>
								<p class="text-[12px] text-rosys-fg-muted mt-0.5">DXF adjusted to your exact body — for cutting machines</p>
							</div>
						</div>
						<ChevronDown class="w-4 h-4 text-violet-400 transition-transform {showCustomFit ? 'rotate-180' : ''}" strokeWidth={1.5} />
					</button>

					{#if showCustomFit}
						<div class="bg-white rounded-2xl border border-violet-200/30 shadow-sm p-5 mb-5 page-enter">
							{#if customFitLoading && !customFitGrading}
								<div class="flex items-center gap-3 py-6 justify-center">
									<Loader2 class="w-5 h-5 animate-spin text-violet-500" strokeWidth={2} />
									<span class="text-[14px] text-rosys-fg-muted">Calculating your custom fit...</span>
								</div>
								<div class="space-y-3 text-[13px] text-rosys-fg-muted">
									<p>Here's what's happening:</p>
									<div class="flex items-start gap-2"><span class="text-violet-500 mt-0.5">1.</span><span>Finding the closest base pattern size to your body</span></div>
									<div class="flex items-start gap-2"><span class="text-violet-500 mt-0.5">2.</span><span>Calculating how much each piece needs to scale</span></div>
									<div class="flex items-start gap-2"><span class="text-violet-500 mt-0.5">3.</span><span>Preserving the original ease and design proportions</span></div>
									<div class="flex items-start gap-2"><span class="text-violet-500 mt-0.5">4.</span><span>Validating every piece is within 1mm tolerance</span></div>
								</div>
							{:else if customFitGrading}
								<p class="text-[11px] font-semibold text-violet-600 uppercase tracking-[0.1em] mb-4">Custom Fit Preview</p>

								<div class="overflow-x-auto mb-4">
									<table class="w-full text-[12px]">
										<thead>
											<tr class="border-b border-rosys-border/30">
												<th class="text-left py-1.5 pr-2 text-rosys-fg-faint font-medium"></th>
												<th class="text-center py-1.5 px-2 text-rosys-fg-faint font-medium">Pattern ({customFitGrading.sample_size})</th>
												<th class="text-center py-1.5 px-2 font-semibold text-violet-600 bg-violet-50/50 rounded-t-lg">Your custom</th>
												<th class="text-center py-1.5 px-2 text-rosys-fg-faint font-medium">Change</th>
											</tr>
										</thead>
										<tbody>
											{#each [
												{ label: 'Bust', s: customFitGrading.sample_finished.bust_cm, c: customFitGrading.custom_finished.bust_cm, d: customFitGrading.adjustments.bust_delta_cm },
												{ label: 'Waist', s: customFitGrading.sample_finished.waist_cm, c: customFitGrading.custom_finished.waist_cm, d: customFitGrading.adjustments.waist_delta_cm },
												{ label: 'Hip', s: customFitGrading.sample_finished.hip_cm, c: customFitGrading.custom_finished.hip_cm, d: customFitGrading.adjustments.hip_delta_cm },
												{ label: 'Length', s: customFitGrading.sample_finished.full_length_cm, c: customFitGrading.custom_finished.full_length_cm, d: customFitGrading.adjustments.length_delta_cm },
											] as row}
												<tr class="border-b border-rosys-border/10">
													<td class="py-2 pr-2 text-rosys-fg-muted font-medium">{row.label}</td>
													<td class="text-center py-2 px-2">{row.s !== null ? `${row.s}cm` : '—'}</td>
													<td class="text-center py-2 px-2 font-semibold text-violet-700 bg-violet-50/50">{row.c !== null ? `${typeof row.c === 'number' ? row.c.toFixed(1) : row.c}cm` : '—'}</td>
													<td class="text-center py-2 px-2 font-medium {row.d && row.d !== 0 ? (row.d > 0 ? 'text-blue-600' : 'text-amber-600') : 'text-rosys-fg-faint'}">{row.d !== null ? `${row.d > 0 ? '+' : ''}${row.d.toFixed(1)}cm` : '—'}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<div class="flex items-center gap-2 mb-4">
									<span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border capitalize
										{customFitGrading.confidence === 'high' ? 'text-emerald-600 bg-emerald-50 border-emerald-200/60' :
										 customFitGrading.confidence === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200/60' :
										 'text-red-600 bg-red-50 border-red-200/60'}">{customFitGrading.confidence} confidence</span>
									<span class="text-[11px] text-rosys-fg-faint">Width {((customFitGrading.scale_width-1)*100).toFixed(1)}% · Height {((customFitGrading.scale_height-1)*100).toFixed(1)}%</span>
								</div>

								{#if customFitGrading.warnings.length > 0}
									{#each customFitGrading.warnings as warning}
										<div class="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200/40 mb-3 text-[12px] text-amber-700">⚠️ {warning}</div>
									{/each}
								{/if}

								{#if customFitError}
									<div class="p-4 rounded-lg bg-red-50 border border-red-200/40 mb-3"><p class="text-[13px] text-red-700">{customFitError}</p></div>
								{:else}
									<button type="button" disabled={customFitLoading} onclick={downloadCustomDxf}
										class="w-full py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40">
										{#if customFitLoading}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Generating DXF...
										{:else}<Download class="w-4 h-4" strokeWidth={2} />Download Custom DXF{/if}
									</button>
								{/if}

								<p class="text-[11px] text-rosys-fg-faint mt-3 leading-relaxed">
									The DXF is proportionally scaled from the base pattern. Each piece is validated within ±1mm. Best for simpler shapes — curved sections like armholes may need manual adjustment on complex garments.
								</p>
							{/if}
						</div>
					{/if}
				{/if}
			{/if}

			<!-- ── Size chart reference ── -->
			{#if hasChart}
				<div class="mt-6 pt-5 border-t border-rosys-border/20">
					<button type="button" onclick={() => showChart = !showChart}
						class="flex items-center gap-2 text-[12px] text-rosys-fg-faint hover:text-rosys-fg-muted transition-colors">
						<ChevronDown class="w-3 h-3 transition-transform {showChart ? 'rotate-180' : ''}" strokeWidth={1.5} />
						Body size chart
					</button>
					{#if showChart}
						<div class="mt-3 overflow-x-auto page-enter">
							<table class="w-full text-[11px]">
								<thead><tr class="border-b border-rosys-border/30">
									<th class="text-left py-1.5 pr-3 text-rosys-fg-faint font-medium"></th>
									{#each sizes as s, i}<th class="text-center py-1.5 px-1.5 font-semibold {i === highlightedIndex ? 'text-rosys-500' : 'text-rosys-fg'}">{s}</th>{/each}
								</tr></thead>
								<tbody>
									{#each ['bust_cm','waist_cm','hip_cm'] as key}
										{@const label = key === 'bust_cm' ? 'Bust' : key === 'waist_cm' ? 'Waist' : 'Hip'}
										<tr class="border-b border-rosys-border/10">
											<td class="py-1.5 pr-3 text-rosys-fg-muted">{label}</td>
											{#each bodyRows as row, i}<td class="text-center py-1.5 px-1.5 {i === highlightedIndex ? 'font-semibold text-rosys-500' : 'text-rosys-fg'}">{(row as any)[key] ? Number((row as any)[key]) : '—'}</td>{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Start over -->
			<button type="button" onclick={reset}
				class="w-full mt-5 py-3 rounded-xl text-[13px] font-medium text-rosys-fg-faint hover:text-rosys-500 transition-colors flex items-center justify-center gap-2">
				<RotateCcw class="w-3.5 h-3.5" strokeWidth={1.5} />
				Start over
			</button>
		</div>
	{/if}
</div>

<style>
	:global(.sizing-prose h2) {
		font-size: 11px; font-weight: 600; text-transform: uppercase;
		letter-spacing: 0.1em; color: var(--color-rosys-fg-faint);
		margin-top: 1.25rem; margin-bottom: 0.5rem;
	}
	:global(.sizing-prose h2:first-child) { margin-top: 0; }
	:global(.sizing-prose p) { font-size: 14px; line-height: 1.6; color: var(--color-rosys-fg-muted); margin-bottom: 0.25rem; }
	:global(.sizing-prose strong) { color: var(--color-rosys-fg); font-weight: 600; }
	:global(.sizing-prose ul) { list-style: none; padding: 0; }
	:global(.sizing-prose li) { font-size: 14px; line-height: 1.6; color: var(--color-rosys-fg-muted); padding: 0.25rem 0; border-bottom: 1px solid color-mix(in srgb, var(--color-rosys-border) 20%, transparent); }
	:global(.sizing-prose li:last-child) { border-bottom: none; }
</style>
