<script lang="ts">
	import { ArrowLeft, Calculator, Scissors, AlertCircle } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, pieces, gradeInfo, fabricText, hasDxf } = data;

	const fabricWidths = [
		{ label: '45"', sub: '114 cm', width: 114 },
		{ label: '54"', sub: '137 cm', width: 137 },
		{ label: '60"', sub: '150 cm', width: 150 }
	];

	let selectedWidth = $state(150);
	let fabricPrice = $state('');
	let addPatternMatch = $state(false);

	const totalFabric = $derived(() => {
		if (pieces.length === 0) return null;

		let totalHeight = 0;

		for (const piece of pieces) {
			const pieceW = piece.cut_width / 10;
			const pieceH = piece.cut_height / 10;
			const qty = piece.qty * (piece.fold ? 2 : 1);

			const fitsAcross = Math.floor(selectedWidth / pieceW) || 1;
			const rows = Math.ceil(qty / fitsAcross);
			totalHeight += rows * pieceH;
		}

		totalHeight += 10;
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

<div class="page-enter mesh-bg min-h-screen px-6 py-10 md:px-10 md:py-14 max-w-3xl mx-auto">
	<a href="/patterns/{pattern.pattern_slug}" class="rosys-back-link mb-10 inline-flex">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<!-- Header with large amber icon -->
	<div class="flex items-center gap-4 mb-10" style="animation: fadeUp 0.5s var(--ease-spring) 0.05s both;">
		<div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
			style="background: linear-gradient(135deg, #FBBF24, #F59E0B); box-shadow: 0 8px 24px rgba(245,158,11,0.25), 0 2px 8px rgba(245,158,11,0.15);">
			<Calculator class="w-7 h-7 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[28px] md:text-[32px] font-bold tracking-[-0.04em]">Fabric Calculator</h1>
			<p class="text-rosys-fg-faint text-[14px] mt-0.5">{pattern.pattern_name}</p>
		</div>
	</div>

	{#if !hasDxf}
		<div class="rosys-card p-10 text-center" style="box-shadow: var(--shadow-xl);">
			<div class="w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-5 float"
				style="background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.02)); border: 1px solid rgba(232,54,109,0.08);">
				<AlertCircle class="w-7 h-7 text-rosys-300" strokeWidth={1.5} />
			</div>
			<p class="text-rosys-fg text-[15px] font-medium mb-1">DXF data not available for this pattern yet.</p>
			{#if fabricText}
				<div class="mt-7 text-left rosys-card p-6" style="border-left: 4px solid var(--color-warm-300); box-shadow: var(--shadow-md);">
					<h3 class="rosys-section-label mb-3">Fabric Requirements (from instructions)</h3>
					<p class="text-[14px] text-rosys-fg-muted whitespace-pre-line leading-relaxed">{fabricText}</p>
				</div>
			{/if}
		</div>
	{:else}
		{#if gradeInfo}
			<div class="rosys-tag px-4 py-2.5 mb-7 text-[12px]" style="display: block;">{gradeInfo}</div>
		{/if}

		<!-- Pattern pieces card -->
		<div class="rosys-card p-6 mb-6" style="border-left: 4px solid var(--color-amber-400); animation: fadeUp 0.4s var(--ease-spring) 0.1s both; box-shadow: var(--shadow-md);">
			<h2 class="rosys-section-label mb-4">
				Pattern Pieces ({pieces.length})
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
				{#each pieces as piece, i}
					<div class="stagger-item flex items-center gap-3 p-3.5 bg-warm-50 rounded-xl transition-all duration-300 hover:bg-warm-100 hover:-translate-y-0.5"
						style="--i: {i};">
						<div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
							style="background: linear-gradient(135deg, #FEF3C7, #FDE68A); border: 1px solid rgba(245,158,11,0.15);">
							<Scissors class="w-4 h-4 text-amber-600" strokeWidth={1.5} />
						</div>
						<div class="min-w-0">
							<p class="text-[13px] font-semibold text-rosys-fg">{piece.piece_id}</p>
							<p class="text-[11px] text-rosys-fg-faint">
								{(piece.cut_width / 10).toFixed(1)} x {(piece.cut_height / 10).toFixed(1)} cm
								{piece.fold ? '(fold)' : ''} x {piece.qty}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Calculator card -->
		<div class="rosys-card p-8 mb-6" style="box-shadow: var(--shadow-xl); animation: fadeUp 0.4s var(--ease-spring) 0.2s both;">
			<h2 class="rosys-section-label mb-6">Calculate Fabric</h2>

			<!-- Fabric width selector -->
			<div class="mb-7">
				<label class="block text-[12px] font-semibold text-rosys-fg-muted mb-3 uppercase tracking-wider">Fabric Width</label>
				<div class="flex gap-3">
					{#each fabricWidths as fw}
						{@const active = selectedWidth === fw.width}
						<button
							type="button"
							class="flex-1 py-4 rounded-xl text-center transition-all duration-300 cursor-pointer
								{active ? 'text-white border-transparent' : 'bg-white text-rosys-fg-muted border border-rosys-border/40 hover:border-rosys-300 hover:-translate-y-0.5'}"
							style={active ? 'background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-brand-lg); transform: translateY(-2px);' : 'box-shadow: var(--shadow-sm);'}
							onclick={() => (selectedWidth = fw.width)}
						>
							<span class="text-[17px] font-bold block">{fw.label}</span>
							<span class="text-[12px] {active ? 'text-white/70' : 'text-rosys-fg-faint'} block mt-0.5">{fw.sub}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- iOS-style toggle -->
			<label class="flex items-center gap-3.5 mb-7 cursor-pointer group">
				<div class="relative w-12 h-[28px] rounded-full transition-all duration-300 {addPatternMatch ? 'bg-rosys-500' : 'bg-warm-300'}"
					style={addPatternMatch ? 'box-shadow: 0 0 12px rgba(232,54,109,0.25);' : ''}>
					<input type="checkbox" bind:checked={addPatternMatch} class="sr-only" />
					<div class="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-transform duration-300 {addPatternMatch ? 'translate-x-[25px]' : 'translate-x-[3px]'}"
						style="box-shadow: 0 2px 6px rgba(0,0,0,0.15);"></div>
				</div>
				<span class="text-[14px] text-rosys-fg-muted group-hover:text-rosys-fg transition-colors duration-200">Add 15% for pattern matching</span>
			</label>

			<!-- Price input -->
			<div class="mb-7">
				<label for="price" class="block text-[12px] font-semibold text-rosys-fg-muted mb-2 uppercase tracking-wider">Fabric price per meter <span class="text-rosys-fg-faint normal-case lowercase">(optional)</span></label>
				<input id="price" type="number" step="0.01" bind:value={fabricPrice} placeholder="e.g. 12.50"
					class="rosys-input" />
			</div>

			<!-- Result card -->
			{#if totalFabric()}
				{@const fab = totalFabric()!}
				<div class="rounded-2xl p-7"
					style="background: linear-gradient(135deg, rgba(52,199,89,0.08), rgba(52,199,89,0.03)); border: 1px solid rgba(52,199,89,0.15); box-shadow: 0 8px 30px rgba(52,199,89,0.08); animation: scaleIn 0.45s var(--ease-spring);">
					<h3 class="text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-5">You Need</h3>
					<div class="grid grid-cols-3 gap-5 text-center">
						<div>
							<p class="text-[36px] font-bold text-emerald-700 tabular-nums leading-none">{fab.meters}</p>
							<p class="text-[12px] text-emerald-600/60 font-semibold mt-2 uppercase tracking-wider">meters</p>
						</div>
						<div>
							<p class="text-[36px] font-bold text-emerald-700 tabular-nums leading-none">{fab.yards}</p>
							<p class="text-[12px] text-emerald-600/60 font-semibold mt-2 uppercase tracking-wider">yards</p>
						</div>
						<div>
							<p class="text-[36px] font-bold text-emerald-700 tabular-nums leading-none">{fab.cm}</p>
							<p class="text-[12px] text-emerald-600/60 font-semibold mt-2 uppercase tracking-wider">cm</p>
						</div>
					</div>
					{#if totalCost()}
						<div class="mt-5 pt-5 border-t border-emerald-200/30 text-center">
							<p class="text-[14px] text-emerald-600">Estimated cost: <span class="font-bold text-[22px]">${totalCost()}</span></p>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		{#if fabricText}
			<div class="rosys-card p-6" style="border-left: 4px solid var(--color-warm-300); box-shadow: var(--shadow-md);">
				<h2 class="rosys-section-label mb-3">From Instructions</h2>
				<p class="text-[14px] text-rosys-fg-muted whitespace-pre-line leading-relaxed">{fabricText}</p>
			</div>
		{/if}
	{/if}
</div>
