<script lang="ts">
	import { ArrowLeft, Ruler, Sparkles, Loader2, Check, Download, FileText, Box, ChevronDown, Zap } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, chart, rawSizeChart, savedProfile } = data;

	const sizes = chart?.sizes ?? [];
	const bodyRows = chart?.body ?? [];
	const hasChart = sizes.length > 0;

	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');
	let height = $state(savedProfile?.height_cm?.toString() ?? '');
	let loading = $state(false);
	let result = $state<any>(null);
	let profile = $state<any>(null);
	let errorMsg = $state('');
	let showDetails = $state(false);
	let showChart = $state(false);
	let showProfile = $state(false);

	const highlightedSize = $derived(result?.recommended_size ?? null);
	const highlightedIndex = $derived(highlightedSize ? sizes.indexOf(highlightedSize) : -1);

	async function findMySize() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter your bust, waist, and hip.'; return; }
		loading = true;
		errorMsg = '';
		result = null;

		try {
			const res = await fetch('/api/ai/size-intelligence', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pattern_slug: pattern.pattern_slug,
					bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip),
					height: height ? parseFloat(height) : undefined,
					source: 'tape_measure'
				})
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Something went wrong');
			const json = await res.json();
			result = json.recommendation;

			// Also predict full body profile if height is provided
			if (height) {
				try {
					const profileRes = await fetch('/api/ai/body-profile', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), height: parseFloat(height) })
					});
					if (profileRes.ok) {
						const pj = await profileRes.json();
						profile = pj.profile;
					}
				} catch {} // Non-critical — don't block the main result
			}
		} catch (e: any) {
			errorMsg = e.message || 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Find Your Size — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter px-5 py-8 md:px-8 md:py-12 max-w-lg mx-auto">

	<a href="/patterns/{pattern.pattern_slug}" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-10 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<!-- ═══ Before result: measurement form ═══ -->
	{#if !result}

		<div class="text-center mb-10">
			<div class="w-14 h-14 rounded-[18px] bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rosys-500/20">
				<Ruler class="w-6 h-6 text-white" strokeWidth={1.5} />
			</div>
			<h1 class="text-rosys-fg text-[28px] font-bold tracking-[-0.04em] mb-2">Find Your Size</h1>
			<p class="text-rosys-fg-muted text-[15px] leading-relaxed max-w-xs mx-auto">{pattern.pattern_name}</p>
		</div>

		<div class="space-y-4 mb-8">
			<div>
				<label for="bust" class="block text-[13px] font-medium text-rosys-fg mb-2">Bust</label>
				<div class="relative">
					<input id="bust" type="number" inputmode="numeric" placeholder="e.g. 88" bind:value={bust}
						class="w-full px-5 py-4 rounded-2xl bg-white border border-rosys-border/50 text-[17px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-400 transition-all shadow-sm" />
					<span class="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-rosys-fg-faint">cm</span>
				</div>
			</div>
			<div>
				<label for="waist" class="block text-[13px] font-medium text-rosys-fg mb-2">Waist</label>
				<div class="relative">
					<input id="waist" type="number" inputmode="numeric" placeholder="e.g. 72" bind:value={waist}
						class="w-full px-5 py-4 rounded-2xl bg-white border border-rosys-border/50 text-[17px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-400 transition-all shadow-sm" />
					<span class="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-rosys-fg-faint">cm</span>
				</div>
			</div>
			<div>
				<label for="hip" class="block text-[13px] font-medium text-rosys-fg mb-2">Hip</label>
				<div class="relative">
					<input id="hip" type="number" inputmode="numeric" placeholder="e.g. 92" bind:value={hip}
						class="w-full px-5 py-4 rounded-2xl bg-white border border-rosys-border/50 text-[17px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-400 transition-all shadow-sm" />
					<span class="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-rosys-fg-faint">cm</span>
				</div>
			</div>
			<div>
				<label for="height" class="block text-[13px] font-medium text-rosys-fg mb-2">Height <span class="font-normal text-rosys-fg-faint">(for length advice)</span></label>
				<div class="relative">
					<input id="height" type="number" inputmode="numeric" placeholder="e.g. 168" bind:value={height}
						class="w-full px-5 py-4 rounded-2xl bg-white border border-rosys-border/50 text-[17px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-400 transition-all shadow-sm" />
					<span class="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-rosys-fg-faint">cm</span>
				</div>
			</div>
		</div>

		{#if errorMsg}
			<p class="text-rosys-500 text-[13px] text-center mb-4">{errorMsg}</p>
		{/if}

		<button type="button" disabled={loading || !bust || !waist || !hip} onclick={findMySize}
			class="w-full py-4 rounded-2xl font-semibold text-[16px] text-white bg-gradient-to-r from-rosys-500 to-rosys-600 hover:from-rosys-600 hover:to-rosys-700 active:scale-[0.98] transition-all shadow-lg shadow-rosys-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center justify-center gap-2.5">
			{#if loading}
				<Loader2 class="w-5 h-5 animate-spin" strokeWidth={2} />
				Finding your size...
			{:else}
				<Sparkles class="w-5 h-5" strokeWidth={2} />
				Find My Size
			{/if}
		</button>

		{#if savedProfile}
			<p class="text-center text-[12px] text-rosys-fg-faint mt-3">
				<Check class="w-3 h-3 inline text-emerald-500" strokeWidth={2} /> Using your saved measurements
			</p>
		{/if}

	<!-- ═══ After result: size + download ═══ -->
	{:else}

		<!-- The answer -->
		<div class="text-center mb-8 page-enter">
			<div class="w-24 h-24 rounded-[28px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-emerald-500/25">
				<span class="text-[42px] font-bold text-white tracking-tight">{result.recommended_size}</span>
			</div>
			<h1 class="text-rosys-fg text-[24px] font-bold tracking-[-0.03em] mb-2">You're a size {result.recommended_size}</h1>
			<p class="text-rosys-fg-muted text-[14px] leading-relaxed max-w-sm mx-auto">{result.customer_summary}</p>
		</div>

		<!-- Between sizes notice -->
		{#if result.between_sizes && result.between_sizes_advice}
			<div class="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/30 mb-6 page-enter">
				<span class="text-[20px] leading-none mt-0.5">↕</span>
				<div>
					<p class="text-[13px] font-medium text-amber-800">Between {result.size_down} and {result.size_up}</p>
					<p class="text-[13px] text-amber-700/80 leading-relaxed mt-1">{result.between_sizes_advice}</p>
				</div>
			</div>
		{/if}

		<!-- Adjustments (only if there are real ones) -->
		{#if result.length_adjustments?.some((a: any) => a.adjust_cm && a.adjust_cm !== 0)}
			<div class="bg-white rounded-2xl border border-rosys-border/30 shadow-sm p-5 mb-6 page-enter">
				<p class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Fit Tips</p>
				{#each result.length_adjustments.filter((a: any) => a.adjust_cm && a.adjust_cm !== 0) as adj}
					<div class="flex items-baseline justify-between py-2 border-b border-rosys-border/15 last:border-0">
						<span class="text-[14px] text-rosys-fg">{adj.area}</span>
						<span class="text-[14px] font-semibold {adj.adjust_cm > 0 ? 'text-blue-600' : 'text-amber-600'}">{adj.adjust_cm > 0 ? '+' : ''}{adj.adjust_cm} cm</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Download -->
		<div class="bg-white rounded-2xl border border-rosys-border/30 shadow-sm overflow-hidden mb-6 page-enter">
			<div class="p-5">
				<p class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-1">Download Your Pattern</p>
				<p class="text-[13px] text-rosys-fg-muted mb-4">Size {result.recommended_size} only — clean, ready to print.</p>

				<div class="grid grid-cols-3 gap-2">
					{#each [
						{ format: 'a0', label: 'A0', sub: 'Print shop' },
						{ format: 'a4', label: 'A4', sub: 'Home' },
						{ format: 'us_letter', label: 'US Letter', sub: 'Home' }
					] as dl}
						<a href="/api/patterns/single-size?slug={pattern.pattern_slug}&size={result.recommended_size}&format={dl.format}"
							class="flex flex-col items-center gap-1 py-3.5 px-2 rounded-xl bg-rosys-50/50 hover:bg-rosys-100/60 border border-rosys-200/40 hover:border-rosys-300 active:scale-[0.96] transition-all group">
							<Download class="w-4 h-4 text-rosys-400 group-hover:text-rosys-500" strokeWidth={1.5} />
							<span class="text-[13px] font-semibold text-rosys-fg">{dl.label}</span>
							<span class="text-[10px] text-rosys-fg-faint">{dl.sub}</span>
						</a>
					{/each}
				</div>
			</div>
		</div>

		<!-- Body profile (the wow effect) -->
		{#if profile}
			<button type="button" onclick={() => showProfile = !showProfile}
				class="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-rosys-border/30 shadow-sm hover:shadow-md transition-all mb-4 page-enter">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
						<Zap class="w-4 h-4 text-white" strokeWidth={2} />
					</div>
					<div class="text-left">
						<p class="text-[13px] font-semibold text-rosys-fg">Your Estimated Body Profile</p>
						<p class="text-[11px] text-rosys-fg-faint">Predicted from your measurements — shoulder, arms, legs & more</p>
					</div>
				</div>
				<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showProfile ? 'rotate-180' : ''}" strokeWidth={1.5} />
			</button>

			{#if showProfile}
				<div class="bg-white rounded-2xl border border-rosys-border/20 shadow-sm p-5 mb-6 page-enter">
					<div class="grid grid-cols-3 gap-3">
						{#each [
							{ label: 'Shoulder', value: profile.shoulder_cm, icon: '↔' },
							{ label: 'Arm Length', value: profile.arm_length_cm, icon: '📏' },
							{ label: 'Arm Circ.', value: profile.arm_circ_cm, icon: '💪' },
							{ label: 'Leg Length', value: profile.leg_length_cm, icon: '🦵' },
							{ label: 'Est. Weight', value: profile.weight_kg, icon: '⚖️', unit: 'kg' },
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
					<p class="text-[11px] text-rosys-fg-faint text-center mt-3">Estimated from 59,000 body measurement records</p>
				</div>
			{/if}
		{/if}

		<!-- AI details (expandable — for those who want more) -->
		{#if result.garment_notes || result.fit_analysis?.length > 0}
			<button type="button" onclick={() => showDetails = !showDetails}
				class="w-full flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-rosys-border/20 hover:bg-white transition-colors mb-4">
				<span class="text-[12px] font-medium text-rosys-fg-muted">More details</span>
				<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showDetails ? 'rotate-180' : ''}" strokeWidth={1.5} />
			</button>

			{#if showDetails}
				<div class="bg-white rounded-2xl border border-rosys-border/20 p-5 mb-4 page-enter space-y-4">
					{#if result.fit_analysis?.length > 0}
						<div>
							<p class="text-[10px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-2">Fit Analysis</p>
							{#each result.fit_analysis as fit}
								<div class="flex items-center justify-between py-2 border-b border-rosys-border/10 last:border-0">
									<span class="text-[13px] text-rosys-fg capitalize">{fit.measurement}</span>
									<div class="flex items-center gap-3">
										<span class="text-[13px] text-rosys-fg-muted">{fit.user_cm}cm</span>
										<span class="text-[11px] font-medium px-2 py-0.5 rounded-md capitalize
											{fit.fit === 'exact' ? 'text-emerald-700 bg-emerald-50' :
											 fit.fit === 'comfortable' ? 'text-blue-700 bg-blue-50' :
											 fit.fit === 'tight' ? 'text-amber-700 bg-amber-50' :
											 'text-violet-700 bg-violet-50'}">{fit.fit}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
					{#if result.garment_notes}
						<div>
							<p class="text-[10px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-2">About this pattern</p>
							<p class="text-[13px] text-rosys-fg-muted leading-relaxed">{result.garment_notes}</p>
						</div>
					{/if}
				</div>
			{/if}
		{/if}

		<!-- Try again -->
		<button type="button" onclick={() => { result = null; errorMsg = ''; }}
			class="w-full py-3 text-[13px] font-medium text-rosys-fg-faint hover:text-rosys-500 transition-colors">
			Try different measurements
		</button>
	{/if}

	<!-- Size chart reference -->
	{#if hasChart}
		<div class="mt-10 pt-6 border-t border-rosys-border/20">
			<button type="button" onclick={() => showChart = !showChart}
				class="flex items-center gap-2 text-[12px] text-rosys-fg-faint hover:text-rosys-fg-muted transition-colors">
				<ChevronDown class="w-3 h-3 transition-transform {showChart ? 'rotate-180' : ''}" strokeWidth={1.5} />
				Size chart
			</button>
			{#if showChart}
				<div class="mt-3 overflow-x-auto page-enter">
					<table class="w-full text-[11px]">
						<thead>
							<tr class="border-b border-rosys-border/30">
								<th class="text-left py-1.5 pr-3 text-rosys-fg-faint font-medium"></th>
								{#each sizes as size, i}
									<th class="text-center py-1.5 px-1.5 font-semibold {i === highlightedIndex ? 'text-rosys-500' : 'text-rosys-fg'}">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each ['bust_cm', 'waist_cm', 'hip_cm'] as key}
								{@const label = key === 'bust_cm' ? 'Bust' : key === 'waist_cm' ? 'Waist' : 'Hip'}
								<tr class="border-b border-rosys-border/10">
									<td class="py-1.5 pr-3 text-rosys-fg-muted">{label}</td>
									{#each bodyRows as row, i}
										<td class="text-center py-1.5 px-1.5 {i === highlightedIndex ? 'font-semibold text-rosys-500' : 'text-rosys-fg'}">{(row as any)[key] ? Number((row as any)[key]) : '—'}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>
