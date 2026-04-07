<script lang="ts">
	import { ArrowLeft, Ruler, Sparkles, Loader2, Check, AlertTriangle, ChevronDown } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, chart, rawSizeChart, savedProfile } = data;

	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');
	let height = $state(savedProfile?.height_cm?.toString() ?? '');
	let loading = $state(false);
	let recommendation = $state('');
	let structured = $state<any>(null);
	let errorMsg = $state('');
	let showAllSizes = $state(false);

	// Extract sizes and measurement labels from structured chart
	const sizes = chart?.sizes ?? [];
	const bodyRows = chart?.body ?? [];
	const finishedRows = chart?.finished ?? [];
	const hasStructuredData = sizes.length > 0;

	// Build display-friendly measurement rows for the table
	type MeasurementRow = { label: string; values: (number | null)[]; unit: string };
	const bodyMeasurements: MeasurementRow[] = $derived.by(() => {
		if (!hasStructuredData) return [];
		const labels = [
			{ key: 'bust_cm', label: 'Bust' },
			{ key: 'waist_cm', label: 'Waist' },
			{ key: 'hip_cm', label: 'Hip' }
		];
		return labels
			.map(({ key, label }) => ({
				label,
				values: bodyRows.map((r: any) => r[key] ? Number(r[key]) : null),
				unit: 'cm'
			}))
			.filter((row) => row.values.some((v: number | null) => v !== null));
	});

	const finishedMeasurements: MeasurementRow[] = $derived.by(() => {
		if (!hasStructuredData) return [];
		const labels = [
			{ key: 'bust_cm', label: 'Bust' },
			{ key: 'waist_cm', label: 'Waist' },
			{ key: 'hip_cm', label: 'Hip' },
			{ key: 'full_length_cm', label: 'Full Length' },
			{ key: 'sleeve_length_cm', label: 'Sleeve Length' },
			{ key: 'bottom_sweep_cm', label: 'Bottom Sweep' },
			{ key: 'zipper_length_cm', label: 'Zipper Length' },
			{ key: 'shoulder_cm', label: 'Shoulder' }
		];
		return labels
			.map(({ key, label }) => ({
				label,
				values: finishedRows.map((r: any) => r[key] ? Number(r[key]) : null),
				unit: 'cm'
			}))
			.filter((row) => row.values.some((v: number | null) => v !== null));
	});

	// Determine which size column to highlight
	const highlightedSize = $derived(structured?.recommended?.size ?? null);
	const highlightedIndex = $derived(highlightedSize ? sizes.indexOf(highlightedSize) : -1);

	async function getRecommendation() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter bust, waist, and hip.'; return; }
		loading = true;
		errorMsg = '';
		recommendation = '';
		structured = null;

		try {
			const res = await fetch('/api/ai/size-recommendation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bust: parseFloat(bust),
					waist: parseFloat(waist),
					hip: parseFloat(hip),
					height: height ? parseFloat(height) : undefined,
					pattern_slug: pattern.pattern_slug
				})
			});

			if (!res.ok) throw new Error('Failed to get recommendation');
			const json = await res.json();
			recommendation = json.recommendation;
			structured = json.structured;
		} catch {
			errorMsg = 'Could not get recommendation. Please try again.';
		} finally {
			loading = false;
		}
	}

	function fitColor(fit: string): string {
		switch (fit) {
			case 'exact': return 'text-emerald-600';
			case 'comfortable': return 'text-blue-600';
			case 'tight': return 'text-amber-600';
			case 'loose': return 'text-violet-600';
			default: return 'text-rosys-fg-muted';
		}
	}

	function fitBg(fit: string): string {
		switch (fit) {
			case 'exact': return 'bg-emerald-50 border-emerald-200/60';
			case 'comfortable': return 'bg-blue-50 border-blue-200/60';
			case 'tight': return 'bg-amber-50 border-amber-200/60';
			case 'loose': return 'bg-violet-50 border-violet-200/60';
			default: return 'bg-warm-50 border-warm-200/60';
		}
	}

	// Fit bar: shows where user measurement falls relative to sizes
	function fitBarPosition(userVal: number, sizeValues: (number | null)[]): number {
		const vals = sizeValues.filter((v): v is number => v !== null);
		if (vals.length < 2) return 50;
		const min = vals[0];
		const max = vals[vals.length - 1];
		const range = max - min;
		if (range === 0) return 50;
		return Math.max(0, Math.min(100, ((userVal - min) / range) * 100));
	}
</script>

<svelte:head>
	<title>Size Assistant — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-3xl mx-auto">
	<a href="/patterns/{pattern.pattern_slug}" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<div class="flex items-center gap-3 mb-8">
		<div class="rosys-section-icon bg-gradient-to-br from-emerald-500 to-emerald-600">
			<Ruler class="w-5 h-5 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em]">Find Your Size</h1>
			<p class="text-rosys-fg-faint text-[13px]">AI-powered recommendation for {pattern.pattern_name}</p>
		</div>
	</div>

	<!-- Measurement Input -->
	<div class="rosys-card p-6 mb-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Your Body Measurements (cm)</h2>
			{#if savedProfile}
				<a href="/profile/measurements" class="text-[11px] font-medium text-rosys-500 hover:text-rosys-600 transition-colors">Saved profile loaded</a>
			{:else}
				<a href="/profile/measurements" class="text-[11px] font-medium text-rosys-fg-faint hover:text-rosys-500 transition-colors">Save measurements</a>
			{/if}
		</div>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="bust" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Bust</label>
				<input id="bust" type="number" bind:value={bust} placeholder="e.g. 88"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
			<div>
				<label for="waist" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Waist</label>
				<input id="waist" type="number" bind:value={waist} placeholder="e.g. 72"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
			<div>
				<label for="hip" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Hip</label>
				<input id="hip" type="number" bind:value={hip} placeholder="e.g. 96"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
			<div>
				<label for="height" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Height <span class="text-rosys-fg-faint">(optional)</span></label>
				<input id="height" type="number" bind:value={height} placeholder="e.g. 168"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
		</div>

		<button
			type="button"
			disabled={loading || !bust || !waist || !hip}
			onclick={getRecommendation}
			class="mt-5 w-full py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{#if loading}
				<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
				Analyzing...
			{:else}
				<Sparkles class="w-4 h-4" strokeWidth={2} />
				Find My Size
			{/if}
		</button>

		{#if errorMsg}
			<p class="mt-3 text-rosys-500 text-[13px]">{errorMsg}</p>
		{/if}
	</div>

	<!-- Structured Result -->
	{#if structured}
		{@const rec = structured.recommended}
		<div class="rosys-card border-emerald-200/60 p-6 mb-6 page-enter">
			<!-- Recommended size badge -->
			<div class="flex items-center justify-between mb-5">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
						<Check class="w-4 h-4 text-white" strokeWidth={2.5} />
					</div>
					<div>
						<p class="text-[11px] font-semibold text-emerald-600 uppercase tracking-[0.1em]">Recommended Size</p>
						<p class="text-[28px] font-bold text-rosys-fg tracking-tight leading-none">{rec.size}</p>
					</div>
				</div>
				{#if structured.betweenSizes}
					<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/60">
						<AlertTriangle class="w-3.5 h-3.5 text-amber-500" strokeWidth={2} />
						<span class="text-[12px] font-medium text-amber-700">Between {structured.lowerSize} & {structured.upperSize}</span>
					</div>
				{/if}
			</div>

			<!-- Fit breakdown cards -->
			<div class="grid grid-cols-3 gap-3 mb-5">
				{#each [rec.bust, rec.waist, rec.hip].filter(Boolean) as fit}
					<div class="rounded-xl border p-3 {fitBg(fit.fit)}">
						<p class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1">{fit.label}</p>
						<p class="text-[18px] font-bold {fitColor(fit.fit)}">{fit.diff_cm > 0 ? '+' : ''}{fit.diff_cm.toFixed(1)}</p>
						<p class="text-[11px] {fitColor(fit.fit)} font-medium capitalize">{fit.fit}</p>
					</div>
				{/each}
			</div>

			<!-- Ease info -->
			{#if rec.ease.bust_cm !== null}
				<div class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warm-50 border border-rosys-border/30">
					<Ruler class="w-3.5 h-3.5 text-rosys-fg-faint" strokeWidth={1.5} />
					<p class="text-[13px] text-rosys-fg-muted">
						Design ease: <span class="font-semibold text-rosys-fg">{rec.ease.bust_cm.toFixed(0)}cm</span> at bust
						— {rec.ease.bust_cm > 10 ? 'relaxed' : rec.ease.bust_cm > 4 ? 'comfortable' : rec.ease.bust_cm > 0 ? 'close' : 'fitted'} silhouette
					</p>
				</div>
			{/if}

			<!-- Fit bars: visual position within size range -->
			{#if hasStructuredData && bust}
				<div class="mt-5 space-y-3">
					{#each [
						{ label: 'Bust', val: parseFloat(bust), key: 'bust_cm' },
						{ label: 'Waist', val: parseFloat(waist), key: 'waist_cm' },
						{ label: 'Hip', val: parseFloat(hip), key: 'hip_cm' }
					] as bar}
						{@const sizeVals = bodyRows.map((r: any) => r[bar.key] ? Number(r[bar.key]) : null)}
						{@const pos = fitBarPosition(bar.val, sizeVals)}
						<div>
							<div class="flex items-center justify-between mb-1">
								<span class="text-[11px] font-medium text-rosys-fg-muted">{bar.label}</span>
								<span class="text-[11px] text-rosys-fg-faint">{bar.val}cm</span>
							</div>
							<div class="relative h-2 bg-warm-100 rounded-full overflow-visible">
								<!-- Size markers -->
								{#each sizes as size, i}
									{@const sizePos = fitBarPosition(sizeVals[i] ?? 0, sizeVals)}
									<div
										class="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-full {size === highlightedSize ? 'bg-emerald-400' : 'bg-warm-300'}"
										style="left: {sizePos}%"
										title="{size}: {sizeVals[i]}cm"
									></div>
								{/each}
								<!-- User marker -->
								<div
									class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-rosys-500 border-2 border-white shadow-sm"
									style="left: {pos}%"
								></div>
							</div>
							<div class="flex justify-between mt-0.5">
								<span class="text-[9px] text-rosys-fg-faint">{sizes[0]}</span>
								<span class="text-[9px] text-rosys-fg-faint">{sizes[sizes.length - 1]}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- AI Narrative (from LLM or deterministic) -->
	{#if recommendation && !structured}
		<div class="rosys-card border-emerald-200/60 p-6 mb-6 page-enter">
			<div class="flex items-center gap-2 mb-4">
				<Sparkles class="w-4 h-4 text-emerald-500" strokeWidth={2} />
				<h2 class="text-[13px] font-semibold text-emerald-700">AI Recommendation</h2>
			</div>
			<div class="text-[14px] text-rosys-fg-secondary leading-[1.8] whitespace-pre-line">
				{recommendation}
			</div>
		</div>
	{:else if recommendation && structured}
		<div class="rosys-card p-5 mb-6 page-enter">
			<div class="flex items-center gap-2 mb-3">
				<Sparkles class="w-3.5 h-3.5 text-rosys-fg-faint" strokeWidth={2} />
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Fit Advice</h2>
			</div>
			<div class="text-[13px] text-rosys-fg-muted leading-[1.75] whitespace-pre-line">
				{recommendation}
			</div>
		</div>
	{/if}

	<!-- Size Chart Tables -->
	{#if hasStructuredData}
		<!-- Body Measurements -->
		{#if bodyMeasurements.length > 0}
			<div class="rosys-card p-5 mb-4">
				<div class="flex items-center gap-2 mb-4">
					<Ruler class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Body Measurements (cm)</h2>
				</div>
				<div class="overflow-x-auto -mx-1">
					<table class="w-full text-[13px]">
						<thead>
							<tr class="border-b border-rosys-border/40">
								<th class="text-left py-2 pr-3 text-rosys-fg-faint font-medium min-w-[60px]"></th>
								{#each sizes as size, i}
									<th class="text-center py-2 px-2 font-semibold min-w-[44px] {i === highlightedIndex ? 'text-emerald-600 bg-emerald-50/50 rounded-t-lg' : 'text-rosys-fg'}">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each bodyMeasurements as row}
								<tr class="border-b border-rosys-border/20">
									<td class="py-2.5 pr-3 text-rosys-fg-muted font-medium">{row.label}</td>
									{#each row.values as val, i}
										<td class="text-center py-2.5 px-2 {i === highlightedIndex ? 'font-semibold text-emerald-700 bg-emerald-50/50' : 'text-rosys-fg'}">
											{val !== null ? val : '—'}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Finished Measurements -->
		{#if finishedMeasurements.length > 0}
			<div class="rosys-card p-5 mb-6">
				<button
					type="button"
					onclick={() => showAllSizes = !showAllSizes}
					class="flex items-center justify-between w-full mb-4"
				>
					<div class="flex items-center gap-2">
						<Ruler class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
						<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Finished Garment Measurements (cm)</h2>
					</div>
					<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showAllSizes ? 'rotate-180' : ''}" strokeWidth={1.5} />
				</button>
				{#if showAllSizes}
					<div class="overflow-x-auto -mx-1 page-enter">
						<table class="w-full text-[13px]">
							<thead>
								<tr class="border-b border-rosys-border/40">
									<th class="text-left py-2 pr-3 text-rosys-fg-faint font-medium min-w-[80px]"></th>
									{#each sizes as size, i}
										<th class="text-center py-2 px-2 font-semibold min-w-[44px] {i === highlightedIndex ? 'text-emerald-600 bg-emerald-50/50 rounded-t-lg' : 'text-rosys-fg'}">{size}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each finishedMeasurements as row}
									<tr class="border-b border-rosys-border/20">
										<td class="py-2.5 pr-3 text-rosys-fg-muted font-medium">{row.label}</td>
										{#each row.values as val, i}
											<td class="text-center py-2.5 px-2 {i === highlightedIndex ? 'font-semibold text-emerald-700 bg-emerald-50/50' : 'text-rosys-fg'}">
												{val !== null ? val : '—'}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	{:else if rawSizeChart}
		<!-- Fallback: raw text size chart -->
		<div class="rosys-card p-5 mb-6">
			<div class="flex items-center gap-2 mb-3">
				<Ruler class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Size Chart</h2>
			</div>
			<div class="text-[13px] text-rosys-fg-muted font-mono whitespace-pre-line leading-relaxed overflow-x-auto">
				{rawSizeChart}
			</div>
		</div>
	{/if}
</div>
