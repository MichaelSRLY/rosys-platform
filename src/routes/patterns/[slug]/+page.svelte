<script lang="ts">
	import { ArrowLeft, Download, FileText, Box, Scissors, Play, ExternalLink, BookOpen, Ruler, Calculator, Layers, MessageCircle, Star, Shirt, Palette } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, parsedPattern, tutorials, downloads, imageUrl, hasDxf, illustrationCount, pieceCount } = data;
	const p = parsedPattern;
</script>

<svelte:head>
	<title>{pattern.pattern_name} — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<a href="/patterns" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		Patterns
	</a>

	<!-- Hero -->
	<div class="grid md:grid-cols-[1fr_1.4fr] gap-8 md:gap-12 mb-12">
		<!-- Image -->
		<div class="aspect-[3/4] bg-rosys-card rounded-3xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-rosys-border/50">
			{#if imageUrl}
				<img src={imageUrl} alt={pattern.pattern_name} class="w-full h-full object-cover" />
			{:else}
				<div class="w-full h-full flex items-center justify-center bg-rosys-bg-alt">
					<Scissors class="w-16 h-16 text-rosys-fg/8" strokeWidth={1} />
				</div>
			{/if}
		</div>

		<!-- Info -->
		<div>
			<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[32px] font-light leading-tight tracking-tight mb-3">
				{pattern.pattern_name}
			</h1>

			<!-- Tags -->
			<div class="flex flex-wrap gap-2 mb-5">
				{#if p.difficulty}
					<span class="px-3 py-1 rounded-lg bg-rosys-bg-alt text-[12px] font-medium text-rosys-fg-muted">{p.difficulty}</span>
				{/if}
				{#if p.seamAllowance}
					<span class="px-3 py-1 rounded-lg bg-rosys-bg-alt text-[12px] font-medium text-rosys-fg-muted">{p.seamAllowance.split('\n')[0]}</span>
				{/if}
				{#if pieceCount > 0}
					<span class="px-3 py-1 rounded-lg bg-rosys-bg-alt text-[12px] font-medium text-rosys-fg-muted">{pieceCount} pieces</span>
				{/if}
			</div>

			<!-- About -->
			{#if p.about}
				<p class="text-[14px] text-rosys-fg-muted leading-[1.75] mb-6">{p.about}</p>
			{/if}

			<!-- Action buttons -->
			<div class="space-y-2.5 mb-8">
				<a href="/patterns/{pattern.pattern_slug}/instructions"
					class="flex items-center gap-4 p-4 bg-rosys-fg text-white rounded-xl hover:bg-rosys-fg/90 active:scale-[0.98] transition-all duration-150">
					<div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
						<BookOpen class="w-5 h-5" strokeWidth={1.5} />
					</div>
					<div class="flex-1">
						<p class="text-[15px] font-semibold">Read Instructions</p>
						<p class="text-[12px] text-white/60">{illustrationCount} illustrated pages</p>
					</div>
				</a>

				<div class="grid grid-cols-2 gap-2.5">
					<a href="/patterns/{pattern.pattern_slug}/sizing"
						class="flex items-center gap-3 p-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all">
						<Ruler class="w-5 h-5" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-semibold">Find My Size</p>
							<p class="text-[11px] text-white/60">AI powered</p>
						</div>
					</a>
					<a href="/patterns/{pattern.pattern_slug}/fabric"
						class="flex items-center gap-3 p-3.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all">
						<Calculator class="w-5 h-5" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-semibold">Fabric Calc</p>
							<p class="text-[11px] text-white/60">How much?</p>
						</div>
					</a>
					<a href="/patterns/{pattern.pattern_slug}/pieces"
						class="flex items-center gap-3 p-3.5 bg-rosys-card border border-rosys-border/60 rounded-xl hover:border-rosys-fg/20 hover:shadow-sm transition-all">
						<Layers class="w-5 h-5 text-blue-500" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-rosys-fg">Pieces</p>
							<p class="text-[11px] text-rosys-fg-faint">Interactive</p>
						</div>
					</a>
					{#if hasDxf}
					<a href="/patterns/{pattern.pattern_slug}/custom-fit"
						class="flex items-center gap-3 p-3.5 bg-rosys-card border border-violet-200/60 rounded-xl hover:border-violet-300 hover:shadow-sm transition-all">
						<Scissors class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-rosys-fg">Custom Fit</p>
							<p class="text-[11px] text-rosys-fg-faint">Your size</p>
						</div>
					</a>
					{/if}
					<a href="/patterns/{pattern.pattern_slug}/help"
						class="flex items-center gap-3 p-3.5 bg-rosys-card border border-rosys-border/60 rounded-xl hover:border-violet-300 hover:shadow-sm transition-all">
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

	<!-- Structured info cards -->
	<div class="grid md:grid-cols-2 gap-5 mb-8">
		<!-- Materials -->
		{#if p.materials.length > 0}
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
				<div class="flex items-center gap-2 mb-4">
					<Shirt class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em]">You Will Need</h2>
				</div>
				<div class="space-y-2">
					{#each p.materials as mat}
						<div class="flex items-center justify-between py-1.5 border-b border-rosys-border/30 last:border-0">
							<span class="text-[14px] text-rosys-fg">{mat.item}</span>
							{#if mat.quantity}
								<span class="text-[13px] text-rosys-fg-muted font-medium shrink-0 ml-4">{mat.quantity}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Fabric Suggestions -->
		{#if p.fabricSuggestions.length > 0}
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
				<div class="flex items-center gap-2 mb-4">
					<Palette class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em]">Fabric Suggestions</h2>
				</div>
				<div class="space-y-2">
					{#each p.fabricSuggestions as fab}
						<p class="text-[13px] text-rosys-fg-muted leading-relaxed">• {fab}</p>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Size Chart -->
		{#if p.sizeChart}
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm md:col-span-2">
				<div class="flex items-center gap-2 mb-4">
					<Ruler class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em]">Size Chart (body measurements, cm)</h2>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-[13px]">
						<thead>
							<tr class="border-b border-rosys-border/40">
								<th class="text-left py-2 pr-4 text-rosys-fg-faint font-medium"></th>
								{#each p.sizeChart.sizes as size}
									<th class="text-center py-2 px-3 text-rosys-fg font-semibold">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each p.sizeChart.measurements as row}
								<tr class="border-b border-rosys-border/20">
									<td class="py-2.5 pr-4 text-rosys-fg-muted font-medium">{row.label}</td>
									{#each row.values as val}
										<td class="text-center py-2.5 px-3 text-rosys-fg">{val}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Pattern Pieces List -->
		{#if p.patternPieces.length > 0}
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm md:col-span-2">
				<div class="flex items-center gap-2 mb-4">
					<Scissors class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em]">Pattern Pieces ({p.patternPieces.length})</h2>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{#each p.patternPieces as piece}
						<div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-rosys-bg/50">
							<span class="w-7 h-7 rounded-lg bg-rosys-bg-alt flex items-center justify-center text-[12px] font-bold text-rosys-fg-muted shrink-0">{piece.number}</span>
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
	<div class="mb-8">
		<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Downloads</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
			{#each downloads as dl}
				{@const icons: Record<string, typeof FileText> = { 'Instructions PDF': FileText, 'A0 Pattern Sheet': Box, 'A4 Pattern': Box, 'US Letter Pattern': Box, 'DXF Pattern File': Scissors }}
				{@const Icon = icons[dl.label] || FileText}
				{#if dl.href}
					<a href={dl.href} target="_blank" rel="noopener"
						class="flex items-center gap-3 p-3.5 bg-rosys-card rounded-xl border border-rosys-border/60 hover:border-rosys-fg/20 hover:shadow-sm transition-all group">
						<Icon class="w-4 h-4 text-rosys-fg/40 group-hover:text-rosys-fg/60 shrink-0" strokeWidth={1.5} />
						<div class="flex-1 min-w-0">
							<p class="text-[13px] font-medium text-rosys-fg">{dl.label}</p>
							<p class="text-[11px] text-rosys-fg-faint">{dl.sub}</p>
						</div>
						<Download class="w-3.5 h-3.5 text-rosys-fg/20 group-hover:text-rosys-fg/40 shrink-0" strokeWidth={1.5} />
					</a>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Tutorials -->
	{#if tutorials.length > 0}
		<div class="mb-8">
			<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Video Tutorials</h2>
			{#each tutorials as tut}
				<a href={tut.url} target="_blank" rel="noopener"
					class="flex items-center gap-3 p-3.5 bg-rosys-card rounded-xl border border-rosys-border/60 hover:border-rosys-pink/30 hover:shadow-sm transition-all group">
					<div class="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
						<Play class="w-4 h-4 text-red-400" strokeWidth={2} />
					</div>
					<p class="flex-1 text-[13px] text-rosys-fg line-clamp-1">{tut.title}</p>
					<ExternalLink class="w-3.5 h-3.5 text-rosys-fg/20 group-hover:text-rosys-fg/40 shrink-0" strokeWidth={1.5} />
				</a>
			{/each}
		</div>
	{/if}

	<!-- Community link -->
	<a href="/patterns/{pattern.pattern_slug}/community"
		class="flex items-center gap-3 p-4 bg-rosys-card rounded-xl border border-rosys-border/40 hover:border-rosys-fg/15 hover:shadow-sm transition-all">
		<Star class="w-5 h-5 text-amber-400" strokeWidth={1.5} />
		<div>
			<p class="text-[14px] font-medium text-rosys-fg">Community Reviews</p>
			<p class="text-[12px] text-rosys-fg-faint">See what others say about this pattern</p>
		</div>
	</a>
</div>
