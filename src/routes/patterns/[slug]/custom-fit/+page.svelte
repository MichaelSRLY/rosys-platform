<script lang="ts">
	import { ArrowLeft, Scissors, Loader2, AlertTriangle, Check, ArrowRight, Ruler, Download } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, hasDxf, savedProfile } = data;

	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');
	let loading = $state(false);
	let grading = $state<any>(null);
	let errorMsg = $state('');

	async function calculateFit() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter all measurements.'; return; }
		loading = true;
		errorMsg = '';
		grading = null;

		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pattern_slug: pattern.pattern_slug,
					bust: parseFloat(bust),
					waist: parseFloat(waist),
					hip: parseFloat(hip)
				})
			});

			if (!res.ok) throw new Error('Failed to calculate');
			const json = await res.json();
			grading = json.grading;
		} catch {
			errorMsg = 'Could not calculate custom fit. Please try again.';
		} finally {
			loading = false;
		}
	}

	function confidenceColor(c: string) {
		if (c === 'high') return 'text-emerald-600 bg-emerald-50 border-emerald-200/60';
		if (c === 'medium') return 'text-amber-600 bg-amber-50 border-amber-200/60';
		return 'text-red-600 bg-red-50 border-red-200/60';
	}

	function fmtDelta(v: number | null) {
		if (v === null) return '—';
		return `${v > 0 ? '+' : ''}${v.toFixed(1)}cm`;
	}

	function fmtScale(v: number) {
		const pct = (v - 1) * 100;
		return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
	}
</script>

<svelte:head>
	<title>Custom Fit — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-3xl mx-auto">
	<a href="/patterns/{pattern.pattern_slug}" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<div class="flex items-center gap-3 mb-8">
		<div class="rosys-section-icon bg-gradient-to-br from-violet-500 to-violet-600">
			<Scissors class="w-5 h-5 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em]">Custom Fit</h1>
			<p class="text-rosys-fg-faint text-[13px]">Get pattern pieces adjusted to your exact measurements</p>
		</div>
	</div>

	{#if !hasDxf}
		<div class="rosys-card p-8 text-center">
			<Scissors class="w-10 h-10 text-rosys-fg/10 mx-auto mb-3" strokeWidth={1} />
			<p class="text-[14px] text-rosys-fg-muted mb-1">No DXF pattern data available</p>
			<p class="text-[12px] text-rosys-fg-faint">Custom fit requires digital pattern pieces for this pattern.</p>
		</div>
	{:else}
		<!-- Measurement Input -->
		<div class="rosys-card p-6 mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Your Body Measurements (cm)</h2>
				{#if savedProfile}
					<span class="text-[11px] font-medium text-rosys-500">From saved profile</span>
				{/if}
			</div>

			<div class="grid grid-cols-3 gap-4">
				<div>
					<label for="bust" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Bust</label>
					<input id="bust" type="number" bind:value={bust} placeholder="88"
						class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-violet-400/20 focus:border-violet-300 transition-all" />
				</div>
				<div>
					<label for="waist" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Waist</label>
					<input id="waist" type="number" bind:value={waist} placeholder="72"
						class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-violet-400/20 focus:border-violet-300 transition-all" />
				</div>
				<div>
					<label for="hip" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Hip</label>
					<input id="hip" type="number" bind:value={hip} placeholder="92"
						class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-violet-400/20 focus:border-violet-300 transition-all" />
				</div>
			</div>

			<button
				type="button"
				disabled={loading || !bust || !waist || !hip}
				onclick={calculateFit}
				class="mt-5 w-full py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{#if loading}
					<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
					Calculating...
				{:else}
					<Scissors class="w-4 h-4" strokeWidth={2} />
					Calculate Custom Fit
				{/if}
			</button>

			{#if errorMsg}
				<p class="mt-3 text-rosys-500 text-[13px]">{errorMsg}</p>
			{/if}
		</div>

		<!-- Grading Results -->
		{#if grading}
			<!-- Confidence badge -->
			<div class="rosys-card p-6 mb-4 page-enter">
				<div class="flex items-center justify-between mb-5">
					<div class="flex items-center gap-2">
						<div class="w-8 h-8 rounded-xl bg-violet-500 flex items-center justify-center">
							<Check class="w-4 h-4 text-white" strokeWidth={2.5} />
						</div>
						<div>
							<p class="text-[11px] font-semibold text-violet-600 uppercase tracking-[0.1em]">Custom Fit Calculated</p>
							<p class="text-[13px] text-rosys-fg-muted">Based on {grading.sample_size} sample, closest to {grading.target_size}</p>
						</div>
					</div>
					<span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border capitalize {confidenceColor(grading.confidence)}">
						{grading.confidence} confidence
					</span>
				</div>

				<!-- Scale factors -->
				<div class="grid grid-cols-2 gap-3 mb-5">
					<div class="p-3 rounded-xl bg-violet-50/50 border border-violet-100/60">
						<p class="text-[11px] text-violet-500 font-semibold uppercase tracking-wider mb-0.5">Width Scale</p>
						<p class="text-[22px] font-bold text-rosys-fg">{fmtScale(grading.scale_width)}</p>
						<p class="text-[11px] text-rosys-fg-faint">×{grading.scale_width.toFixed(4)}</p>
					</div>
					<div class="p-3 rounded-xl bg-violet-50/50 border border-violet-100/60">
						<p class="text-[11px] text-violet-500 font-semibold uppercase tracking-wider mb-0.5">Height Scale</p>
						<p class="text-[22px] font-bold text-rosys-fg">{fmtScale(grading.scale_height)}</p>
						<p class="text-[11px] text-rosys-fg-faint">×{grading.scale_height.toFixed(4)}</p>
					</div>
				</div>

				<!-- Measurement comparison -->
				<div class="overflow-x-auto -mx-1">
					<table class="w-full text-[13px]">
						<thead>
							<tr class="border-b border-rosys-border/40">
								<th class="text-left py-2 pr-3 text-rosys-fg-faint font-medium"></th>
								<th class="text-center py-2 px-3 text-rosys-fg-faint font-medium">Sample ({grading.sample_size})</th>
								<th class="text-center py-2 px-3 text-rosys-fg-faint font-medium">Std ({grading.target_size})</th>
								<th class="text-center py-2 px-3 text-violet-600 font-semibold bg-violet-50/50 rounded-t-lg">Your Custom</th>
								<th class="text-center py-2 px-3 text-rosys-fg-faint font-medium">Delta</th>
							</tr>
						</thead>
						<tbody>
							{#each [
								{ label: 'Bust', sample: grading.sample_finished.bust_cm, target: grading.target_finished.bust_cm, custom: grading.custom_finished.bust_cm, delta: grading.adjustments.bust_delta_cm },
								{ label: 'Waist', sample: grading.sample_finished.waist_cm, target: grading.target_finished.waist_cm, custom: grading.custom_finished.waist_cm, delta: grading.adjustments.waist_delta_cm },
								{ label: 'Hip', sample: grading.sample_finished.hip_cm, target: grading.target_finished.hip_cm, custom: grading.custom_finished.hip_cm, delta: grading.adjustments.hip_delta_cm },
								{ label: 'Length', sample: grading.sample_finished.full_length_cm, target: grading.target_finished.full_length_cm, custom: grading.custom_finished.full_length_cm, delta: grading.adjustments.length_delta_cm }
							] as row}
								<tr class="border-b border-rosys-border/20">
									<td class="py-2.5 pr-3 text-rosys-fg-muted font-medium">{row.label}</td>
									<td class="text-center py-2.5 px-3 text-rosys-fg">{row.sample !== null ? `${row.sample}cm` : '—'}</td>
									<td class="text-center py-2.5 px-3 text-rosys-fg">{row.target !== null ? `${row.target}cm` : '—'}</td>
									<td class="text-center py-2.5 px-3 font-semibold text-violet-700 bg-violet-50/50">{row.custom !== null ? `${row.custom.toFixed(1)}cm` : '—'}</td>
									<td class="text-center py-2.5 px-3 {row.delta !== null && row.delta !== 0 ? (row.delta > 0 ? 'text-blue-600' : 'text-amber-600') : 'text-rosys-fg-faint'} font-medium">{fmtDelta(row.delta)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Warnings -->
				{#if grading.warnings.length > 0}
					<div class="mt-4 space-y-2">
						{#each grading.warnings as warning}
							<div class="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200/40">
								<AlertTriangle class="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" strokeWidth={2} />
								<span class="text-[12px] text-amber-700">{warning}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- How to use -->
			<div class="rosys-card p-5 mb-6 page-enter">
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">How to get your custom DXF</h2>
				<div class="space-y-3 text-[13px] text-rosys-fg-muted">
					<div class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-[11px] font-bold text-violet-600 shrink-0">1</span>
						<p>Run the grading script on your machine with your measurements:</p>
					</div>
					<div class="ml-9 p-3 rounded-lg bg-rosys-fg text-[12px] text-emerald-300 font-mono overflow-x-auto">
						python3 scripts/grade-pattern.py {pattern.pattern_slug} --bust {bust} --waist {waist} --hip {hip}
					</div>
					<div class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-[11px] font-bold text-violet-600 shrink-0">2</span>
						<p>Open the generated DXF in your cutting software (Cricut, Silhouette, etc.) or print with your pattern printer.</p>
					</div>
					<div class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-[11px] font-bold text-violet-600 shrink-0">3</span>
						<p>The pieces have been proportionally scaled from the {grading.sample_size} base to fit your body with the pattern's designed ease.</p>
					</div>
				</div>
			</div>

			<!-- Navigation -->
			<div class="flex gap-3">
				<a
					href="/patterns/{pattern.pattern_slug}/sizing"
					class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[14px] font-medium text-rosys-fg-muted bg-rosys-card border border-rosys-border/60 hover:border-rosys-fg/20 hover:shadow-sm transition-all"
				>
					<Ruler class="w-4 h-4" strokeWidth={1.5} />
					Size Assistant
				</a>
				<a
					href="/patterns/{pattern.pattern_slug}/pieces"
					class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[14px] font-medium text-rosys-fg-muted bg-rosys-card border border-rosys-border/60 hover:border-rosys-fg/20 hover:shadow-sm transition-all"
				>
					<ArrowRight class="w-4 h-4" strokeWidth={1.5} />
					View Pieces
				</a>
			</div>
		{/if}
	{/if}
</div>
