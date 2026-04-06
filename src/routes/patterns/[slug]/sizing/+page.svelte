<script lang="ts">
	import { ArrowLeft, Ruler, Sparkles, Loader2 } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, sizeChart } = data;

	let bust = $state('');
	let waist = $state('');
	let hip = $state('');
	let height = $state('');
	let loading = $state(false);
	let recommendation = $state('');
	let error = $state('');

	async function getRecommendation() {
		if (!bust || !waist || !hip) { error = 'Please enter bust, waist, and hip.'; return; }
		loading = true;
		error = '';
		recommendation = '';

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
		} catch {
			error = 'Could not get recommendation. Please try again.';
		} finally {
			loading = false;
		}
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
		<div class="rosys-section-icon">
			<Ruler class="w-5 h-5 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em]">Size Assistant</h1>
			<p class="text-rosys-fg-faint text-[13px]">AI-powered recommendation for {pattern.pattern_name}</p>
		</div>
	</div>

	{#if sizeChart}
		<div class="rosys-card p-5 mb-8">
			<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Size Chart Reference</h2>
			<div class="text-[13px] text-rosys-fg-muted font-mono whitespace-pre-line leading-relaxed overflow-x-auto">
				{sizeChart}
			</div>
		</div>
	{/if}

	<div class="rosys-card p-6 mb-6">
		<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-4">Your Measurements (cm)</h2>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="bust" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Bust</label>
				<input id="bust" type="number" bind:value={bust} placeholder="e.g. 88"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-300 transition-all" />
			</div>
			<div>
				<label for="waist" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Waist</label>
				<input id="waist" type="number" bind:value={waist} placeholder="e.g. 72"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-300 transition-all" />
			</div>
			<div>
				<label for="hip" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Hip</label>
				<input id="hip" type="number" bind:value={hip} placeholder="e.g. 96"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-300 transition-all" />
			</div>
			<div>
				<label for="height" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Height <span class="text-rosys-fg-faint">(optional)</span></label>
				<input id="height" type="number" bind:value={height} placeholder="e.g. 168"
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-300 transition-all" />
			</div>
		</div>

		<button
			type="button"
			disabled={loading || !bust || !waist || !hip}
			onclick={getRecommendation}
			class="rosys-btn-primary mt-5 w-full py-3.5"
		>
			{#if loading}
				<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
				Analyzing...
			{:else}
				<Sparkles class="w-4 h-4" strokeWidth={2} />
				Get Size Recommendation
			{/if}
		</button>

		{#if error}
			<p class="mt-3 text-rosys-500 text-[13px]">{error}</p>
		{/if}
	</div>

	{#if recommendation}
		<div class="rosys-card border-emerald-200/60 p-6 page-enter">
			<div class="flex items-center gap-2 mb-4">
				<Sparkles class="w-4 h-4 text-emerald-500" strokeWidth={2} />
				<h2 class="text-[13px] font-semibold text-emerald-700">AI Recommendation</h2>
			</div>
			<div class="text-[14px] text-rosys-fg-secondary leading-[1.8] whitespace-pre-line">
				{recommendation}
			</div>
		</div>
	{/if}
</div>
