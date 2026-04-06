<script lang="ts">
	import { ArrowLeft, BookOpen, Scissors, Ruler, Package, Palette, Printer, LayoutGrid, ChevronRight, Shirt, Info } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, parsed, sizeChartRaw } = data;
	const p = parsed;

	let showSizeChart = $state(false);
	let showTableOfContents = $state(false);

	// Build sections from parsed data — each becomes a visual card
	interface Section {
		id: string;
		title: string;
		icon: typeof BookOpen;
		color: string;
		type: 'about' | 'materials' | 'fabric' | 'pieces' | 'steps' | 'printing' | 'usage' | 'info';
	}

	const sections: Section[] = [
		...(p.about ? [{ id: 'about', title: 'About This Pattern', icon: Info, color: 'violet', type: 'about' as const }] : []),
		...(p.materials.length > 0 ? [{ id: 'materials', title: 'You Will Need', icon: Package, color: 'blue', type: 'materials' as const }] : []),
		...(p.fabricSuggestions.length > 0 ? [{ id: 'fabrics', title: 'Fabric Suggestions', icon: Palette, color: 'rose', type: 'fabric' as const }] : []),
		...(p.patternPieces.length > 0 ? [{ id: 'pieces', title: `Pattern Pieces (${p.patternPieces.length})`, icon: Scissors, color: 'amber', type: 'pieces' as const }] : []),
		...(p.printingNotes ? [{ id: 'printing', title: 'Printing & Assembly', icon: Printer, color: 'slate', type: 'printing' as const }] : []),
		...(p.fabricUsage ? [{ id: 'usage', title: 'Fabric Layout', icon: LayoutGrid, color: 'emerald', type: 'usage' as const }] : []),
		...(p.sewingSteps.length > 0 ? p.sewingSteps.map((s, i) => ({
			id: `step-${s.number}`,
			title: s.title || `Step ${s.number}`,
			icon: Shirt,
			color: 'pink',
			type: 'steps' as const
		})) : [])
	];

	const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
		violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200/60', badge: 'bg-violet-100 text-violet-700' },
		blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200/60', badge: 'bg-blue-100 text-blue-700' },
		rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200/60', badge: 'bg-rose-100 text-rose-700' },
		amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200/60', badge: 'bg-amber-100 text-amber-700' },
		slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/60', badge: 'bg-slate-100 text-slate-700' },
		emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200/60', badge: 'bg-emerald-100 text-emerald-700' },
		pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200/60', badge: 'bg-pink-100 text-pink-700' }
	};

	function scrollTo(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		showTableOfContents = false;
	}
</script>

<svelte:head>
	<title>Instructions — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter">
	<!-- Sticky header -->
	<div class="sticky top-0 z-20 glass border-b border-rosys-border/30">
		<div class="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
			<a href="/patterns/{pattern.pattern_slug}" class="flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[13px] font-medium transition-colors">
				<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
				{pattern.pattern_name}
			</a>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => (showTableOfContents = !showTableOfContents)}
					class="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
						{showTableOfContents ? 'bg-rosys-fg text-white' : 'bg-rosys-bg-alt text-rosys-fg-muted hover:text-rosys-fg'}"
				>Contents</button>
				<button
					type="button"
					onclick={() => (showSizeChart = !showSizeChart)}
					class="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
						{showSizeChart ? 'bg-rosys-fg text-white' : 'bg-rosys-bg-alt text-rosys-fg-muted hover:text-rosys-fg'}"
				>Sizes</button>
			</div>
		</div>
	</div>

	<!-- Table of Contents dropdown -->
	{#if showTableOfContents}
		<div class="sticky top-[52px] z-10 bg-rosys-card border-b border-rosys-border/30 shadow-sm">
			<div class="max-w-3xl mx-auto px-5 py-4">
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
					{#each sections as section}
						{@const c = colorMap[section.color]}
						<button
							type="button"
							onclick={() => scrollTo(section.id)}
							class="flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-rosys-bg-alt transition-colors"
						>
							<span class="w-2 h-2 rounded-full {c.bg} shrink-0"></span>
							<span class="text-[12px] text-rosys-fg-muted truncate">{section.title}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Size chart overlay -->
	{#if showSizeChart && sizeChartRaw}
		<div class="sticky top-[52px] z-10 bg-rosys-card border-b border-rosys-border/30 shadow-sm">
			<div class="max-w-3xl mx-auto px-5 py-4 overflow-x-auto">
				{#if p.sizeChart}
					<table class="w-full text-[12px]">
						<thead>
							<tr class="border-b border-rosys-border/40">
								<th class="text-left py-1.5 pr-3 text-rosys-fg-faint font-medium"></th>
								{#each p.sizeChart.sizes as size}
									<th class="text-center py-1.5 px-2 text-rosys-fg font-semibold">{size}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each p.sizeChart.measurements as row}
								<tr class="border-b border-rosys-border/20">
									<td class="py-1.5 pr-3 text-rosys-fg-muted font-medium">{row.label}</td>
									{#each row.values as val}
										<td class="text-center py-1.5 px-2 text-rosys-fg tabular-nums">{val}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<pre class="text-[12px] text-rosys-fg-muted font-mono whitespace-pre-line">{sizeChartRaw}</pre>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Content -->
	<div class="max-w-3xl mx-auto px-5 py-8 space-y-6">

		<!-- ABOUT card -->
		{#if p.about}
			<div id="about" class="bg-rosys-card rounded-2xl border border-violet-200/40 p-6 shadow-sm">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
						<Info class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
					</div>
					<div>
						<h2 class="text-[16px] font-semibold text-rosys-fg">About This Pattern</h2>
						{#if p.difficulty}
							<span class="text-[11px] font-medium px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">{p.difficulty}</span>
						{/if}
					</div>
				</div>
				<p class="text-[14px] text-rosys-fg-muted leading-[1.8]">{p.about}</p>
				{#if p.seamAllowance}
					<div class="mt-4 pt-3 border-t border-rosys-border/30">
						<p class="text-[12px] text-rosys-fg-faint"><strong class="text-rosys-fg-muted">Seam Allowance:</strong> {p.seamAllowance}</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- MATERIALS card -->
		{#if p.materials.length > 0}
			<div id="materials" class="bg-rosys-card rounded-2xl border border-blue-200/40 p-6 shadow-sm">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
						<Package class="w-5 h-5 text-blue-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[16px] font-semibold text-rosys-fg">You Will Need</h2>
				</div>
				<div class="space-y-0">
					{#each p.materials as mat, i}
						<div class="flex items-center justify-between py-3 {i < p.materials.length - 1 ? 'border-b border-rosys-border/20' : ''}">
							<div class="flex items-center gap-3">
								<span class="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-[11px] font-bold text-blue-400 shrink-0">{i + 1}</span>
								<span class="text-[14px] text-rosys-fg">{mat.item}</span>
							</div>
							{#if mat.quantity}
								<span class="text-[13px] text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg shrink-0 ml-3">{mat.quantity}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- FABRIC SUGGESTIONS card -->
		{#if p.fabricSuggestions.length > 0}
			<div id="fabrics" class="bg-rosys-card rounded-2xl border border-rose-200/40 p-6 shadow-sm">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
						<Palette class="w-5 h-5 text-rose-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[16px] font-semibold text-rosys-fg">Fabric Suggestions</h2>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{#each p.fabricSuggestions as fab}
						<div class="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/50">
							<span class="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0"></span>
							<p class="text-[13px] text-rosys-fg-muted leading-relaxed">{fab}</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- PATTERN PIECES card -->
		{#if p.patternPieces.length > 0}
			<div id="pieces" class="bg-rosys-card rounded-2xl border border-amber-200/40 p-6 shadow-sm">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
						<Scissors class="w-5 h-5 text-amber-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[16px] font-semibold text-rosys-fg">Pattern Pieces</h2>
					<span class="text-[12px] font-medium px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-700">{p.patternPieces.length} pieces</span>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{#each p.patternPieces as piece}
						<div class="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100/60">
							<span class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-[13px] font-bold text-amber-700 shrink-0">{piece.number}</span>
							<div class="min-w-0">
								<p class="text-[13px] font-medium text-rosys-fg">{piece.name}</p>
								<p class="text-[11px] text-amber-600/70">{piece.cutInstructions}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- PRINTING NOTES card -->
		{#if p.printingNotes}
			<div id="printing" class="bg-rosys-card rounded-2xl border border-slate-200/40 p-6 shadow-sm">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
						<Printer class="w-5 h-5 text-slate-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[16px] font-semibold text-rosys-fg">Printing & Assembly</h2>
				</div>
				<p class="text-[14px] text-rosys-fg-muted leading-[1.75] whitespace-pre-line">{p.printingNotes}</p>
			</div>
		{/if}

		<!-- FABRIC LAYOUT card -->
		{#if p.fabricUsage}
			<div id="usage" class="bg-rosys-card rounded-2xl border border-emerald-200/40 p-6 shadow-sm">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
						<LayoutGrid class="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
					</div>
					<h2 class="text-[16px] font-semibold text-rosys-fg">Fabric Layout</h2>
				</div>
				<p class="text-[14px] text-rosys-fg-muted leading-[1.75] whitespace-pre-line">{p.fabricUsage}</p>
			</div>
		{/if}

		<!-- SEWING STEPS -->
		{#if p.sewingSteps.length > 0}
			<div class="pt-4">
				<h2 class="text-[20px] font-bold text-rosys-fg mb-6 flex items-center gap-3">
					<Shirt class="w-6 h-6 text-pink-500" strokeWidth={1.5} />
					Sewing Steps
				</h2>
				<div class="space-y-4">
					{#each p.sewingSteps as step}
						<div id="step-{step.number}" class="bg-rosys-card rounded-2xl border border-pink-200/40 p-6 shadow-sm">
							<div class="flex items-start gap-4">
								<span class="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-[16px] font-bold text-pink-600 shrink-0">{step.number}</span>
								<div class="flex-1 min-w-0">
									<h3 class="text-[15px] font-semibold text-rosys-fg mb-2">{step.title}</h3>
									<p class="text-[14px] text-rosys-fg-muted leading-[1.8] whitespace-pre-line">{step.content}</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
