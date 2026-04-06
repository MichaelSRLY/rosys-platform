<script lang="ts">
	import { ArrowLeft, Maximize2, ZoomIn, ZoomOut, RotateCcw, Layers } from 'lucide-svelte';
	import type { PatternPiece } from './+page.server';

	let { data } = $props();
	const { pattern, pieces, gradeRule, sampleSize } = data;

	let scale = $state(1);
	let selectedPiece = $state<PatternPiece | null>(null);
	let showSeamAllowance = $state(true);

	// Colors for pieces
	const colors = [
		{ fill: '#fef3c7', stroke: '#f59e0b' },
		{ fill: '#dbeafe', stroke: '#3b82f6' },
		{ fill: '#fce7f3', stroke: '#ec4899' },
		{ fill: '#d1fae5', stroke: '#10b981' },
		{ fill: '#ede9fe', stroke: '#8b5cf6' },
		{ fill: '#fed7aa', stroke: '#f97316' },
		{ fill: '#cffafe', stroke: '#06b6d4' },
		{ fill: '#fecaca', stroke: '#ef4444' }
	];

	// Calculate SVG dimensions to fit all pieces
	const SVG_PADDING = 40;
	const PIECE_GAP = 20;

	// Layout pieces in a grid
	const svgLayout = $derived.by(() => {
		const SCALE = 0.15; // mm to SVG units
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
	<div class="shrink-0 glass border-b border-rosys-border/30 px-5 py-3">
		<div class="flex items-center justify-between">
			<a href="/patterns/{pattern.pattern_slug}" class="flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[13px] font-medium transition-colors">
				<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
				{pattern.pattern_name}
			</a>
			<div class="flex items-center gap-2">
				{#if gradeRule}
					<span class="text-[11px] text-rosys-fg-faint bg-rosys-bg-alt px-2.5 py-1 rounded-md">{sampleSize}</span>
				{/if}
				<span class="text-[11px] text-rosys-fg-faint">{pieces.length} pieces</span>
			</div>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="shrink-0 flex items-center justify-between px-5 py-2 border-b border-rosys-border/20 bg-rosys-card/50">
		<div class="flex items-center gap-1">
			<button onclick={zoomOut} class="p-2 rounded-lg hover:bg-rosys-bg-alt text-rosys-fg-muted transition-colors">
				<ZoomOut class="w-4 h-4" strokeWidth={1.5} />
			</button>
			<span class="text-[12px] text-rosys-fg-faint font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
			<button onclick={zoomIn} class="p-2 rounded-lg hover:bg-rosys-bg-alt text-rosys-fg-muted transition-colors">
				<ZoomIn class="w-4 h-4" strokeWidth={1.5} />
			</button>
			<button onclick={resetZoom} class="p-2 rounded-lg hover:bg-rosys-bg-alt text-rosys-fg-muted transition-colors">
				<RotateCcw class="w-4 h-4" strokeWidth={1.5} />
			</button>
		</div>
		<label class="flex items-center gap-2 cursor-pointer">
			<input type="checkbox" bind:checked={showSeamAllowance} class="w-3.5 h-3.5 rounded accent-rosys-fg" />
			<span class="text-[12px] text-rosys-fg-muted">Seam allowance</span>
		</label>
	</div>

	<!-- SVG Canvas -->
	<div class="flex-1 overflow-auto bg-white">
		<div style="transform: scale({scale}); transform-origin: top left; min-width: {svgLayout.totalW}px; min-height: {svgLayout.totalH}px;">
			<svg
				viewBox="0 0 {svgLayout.totalW} {svgLayout.totalH}"
				width={svgLayout.totalW}
				height={svgLayout.totalH}
				xmlns="http://www.w3.org/2000/svg"
			>
				<!-- Grid dots -->
				<defs>
					<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
						<circle cx="1" cy="1" r="0.5" fill="#e5e7eb" />
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#grid)" />

				{#each svgLayout.positioned as item, i}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						class="cursor-pointer"
						onclick={() => (selectedPiece = selectedPiece?.id === item.piece.id ? null : item.piece)}
					>
						<!-- Cut outline (seam allowance) -->
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
								opacity="0.4"
								rx="2"
							/>
						{/if}

						<!-- Finished outline -->
						<rect
							x={item.x + item.piece.seamAllowanceW * 0.15}
							y={item.y + item.piece.seamAllowanceH * 0.15}
							width={item.w - item.piece.seamAllowanceW * 0.15 * 2}
							height={item.h - item.piece.seamAllowanceH * 0.15 * 2}
							fill={item.color.fill}
							stroke={item.color.stroke}
							stroke-width="1.5"
							rx="1"
						/>

						<!-- Label -->
						<text
							x={item.x + item.w / 2}
							y={item.y + item.h / 2 - 6}
							text-anchor="middle"
							fill={item.color.stroke}
							font-size="11"
							font-weight="600"
							font-family="Inter, sans-serif"
						>{item.piece.id}</text>

						<!-- Dimensions -->
						<text
							x={item.x + item.w / 2}
							y={item.y + item.h / 2 + 8}
							text-anchor="middle"
							fill={item.color.stroke}
							font-size="8"
							opacity="0.7"
							font-family="Inter, sans-serif"
						>{(item.piece.cutWidth / 10).toFixed(1)} × {(item.piece.cutHeight / 10).toFixed(1)} cm</text>

						<!-- Fold indicator -->
						{#if item.piece.fold}
							<text
								x={item.x + item.w / 2}
								y={item.y + item.h / 2 + 18}
								text-anchor="middle"
								fill={item.color.stroke}
								font-size="7"
								opacity="0.5"
								font-family="Inter, sans-serif"
							>FOLD</text>
						{/if}
					</g>
				{/each}
			</svg>
		</div>
	</div>

	<!-- Piece detail panel -->
	{#if selectedPiece}
		<div class="shrink-0 bg-rosys-card border-t border-rosys-border/30 px-5 py-4">
			<div class="max-w-3xl mx-auto flex items-start gap-6">
				<div class="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
					<div>
						<p class="text-[11px] text-rosys-fg-faint uppercase tracking-wider font-medium">Piece</p>
						<p class="text-[17px] font-bold text-rosys-fg">{selectedPiece.id}</p>
					</div>
					<div>
						<p class="text-[11px] text-rosys-fg-faint uppercase tracking-wider font-medium">Cut Size</p>
						<p class="text-[15px] font-semibold text-rosys-fg">{(selectedPiece.cutWidth / 10).toFixed(1)} × {(selectedPiece.cutHeight / 10).toFixed(1)} cm</p>
					</div>
					<div>
						<p class="text-[11px] text-rosys-fg-faint uppercase tracking-wider font-medium">Finished</p>
						<p class="text-[15px] font-semibold text-rosys-fg">{(selectedPiece.finishedWidth / 10).toFixed(1)} × {(selectedPiece.finishedHeight / 10).toFixed(1)} cm</p>
					</div>
					<div>
						<p class="text-[11px] text-rosys-fg-faint uppercase tracking-wider font-medium">Seam Allowance</p>
						<p class="text-[15px] font-semibold text-rosys-fg">{(selectedPiece.seamAllowanceW / 10).toFixed(1)} cm</p>
					</div>
				</div>
				<div class="flex gap-3 text-[12px] text-rosys-fg-faint">
					{#if selectedPiece.fold}<span class="bg-rosys-bg-alt px-2 py-1 rounded-md">Fold</span>{/if}
					<span class="bg-rosys-bg-alt px-2 py-1 rounded-md">Qty: {selectedPiece.qty}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
