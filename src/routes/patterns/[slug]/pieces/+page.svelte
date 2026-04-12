<script lang="ts">
	import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw } from 'lucide-svelte';
	import type { PatternPiece } from './+page.server';

	let { data } = $props();
	const { pattern, pieces, gradeRule, sampleSize } = data;

	let scale = $state(1);
	let selectedPiece = $state<PatternPiece | null>(null);
	let showSeamAllowance = $state(true);

	const colors = [
		{ fill: '#fff5f7', stroke: '#e8366d' },
		{ fill: '#dbeafe', stroke: '#3b82f6' },
		{ fill: '#fef3c7', stroke: '#f59e0b' },
		{ fill: '#d1fae5', stroke: '#10b981' },
		{ fill: '#ede9fe', stroke: '#8b5cf6' },
		{ fill: '#fed7aa', stroke: '#f97316' },
		{ fill: '#cffafe', stroke: '#06b6d4' },
		{ fill: '#fce7f3', stroke: '#ec4899' }
	];

	const SVG_PADDING = 40;
	const PIECE_GAP = 20;

	const svgLayout = $derived.by(() => {
		const SCALE = 0.15;
		const cols = Math.min(pieces.length, Math.ceil(Math.sqrt(pieces.length)));

		let maxRowHeight = 0;
		let x = SVG_PADDING;
		let y = SVG_PADDING;
		let col = 0;
		let totalW = 0;
		let totalH = 0;

		const positioned = pieces.map((piece, i) => {
			const w = piece.cutWidth * SCALE;
			const h = piece.cutHeight * SCALE;

			if (col >= cols) {
				col = 0;
				x = SVG_PADDING;
				y += maxRowHeight + PIECE_GAP;
				maxRowHeight = 0;
			}

			const pos = { piece, x, y, w, h, color: colors[i % colors.length] };
			x += w + PIECE_GAP;
			maxRowHeight = Math.max(maxRowHeight, h);
			totalW = Math.max(totalW, x);
			col++;

			return pos;
		});

		totalH = y + maxRowHeight + SVG_PADDING;
		totalW += SVG_PADDING;

		return { positioned, totalW, totalH };
	});

	function zoomIn() { scale = Math.min(scale + 0.25, 3); }
	function zoomOut() { scale = Math.max(scale - 0.25, 0.25); }
	function resetZoom() { scale = 1; }
</script>

<svelte:head>
	<title>Pattern Pieces — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter h-full flex flex-col">
	<!-- Header -->
	<div class="shrink-0 glass border-b border-rosys-border/20 px-5 py-3.5 z-20"
		style="box-shadow: 0 1px 12px rgba(0,0,0,0.05);">
		<div class="flex items-center justify-between">
			<a href="/patterns/{pattern.pattern_slug}" class="rosys-back-link">
				<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
				{pattern.pattern_name}
			</a>
			<div class="flex items-center gap-2.5">
				{#if gradeRule}
					<span class="rosys-tag text-rosys-600" style="background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.02)); border-color: rgba(232,54,109,0.12);">{sampleSize}</span>
				{/if}
				<span class="rosys-tag">{pieces.length} pieces</span>
			</div>
		</div>
	</div>

	<!-- Floating glass toolbar pill -->
	<div class="absolute top-16 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-3 py-1.5 flex items-center gap-1"
		style="box-shadow: var(--shadow-xl), 0 0 0 1px rgba(0,0,0,0.03); animation: slideDown 0.45s var(--ease-spring) 0.2s both;">
		<button onclick={zoomOut} class="p-2.5 rounded-full hover:bg-warm-100 text-rosys-fg-muted transition-all duration-200 hover:scale-110 active:scale-95">
			<ZoomOut class="w-4 h-4" strokeWidth={1.5} />
		</button>
		<span class="text-[12px] text-rosys-fg font-semibold w-14 text-center tabular-nums">{Math.round(scale * 100)}%</span>
		<button onclick={zoomIn} class="p-2.5 rounded-full hover:bg-warm-100 text-rosys-fg-muted transition-all duration-200 hover:scale-110 active:scale-95">
			<ZoomIn class="w-4 h-4" strokeWidth={1.5} />
		</button>
		<div class="w-px h-5 bg-rosys-border/30 mx-1"></div>
		<button onclick={resetZoom} class="p-2.5 rounded-full hover:bg-warm-100 text-rosys-fg-muted transition-all duration-200 hover:scale-110 active:scale-95">
			<RotateCcw class="w-3.5 h-3.5" strokeWidth={1.5} />
		</button>
		<div class="w-px h-5 bg-rosys-border/30 mx-1"></div>
		<!-- SA toggle -->
		<label class="flex items-center gap-2 px-2 cursor-pointer">
			<div class="relative w-9 h-[20px] rounded-full transition-all duration-300 {showSeamAllowance ? 'bg-rosys-500' : 'bg-warm-300'}"
				style={showSeamAllowance ? 'box-shadow: 0 0 8px rgba(232,54,109,0.2);' : ''}>
				<input type="checkbox" bind:checked={showSeamAllowance} class="sr-only" />
				<div class="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-transform duration-300 {showSeamAllowance ? 'translate-x-[18px]' : 'translate-x-[2px]'}"
					style="box-shadow: 0 1px 4px rgba(0,0,0,0.15);"></div>
			</div>
			<span class="text-[11px] text-rosys-fg font-semibold">SA</span>
		</label>
	</div>

	<!-- SVG Canvas with dot grid background -->
	<div class="flex-1 overflow-auto relative"
		style="background: radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px); background-size: 20px 20px; background-color: var(--color-warm-50);">
		<div style="transform: scale({scale}); transform-origin: top left; min-width: {svgLayout.totalW}px; min-height: {svgLayout.totalH}px; transition: transform 0.25s var(--ease-spring);">
			<svg
				viewBox="0 0 {svgLayout.totalW} {svgLayout.totalH}"
				width={svgLayout.totalW}
				height={svgLayout.totalH}
				xmlns="http://www.w3.org/2000/svg"
			>
				{#each svgLayout.positioned as item, i}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						class="cursor-pointer"
						style="transition: opacity 0.3s ease, filter 0.3s ease; opacity: {selectedPiece && selectedPiece.id !== item.piece.id ? 0.3 : 1}; filter: {selectedPiece && selectedPiece.id !== item.piece.id ? 'saturate(0.4)' : 'none'};"
						onclick={() => (selectedPiece = selectedPiece?.id === item.piece.id ? null : item.piece)}
					>
						{#if showSeamAllowance}
							<rect
								x={item.x}
								y={item.y}
								width={item.w}
								height={item.h}
								fill={item.color.fill}
								stroke={item.color.stroke}
								stroke-width="1"
								stroke-dasharray="4 2"
								opacity="0.3"
								rx="3"
							/>
						{/if}

						<rect
							x={item.x + item.piece.seamAllowanceW * 0.15}
							y={item.y + item.piece.seamAllowanceH * 0.15}
							width={item.w - item.piece.seamAllowanceW * 0.15 * 2}
							height={item.h - item.piece.seamAllowanceH * 0.15 * 2}
							fill={item.color.fill}
							stroke={item.color.stroke}
							stroke-width={selectedPiece?.id === item.piece.id ? 3 : 1.5}
							rx="2"
							style="transition: stroke-width 0.3s, filter 0.3s;"
							filter={selectedPiece?.id === item.piece.id ? `drop-shadow(0 0 6px ${item.color.stroke}40)` : 'none'}
						/>

						<!-- Glow ring when selected -->
						{#if selectedPiece?.id === item.piece.id}
							<rect
								x={item.x + item.piece.seamAllowanceW * 0.15 - 4}
								y={item.y + item.piece.seamAllowanceH * 0.15 - 4}
								width={item.w - item.piece.seamAllowanceW * 0.15 * 2 + 8}
								height={item.h - item.piece.seamAllowanceH * 0.15 * 2 + 8}
								fill="none"
								stroke={item.color.stroke}
								stroke-width="1.5"
								stroke-dasharray="6 3"
								opacity="0.4"
								rx="5"
								style="animation: borderGlow 2s ease-in-out infinite;"
							/>
						{/if}

						<text
							x={item.x + item.w / 2}
							y={item.y + item.h / 2 - 6}
							text-anchor="middle"
							fill={item.color.stroke}
							font-size="11"
							font-weight="700"
							font-family="Inter, sans-serif"
						>{item.piece.id}</text>

						<text
							x={item.x + item.w / 2}
							y={item.y + item.h / 2 + 8}
							text-anchor="middle"
							fill={item.color.stroke}
							font-size="8"
							opacity="0.65"
							font-family="Inter, sans-serif"
						>{(item.piece.cutWidth / 10).toFixed(1)} × {(item.piece.cutHeight / 10).toFixed(1)} cm</text>

						{#if item.piece.fold}
							<text
								x={item.x + item.w / 2}
								y={item.y + item.h / 2 + 18}
								text-anchor="middle"
								fill={item.color.stroke}
								font-size="7"
								opacity="0.45"
								font-weight="600"
								font-family="Inter, sans-serif"
								letter-spacing="0.05em"
							>FOLD</text>
						{/if}
					</g>
				{/each}
			</svg>
		</div>
	</div>

	<!-- Piece detail panel -->
	{#if selectedPiece}
		<div class="shrink-0 glass border-t border-rosys-border/20 px-6 py-5"
			style="animation: slideUp 0.35s var(--ease-spring); box-shadow: 0 -4px 20px rgba(0,0,0,0.06);">
			<div class="max-w-3xl mx-auto flex items-start gap-8">
				<div class="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-5">
					<div>
						<p class="rosys-section-label mb-1">Piece</p>
						<p class="text-[18px] font-bold text-rosys-fg">{selectedPiece.id}</p>
					</div>
					<div>
						<p class="rosys-section-label mb-1">Cut Size</p>
						<p class="text-[16px] font-semibold text-rosys-fg tabular-nums">{(selectedPiece.cutWidth / 10).toFixed(1)} x {(selectedPiece.cutHeight / 10).toFixed(1)} cm</p>
					</div>
					<div>
						<p class="rosys-section-label mb-1">Finished</p>
						<p class="text-[16px] font-semibold text-rosys-fg tabular-nums">{(selectedPiece.finishedWidth / 10).toFixed(1)} x {(selectedPiece.finishedHeight / 10).toFixed(1)} cm</p>
					</div>
					<div>
						<p class="rosys-section-label mb-1">Seam Allowance</p>
						<p class="text-[16px] font-semibold text-rosys-fg tabular-nums">{(selectedPiece.seamAllowanceW / 10).toFixed(1)} cm</p>
					</div>
				</div>
				<div class="flex gap-2 shrink-0">
					{#if selectedPiece.fold}
						<span class="rosys-tag text-rosys-600" style="background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.02)); border-color: rgba(232,54,109,0.12);">Fold</span>
					{/if}
					<span class="rosys-tag">Qty: {selectedPiece.qty}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
