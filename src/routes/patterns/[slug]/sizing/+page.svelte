<script lang="ts">
	import { ArrowLeft, Ruler, Sparkles, Loader2, Check, AlertTriangle, ChevronDown, Download, FileText, Box, ArrowUpRight, Scissors, User } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, chart, rawSizeChart, savedProfile } = data;

	// Sizes and chart data
	const sizes = chart?.sizes ?? [];
	const bodyRows = chart?.body ?? [];
	const finishedRows = chart?.finished ?? [];
	const hasChart = sizes.length > 0;

	// Measurement inputs
	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');
	let height = $state(savedProfile?.height_cm?.toString() ?? '');

	// State
	let loading = $state(false);
	let result = $state<any>(null);
	let errorMsg = $state('');
	let showChart = $state(false);

	// Highlighted size from AI result
	const highlightedSize = $derived(result?.recommended_size ?? null);
	const highlightedIndex = $derived(highlightedSize ? sizes.indexOf(highlightedSize) : -1);

	async function analyze() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter bust, waist, and hip.'; return; }
		loading = true;
		errorMsg = '';
		result = null;

		try {
			const res = await fetch('/api/ai/size-intelligence', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pattern_slug: pattern.pattern_slug,
					bust: parseFloat(bust),
					waist: parseFloat(waist),
					hip: parseFloat(hip),
					height: height ? parseFloat(height) : undefined,
					source: 'tape_measure'
				})
			});

			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Analysis failed');
			const json = await res.json();
			result = json.recommendation;
		} catch (e: any) {
			errorMsg = e.message || 'Could not analyze. Please try again.';
		} finally {
			loading = false;
		}
	}

	function fitColor(fit: string) {
		const map: Record<string, string> = {
			exact: 'text-emerald-600', comfortable: 'text-blue-600',
			tight: 'text-amber-600', loose: 'text-violet-600'
		};
		return map[fit] || 'text-rosys-fg-muted';
	}

	function fitBg(fit: string) {
		const map: Record<string, string> = {
			exact: 'bg-emerald-50 border-emerald-200/50',
			comfortable: 'bg-blue-50 border-blue-200/50',
			tight: 'bg-amber-50 border-amber-200/50',
			loose: 'bg-violet-50 border-violet-200/50'
		};
		return map[fit] || 'bg-warm-50 border-warm-200/50';
	}
</script>

<svelte:head>
	<title>Find Your Size — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-3xl mx-auto">
	<a href="/patterns/{pattern.pattern_slug}" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<!-- Header -->
	<div class="flex items-center gap-3 mb-2">
		<div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
			<Ruler class="w-5 h-5 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[24px] md:text-[28px] font-bold tracking-[-0.03em]">Find Your Size</h1>
			<p class="text-rosys-fg-faint text-[13px]">AI-powered fit analysis for {pattern.pattern_name}</p>
		</div>
	</div>
	<p class="text-[13px] text-rosys-fg-muted leading-relaxed mb-8 ml-14">Enter your measurements and our AI analyzes the pattern's construction, ease, and proportions to give you the perfect size — with specific alteration advice.</p>

	<!-- Measurement Input Card -->
	<div class="bg-white rounded-2xl border border-rosys-border/40 shadow-sm p-6 mb-6">
		<div class="flex items-center justify-between mb-5">
			<div class="flex items-center gap-2">
				<User class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Your Body Measurements</h2>
			</div>
			{#if savedProfile}
				<a href="/profile/measurements" class="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1">
					<Check class="w-3 h-3" strokeWidth={2} />
					Profile loaded
				</a>
			{:else}
				<a href="/profile/measurements" class="text-[11px] font-medium text-rosys-fg-faint hover:text-rosys-500 transition-colors">Save measurements</a>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-4 mb-5">
			<div>
				<label for="bust" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Bust <span class="text-rosys-fg-faint">(cm)</span></label>
				<input id="bust" type="number" placeholder="88" bind:value={bust}
					class="w-full px-4 py-3 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
			<div>
				<label for="waist" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Waist <span class="text-rosys-fg-faint">(cm)</span></label>
				<input id="waist" type="number" placeholder="72" bind:value={waist}
					class="w-full px-4 py-3 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
			<div>
				<label for="hip" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Hip <span class="text-rosys-fg-faint">(cm)</span></label>
				<input id="hip" type="number" placeholder="92" bind:value={hip}
					class="w-full px-4 py-3 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
			<div>
				<label for="height" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Height <span class="text-rosys-fg-faint">(cm)</span></label>
				<input id="height" type="number" placeholder="168" bind:value={height}
					class="w-full px-4 py-3 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
			</div>
		</div>

		<button type="button" disabled={loading || !bust || !waist || !hip} onclick={analyze}
			class="w-full py-3.5 inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
			{#if loading}
				<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
				Analyzing pattern...
			{:else}
				<Sparkles class="w-4 h-4" strokeWidth={2} />
				Analyze My Fit
			{/if}
		</button>
	</div>

	<!-- AI Result -->
	{#if result}
		<!-- Size Badge -->
		<div class="bg-white rounded-2xl border border-emerald-200/60 shadow-sm overflow-hidden mb-4 page-enter">
			<div class="p-6">
				<div class="flex items-start justify-between mb-5">
					<div class="flex items-center gap-4">
						<div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
							<span class="text-[28px] font-bold text-white tracking-tight">{result.recommended_size}</span>
						</div>
						<div>
							<p class="text-[11px] font-semibold text-emerald-600 uppercase tracking-[0.12em] mb-0.5">Recommended Size</p>
							<p class="text-[22px] font-bold text-rosys-fg tracking-tight">Size {result.recommended_size}</p>
						</div>
					</div>
					<span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border capitalize
						{result.confidence === 'high' ? 'text-emerald-600 bg-emerald-50 border-emerald-200/60' :
						 result.confidence === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200/60' :
						 'text-red-600 bg-red-50 border-red-200/60'}">
						{result.confidence}
					</span>
				</div>

				<!-- Customer Summary -->
				<div class="text-[14px] text-rosys-fg-secondary leading-[1.75] mb-5">
					{result.customer_summary}
				</div>

				<!-- Between sizes -->
				{#if result.between_sizes}
					<div class="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/30 mb-5">
						<AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-amber-800 mb-0.5">Between sizes {result.size_down} and {result.size_up}</p>
							<p class="text-[12px] text-amber-700 leading-relaxed">{result.between_sizes_advice}</p>
						</div>
					</div>
				{/if}

				<!-- Fit Analysis Cards -->
				{#if result.fit_analysis?.length > 0}
					<div class="grid grid-cols-3 gap-2.5 mb-5">
						{#each result.fit_analysis as fit}
							<div class="rounded-xl border p-3 {fitBg(fit.fit)}">
								<p class="text-[10px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1">{fit.measurement}</p>
								<p class="text-[18px] font-bold {fitColor(fit.fit)} leading-none mb-1">{fit.user_cm}<span class="text-[11px] font-normal">cm</span></p>
								<p class="text-[11px] {fitColor(fit.fit)} font-medium capitalize">{fit.fit}</p>
								{#if fit.ease_cm}
									<p class="text-[10px] text-rosys-fg-faint mt-1">Ease: {fit.ease_cm > 0 ? '+' : ''}{fit.ease_cm}cm</p>
								{/if}
								{#if fit.concern}
									<p class="text-[10px] text-amber-600 mt-1">{fit.concern}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Adjustments -->
			{#if (result.length_adjustments?.length > 0 && result.length_adjustments[0]?.adjust_cm !== 0) || result.width_adjustments?.length > 0}
				<div class="border-t border-emerald-100/60 px-6 py-4 bg-emerald-50/20">
					<div class="flex items-center gap-2 mb-3">
						<Scissors class="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
						<p class="text-[11px] font-semibold text-emerald-700 uppercase tracking-[0.1em]">Recommended Adjustments</p>
					</div>
					<div class="space-y-2">
						{#each result.length_adjustments?.filter((a: any) => a.adjust_cm !== 0) ?? [] as adj}
							<div class="flex items-center justify-between py-1.5">
								<span class="text-[13px] text-rosys-fg-muted">{adj.area}</span>
								<div class="text-right">
									<span class="text-[14px] font-semibold {adj.adjust_cm > 0 ? 'text-blue-600' : 'text-amber-600'}">
										{adj.adjust_cm > 0 ? '+' : ''}{adj.adjust_cm}cm
									</span>
									<p class="text-[10px] text-rosys-fg-faint">{adj.reason}</p>
								</div>
							</div>
						{/each}
						{#each result.width_adjustments ?? [] as adj}
							<div class="flex items-center justify-between py-1.5">
								<span class="text-[13px] text-rosys-fg-muted">{adj.area}</span>
								<div class="text-right">
									<span class="text-[14px] font-semibold {adj.adjust_cm > 0 ? 'text-blue-600' : 'text-amber-600'}">
										{adj.adjust_cm > 0 ? '+' : ''}{adj.adjust_cm}cm
									</span>
									<p class="text-[10px] text-rosys-fg-faint">{adj.reason}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Garment Notes -->
			{#if result.garment_notes}
				<div class="border-t border-emerald-100/60 px-6 py-4">
					<p class="text-[12px] text-rosys-fg-muted leading-relaxed">{result.garment_notes}</p>
				</div>
			{/if}
		</div>

		<!-- Download Your Size -->
		{#if highlightedSize}
			<div class="bg-white rounded-2xl border border-violet-200/50 shadow-sm p-5 mb-4 page-enter">
				<div class="flex items-center gap-2 mb-3">
					<Download class="w-4 h-4 text-violet-500" strokeWidth={1.5} />
					<h2 class="text-[11px] font-semibold text-violet-600 uppercase tracking-[0.1em]">Download Size {highlightedSize}</h2>
				</div>
				<p class="text-[12px] text-rosys-fg-faint mb-4">Clean single-size pattern — just your size, no clutter.</p>
				<div class="grid grid-cols-3 gap-2">
					{#each [
						{ format: 'a0', label: 'A0', desc: 'Print shop', icon: Box },
						{ format: 'a4', label: 'A4', desc: 'Home print', icon: FileText },
						{ format: 'us_letter', label: 'US Letter', desc: 'US print', icon: FileText }
					] as dl}
						<a href="/api/patterns/single-size?slug={pattern.pattern_slug}&size={highlightedSize}&format={dl.format}"
							class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-violet-50/50 border border-violet-100/50 hover:border-violet-300 hover:shadow-sm active:scale-[0.97] transition-all text-center group">
							<dl.icon class="w-5 h-5 text-violet-400 group-hover:text-violet-500" strokeWidth={1.5} />
							<span class="text-[13px] font-semibold text-rosys-fg">{dl.label}</span>
							<span class="text-[10px] text-rosys-fg-faint">{dl.desc}</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<!-- Size Chart (collapsible) -->
	{#if hasChart}
		<button type="button" onclick={() => showChart = !showChart}
			class="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-rosys-border/30 shadow-sm mb-4 text-left hover:border-rosys-border/50 transition-colors">
			<div class="flex items-center gap-2">
				<Ruler class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
				<span class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Size Chart</span>
			</div>
			<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showChart ? 'rotate-180' : ''}" strokeWidth={1.5} />
		</button>

		{#if showChart}
			<div class="bg-white rounded-2xl border border-rosys-border/30 shadow-sm p-5 mb-4 page-enter">
				<!-- Body measurements -->
				<h3 class="text-[10px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Body Measurements (cm)</h3>
				<div class="overflow-x-auto -mx-1 mb-5">
					<table class="w-full text-[12px]">
						<thead>
							<tr class="border-b border-rosys-border/30">
								<th class="text-left py-1.5 pr-3 text-rosys-fg-faint font-medium"></th>
								{#each sizes as size, i}
									<th class="text-center py-1.5 px-2 font-semibold min-w-[40px] {i === highlightedIndex ? 'text-emerald-600 bg-emerald-50/60 rounded-t-lg' : 'text-rosys-fg'}">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each ['bust_cm', 'waist_cm', 'hip_cm'] as key}
								{@const label = key.replace('_cm', '').charAt(0).toUpperCase() + key.replace('_cm', '').slice(1)}
								{@const values = bodyRows.map((r: any) => r[key] ? Number(r[key]) : null)}
								{#if values.some((v: any) => v !== null)}
									<tr class="border-b border-rosys-border/15">
										<td class="py-2 pr-3 text-rosys-fg-muted font-medium">{label}</td>
										{#each values as val, i}
											<td class="text-center py-2 px-2 {i === highlightedIndex ? 'font-semibold text-emerald-700 bg-emerald-50/60' : 'text-rosys-fg'}">{val ?? '—'}</td>
										{/each}
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Finished measurements -->
				<h3 class="text-[10px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Finished Garment (cm)</h3>
				<div class="overflow-x-auto -mx-1">
					<table class="w-full text-[12px]">
						<thead>
							<tr class="border-b border-rosys-border/30">
								<th class="text-left py-1.5 pr-3 text-rosys-fg-faint font-medium"></th>
								{#each sizes as size, i}
									<th class="text-center py-1.5 px-2 font-semibold min-w-[40px] {i === highlightedIndex ? 'text-emerald-600 bg-emerald-50/60 rounded-t-lg' : 'text-rosys-fg'}">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each ['bust_cm', 'waist_cm', 'hip_cm', 'full_length_cm', 'sleeve_length_cm', 'bottom_sweep_cm'] as key}
								{@const labels: Record<string, string> = { bust_cm: 'Bust', waist_cm: 'Waist', hip_cm: 'Hip', full_length_cm: 'Length', sleeve_length_cm: 'Sleeve', bottom_sweep_cm: 'Sweep' }}
								{@const values = finishedRows.map((r: any) => r[key] ? Number(r[key]) : null)}
								{#if values.some((v: any) => v !== null)}
									<tr class="border-b border-rosys-border/15">
										<td class="py-2 pr-3 text-rosys-fg-muted font-medium">{labels[key] || key}</td>
										{#each values as val, i}
											<td class="text-center py-2 px-2 {i === highlightedIndex ? 'font-semibold text-emerald-700 bg-emerald-50/60' : 'text-rosys-fg'}">{val ?? '—'}</td>
										{/each}
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{:else if rawSizeChart}
		<div class="bg-white rounded-2xl border border-rosys-border/30 shadow-sm p-5 mb-4">
			<div class="flex items-center gap-2 mb-3">
				<Ruler class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Size Chart</h2>
			</div>
			<div class="text-[12px] text-rosys-fg-muted font-mono whitespace-pre-line leading-relaxed overflow-x-auto">{rawSizeChart}</div>
		</div>
	{/if}

	{#if errorMsg}
		<div class="bg-white rounded-2xl border border-red-200/50 p-4 mt-4">
			<p class="text-[13px] text-red-600">{errorMsg}</p>
		</div>
	{/if}
</div>
