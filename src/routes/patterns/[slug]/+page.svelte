<script lang="ts">
	import { ArrowLeft, Download, FileText, Box, Scissors, Play, ExternalLink, BookOpen, Ruler, Calculator, Layers, MessageCircle, Star, Shirt, Palette, ChevronRight } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, parsedPattern, tutorials, downloads, imageUrl, hasDxf, illustrationCount, pieceCount } = data;
	const p = parsedPattern;
</script>

<svelte:head>
	<title>{pattern.pattern_name} — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-10 md:px-12 md:py-16 max-w-5xl mx-auto">
	<a href="/patterns" class="rosys-back-link mb-10 inline-flex">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		Patterns
	</a>

	<!-- Hero -->
	<div class="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-14 mb-16">
		<!-- Image -->
		<div class="relative aspect-[3/4] rounded-3xl overflow-hidden" style="box-shadow: var(--shadow-2xl)">
			{#if imageUrl}
				<img src={imageUrl} alt={pattern.pattern_name} class="w-full h-full object-cover" />
				<!-- Bottom gradient overlay for depth -->
				<div class="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/30 via-black/10 to-transparent pointer-events-none"></div>
			{:else}
				<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-warm-100 to-rosys-50">
					<Scissors class="w-16 h-16 text-rosys-fg/8" strokeWidth={1} />
				</div>
			{/if}
		</div>

		<!-- Info -->
		<div class="flex flex-col justify-center">
			<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[36px] md:text-[40px] font-light leading-[1.1] tracking-tight mb-4">
				{pattern.pattern_name}
			</h1>

			<!-- Tags -->
			<div class="flex flex-wrap gap-2 mb-6">
				{#if p.difficulty}
					<span class="rosys-tag">{p.difficulty}</span>
				{/if}
				{#if p.seamAllowance}
					<span class="rosys-tag">{p.seamAllowance.split('\n')[0]}</span>
				{/if}
				{#if pieceCount > 0}
					<span class="rosys-tag">{pieceCount} pieces</span>
				{/if}
			</div>

			<!-- About -->
			{#if p.about}
				<p class="text-[14px] text-rosys-fg-muted leading-[1.8] mb-8 max-w-lg">{p.about}</p>
			{/if}

			<!-- Action buttons -->
			<div class="space-y-3">
				<!-- Primary CTA — large, dark, with shine -->
				<a href="/patterns/{pattern.pattern_slug}/instructions"
					class="shine-effect relative flex items-center gap-4 w-full p-5 bg-rosys-fg text-white rounded-2xl hover:bg-rosys-fg/90 active:scale-[0.98] transition-all duration-200"
					style="box-shadow: var(--shadow-xl)">
					<div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 relative z-[1]" style="background: rgba(255,255,255,0.12); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1);">
						<BookOpen class="w-5 h-5" strokeWidth={1.5} />
					</div>
					<div class="flex-1 relative z-[1]">
						<p class="text-[16px] font-semibold tracking-[-0.01em]">Read Instructions</p>
						<p class="text-[12px] text-white/50 mt-0.5">{illustrationCount} illustrated pages</p>
					</div>
				</a>

				<!-- 2x2 action grid -->
				<div class="grid grid-cols-2 gap-3">
					<a href="/patterns/{pattern.pattern_slug}/sizing"
						class="flex items-center gap-3 p-4 rounded-2xl text-white hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
						style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); box-shadow: 0 4px 14px rgba(5,150,105,0.25), 0 1px 3px rgba(5,150,105,0.1); transition-timing-function: var(--ease-spring)">
						<Ruler class="w-5 h-5" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-semibold">Find My Size</p>
							<p class="text-[11px] text-white/55">AI powered</p>
						</div>
					</a>
					<a href="/patterns/{pattern.pattern_slug}/fabric"
						class="flex items-center gap-3 p-4 rounded-2xl text-white hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
						style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); box-shadow: 0 4px 14px rgba(217,119,6,0.25), 0 1px 3px rgba(217,119,6,0.1); transition-timing-function: var(--ease-spring)">
						<Calculator class="w-5 h-5" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-semibold">Fabric Calc</p>
							<p class="text-[11px] text-white/55">How much?</p>
						</div>
					</a>
					<a href="/patterns/{pattern.pattern_slug}/pieces"
						class="flex items-center gap-3 p-4 bg-rosys-card rounded-2xl border border-rosys-border/50 hover:border-blue-300/60 hover:-translate-y-0.5 transition-all duration-300"
						style="box-shadow: var(--shadow-sm); transition-timing-function: var(--ease-spring)">
						<Layers class="w-5 h-5 text-blue-500" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-rosys-fg">Pieces</p>
							<p class="text-[11px] text-rosys-fg-faint">Interactive</p>
						</div>
					</a>
					<a href="/patterns/{pattern.pattern_slug}/help"
						class="flex items-center gap-3 p-4 bg-rosys-card rounded-2xl border border-rosys-border/50 hover:border-violet-300/60 hover:-translate-y-0.5 transition-all duration-300"
						style="box-shadow: var(--shadow-sm); transition-timing-function: var(--ease-spring)">
						<MessageCircle class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-rosys-fg">AI Helper</p>
							<p class="text-[11px] text-rosys-fg-faint">Ask anything</p>
						</div>
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- Structured info cards — colored top borders -->
	<div class="grid md:grid-cols-2 gap-6 mb-10">
		<!-- Materials -->
		{#if p.materials.length > 0}
			<div class="stagger-item rosys-card overflow-hidden" style="--i: 0">
				<div class="h-[3px] bg-gradient-to-r from-blue-400 to-blue-300"></div>
				<div class="p-6">
					<div class="flex items-center gap-2.5 mb-5">
						<Shirt class="w-4 h-4 text-blue-500" strokeWidth={1.5} />
						<h2 class="rosys-section-label">You Will Need</h2>
					</div>
					<div class="space-y-1">
						{#each p.materials as mat}
							<div class="flex items-center justify-between py-2.5 border-b border-rosys-border/25 last:border-0">
								<span class="text-[14px] text-rosys-fg">{mat.item}</span>
								{#if mat.quantity}
									<span class="text-[13px] text-blue-600 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-md shrink-0 ml-4">{mat.quantity}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Fabric Suggestions -->
		{#if p.fabricSuggestions.length > 0}
			<div class="stagger-item rosys-card overflow-hidden" style="--i: 1">
				<div class="h-[3px] bg-gradient-to-r from-rose-400 to-rose-300"></div>
				<div class="p-6">
					<div class="flex items-center gap-2.5 mb-5">
						<Palette class="w-4 h-4 text-rose-500" strokeWidth={1.5} />
						<h2 class="rosys-section-label">Fabric Suggestions</h2>
					</div>
					<div class="space-y-3">
						{#each p.fabricSuggestions as fab}
							<div class="flex items-start gap-3">
								<div class="w-1.5 h-1.5 rounded-full bg-rose-300 mt-2 shrink-0"></div>
								<p class="text-[13px] text-rosys-fg-muted leading-relaxed">{fab}</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Size Chart -->
		{#if p.sizeChart}
			<div class="stagger-item rosys-card overflow-hidden md:col-span-2" style="--i: 2">
				<div class="h-[3px] bg-gradient-to-r from-emerald-400 to-emerald-300"></div>
				<div class="p-6">
					<div class="flex items-center gap-2.5 mb-5">
						<Ruler class="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
						<h2 class="rosys-section-label">Size Chart (body measurements, cm)</h2>
					</div>
					<div class="overflow-x-auto -mx-2">
						<table class="w-full text-[13px]">
							<thead>
								<tr class="bg-rosys-50/60">
									<th class="text-left py-3 px-4 text-rosys-fg-faint font-medium rounded-l-lg"></th>
									{#each p.sizeChart.sizes as size}
										<th class="text-center py-3 px-3 text-rosys-fg font-bold">{size}</th>
									{/each}
									<th class="rounded-r-lg w-0"></th>
								</tr>
							</thead>
							<tbody>
								{#each p.sizeChart.measurements as row, i}
									<tr class="border-b border-rosys-border/15 transition-colors duration-150 hover:bg-warm-50">
										<td class="py-3 px-4 text-rosys-fg-muted font-medium">{row.label}</td>
										{#each row.values as val}
											<td class="text-center py-3 px-3 text-rosys-fg tabular-nums">{val}</td>
										{/each}
										<td></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- Pattern Pieces List -->
		{#if p.patternPieces.length > 0}
			<div class="stagger-item rosys-card overflow-hidden md:col-span-2" style="--i: 3">
				<div class="h-[3px] bg-gradient-to-r from-amber-400 to-amber-300"></div>
				<div class="p-6">
					<div class="flex items-center gap-2.5 mb-5">
						<Scissors class="w-4 h-4 text-amber-500" strokeWidth={1.5} />
						<h2 class="rosys-section-label">Pattern Pieces ({p.patternPieces.length})</h2>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
						{#each p.patternPieces as piece}
							<div class="flex items-center gap-3 py-2.5 px-3.5 rounded-xl bg-warm-50/80 border border-rosys-border/20">
								<span class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-[12px] font-bold text-amber-700 shrink-0">{piece.number}</span>
								<div class="min-w-0">
									<p class="text-[13px] font-medium text-rosys-fg truncate">{piece.name}</p>
									<p class="text-[11px] text-rosys-fg-faint truncate">{piece.cutInstructions}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Downloads -->
	<div class="mb-10">
		<h2 class="rosys-section-label mb-4">Downloads</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			{#each downloads as dl}
				{@const icons: Record<string, typeof FileText> = { 'Instructions PDF': FileText, 'A0 Pattern Sheet': Box, 'A4 Pattern': Box, 'US Letter Pattern': Box, 'DXF Pattern File': Scissors }}
				{@const Icon = icons[dl.label] || FileText}
				{#if dl.href}
					<a href={dl.href} target="_blank" rel="noopener"
						class="group flex items-center gap-4 p-4 rosys-card hover:border-rosys-fg/12 transition-all"
						style="transition-timing-function: var(--ease-spring)">
						<div class="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center shrink-0 transition-colors duration-200 group-hover:bg-warm-200/80">
							<Icon class="w-4.5 h-4.5 text-rosys-fg/40 group-hover:text-rosys-fg/60 shrink-0" strokeWidth={1.5} />
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-[13px] font-semibold text-rosys-fg">{dl.label}</p>
							<p class="text-[11px] text-rosys-fg-faint mt-0.5">{dl.sub}</p>
						</div>
						<Download class="w-4 h-4 text-rosys-fg/15 group-hover:text-rosys-fg/40 shrink-0 transition-all duration-300 group-hover:translate-y-[3px]" strokeWidth={1.5} />
					</a>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Tutorials -->
	{#if tutorials.length > 0}
		<div class="mb-10">
			<h2 class="rosys-section-label mb-4">Video Tutorials</h2>
			<div class="space-y-2.5">
				{#each tutorials as tut}
					<a href={tut.url} target="_blank" rel="noopener"
						class="flex items-center gap-4 p-4 rosys-card hover:border-rosys-pink/20 transition-all group"
						style="transition-timing-function: var(--ease-spring)">
						<div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100/80 transition-colors duration-200">
							<Play class="w-4 h-4 text-red-400" strokeWidth={2} />
						</div>
						<p class="flex-1 text-[13px] font-medium text-rosys-fg line-clamp-1">{tut.title}</p>
						<ExternalLink class="w-3.5 h-3.5 text-rosys-fg/15 group-hover:text-rosys-fg/40 shrink-0 transition-colors duration-200" strokeWidth={1.5} />
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Community link — premium gradient card -->
	<a href="/patterns/{pattern.pattern_slug}/community"
		class="group flex items-center gap-4 p-5 rounded-2xl border border-rosys-border/30 hover:border-rosys-fg/10 hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-r from-warm-50 via-rosys-50/20 to-warm-50"
		style="box-shadow: var(--shadow-sm); transition-timing-function: var(--ease-spring)">
		<div class="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
			<Star class="w-5 h-5 text-amber-400" strokeWidth={1.5} />
		</div>
		<div class="flex-1">
			<p class="text-[15px] font-semibold text-rosys-fg tracking-[-0.01em]">Community Reviews</p>
			<p class="text-[12px] text-rosys-fg-faint mt-0.5">See what others say about this pattern</p>
		</div>
		<ChevronRight class="w-5 h-5 text-rosys-fg-faint/50 group-hover:text-rosys-fg-faint group-hover:translate-x-0.5 transition-all duration-200" strokeWidth={1.5} />
	</a>
</div>
