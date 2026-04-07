<script lang="ts">
	import { ArrowLeft, Scissors, Loader2, AlertTriangle, Check, Download, RefreshCw, Ruler } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, hasDxf, savedProfile } = data;

	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');

	let loading = $state(false);
	let downloading = $state(false);
	let grading = $state<any>(null);
	let apiError = $state('');
	let errorMsg = $state('');
	let step = $state<'input' | 'preview' | 'done'>('input');

	async function calculateFit() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter all measurements.'; return; }
		loading = true;
		errorMsg = '';
		apiError = '';

		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip) })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
			const json = await res.json();
			grading = json.grading;
			apiError = json.error || '';
			step = 'preview';
		} catch (e: any) {
			errorMsg = e.message || 'Could not calculate custom fit.';
		} finally {
			loading = false;
		}
	}

	async function downloadDxf() {
		downloading = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), generate: true })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Download failed');

			const blob = await res.blob();
			const cd = res.headers.get('content-disposition');
			const filename = cd?.match(/filename="(.+)"/)?.[1] || `${pattern.pattern_slug}-custom.dxf`;

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
			step = 'done';
		} catch (e: any) {
			errorMsg = e.message || 'Could not generate pattern.';
		} finally {
			downloading = false;
		}
	}

	function startOver() {
		step = 'input';
		grading = null;
		apiError = '';
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

	<div class="flex items-center gap-3 mb-3">
		<div class="rosys-section-icon bg-gradient-to-br from-violet-500 to-violet-600">
			<Scissors class="w-5 h-5 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em]">Custom Fit Pattern</h1>
			<p class="text-rosys-fg-faint text-[13px]">DXF cutting file adjusted to your exact body</p>
		</div>
	</div>

	<p class="text-[13px] text-rosys-fg-muted mb-8 leading-relaxed">
		Get a single-size DXF pattern scaled to your measurements — perfect for cutting machines (Cricut, Silhouette) or digital cutting. For printed PDF patterns, use the <a href="/patterns/{pattern.pattern_slug}/sizing" class="text-rosys-500 hover:underline">Size Assistant</a> to find which line to cut.
	</p>

	{#if !hasDxf}
		<div class="rosys-card p-8 text-center">
			<Scissors class="w-10 h-10 text-rosys-fg/10 mx-auto mb-3" strokeWidth={1} />
			<p class="text-[14px] text-rosys-fg-muted">Custom fit is not yet available for this pattern.</p>
		</div>
	{:else}

		<!-- Step 1: Measurements -->
		{#if step === 'input'}
			<div class="rosys-card p-6">
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
						<input id="bust" type="number" bind:value={bust} placeholder="88" class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-violet-400/20 focus:border-violet-300 transition-all" />
					</div>
					<div>
						<label for="waist" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Waist</label>
						<input id="waist" type="number" bind:value={waist} placeholder="72" class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-violet-400/20 focus:border-violet-300 transition-all" />
					</div>
					<div>
						<label for="hip" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Hip</label>
						<input id="hip" type="number" bind:value={hip} placeholder="92" class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-violet-400/20 focus:border-violet-300 transition-all" />
					</div>
				</div>
				<button type="button" disabled={loading || !bust || !waist || !hip} onclick={calculateFit}
					class="mt-5 w-full py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
					{#if loading}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Calculating...
					{:else}<Scissors class="w-4 h-4" strokeWidth={2} />Calculate Custom Fit{/if}
				</button>
			</div>
		{/if}

		<!-- Step 2: Preview + Download -->
		{#if step === 'preview' && grading}
			<div class="rosys-card p-6 mb-4 page-enter">
				<div class="flex items-center justify-between mb-5">
					<div>
						<p class="text-[11px] font-semibold text-violet-600 uppercase tracking-[0.1em]">Custom Fit Preview</p>
						<p class="text-[13px] text-rosys-fg-muted">Based on {grading.sample_size} pattern, adjusted for your body</p>
					</div>
					<span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border capitalize {confidenceColor(grading.confidence)}">{grading.confidence}</span>
				</div>

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
								{ label: 'Bust', sample: grading.sample_finished.bust_cm, custom: grading.custom_finished.bust_cm, delta: grading.adjustments.bust_delta_cm },
								{ label: 'Waist', sample: grading.sample_finished.waist_cm, custom: grading.custom_finished.waist_cm, delta: grading.adjustments.waist_delta_cm },
								{ label: 'Hip', sample: grading.sample_finished.hip_cm, custom: grading.custom_finished.hip_cm, delta: grading.adjustments.hip_delta_cm },
								{ label: 'Length', sample: grading.sample_finished.full_length_cm, custom: grading.custom_finished.full_length_cm, delta: grading.adjustments.length_delta_cm }
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
					<div class="mb-4 space-y-2">
						{#each grading.warnings as warning}
							<div class="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200/40">
								<AlertTriangle class="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" strokeWidth={2} />
								<span class="text-[12px] text-amber-700">{warning}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if apiError}
					<div class="mb-4 p-4 rounded-lg bg-red-50 border border-red-200/40">
						<p class="text-[13px] text-red-700">{apiError}</p>
					</div>
				{:else}
					<div class="flex gap-3">
						<button type="button" disabled={downloading} onclick={downloadDxf}
							class="flex-1 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40">
							{#if downloading}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Generating...
							{:else}<Download class="w-4 h-4" strokeWidth={2} />Download Custom DXF{/if}
						</button>
						<button type="button" onclick={startOver} class="px-4 py-3 rounded-xl text-rosys-fg-muted hover:bg-warm-100 transition-colors">
							<RefreshCw class="w-4 h-4" strokeWidth={1.5} />
						</button>
					</div>
				{/if}
			</div>

			<!-- Tip: use Size Assistant for PDFs -->
			<div class="rosys-card p-4 flex items-start gap-3">
				<Ruler class="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" strokeWidth={1.5} />
				<div>
					<p class="text-[13px] text-rosys-fg-muted">
						<strong class="text-rosys-fg">Printing a PDF pattern?</strong> Use the
						<a href="/patterns/{pattern.pattern_slug}/sizing" class="text-emerald-600 hover:underline font-medium">Size Assistant</a>
						to find which size line to cut — the PDF already includes all 7 sizes.
					</p>
				</div>
			</div>
		{/if}

		<!-- Step 3: Downloaded -->
		{#if step === 'done'}
			<div class="rosys-card border-emerald-200/60 p-6 mb-4 page-enter">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
						<Check class="w-5 h-5 text-white" strokeWidth={2.5} />
					</div>
					<div>
						<p class="text-[16px] font-bold text-rosys-fg">Your custom pattern has been downloaded</p>
						<p class="text-[13px] text-rosys-fg-muted">Single-size DXF adjusted for bust {bust}cm, waist {waist}cm, hip {hip}cm</p>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3 mt-4 text-[13px]">
					<div class="p-3 rounded-lg bg-violet-50/50">
						<p class="text-[11px] text-violet-500 font-semibold mb-0.5">Width adjusted</p>
						<p class="text-rosys-fg font-medium">{((grading.scale_width - 1) * 100).toFixed(1)}%</p>
					</div>
					<div class="p-3 rounded-lg bg-violet-50/50">
						<p class="text-[11px] text-violet-500 font-semibold mb-0.5">Height adjusted</p>
						<p class="text-rosys-fg font-medium">{((grading.scale_height - 1) * 100).toFixed(1)}%</p>
					</div>
				</div>
			</div>

			<div class="flex gap-3">
				<button type="button" onclick={downloadDxf} class="flex-1 rosys-btn-primary py-3">
					<Download class="w-4 h-4" strokeWidth={2} />
					Download Again
				</button>
				<button type="button" onclick={startOver}
					class="px-4 py-3 rounded-xl text-[14px] font-medium text-rosys-fg-muted bg-rosys-card border border-rosys-border/60 hover:border-rosys-fg/20 transition-all">
					Different measurements
				</button>
			</div>
		{/if}

		{#if errorMsg}
			<div class="rosys-card border-red-200/60 p-4 mt-4">
				<p class="text-[13px] text-red-600">{errorMsg}</p>
			</div>
		{/if}
	{/if}
</div>
