<script lang="ts">
	import { ArrowLeft, BookOpen, Ruler, Scissors, ChevronLeft, ChevronRight, Package } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, sections, sizeChart } = data;

	let currentSection = $state(0);
	let showSizeChart = $state(false);

	const total = sections.length;
	const progress = $derived(((currentSection + 1) / total) * 100);

	function next() { if (currentSection < total - 1) currentSection++; }
	function prev() { if (currentSection > 0) currentSection--; }

	// Parse size chart into table data
	const sizeTableRows = $derived(() => {
		if (!sizeChart) return [];
		const lines = sizeChart.split('\n').filter((l) => l.trim());
		const rows: { label: string; values: string[] }[] = [];
		for (const line of lines) {
			const parts = line.trim().split(/\s{2,}|\t+/);
			if (parts.length >= 3 && /\d/.test(parts[1])) {
				rows.push({ label: parts[0], values: parts.slice(1) });
			}
		}
		return rows;
	});
</script>

<svelte:head>
	<title>Instructions — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter h-full flex flex-col">
	<!-- Top bar -->
	<div class="shrink-0 glass border-b border-rosys-border/30 px-5 py-3">
		<div class="flex items-center justify-between max-w-3xl mx-auto">
			<a href="/patterns/{pattern.pattern_slug}" class="flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[13px] font-medium transition-colors">
				<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
				{pattern.pattern_name}
			</a>
			<div class="flex items-center gap-3">
				<button
					type="button"
					class="px-3 py-1 rounded-lg text-[12px] font-medium transition-all
						{showSizeChart ? 'bg-rosys-fg text-white' : 'bg-rosys-bg-alt text-rosys-fg-muted hover:text-rosys-fg'}"
					onclick={() => (showSizeChart = !showSizeChart)}
				>
					<span class="flex items-center gap-1.5">
						<Ruler class="w-3.5 h-3.5" strokeWidth={1.5} />
						Sizes
					</span>
				</button>
				<span class="text-[12px] text-rosys-fg-faint">{currentSection + 1} / {total}</span>
			</div>
		</div>
		<!-- Progress bar -->
		<div class="max-w-3xl mx-auto mt-2">
			<div class="w-full bg-rosys-bg-alt rounded-full h-[3px]">
				<div
					class="bg-rosys-fg h-[3px] rounded-full transition-all duration-300"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Size chart overlay -->
	{#if showSizeChart && sizeChart}
		<div class="shrink-0 bg-rosys-card border-b border-rosys-border/30 px-5 py-4 overflow-x-auto">
			<div class="max-w-3xl mx-auto">
				<h3 class="text-[12px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em] mb-3">Size Chart (cm)</h3>
				<div class="text-[13px] text-rosys-fg-muted whitespace-pre-line leading-relaxed font-mono">
					{sizeChart}
				</div>
			</div>
		</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-auto">
		<div class="max-w-3xl mx-auto px-6 py-8 md:py-12">
			{#key currentSection}
				{@const section = sections[currentSection]}
				<div class="page-enter">
					<!-- Section header -->
					<div class="flex items-center gap-3 mb-6">
						<div class="w-10 h-10 rounded-xl flex items-center justify-center
							{section.type === 'step' ? 'bg-amber-50' : section.type === 'materials' ? 'bg-emerald-50' : 'bg-rosys-bg-alt'}">
							{#if section.type === 'step'}
								<Scissors class="w-5 h-5 text-amber-500" strokeWidth={1.5} />
							{:else if section.type === 'materials'}
								<Package class="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
							{:else}
								<BookOpen class="w-5 h-5 text-rosys-fg/40" strokeWidth={1.5} />
							{/if}
						</div>
						<div>
							<h2 class="font-[var(--font-logo)] italic text-rosys-fg text-[22px] font-light tracking-tight">
								{section.title}
							</h2>
							<p class="text-[12px] text-rosys-fg-faint">Section {currentSection + 1} of {total}</p>
						</div>
					</div>

					<!-- Section content -->
					<div class="prose-rosys text-[15px] text-rosys-fg-secondary leading-[1.75] whitespace-pre-line">
						{section.content}
					</div>
				</div>
			{/key}
		</div>
	</div>

	<!-- Navigation -->
	<div class="shrink-0 glass border-t border-rosys-border/30 px-5 py-3">
		<div class="max-w-3xl mx-auto flex items-center justify-between">
			<button
				type="button"
				disabled={currentSection === 0}
				onclick={prev}
				class="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all
					{currentSection === 0 ? 'text-rosys-fg-faint/40' : 'text-rosys-fg hover:bg-rosys-bg-alt active:scale-[0.97]'}"
			>
				<ChevronLeft class="w-4 h-4" strokeWidth={1.5} />
				Previous
			</button>

			<!-- Section dots -->
			<div class="flex gap-1.5 max-w-[200px] overflow-hidden">
				{#each sections as _, i}
					<button
						type="button"
						onclick={() => (currentSection = i)}
						class="w-2 h-2 rounded-full transition-all duration-200 shrink-0
							{i === currentSection ? 'bg-rosys-fg w-6' : i < currentSection ? 'bg-rosys-fg/30' : 'bg-rosys-fg/10'}"
					></button>
				{/each}
			</div>

			<button
				type="button"
				disabled={currentSection === total - 1}
				onclick={next}
				class="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all
					{currentSection === total - 1 ? 'text-rosys-fg-faint/40' : 'bg-rosys-fg text-white hover:bg-rosys-fg/90 active:scale-[0.97]'}"
			>
				Next
				<ChevronRight class="w-4 h-4" strokeWidth={1.5} />
			</button>
		</div>
	</div>
</div>
