<script lang="ts">
	import { Ruler, Sparkles, Loader2, AlertTriangle } from 'lucide-svelte';

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
					height: height ? parseFloat(height) : undefined
				})
			});

			if (!res.ok) throw new Error('Failed');
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
	<title>Size Assistant — Rosys Patterns</title>
</svelte:head>

<div class="page-enter mesh-bg min-h-screen px-6 py-10 md:px-10 md:py-14 max-w-3xl mx-auto">
	<!-- Header with rosys-section-icon -->
	<div class="flex items-center gap-4 mb-3" style="animation: fadeUp 0.45s var(--ease-spring) both;">
		<div class="rosys-section-icon">
			<Ruler class="w-5 h-5 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[28px] md:text-[32px] font-bold tracking-[-0.04em]">Size Assistant</h1>
			<p class="text-rosys-fg-faint text-[14px] mt-0.5">AI-powered sizing for all Rosys Patterns</p>
		</div>
	</div>

	<p class="text-rosys-fg-muted text-[15px] leading-relaxed mb-10 mt-5 max-w-lg" style="animation: fadeUp 0.45s var(--ease-spring) 0.06s both;">
		Enter your body measurements and our AI will recommend the best size. For pattern-specific sizing,
		visit any pattern and use the sizing tab there.
	</p>

	<!-- Measurement form card -->
	<div class="rosys-card p-8 mb-8" style="box-shadow: var(--shadow-xl); animation: fadeUp 0.45s var(--ease-spring) 0.12s both;">
		<h2 class="rosys-section-label mb-5">Your Measurements (cm)</h2>
		<div class="grid grid-cols-2 gap-5">
			<div>
				<label for="bust" class="block text-[12px] font-semibold text-rosys-fg-muted mb-2">Bust</label>
				<input id="bust" type="number" bind:value={bust} placeholder="e.g. 88"
					class="rosys-input" />
			</div>
			<div>
				<label for="waist" class="block text-[12px] font-semibold text-rosys-fg-muted mb-2">Waist</label>
				<input id="waist" type="number" bind:value={waist} placeholder="e.g. 72"
					class="rosys-input" />
			</div>
			<div>
				<label for="hip" class="block text-[12px] font-semibold text-rosys-fg-muted mb-2">Hip</label>
				<input id="hip" type="number" bind:value={hip} placeholder="e.g. 96"
					class="rosys-input" />
			</div>
			<div>
				<label for="height" class="block text-[12px] font-semibold text-rosys-fg-muted mb-2">Height <span class="text-rosys-fg-faint font-normal">(optional)</span></label>
				<input id="height" type="number" bind:value={height} placeholder="e.g. 168"
					class="rosys-input" />
			</div>
		</div>

		<button
			type="button"
			disabled={loading || !bust || !waist || !hip}
			onclick={getRecommendation}
			class="rosys-btn-primary shine-effect mt-7 w-full py-4"
		>
			{#if loading}
				<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
				Analyzing...
			{:else}
				<Sparkles class="w-4 h-4" strokeWidth={2} />
				Get Size Recommendation
			{/if}
		</button>

		<!-- Error -->
		{#if error}
			<div class="flex items-start gap-3 mt-5 p-4 rounded-xl"
				style="background: linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02)); border: 1px solid rgba(239,68,68,0.12); animation: slideDown 0.35s var(--ease-spring);">
				<AlertTriangle class="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
				<p class="text-red-600 text-[14px] font-medium">{error}</p>
			</div>
		{/if}
	</div>

	<!-- Result card -->
	{#if recommendation}
		<div class="rosys-card p-7" style="border-left: 4px solid var(--color-rosys-success); box-shadow: var(--shadow-xl); animation: scaleIn 0.45s var(--ease-spring);">
			<div class="flex items-center gap-3 mb-5">
				<div class="w-10 h-10 rounded-xl flex items-center justify-center"
					style="background: linear-gradient(135deg, rgba(52,199,89,0.1), rgba(52,199,89,0.05)); border: 1px solid rgba(52,199,89,0.12);">
					<Sparkles class="w-5 h-5 text-emerald-500" strokeWidth={2} />
				</div>
				<h2 class="text-[16px] font-bold text-emerald-700">AI Recommendation</h2>
			</div>
			<div class="text-[14px] text-rosys-fg-secondary leading-[1.8] whitespace-pre-line">
				{recommendation}
			</div>
		</div>
	{/if}
</div>
