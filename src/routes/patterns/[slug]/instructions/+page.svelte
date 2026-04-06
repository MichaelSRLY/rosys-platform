<script lang="ts">
	import { ArrowLeft, ChevronLeft, ChevronRight, Info, Package, Palette, Scissors, Printer, LayoutGrid, Shirt, Ruler, List, Check } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, parsed, sizeChartRaw, pages, totalPages } = data;
	const p = parsed;

	let currentPage = $state(0);
	let showToc = $state(false);
	let showSizes = $state(false);
	let direction = $state<'next' | 'prev'>('next');

	const progress = $derived(((currentPage + 1) / totalPages) * 100);
	const current = $derived(pages[currentPage]);

	function goTo(idx: number) {
		direction = idx > currentPage ? 'next' : 'prev';
		currentPage = idx;
		showToc = false;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
	function next() { if (currentPage < totalPages - 1) goTo(currentPage + 1); }
	function prev() { if (currentPage > 0) goTo(currentPage - 1); }

	// Keyboard nav
	function handleKey(e: KeyboardEvent) {
		if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
		if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
	}

	const pageColors: Record<string, { bg: string; icon: string; border: string; accent: string }> = {
		about:     { bg: 'bg-violet-50', icon: 'text-violet-500', border: 'border-violet-200/50', accent: 'bg-violet-500' },
		materials: { bg: 'bg-blue-50',   icon: 'text-blue-500',   border: 'border-blue-200/50',   accent: 'bg-blue-500' },
		fabrics:   { bg: 'bg-rose-50',   icon: 'text-rose-500',   border: 'border-rose-200/50',   accent: 'bg-rose-500' },
		pieces:    { bg: 'bg-amber-50',  icon: 'text-amber-500',  border: 'border-amber-200/50',  accent: 'bg-amber-500' },
		layout:    { bg: 'bg-emerald-50',icon: 'text-emerald-500',border: 'border-emerald-200/50',accent: 'bg-emerald-500' },
		step:      { bg: 'bg-pink-50',   icon: 'text-pink-500',   border: 'border-pink-200/50',   accent: 'bg-pink-500' }
	};

	const pageIcons: Record<string, typeof Info> = {
		about: Info, materials: Package, fabrics: Palette, pieces: Scissors, layout: LayoutGrid, step: Shirt
	};

	function pdfPageUrl(page: number | null): string {
		if (!page) return '';
		return `/api/patterns/page-image?slug=${pattern.pattern_slug}&page=${page}`;
	}

	// Check if current page has admin-uploaded illustrations or PDF page fallback
	const hasIllustration = $derived(
		(current.illustrations && current.illustrations.length > 0) || !!current.pdfPage
	);
</script>

<svelte:window onkeydown={handleKey} />

<svelte:head>
	<title>{current.title} — {pattern.pattern_name}</title>
</svelte:head>

<div class="h-full flex flex-col">
	<!-- Header -->
	<div class="shrink-0 glass border-b border-rosys-border/30 z-20">
		<div class="max-w-4xl mx-auto px-5 py-2.5 flex items-center justify-between">
			<a href="/patterns/{pattern.pattern_slug}" class="flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[12px] font-medium transition-colors">
				<ArrowLeft class="w-3.5 h-3.5" strokeWidth={1.5} />
				{pattern.pattern_name}
			</a>
			<div class="flex items-center gap-2">
				<button onclick={() => { showToc = !showToc; showSizes = false; }}
					class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all {showToc ? 'bg-rosys-fg text-white' : 'bg-rosys-bg-alt text-rosys-fg-muted'}">
					<span class="flex items-center gap-1"><List class="w-3 h-3" strokeWidth={2} /> Contents</span>
				</button>
				<button onclick={() => { showSizes = !showSizes; showToc = false; }}
					class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all {showSizes ? 'bg-rosys-fg text-white' : 'bg-rosys-bg-alt text-rosys-fg-muted'}">
					<span class="flex items-center gap-1"><Ruler class="w-3 h-3" strokeWidth={2} /> Sizes</span>
				</button>
				<span class="text-[11px] text-rosys-fg-faint font-medium ml-1">{currentPage + 1}/{totalPages}</span>
			</div>
		</div>
		<!-- Progress -->
		<div class="h-[3px] bg-rosys-bg-alt">
			<div class="{pageColors[current.type]?.accent || 'bg-rosys-fg'} h-full transition-all duration-500 ease-out" style="width:{progress}%"></div>
		</div>
	</div>

	<!-- TOC dropdown -->
	{#if showToc}
		<div class="shrink-0 bg-rosys-card border-b border-rosys-border/30 shadow-md z-10 max-h-[50vh] overflow-auto">
			<div class="max-w-4xl mx-auto px-5 py-3 grid grid-cols-2 sm:grid-cols-3 gap-1">
				{#each pages as pg, i}
					{@const c = pageColors[pg.type]}
					<button onclick={() => goTo(i)}
						class="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all {i === currentPage ? 'bg-rosys-fg text-white' : 'hover:bg-rosys-bg-alt'}">
						{#if i === currentPage}
							<Check class="w-3 h-3 shrink-0" strokeWidth={2.5} />
						{:else}
							<span class="w-3 h-3 rounded-full {c?.bg} shrink-0"></span>
						{/if}
						<span class="text-[11px] font-medium truncate">{pg.title}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Size chart dropdown -->
	{#if showSizes && p.sizeChart}
		<div class="shrink-0 bg-rosys-card border-b border-rosys-border/30 shadow-md z-10 overflow-x-auto">
			<div class="max-w-4xl mx-auto px-5 py-3">
				<table class="w-full text-[11px]">
					<thead><tr class="border-b border-rosys-border/40">
						<th class="text-left py-1 pr-3 text-rosys-fg-faint font-semibold"></th>
						{#each p.sizeChart.sizes as size}<th class="text-center py-1 px-2 text-rosys-fg font-bold">{size}</th>{/each}
					</tr></thead>
					<tbody>{#each p.sizeChart.measurements as row}
						<tr class="border-b border-rosys-border/15">
							<td class="py-1.5 pr-3 text-rosys-fg-muted font-medium">{row.label}</td>
							{#each row.values as val}<td class="text-center py-1.5 px-2 text-rosys-fg tabular-nums">{val}</td>{/each}
						</tr>
					{/each}</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Main content -->
	<div class="flex-1 overflow-auto">
		{#key currentPage}
			{@const c = pageColors[current.type] || pageColors.about}
			{@const Icon = pageIcons[current.type] || Info}
			<div class="page-enter max-w-4xl mx-auto px-5 py-8">

				<!-- Page header -->
				<div class="flex items-center gap-3 mb-6">
					<div class="w-12 h-12 rounded-2xl {c.bg} flex items-center justify-center shrink-0">
						<Icon class="w-6 h-6 {c.icon}" strokeWidth={1.5} />
					</div>
					<div>
						<h1 class="text-[22px] font-bold text-rosys-fg tracking-[-0.02em]">{current.title}</h1>
						<p class="text-[13px] text-rosys-fg-faint">{current.subtitle}</p>
					</div>
				</div>

				<!-- Content + Illustration — layout depends on admin config -->
				<div class="{current.layout === 'text-only' ? '' : current.layout === 'image-top' ? 'flex flex-col gap-6' : hasIllustration ? 'grid md:grid-cols-[1fr_1fr] gap-6' : ''}"
					style={current.layout === 'text-right' ? 'direction: rtl' : ''}>
					<!-- Text content -->
					<div style={current.layout === 'text-right' ? 'direction: ltr' : ''}>
						{#if current.type === 'about'}
							<div class="bg-rosys-card rounded-2xl {c.border} border p-6 shadow-sm">
								<p class="text-[15px] text-rosys-fg leading-[1.85] mb-4">{p.about}</p>
								{#if p.seamAllowance}
									<div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-50 border border-violet-100">
										<Ruler class="w-4 h-4 text-violet-400 shrink-0" strokeWidth={1.5} />
										<p class="text-[13px] text-violet-700 font-medium">{p.seamAllowance.split('\n')[0]}</p>
									</div>
								{/if}
								{#if p.difficulty}
									<div class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-100">
										<span class="text-[12px] font-semibold text-violet-700">{p.difficulty}</span>
									</div>
								{/if}
							</div>

						{:else if current.type === 'materials'}
							<div class="space-y-2">
								{#each p.materials as mat, i}
									<div class="flex items-center gap-4 p-4 bg-rosys-card rounded-xl {c.border} border shadow-sm">
										<span class="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-[14px] font-bold text-blue-600 shrink-0">{i + 1}</span>
										<span class="flex-1 text-[15px] text-rosys-fg font-medium">{mat.item}</span>
										{#if mat.quantity}
											<span class="text-[13px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg shrink-0">{mat.quantity}</span>
										{/if}
									</div>
								{/each}
							</div>

						{:else if current.type === 'fabrics'}
							<div class="grid grid-cols-1 gap-2">
								{#each p.fabricSuggestions as fab, i}
									<div class="flex items-start gap-3 p-4 bg-rosys-card rounded-xl {c.border} border shadow-sm">
										<span class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
											<Palette class="w-4 h-4 text-rose-500" strokeWidth={1.5} />
										</span>
										<p class="text-[14px] text-rosys-fg leading-relaxed">{fab}</p>
									</div>
								{/each}
							</div>

						{:else if current.type === 'pieces'}
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{#each p.patternPieces as piece}
									<div class="flex items-center gap-3 p-3 bg-rosys-card rounded-xl {c.border} border shadow-sm">
										<span class="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-[14px] font-bold text-amber-700 shrink-0">{piece.number}</span>
										<div class="min-w-0">
											<p class="text-[13px] font-semibold text-rosys-fg">{piece.name}</p>
											<p class="text-[11px] text-amber-600">{piece.cutInstructions}</p>
										</div>
									</div>
								{/each}
							</div>

						{:else if current.type === 'layout'}
							<div class="bg-rosys-card rounded-2xl {c.border} border p-6 shadow-sm">
								<p class="text-[14px] text-rosys-fg-muted leading-[1.8] whitespace-pre-line">{p.fabricUsage}</p>
							</div>

						{:else if current.type === 'step'}
							{@const stepData = p.sewingSteps.find(s => `step-${s.number}` === current.id)}
							{#if stepData}
								<div class="bg-rosys-card rounded-2xl {c.border} border p-6 shadow-sm">
									{#if stepData.title && stepData.title !== `Step ${stepData.number}`}
										<h2 class="text-[16px] font-semibold text-rosys-fg mb-3">{stepData.title}</h2>
									{/if}
									<p class="text-[15px] text-rosys-fg leading-[1.85] whitespace-pre-line">{stepData.content}</p>
								</div>
							{/if}
						{/if}
					</div>

					<!-- Illustration(s) -->
					{#if current.layout !== 'text-only' && hasIllustration}
						<div style={current.layout === 'text-right' ? 'direction: ltr' : ''}>
							{#if current.illustrations && current.illustrations.length > 0}
								<!-- Admin-uploaded illustrations -->
								<div class="space-y-3">
									{#each current.illustrations as url}
										<div class="rounded-2xl overflow-hidden border border-rosys-border/40 shadow-sm bg-white">
											<img src={url} alt="Illustration for {current.title}" class="w-full h-auto" loading="lazy" />
										</div>
									{/each}
								</div>
							{:else if current.pdfPage}
								<!-- PDF page fallback -->
								<div class="rounded-2xl overflow-hidden border border-rosys-border/40 shadow-sm bg-white">
									<img src={pdfPageUrl(current.pdfPage)} alt="Illustration for {current.title}" class="w-full h-auto" loading="lazy" />
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/key}
	</div>

	<!-- Navigation footer -->
	<div class="shrink-0 glass border-t border-rosys-border/30 z-10">
		<div class="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
			<button onclick={prev} disabled={currentPage === 0}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all
					{currentPage === 0 ? 'text-rosys-fg-faint/30 cursor-default' : 'text-rosys-fg hover:bg-rosys-bg-alt active:scale-[0.97]'}">
				<ChevronLeft class="w-4 h-4" strokeWidth={2} /> Back
			</button>

			<!-- Page dots — compact -->
			<div class="flex gap-[5px] max-w-[280px] overflow-hidden items-center">
				{#each pages as pg, i}
					{@const c = pageColors[pg.type]}
					<button onclick={() => goTo(i)}
						class="h-2 rounded-full transition-all duration-300 shrink-0
							{i === currentPage ? `w-8 ${c?.accent}` : i < currentPage ? `w-2 ${c?.accent} opacity-40` : 'w-2 bg-rosys-fg/10'}">
					</button>
				{/each}
			</div>

			<button onclick={next} disabled={currentPage === totalPages - 1}
				class="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all
					{currentPage === totalPages - 1 ? 'text-rosys-fg-faint/30 cursor-default' : `text-white ${pageColors[pages[currentPage + 1]?.type]?.accent || 'bg-rosys-fg'} hover:opacity-90 active:scale-[0.97] shadow-sm`}">
				Next <ChevronRight class="w-4 h-4" strokeWidth={2} />
			</button>
		</div>
	</div>
</div>
