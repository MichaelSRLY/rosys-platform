<script lang="ts">
	import { ArrowLeft, Calculator, Ruler, Scissors, AlertCircle } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, pieces, gradeInfo, fabricText, hasDxf } = data;

	// Fabric widths in cm
	const fabricWidths = [
		{ label: '45" (114 cm)', width: 114 },
		{ label: '54" (137 cm)', width: 137 },
		{ label: '60" (150 cm)', width: 150 }
	];

	let selectedWidth = $state(150);
	let fabricPrice = $state('');
	let addPatternMatch = $state(false);

	// Calculate total fabric needed
	const totalFabric = $derived(() => {
		if (pieces.length === 0) return null;

		// Simple nesting: stack pieces vertically within fabric width
		// This is a simplified calculation — real nesting is NP-hard
		let totalHeight = 0;

		for (const piece of pieces) {
			const pieceW = piece.cut_width / 10; // mm to cm
			const pieceH = piece.cut_height / 10;
			const qty = piece.qty * (piece.fold ? 2 : 1);

			// How many pieces fit side-by-side in fabric width
			const fitsAcross = Math.floor(selectedWidth / pieceW) || 1;
			const rows = Math.ceil(qty / fitsAcross);
			totalHeight += rows * pieceH;
		}

		// Add 10cm buffer for alignment
		totalHeight += 10;

		// Pattern matching adds 15%
		if (addPatternMatch) totalHeight *= 1.15;

		const meters = totalHeight / 100;
		const yards = meters * 1.0936;

		return { cm: Math.ceil(totalHeight), meters: Math.ceil(meters * 10) / 10, yards: Math.ceil(yards * 10) / 10 };
	});

	const totalCost = $derived(() => {
		const fab = totalFabric();
		if (!fab || !fabricPrice) return null;
		const price = parseFloat(fabricPrice);
		return Math.ceil(price * fab.meters * 100) / 100;
	});
</script>

<svelte:head>
	<title>Fabric Calculator — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-3xl mx-auto">
	<a href="/patterns/{pattern.pattern_slug}" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<div class="flex items-center gap-3 mb-8">
		<div class="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
			<Calculator class="w-6 h-6 text-amber-500" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[26px] font-light tracking-tight">Fabric Calculator</h1>
			<p class="text-rosys-fg-faint text-[13px]">{pattern.pattern_name}</p>
		</div>
	</div>

	{#if !hasDxf}
		<div class="bg-rosys-card rounded-2xl border border-rosys-border/50 p-6 shadow-sm text-center">
			<AlertCircle class="w-10 h-10 text-rosys-fg/20 mx-auto mb-3" strokeWidth={1.5} />
			<p class="text-rosys-fg-muted text-[14px]">DXF data not available for this pattern yet.</p>
			{#if fabricText}
				<div class="mt-4 text-left bg-rosys-bg rounded-xl p-4">
					<h3 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em] mb-2">Fabric Requirements (from instructions)</h3>
					<p class="text-[13px] text-rosys-fg-muted whitespace-pre-line">{fabricText}</p>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Grade info -->
		{#if gradeInfo}
			<p class="text-[12px] text-rosys-fg-faint bg-rosys-bg-alt rounded-lg px-4 py-2 mb-6">{gradeInfo}</p>
		{/if}

		<!-- Pattern pieces -->
		<div class="bg-rosys-card rounded-2xl border border-rosys-border/50 p-5 mb-6 shadow-sm">
			<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em] mb-3">
				Pattern Pieces ({pieces.length})
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each pieces as piece}
					<div class="flex items-center gap-3 p-3 bg-rosys-bg rounded-xl">
						<div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
							<Scissors class="w-4 h-4 text-amber-500" strokeWidth={1.5} />
						</div>
						<div class="min-w-0">
							<p class="text-[13px] font-medium text-rosys-fg">{piece.piece_id}</p>
							<p class="text-[11px] text-rosys-fg-faint">
								{(piece.cut_width / 10).toFixed(1)} × {(piece.cut_height / 10).toFixed(1)} cm
								{piece.fold ? '(fold)' : ''} × {piece.qty}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Calculator -->
		<div class="bg-rosys-card rounded-2xl border border-rosys-border/50 p-6 mb-6 shadow-sm">
			<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em] mb-4">Calculate Fabric</h2>

			<!-- Fabric width -->
			<div class="mb-4">
				<label class="block text-[12px] font-medium text-rosys-fg-muted mb-2">Fabric Width</label>
				<div class="flex gap-2">
					{#each fabricWidths as fw}
						<button
							type="button"
							class="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all
								{selectedWidth === fw.width ? 'bg-rosys-fg text-white shadow-sm' : 'bg-rosys-bg text-rosys-fg-muted hover:bg-rosys-bg-alt'}"
							onclick={() => (selectedWidth = fw.width)}
						>{fw.label}</button>
					{/each}
				</div>
			</div>

			<!-- Options -->
			<label class="flex items-center gap-3 mb-4 cursor-pointer">
				<input type="checkbox" bind:checked={addPatternMatch} class="w-4 h-4 rounded accent-rosys-fg" />
				<span class="text-[13px] text-rosys-fg-muted">Add 15% for pattern matching (stripes/plaids)</span>
			</label>

			<!-- Price -->
			<div class="mb-5">
				<label for="price" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Fabric price per meter <span class="text-rosys-fg-faint">(optional)</span></label>
				<input id="price" type="number" step="0.01" bind:value={fabricPrice} placeholder="e.g. 12.50"
					class="w-full px-4 py-3 rounded-xl bg-rosys-bg border-none text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-fg/15" />
			</div>

			<!-- Result -->
			{#if totalFabric()}
				{@const fab = totalFabric()!}
				<div class="bg-emerald-50 rounded-xl p-5 border border-emerald-200/60">
					<h3 class="text-[12px] font-semibold text-emerald-700 uppercase tracking-wider mb-3">You Need</h3>
					<div class="grid grid-cols-3 gap-4 text-center">
						<div>
							<p class="text-[28px] font-bold text-emerald-700">{fab.meters}</p>
							<p class="text-[11px] text-emerald-600/70 font-medium">meters</p>
						</div>
						<div>
							<p class="text-[28px] font-bold text-emerald-700">{fab.yards}</p>
							<p class="text-[11px] text-emerald-600/70 font-medium">yards</p>
						</div>
						<div>
							<p class="text-[28px] font-bold text-emerald-700">{fab.cm}</p>
							<p class="text-[11px] text-emerald-600/70 font-medium">cm</p>
						</div>
					</div>
					{#if totalCost()}
						<div class="mt-4 pt-3 border-t border-emerald-200/60 text-center">
							<p class="text-[13px] text-emerald-600">Estimated cost: <span class="font-bold text-[17px]">${totalCost()}</span></p>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Fabric requirements from instructions -->
		{#if fabricText}
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/50 p-5 shadow-sm">
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em] mb-3">From Instructions</h2>
				<p class="text-[13px] text-rosys-fg-muted whitespace-pre-line leading-relaxed">{fabricText}</p>
			</div>
		{/if}
	{/if}
</div>
