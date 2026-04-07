<script lang="ts">
	import { ArrowLeft, Scissors, Loader2, AlertTriangle, Check, Download, RefreshCw, FileText, Box } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, hasDxf, savedProfile } = data;

	let bust = $state(savedProfile?.bust_cm?.toString() ?? '');
	let waist = $state(savedProfile?.waist_cm?.toString() ?? '');
	let hip = $state(savedProfile?.hip_cm?.toString() ?? '');

	let loading = $state(false);
	let generating = $state(false);
	let grading = $state<any>(null);
	let files = $state<any[]>([]);
	let errorMsg = $state('');
	let downloadingFormat = $state('');
	let step = $state<'input' | 'preview' | 'ready'>('input');

	async function calculateFit() {
		if (!bust || !waist || !hip) { errorMsg = 'Please enter all measurements.'; return; }
		loading = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip) })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
			const json = await res.json();
			grading = json.grading;
			step = 'preview';
		} catch (e: any) {
			errorMsg = e.message || 'Could not calculate custom fit.';
		} finally {
			loading = false;
		}
	}

	async function generateAll() {
		generating = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), generate: true })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Generation failed');
			const json = await res.json();
			grading = json.grading;
			files = json.files || [];
			step = 'ready';
		} catch (e: any) {
			errorMsg = e.message || 'Could not generate custom patterns.';
		} finally {
			generating = false;
		}
	}

	async function downloadFile(format: string, filename: string) {
		downloadingFormat = format;
		try {
			const res = await fetch('/api/patterns/generate-custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern_slug: pattern.pattern_slug, bust: parseFloat(bust), waist: parseFloat(waist), hip: parseFloat(hip), generate: true, format })
			});
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			errorMsg = `Failed to download ${format} file.`;
		} finally {
			downloadingFormat = '';
		}
	}

	function startOver() {
		step = 'input';
		grading = null;
		files = [];
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

	function formatIcon(format: string) {
		if (format === 'dxf') return Scissors;
		if (format === 'a0') return Box;
		return FileText;
	}

	function formatSize(bytes: number) {
		if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
		return `${Math.round(bytes / 1024)} KB`;
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
			<p class="text-rosys-fg-faint text-[13px]">Pattern files adjusted to your exact body measurements</p>
		</div>
	</div>

	{#if !hasDxf}
		<div class="rosys-card p-8 text-center">
			<Scissors class="w-10 h-10 text-rosys-fg/10 mx-auto mb-3" strokeWidth={1} />
			<p class="text-[14px] text-rosys-fg-muted">Custom fit is not yet available for this pattern.</p>
		</div>
	{:else}

		<!-- Step 1: Measurements -->
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

		<!-- Step 2: Preview + Generate -->
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
					<button type="button" disabled={generating} onclick={generateAll}
						class="flex-1 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40">
						{#if generating}<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />Generating your patterns...
						{:else}<Scissors class="w-4 h-4" strokeWidth={2} />Generate My Custom Patterns{/if}
					</button>
					<button type="button" onclick={startOver} class="px-4 py-3 rounded-xl text-rosys-fg-muted hover:bg-warm-100 transition-colors">
						<RefreshCw class="w-4 h-4" strokeWidth={1.5} />
					</button>
				</div>
			</div>
		{/if}

		<!-- Step 3: Download files -->
		{#if step === 'ready' && files.length > 0}
			<div class="rosys-card border-emerald-200/60 p-6 mb-4 page-enter">
				<div class="flex items-center gap-3 mb-5">
					<div class="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
						<Check class="w-5 h-5 text-white" strokeWidth={2.5} />
					</div>
					<div>
						<p class="text-[16px] font-bold text-rosys-fg">Your custom patterns are ready</p>
						<p class="text-[13px] text-rosys-fg-muted">Adjusted for bust {bust}cm, waist {waist}cm, hip {hip}cm</p>
					</div>
				</div>

				<div class="space-y-2">
					{#each files as file}
						{@const Icon = formatIcon(file.format)}
						<button
							type="button"
							onclick={() => downloadFile(file.format, file.filename)}
							disabled={!!downloadingFormat}
							class="w-full flex items-center gap-4 p-4 bg-white border border-rosys-border/40 rounded-xl hover:border-emerald-300 hover:shadow-sm active:scale-[0.98] transition-all text-left group"
						>
							<div class="w-10 h-10 rounded-xl {file.format === 'a0' ? 'bg-blue-50' : file.format === 'dxf' ? 'bg-violet-50' : 'bg-warm-100'} flex items-center justify-center shrink-0">
								<Icon class="w-5 h-5 {file.format === 'a0' ? 'text-blue-500' : file.format === 'dxf' ? 'text-violet-500' : 'text-rosys-fg-muted'}" strokeWidth={1.5} />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-[14px] font-medium text-rosys-fg">{file.label}</p>
								<p class="text-[12px] text-rosys-fg-faint">{file.filename} — {formatSize(file.size)}</p>
							</div>
							{#if downloadingFormat === file.format}
								<Loader2 class="w-4 h-4 text-rosys-fg-faint animate-spin shrink-0" strokeWidth={2} />
							{:else}
								<Download class="w-4 h-4 text-rosys-fg/20 group-hover:text-emerald-500 shrink-0 transition-colors" strokeWidth={1.5} />
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- What's included -->
			{#if grading}
				<div class="rosys-card p-5 mb-6 page-enter">
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">What's adjusted</h2>
					<div class="grid grid-cols-2 gap-3 text-[13px]">
						<div class="p-3 rounded-lg bg-violet-50/50">
							<p class="text-[11px] text-violet-500 font-semibold mb-0.5">Width</p>
							<p class="text-rosys-fg font-medium">{((grading.scale_width - 1) * 100).toFixed(1)}% {grading.scale_width > 1 ? 'larger' : 'smaller'}</p>
						</div>
						<div class="p-3 rounded-lg bg-violet-50/50">
							<p class="text-[11px] text-violet-500 font-semibold mb-0.5">Height</p>
							<p class="text-rosys-fg font-medium">{((grading.scale_height - 1) * 100).toFixed(1)}% {grading.scale_height > 1 ? 'longer' : 'shorter'}</p>
						</div>
					</div>
					<p class="text-[12px] text-rosys-fg-faint mt-3">All pattern pieces have been proportionally scaled from the {grading.sample_size} base pattern, preserving the design's intended ease and fit characteristics.</p>
				</div>
			{/if}

			<button type="button" onclick={startOver}
				class="w-full py-3 inline-flex items-center justify-center gap-2 rounded-xl text-[14px] font-medium text-rosys-fg-muted bg-rosys-card border border-rosys-border/60 hover:border-rosys-fg/20 hover:shadow-sm transition-all">
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
