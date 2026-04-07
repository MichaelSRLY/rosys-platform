<script lang="ts">
	import { ArrowLeft, Scissors, Loader2, AlertTriangle, Check, Shield, Download, RefreshCw } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, hasDxf, savedProfile } = data;

	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');

	let loading = $state(false);
	let generating = $state(false);
	let grading = $state<any>(null);
	let dxfResult = $state<any>(null);
	let errorMsg = $state('');
	let step = $state<'input' | 'preview' | 'ready'>('input');

	async function calculateFit() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter all measurements.'; return; }
		loading = true;
		errorMsg = '';

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
			step = 'preview';
		} catch {
			errorMsg = 'Could not calculate custom fit.';
		} finally {
			loading = false;
		}
	}

	async function generateAndDownload() {
		generating = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pattern_slug: pattern.pattern_slug,
					bust: parseFloat(bust),
					waist: parseFloat(waist),
					hip: parseFloat(hip),
					generate: true
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Generation failed');
			}

			const json = await res.json();
			dxfResult = json.dxf;
			grading = json.grading;
			step = 'ready';

			// Auto-download
			downloadDxf();
		} catch (e: any) {
			errorMsg = e.message || 'Could not generate custom pattern.';
		} finally {
			generating = false;
		}
	}

	function downloadDxf() {
		if (!dxfResult?.content) return;
		const blob = new Blob([dxfResult.content], { type: 'application/dxf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = dxfResult.filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function startOver() {
		step = 'input';
		grading = null;
		dxfResult = null;
		errorMsg = '';
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
			<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em]">Custom Fit Pattern</h1>
			<p class="text-rosys-fg-faint text-[13px]">Pattern pieces adjusted to your exact body</p>
		</div>
	</div>

	{#if !hasDxf}
		<div class="rosys-card p-8 text-center">
			<Scissors class="w-10 h-10 text-rosys-fg/10 mx-auto mb-3" strokeWidth={1} />
			<p class="text-[14px] text-rosys-fg-muted">Custom fit is not yet available for this pattern.</p>
		</div>
	{:else}

		<!-- Step 1: Measurement Input -->
		{#if step === 'input'}
			<div class="rosys-card p-6 mb-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">Your Body Measurements (cm)</h2>
					{#if savedProfile}
						<span class="text-[11px] font-medium text-rosys-500">From saved profile</span>
					{:else}
						<a href="/profile/measurements" class="text-[11px] font-medium text-rosys-fg-faint hover:text-rosys-500 transition-colors">Save measurements</a>
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
			</div>
		{/if}

		<!-- Step 2: Preview grading + Generate -->
		{#if step === 'preview' && grading}
			<div class="rosys-card p-6 mb-4 page-enter">
				<div class="flex items-center justify-between mb-5">
					<div>
						<p class="text-[11px] font-semibold text-violet-600 uppercase tracking-[0.1em]">Custom Fit Preview</p>
						<p class="text-[13px] text-rosys-fg-muted">
							Grading from {grading.sample_size} base
							{#if grading.target_size !== grading.sample_size}
								toward {grading.target_size}
							{/if}
						</p>
					</div>
					<span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border capitalize {confidenceColor(grading.confidence)}">
						{grading.confidence}
					</span>
				</div>

				<!-- Comparison table -->
				<div class="overflow-x-auto -mx-1 mb-5">
					<table class="w-full text-[13px]">
						<thead>
							<tr class="border-b border-rosys-border/40">
								<th class="text-left py-2 pr-3 text-rosys-fg-faint font-medium"></th>
								<th class="text-center py-2 px-3 text-rosys-fg-faint font-medium">Original ({grading.sample_size})</th>
								<th class="text-center py-2 px-3 font-semibold text-violet-600 bg-violet-50/50 rounded-t-lg">Your Custom</th>
								<th class="text-center py-2 px-3 text-rosys-fg-faint font-medium">Change</th>
							</tr>
						</thead>
						<tbody>
							{#each [
								{ label: 'Bust (finished)', sample: grading.sample_finished.bust_cm, custom: grading.custom_finished.bust_cm, delta: grading.adjustments.bust_delta_cm },
								{ label: 'Waist (finished)', sample: grading.sample_finished.waist_cm, custom: grading.custom_finished.waist_cm, delta: grading.adjustments.waist_delta_cm },
								{ label: 'Hip (finished)', sample: grading.sample_finished.hip_cm, custom: grading.custom_finished.hip_cm, delta: grading.adjustments.hip_delta_cm },
								{ label: 'Full Length', sample: grading.sample_finished.full_length_cm, custom: grading.custom_finished.full_length_cm, delta: grading.adjustments.length_delta_cm }
							] as row}
								<tr class="border-b border-rosys-border/20">
									<td class="py-2.5 pr-3 text-rosys-fg-muted font-medium">{row.label}</td>
									<td class="text-center py-2.5 px-3 text-rosys-fg">{row.sample !== null ? `${row.sample}cm` : '—'}</td>
									<td class="text-center py-2.5 px-3 font-semibold text-violet-700 bg-violet-50/50">{row.custom !== null ? `${typeof row.custom === 'number' ? row.custom.toFixed(1) : row.custom}cm` : '—'}</td>
									<td class="text-center py-2.5 px-3 font-medium {row.delta && row.delta !== 0 ? (row.delta > 0 ? 'text-blue-600' : 'text-amber-600') : 'text-rosys-fg-faint'}">{fmtDelta(row.delta)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if grading.warnings.length > 0}
					<div class="mb-5 space-y-2">
						{#each grading.warnings as warning}
							<div class="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200/40">
								<AlertTriangle class="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" strokeWidth={2} />
								<span class="text-[12px] text-amber-700">{warning}</span>
							</div>
						{/each}
					</div>
				{/if}

				<div class="flex gap-3">
					<button
						type="button"
						disabled={generating}
						onclick={generateAndDownload}
						class="flex-1 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40"
					>
						{#if generating}
							<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
							Generating your pattern...
						{:else}
							<Download class="w-4 h-4" strokeWidth={2} />
							Generate & Download DXF
						{/if}
					</button>
					<button
						type="button"
						onclick={startOver}
						class="px-4 py-3 rounded-xl text-[14px] font-medium text-rosys-fg-muted hover:bg-warm-100 transition-colors"
					>
						<RefreshCw class="w-4 h-4" strokeWidth={1.5} />
					</button>
				</div>
			</div>
		{/if}

		<!-- Step 3: Generated + Validation -->
		{#if step === 'ready' && dxfResult}
			<!-- Success banner -->
			<div class="rosys-card border-emerald-200/60 p-6 mb-4 page-enter">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
						<Check class="w-5 h-5 text-white" strokeWidth={2.5} />
					</div>
					<div>
						<p class="text-[16px] font-bold text-rosys-fg">Your custom pattern is ready</p>
						<p class="text-[13px] text-rosys-fg-muted">{dxfResult.filename}</p>
					</div>
				</div>

				<button
					type="button"
					onclick={downloadDxf}
					class="w-full py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] transition-all shadow-sm"
				>
					<Download class="w-4 h-4" strokeWidth={2} />
					Download Again
				</button>
			</div>

			<!-- Piece-by-piece breakdown -->
			<div class="rosys-card p-5 mb-4 page-enter">
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Pattern Pieces</h2>
				<div class="space-y-2">
					{#each dxfResult.pieces as piece}
						<div class="flex items-center justify-between py-2 px-3 rounded-lg bg-warm-50/50">
							<span class="text-[13px] font-medium text-rosys-fg">{piece.name}</span>
							<div class="flex items-center gap-4 text-[12px]">
								<span class="text-rosys-fg-faint">{piece.originalCutMm.w}x{piece.originalCutMm.h}mm</span>
								<span class="text-rosys-fg-faint">→</span>
								<span class="font-medium text-violet-600">{piece.gradedCutMm.w}x{piece.gradedCutMm.h}mm</span>
								<span class="text-rosys-fg-faint">
									({piece.deltaW > 0 ? '+' : ''}{piece.deltaW}, {piece.deltaH > 0 ? '+' : ''}{piece.deltaH})
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Validation results -->
			<div class="rosys-card p-5 mb-6 page-enter">
				<div class="flex items-center gap-2 mb-3">
					<Shield class="w-4 h-4 {dxfResult.validation.passed ? 'text-emerald-500' : 'text-amber-500'}" strokeWidth={1.5} />
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em]">
						Validation {dxfResult.validation.passed ? 'Passed' : 'Warnings'}
					</h2>
				</div>

				{#if dxfResult.validation.passed}
					<div class="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200/40">
						<Check class="w-4 h-4 text-emerald-500" strokeWidth={2} />
						<span class="text-[13px] text-emerald-700">All {dxfResult.validation.checks.length} dimension checks passed — piece dimensions match expected measurements within 1mm tolerance.</span>
					</div>
				{:else}
					<div class="space-y-1">
						{#each dxfResult.validation.checks as check}
							<div class="flex items-center justify-between py-1.5 px-3 rounded-lg {check.passed ? 'bg-emerald-50/50' : 'bg-amber-50'}">
								<span class="text-[12px] text-rosys-fg-muted">{check.name}</span>
								<div class="flex items-center gap-2">
									<span class="text-[12px] text-rosys-fg-faint">expected {check.expected}mm</span>
									<span class="text-[12px] font-medium {check.passed ? 'text-emerald-600' : 'text-amber-600'}">
										actual {check.actual}mm
									</span>
									{#if check.passed}
										<Check class="w-3 h-3 text-emerald-500" strokeWidth={2.5} />
									{:else}
										<AlertTriangle class="w-3 h-3 text-amber-500" strokeWidth={2} />
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<button
				type="button"
				onclick={startOver}
				class="w-full py-3 inline-flex items-center justify-center gap-2 rounded-xl text-[14px] font-medium text-rosys-fg-muted bg-rosys-card border border-rosys-border/60 hover:border-rosys-fg/20 hover:shadow-sm transition-all"
			>
				<RefreshCw class="w-4 h-4" strokeWidth={1.5} />
				Generate for different measurements
			</button>
		{/if}

		{#if errorMsg}
			<div class="rosys-card border-red-200/60 p-4 mt-4">
				<p class="text-[13px] text-red-600">{errorMsg}</p>
			</div>
		{/if}
	{/if}
</div>
