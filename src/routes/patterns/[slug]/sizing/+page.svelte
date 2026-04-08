<script lang="ts">
	import { ArrowLeft, Ruler, Sparkles, Loader2, Check, AlertTriangle, ChevronDown, ChevronRight, Download, FileText, Box, Scissors, Camera, User, ArrowRight, Zap } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, chart, rawSizeChart, savedProfile } = data;

	const sizes = chart?.sizes ?? [];
	const bodyRows = chart?.body ?? [];
	const finishedRows = chart?.finished ?? [];
	const hasChart = sizes.length > 0;

	// ─── State ───
	let step = $state<'choose' | 'measure' | 'profile' | 'analysis' | 'download'>('choose');
	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');
	let height = $state(savedProfile?.height_cm?.toString() ?? '');
	let loading = $state(false);
	let result = $state<any>(null);
	let errorMsg = $state('');
	let showChart = $state(false);

	// Auto-advance if profile is loaded
	$effect(() => {
		if (savedProfile && bust && waist && hip) {
			step = 'measure';
		}
	});

	const highlightedSize = $derived(result?.recommended_size ?? null);
	const highlightedIndex = $derived(highlightedSize ? sizes.indexOf(highlightedSize) : -1);

	function chooseMethod(method: string) {
		if (method === 'tape') step = 'measure';
		if (method === 'photo') window.location.href = '/profile/measurements/photo';
		if (method === 'size') step = 'measure'; // they can just analyze without entering
	}

	function goToProfile() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter bust, waist, and hip.'; return; }
		errorMsg = '';
		step = 'profile';
	}

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
					bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip),
					height: height ? parseFloat(height) : undefined,
					source: 'tape_measure'
				})
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Analysis failed');
			const json = await res.json();
			result = json.recommendation;
			step = 'analysis';
		} catch (e: any) {
			errorMsg = e.message || 'Could not analyze.';
		} finally {
			loading = false;
		}
	}

	function fitColor(fit: string) {
		return { exact: 'text-emerald-600', comfortable: 'text-blue-600', tight: 'text-amber-600', loose: 'text-violet-600' }[fit] || 'text-rosys-fg-muted';
	}
	function fitBg(fit: string) {
		return { exact: 'bg-emerald-50 border-emerald-200/50', comfortable: 'bg-blue-50 border-blue-200/50', tight: 'bg-amber-50 border-amber-200/50', loose: 'bg-violet-50 border-violet-200/50' }[fit] || 'bg-warm-50 border-warm-200/50';
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

	<!-- Progress dots -->
	<div class="flex items-center justify-center gap-2 mb-8">
		{#each ['choose', 'measure', 'profile', 'analysis', 'download'] as s, i}
			{@const active = ['choose','measure','profile','analysis','download'].indexOf(step) >= i}
			<div class="w-2 h-2 rounded-full transition-all {active ? 'bg-emerald-500 scale-110' : 'bg-warm-200'}"></div>
		{/each}
	</div>

	<!-- ═══════════════════════════════════════════ -->
	<!-- STEP 1: Choose method                       -->
	<!-- ═══════════════════════════════════════════ -->
	{#if step === 'choose'}
		<div class="text-center mb-8">
			<h1 class="text-rosys-fg text-[26px] md:text-[32px] font-bold tracking-[-0.03em] mb-2">Find Your Perfect Fit</h1>
			<p class="text-rosys-fg-muted text-[14px]">How would you like to get started?</p>
		</div>

		<div class="space-y-3">
			<button type="button" onclick={() => chooseMethod('tape')}
				class="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-rosys-border/40 shadow-sm hover:border-emerald-300 hover:shadow-md active:scale-[0.98] transition-all text-left group">
				<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
					<Ruler class="w-5 h-5 text-white" strokeWidth={1.5} />
				</div>
				<div class="flex-1">
					<p class="text-[15px] font-semibold text-rosys-fg">I have a tape measure</p>
					<p class="text-[12px] text-rosys-fg-faint">Enter bust, waist, hip — most accurate</p>
				</div>
				<ChevronRight class="w-5 h-5 text-rosys-fg/20 group-hover:text-emerald-500 transition-colors" strokeWidth={1.5} />
			</button>

			<button type="button" onclick={() => chooseMethod('photo')}
				class="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-rosys-border/40 shadow-sm hover:border-blue-300 hover:shadow-md active:scale-[0.98] transition-all text-left group">
				<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
					<Camera class="w-5 h-5 text-white" strokeWidth={1.5} />
				</div>
				<div class="flex-1">
					<p class="text-[15px] font-semibold text-rosys-fg">Upload a photo</p>
					<p class="text-[12px] text-rosys-fg-faint">AI estimates your measurements from a photo</p>
				</div>
				<ChevronRight class="w-5 h-5 text-rosys-fg/20 group-hover:text-blue-500 transition-colors" strokeWidth={1.5} />
			</button>

			{#if savedProfile}
				<button type="button" onclick={() => { step = 'profile'; }}
					class="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-rosys-500/30 shadow-sm hover:border-rosys-500/50 hover:shadow-md active:scale-[0.98] transition-all text-left group">
					<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center shrink-0 shadow-sm">
						<User class="w-5 h-5 text-white" strokeWidth={1.5} />
					</div>
					<div class="flex-1">
						<p class="text-[15px] font-semibold text-rosys-fg">Use saved measurements</p>
						<p class="text-[12px] text-rosys-fg-faint">Bust {savedProfile.bust_cm}cm, Waist {savedProfile.waist_cm}cm, Hip {savedProfile.hip_cm}cm</p>
					</div>
					<ChevronRight class="w-5 h-5 text-rosys-fg/20 group-hover:text-rosys-500 transition-colors" strokeWidth={1.5} />
				</button>
			{/if}
		</div>
	{/if}

	<!-- ═══════════════════════════════════════════ -->
	<!-- STEP 2: Enter measurements                  -->
	<!-- ═══════════════════════════════════════════ -->
	{#if step === 'measure'}
		<div class="text-center mb-6">
			<h1 class="text-rosys-fg text-[24px] font-bold tracking-[-0.03em] mb-1">Your Measurements</h1>
			<p class="text-rosys-fg-muted text-[13px]">Measure with the tape snug but not tight</p>
		</div>

		<div class="bg-white rounded-2xl border border-rosys-border/40 shadow-sm p-6 mb-4">
			<div class="grid grid-cols-2 gap-4 mb-5">
				<div>
					<label for="bust" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Bust <span class="text-rosys-fg-faint">(cm)</span></label>
					<input id="bust" type="number" placeholder="88" bind:value={bust}
						class="w-full px-4 py-3.5 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[16px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
				</div>
				<div>
					<label for="waist" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Waist <span class="text-rosys-fg-faint">(cm)</span></label>
					<input id="waist" type="number" placeholder="72" bind:value={waist}
						class="w-full px-4 py-3.5 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[16px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
				</div>
				<div>
					<label for="hip" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Hip <span class="text-rosys-fg-faint">(cm)</span></label>
					<input id="hip" type="number" placeholder="92" bind:value={hip}
						class="w-full px-4 py-3.5 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[16px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
				</div>
				<div>
					<label for="height" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Height <span class="text-rosys-fg-faint">(cm)</span></label>
					<input id="height" type="number" placeholder="168" bind:value={height}
						class="w-full px-4 py-3.5 rounded-xl bg-warm-50/50 border border-rosys-border/40 text-[16px] text-rosys-fg placeholder-rosys-fg-faint/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300 transition-all" />
				</div>
			</div>

			{#if errorMsg}
				<p class="text-rosys-500 text-[12px] mb-3">{errorMsg}</p>
			{/if}

			<button type="button" disabled={!bust || !waist || !hip} onclick={goToProfile}
				class="w-full py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
				Continue
				<ArrowRight class="w-4 h-4" strokeWidth={2} />
			</button>
		</div>

		<button type="button" onclick={() => step = 'choose'} class="text-[12px] text-rosys-fg-faint hover:text-rosys-500 transition-colors">
			← Back
		</button>
	{/if}

	<!-- ═══════════════════════════════════════════ -->
	<!-- STEP 3: Body profile overview               -->
	<!-- ═══════════════════════════════════════════ -->
	{#if step === 'profile'}
		<div class="text-center mb-6">
			<h1 class="text-rosys-fg text-[24px] font-bold tracking-[-0.03em] mb-1">Your Body Profile</h1>
			<p class="text-rosys-fg-muted text-[13px]">Ready to analyze against {pattern.pattern_name}</p>
		</div>

		<div class="bg-white rounded-2xl border border-rosys-border/40 shadow-sm p-6 mb-4">
			<div class="grid grid-cols-4 gap-3 mb-6">
				{#each [
					{ label: 'Bust', value: bust, color: 'text-rosys-500' },
					{ label: 'Waist', value: waist, color: 'text-blue-600' },
					{ label: 'Hip', value: hip, color: 'text-violet-600' },
					{ label: 'Height', value: height || '—', color: 'text-rosys-fg-muted' }
				] as m}
					<div class="text-center p-3 rounded-xl bg-warm-50/50">
						<p class="text-[10px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1">{m.label}</p>
						<p class="text-[22px] font-bold {m.color} leading-none">{m.value}</p>
						<p class="text-[10px] text-rosys-fg-faint mt-0.5">cm</p>
					</div>
				{/each}
			</div>

			{#if errorMsg}
				<p class="text-rosys-500 text-[12px] mb-3">{errorMsg}</p>
			{/if}

			<button type="button" disabled={loading} onclick={analyze}
				class="w-full py-4 inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold text-[15px] text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
				{#if loading}
					<Loader2 class="w-5 h-5 animate-spin" strokeWidth={2} />
					AI is analyzing the pattern...
				{:else}
					<Sparkles class="w-5 h-5" strokeWidth={2} />
					Analyze My Fit
				{/if}
			</button>
		</div>

		<div class="flex gap-3">
			<button type="button" onclick={() => step = 'measure'} class="text-[12px] text-rosys-fg-faint hover:text-rosys-500 transition-colors">← Edit measurements</button>
			<a href="/profile/measurements" class="text-[12px] text-rosys-fg-faint hover:text-rosys-500 transition-colors ml-auto">Save to profile</a>
		</div>
	{/if}

	<!-- ═══════════════════════════════════════════ -->
	<!-- STEP 4: AI Analysis Result                  -->
	<!-- ═══════════════════════════════════════════ -->
	{#if step === 'analysis' && result}
		<!-- Size Badge -->
		<div class="bg-white rounded-2xl border border-emerald-200/60 shadow-sm overflow-hidden mb-4 page-enter">
			<div class="p-6">
				<div class="flex items-start justify-between mb-5">
					<div class="flex items-center gap-4">
						<div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
							<span class="text-[28px] font-bold text-white tracking-tight">{result.recommended_size}</span>
						</div>
						<div>
							<p class="text-[11px] font-semibold text-emerald-600 uppercase tracking-[0.12em] mb-0.5">Your Size</p>
							<p class="text-[22px] font-bold text-rosys-fg tracking-tight leading-none">Size {result.recommended_size}</p>
							<p class="text-[12px] text-rosys-fg-faint mt-1">{pattern.pattern_name}</p>
						</div>
					</div>
					<span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border capitalize
						{result.confidence === 'high' ? 'text-emerald-600 bg-emerald-50 border-emerald-200/60' :
						 result.confidence === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200/60' :
						 'text-red-600 bg-red-50 border-red-200/60'}">
						{result.confidence}
					</span>
				</div>

				<div class="text-[14px] text-rosys-fg-secondary leading-[1.75] mb-5">{result.customer_summary}</div>

				{#if result.between_sizes}
					<div class="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/30 mb-5">
						<AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-amber-800">Between {result.size_down} and {result.size_up}</p>
							<p class="text-[12px] text-amber-700 leading-relaxed">{result.between_sizes_advice}</p>
						</div>
					</div>
				{/if}

				{#if result.fit_analysis?.length > 0}
					<div class="grid grid-cols-3 gap-2.5 mb-5">
						{#each result.fit_analysis as fit}
							<div class="rounded-xl border p-3 {fitBg(fit.fit)}">
								<p class="text-[10px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1">{fit.measurement}</p>
								<p class="text-[18px] font-bold {fitColor(fit.fit)} leading-none mb-1">{fit.user_cm}<span class="text-[11px] font-normal">cm</span></p>
								<p class="text-[11px] {fitColor(fit.fit)} font-medium capitalize">{fit.fit}</p>
								{#if fit.concern}
									<p class="text-[10px] text-amber-600 mt-1">{fit.concern}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			{#if (result.length_adjustments?.some((a: any) => a.adjust_cm !== 0)) || result.width_adjustments?.length > 0}
				<div class="border-t border-emerald-100/60 px-6 py-4 bg-emerald-50/20">
					<div class="flex items-center gap-2 mb-3">
						<Scissors class="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
						<p class="text-[11px] font-semibold text-emerald-700 uppercase tracking-[0.1em]">Adjustments</p>
					</div>
					<div class="space-y-2">
						{#each [...(result.length_adjustments?.filter((a: any) => a.adjust_cm !== 0) ?? []), ...(result.width_adjustments ?? [])] as adj}
							<div class="flex items-center justify-between py-1.5">
								<span class="text-[13px] text-rosys-fg-muted">{adj.area}</span>
								<div class="text-right">
									<span class="text-[14px] font-semibold {adj.adjust_cm > 0 ? 'text-blue-600' : 'text-amber-600'}">{adj.adjust_cm > 0 ? '+' : ''}{adj.adjust_cm}cm</span>
									<p class="text-[10px] text-rosys-fg-faint">{adj.reason}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if result.garment_notes}
				<div class="border-t border-emerald-100/60 px-6 py-4">
					<p class="text-[12px] text-rosys-fg-muted leading-relaxed">{result.garment_notes}</p>
				</div>
			{/if}
		</div>

		<!-- Continue to download -->
		<button type="button" onclick={() => step = 'download'}
			class="w-full py-3.5 inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-sm mb-4">
			<Download class="w-4 h-4" strokeWidth={2} />
			Get My Pattern
		</button>

		<button type="button" onclick={() => { step = 'measure'; result = null; }} class="text-[12px] text-rosys-fg-faint hover:text-rosys-500 transition-colors">
			← Try different measurements
		</button>
	{/if}

	<!-- ═══════════════════════════════════════════ -->
	<!-- STEP 5: Download patterns                   -->
	<!-- ═══════════════════════════════════════════ -->
	{#if step === 'download' && result}
		<div class="text-center mb-6">
			<h1 class="text-rosys-fg text-[24px] font-bold tracking-[-0.03em] mb-1">Get Your Pattern</h1>
			<p class="text-rosys-fg-muted text-[13px]">Size {result.recommended_size} — {pattern.pattern_name}</p>
		</div>

		<!-- Single-size PDF -->
		<div class="bg-white rounded-2xl border border-violet-200/50 shadow-sm p-5 mb-4 page-enter">
			<div class="flex items-center gap-2 mb-1">
				<FileText class="w-4 h-4 text-violet-500" strokeWidth={1.5} />
				<h2 class="text-[13px] font-semibold text-rosys-fg">Single-Size PDF</h2>
			</div>
			<p class="text-[12px] text-rosys-fg-faint mb-4">Clean pattern with only your size — no other lines.</p>
			<div class="grid grid-cols-3 gap-2">
				{#each [
					{ format: 'a0', label: 'A0', desc: 'Print shop' },
					{ format: 'a4', label: 'A4', desc: 'Home printer' },
					{ format: 'us_letter', label: 'US Letter', desc: 'US printer' }
				] as dl}
					<a href="/api/patterns/single-size?slug={pattern.pattern_slug}&size={result.recommended_size}&format={dl.format}"
						class="flex flex-col items-center gap-1 p-3 rounded-xl bg-violet-50/50 border border-violet-100/50 hover:border-violet-300 hover:shadow-sm active:scale-[0.97] transition-all group">
						<Box class="w-5 h-5 text-violet-400 group-hover:text-violet-500" strokeWidth={1.5} />
						<span class="text-[13px] font-semibold text-rosys-fg">{dl.label}</span>
						<span class="text-[10px] text-rosys-fg-faint">{dl.desc}</span>
					</a>
				{/each}
			</div>
		</div>

		<!-- Custom DXF -->
		<a href="/patterns/{pattern.pattern_slug}/custom-fit"
			class="flex items-center gap-4 p-5 bg-white rounded-2xl border border-rosys-border/40 shadow-sm hover:border-rosys-fg/15 hover:shadow-md transition-all mb-4 page-enter group">
			<div class="w-10 h-10 rounded-xl bg-rosys-fg flex items-center justify-center shrink-0">
				<Scissors class="w-5 h-5 text-white" strokeWidth={1.5} />
			</div>
			<div class="flex-1">
				<p class="text-[14px] font-semibold text-rosys-fg">Custom-Fit DXF</p>
				<p class="text-[12px] text-rosys-fg-faint">Pattern pieces scaled to your exact measurements — for cutting machines</p>
			</div>
			<ChevronRight class="w-4 h-4 text-rosys-fg/20 group-hover:text-rosys-fg/40" strokeWidth={1.5} />
		</a>

		<!-- Save profile -->
		<a href="/profile/measurements"
			class="flex items-center gap-4 p-4 bg-white rounded-2xl border border-rosys-border/30 shadow-sm hover:border-emerald-200 transition-all mb-6 page-enter group">
			<User class="w-5 h-5 text-rosys-fg-faint group-hover:text-emerald-500" strokeWidth={1.5} />
			<div class="flex-1">
				<p class="text-[13px] font-medium text-rosys-fg">Save measurements for next time</p>
				<p class="text-[11px] text-rosys-fg-faint">One-click sizing on every pattern</p>
			</div>
			<ChevronRight class="w-4 h-4 text-rosys-fg/20" strokeWidth={1.5} />
		</a>

		<button type="button" onclick={() => step = 'analysis'} class="text-[12px] text-rosys-fg-faint hover:text-rosys-500 transition-colors">
			← Back to analysis
		</button>
	{/if}

	<!-- ═══════════════════════════════════════════ -->
	<!-- Size Chart (always accessible)              -->
	<!-- ═══════════════════════════════════════════ -->
	{#if hasChart && step !== 'choose'}
		<div class="mt-8">
			<button type="button" onclick={() => showChart = !showChart}
				class="w-full flex items-center justify-between p-3.5 bg-white/60 rounded-xl border border-rosys-border/20 text-left hover:bg-white transition-colors">
				<span class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Size Chart Reference</span>
				<ChevronDown class="w-4 h-4 text-rosys-fg-faint transition-transform {showChart ? 'rotate-180' : ''}" strokeWidth={1.5} />
			</button>

			{#if showChart}
				<div class="bg-white rounded-xl border border-rosys-border/20 p-4 mt-2 page-enter overflow-x-auto">
					<table class="w-full text-[11px]">
						<thead>
							<tr class="border-b border-rosys-border/30">
								<th class="text-left py-1.5 pr-3 text-rosys-fg-faint font-medium"></th>
								{#each sizes as size, i}
									<th class="text-center py-1.5 px-1.5 font-semibold {i === highlightedIndex ? 'text-emerald-600 bg-emerald-50/60 rounded-t' : 'text-rosys-fg'}">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each ['bust_cm', 'waist_cm', 'hip_cm'] as key}
								{@const label = key.replace('_cm','').charAt(0).toUpperCase() + key.replace('_cm','').slice(1)}
								<tr class="border-b border-rosys-border/15">
									<td class="py-1.5 pr-3 text-rosys-fg-muted font-medium">{label}</td>
									{#each bodyRows as row, i}
										<td class="text-center py-1.5 px-1.5 {i === highlightedIndex ? 'font-semibold text-emerald-700 bg-emerald-50/60' : 'text-rosys-fg'}">{(row as any)[key] ? Number((row as any)[key]) : '—'}</td>
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
