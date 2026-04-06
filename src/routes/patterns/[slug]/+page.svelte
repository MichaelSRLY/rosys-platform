<script lang="ts">
	import { ArrowLeft, Download, FileText, Box, Scissors, Play, ExternalLink, BookOpen, Ruler, Calculator, Layers, MessageCircle, Star, Shirt, Palette, ChevronRight } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, parsedPattern, tutorials, downloads, imageUrl, hasDxf, illustrationCount, pieceCount } = data;
	const p = parsedPattern;
</script>

<svelte:head>
	<title>{pattern.pattern_name} — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<a href="/patterns" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-500 text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		Patterns
	</a>

	<!-- Hero -->
	<div class="grid md:grid-cols-[1fr_1.4fr] gap-8 md:gap-12 mb-10">
		<div class="aspect-[3/4] bg-white rounded-3xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-warm-200/50">
			{#if imageUrl}
				<img src={imageUrl} alt={pattern.pattern_name} class="w-full h-full object-cover" />
			{:else}
				<div class="w-full h-full flex items-center justify-center bg-warm-100">
					<Scissors class="w-16 h-16 text-rosys-fg/8" strokeWidth={1} />
				</div>
			{/if}
		</div>

		<div>
			<h1 class="text-[32px] font-bold text-rosys-fg leading-tight tracking-tight mb-3">{pattern.pattern_name}</h1>

			<!-- Tags -->
			<div class="flex flex-wrap gap-2 mb-5">
				{#if p.difficulty}
					<span class="px-3 py-1 rounded-full bg-rosys-100 text-rosys-700 text-[12px] font-semibold">{p.difficulty}</span>
				{/if}
				{#if pieceCount > 0}
					<span class="px-3 py-1 rounded-full bg-warm-100 text-warm-500 text-[12px] font-semibold">{pieceCount} pieces</span>
				{/if}
				{#if p.seamAllowance}
					<span class="px-3 py-1 rounded-full bg-warm-100 text-warm-500 text-[12px] font-semibold">{p.seamAllowance.split('\n')[0]}</span>
				{/if}
			</div>

			{#if p.about}
				<p class="text-[14px] text-rosys-fg-muted leading-[1.8] mb-6">{p.about}</p>
			{/if}

			<!-- Primary CTA -->
			<a href="/patterns/{pattern.pattern_slug}/instructions" class="rosys-btn-primary w-full py-4 text-[15px] mb-3">
				<BookOpen class="w-5 h-5" strokeWidth={1.5} />
				Read Instructions
				<span class="ml-auto text-white/60 text-[12px]">{illustrationCount} pages</span>
			</a>

			<!-- Tool grid -->
			<div class="grid grid-cols-2 gap-2.5">
				<a href="/patterns/{pattern.pattern_slug}/sizing" class="rosys-card flex items-center gap-3 p-3.5 hover:-translate-y-0.5">
					<div class="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
						<Ruler class="w-[18px] h-[18px] text-emerald-500" strokeWidth={1.5} />
					</div>
					<div class="min-w-0">
						<p class="text-[13px] font-semibold text-rosys-fg">Find My Size</p>
						<p class="text-[11px] text-rosys-fg-faint">AI powered</p>
					</div>
				</a>
				<a href="/patterns/{pattern.pattern_slug}/fabric" class="rosys-card flex items-center gap-3 p-3.5 hover:-translate-y-0.5">
					<div class="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
						<Calculator class="w-[18px] h-[18px] text-amber-500" strokeWidth={1.5} />
					</div>
					<div class="min-w-0">
						<p class="text-[13px] font-semibold text-rosys-fg">Fabric Calc</p>
						<p class="text-[11px] text-rosys-fg-faint">How much?</p>
					</div>
				</a>
				<a href="/patterns/{pattern.pattern_slug}/pieces" class="rosys-card flex items-center gap-3 p-3.5 hover:-translate-y-0.5">
					<div class="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
						<Layers class="w-[18px] h-[18px] text-blue-500" strokeWidth={1.5} />
					</div>
					<div class="min-w-0">
						<p class="text-[13px] font-semibold text-rosys-fg">Pattern Pieces</p>
						<p class="text-[11px] text-rosys-fg-faint">Interactive SVG</p>
					</div>
				</a>
				<a href="/patterns/{pattern.pattern_slug}/help" class="rosys-card flex items-center gap-3 p-3.5 hover:-translate-y-0.5">
					<div class="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
						<MessageCircle class="w-[18px] h-[18px] text-violet-500" strokeWidth={1.5} />
					</div>
					<div class="min-w-0">
						<p class="text-[13px] font-semibold text-rosys-fg">AI Helper</p>
						<p class="text-[11px] text-rosys-fg-faint">Ask anything</p>
					</div>
				</a>
			</div>
		</div>
	</div>

	<!-- Info cards -->
	<div class="grid md:grid-cols-2 gap-4 mb-8">
		{#if p.materials.length > 0}
			<div class="rosys-card p-5">
				<div class="flex items-center gap-2.5 mb-4">
					<div class="w-8 h-8 rounded-lg bg-rosys-50 flex items-center justify-center">
						<Shirt class="w-4 h-4 text-rosys-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[13px] font-semibold text-rosys-fg">You Will Need</h2>
				</div>
				<div class="space-y-0">
					{#each p.materials as mat}
						<div class="flex items-center justify-between py-2.5 border-b border-warm-200/40 last:border-0">
							<span class="text-[14px] text-rosys-fg">{mat.item}</span>
							{#if mat.quantity}
								<span class="text-[13px] text-rosys-500 font-semibold shrink-0 ml-4">{mat.quantity}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if p.fabricSuggestions.length > 0}
			<div class="rosys-card p-5">
				<div class="flex items-center gap-2.5 mb-4">
					<div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
						<Palette class="w-4 h-4 text-amber-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[13px] font-semibold text-rosys-fg">Fabric Suggestions</h2>
				</div>
				<div class="space-y-2">
					{#each p.fabricSuggestions as fab}
						<p class="text-[13px] text-rosys-fg-muted leading-relaxed pl-3 border-l-2 border-rosys-200">{fab}</p>
					{/each}
				</div>
			</div>
		{/if}

		{#if p.sizeChart}
			<div class="rosys-card p-5 md:col-span-2">
				<div class="flex items-center gap-2.5 mb-4">
					<div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
						<Ruler class="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[13px] font-semibold text-rosys-fg">Size Chart <span class="font-normal text-rosys-fg-faint">(body measurements, cm)</span></h2>
				</div>
				<div class="overflow-x-auto -mx-1">
					<table class="w-full text-[13px]">
						<thead>
							<tr>
								<th class="text-left py-2 pr-4 text-rosys-fg-faint font-medium"></th>
								{#each p.sizeChart.sizes as size}
									<th class="text-center py-2 px-3 font-bold text-rosys-fg">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each p.sizeChart.measurements as row, i}
								<tr class="{i % 2 === 0 ? 'bg-warm-50' : ''}">
									<td class="py-2.5 pr-4 text-rosys-fg-muted font-medium rounded-l-lg">{row.label}</td>
									{#each row.values as val, j}
										<td class="text-center py-2.5 px-3 text-rosys-fg {j === row.values.length - 1 ? 'rounded-r-lg' : ''}">{val}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if p.patternPieces.length > 0}
			<div class="rosys-card p-5 md:col-span-2">
				<div class="flex items-center gap-2.5 mb-4">
					<div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
						<Scissors class="w-4 h-4 text-blue-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[13px] font-semibold text-rosys-fg">Pattern Pieces <span class="font-normal text-rosys-fg-faint">({p.patternPieces.length})</span></h2>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{#each p.patternPieces as piece}
						<div class="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-warm-50 hover:bg-warm-100 transition-colors">
							<span class="w-7 h-7 rounded-lg bg-white border border-warm-200 flex items-center justify-center text-[12px] font-bold text-rosys-500 shrink-0">{piece.number}</span>
							<div class="min-w-0">
								<p class="text-[13px] font-medium text-rosys-fg truncate">{piece.name}</p>
								<p class="text-[11px] text-rosys-fg-faint truncate">{piece.cutInstructions}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Downloads -->
	<div class="mb-6">
		<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Downloads</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
			{#each downloads as dl}
				{@const icons: Record<string, typeof FileText> = { 'Instructions PDF': FileText, 'A0 Pattern Sheet': Box, 'A4 Pattern': Box, 'US Letter Pattern': Box, 'DXF Pattern File': Scissors }}
				{@const Icon = icons[dl.label] || FileText}
				{#if dl.href}
					<a href={dl.href} target="_blank" rel="noopener" class="rosys-card flex items-center gap-3 p-3.5 group">
						<Icon class="w-4 h-4 text-rosys-fg-faint group-hover:text-rosys-500 shrink-0 transition-colors" strokeWidth={1.5} />
						<div class="flex-1 min-w-0">
							<p class="text-[13px] font-medium text-rosys-fg">{dl.label}</p>
							<p class="text-[11px] text-rosys-fg-faint">{dl.sub}</p>
						</div>
						<Download class="w-3.5 h-3.5 text-rosys-fg-faint/40 group-hover:text-rosys-500 shrink-0 transition-colors" strokeWidth={1.5} />
					</a>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Tutorials -->
	{#if tutorials.length > 0}
		<div class="mb-6">
			<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Video Tutorials</h2>
			{#each tutorials as tut}
				<a href={tut.url} target="_blank" rel="noopener" class="rosys-card flex items-center gap-3 p-3.5 group">
					<div class="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
						<Play class="w-4 h-4 text-red-400" strokeWidth={2} />
					</div>
					<p class="flex-1 text-[13px] text-rosys-fg line-clamp-1">{tut.title}</p>
					<ExternalLink class="w-3.5 h-3.5 text-rosys-fg-faint/40 group-hover:text-rosys-500 shrink-0 transition-colors" strokeWidth={1.5} />
				</a>
			{/each}
		</div>
	{/if}

	<!-- Community -->
	<a href="/patterns/{pattern.pattern_slug}/community" class="rosys-card flex items-center gap-3 p-4 group">
		<div class="w-9 h-9 rounded-lg bg-rosys-50 flex items-center justify-center shrink-0">
			<Star class="w-4 h-4 text-rosys-500" strokeWidth={1.5} />
		</div>
		<div class="flex-1">
			<p class="text-[14px] font-semibold text-rosys-fg">Community Reviews</p>
			<p class="text-[12px] text-rosys-fg-faint">See what others say about this pattern</p>
		</div>
		<ChevronRight class="w-4 h-4 text-rosys-fg-faint/40 group-hover:text-rosys-500 transition-colors" strokeWidth={1.5} />
	</a>
</div>
