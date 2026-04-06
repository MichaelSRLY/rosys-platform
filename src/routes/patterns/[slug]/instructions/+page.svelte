<script lang="ts">
	import { ArrowLeft, BookOpen, Ruler, Scissors, ChevronLeft, ChevronRight, Package, ListOrdered, Info, CheckCircle2 } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, sections, sizeChart } = data;

	let currentSection = $state(0);
	let showSizeChart = $state(false);
	let showToc = $state(false);

	const total = sections.length;
	const progress = $derived(((currentSection + 1) / total) * 100);

	function next() { if (currentSection < total - 1) currentSection++; }
	function prev() { if (currentSection > 0) currentSection--; }
	function goTo(i: number) { currentSection = i; showToc = false; }

	function titleCase(str: string): string {
		if (str === str.toUpperCase() && str.length > 3) {
			return str.split(' ').map(w =>
				w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
			).join(' ');
		}
		return str;
	}

	const sectionIcon = (type: string) => {
		switch (type) {
			case 'step': return Scissors;
			case 'materials': return Package;
			default: return BookOpen;
		}
	};

	const sectionIconBg = (type: string) => {
		switch (type) {
			case 'step': return 'bg-rosys-50 text-rosys-500';
			case 'materials': return 'bg-emerald-50 text-emerald-500';
			default: return 'bg-warm-100 text-rosys-fg/40';
		}
	};

	interface RichLine {
		kind: 'text' | 'numbered' | 'bullet' | 'heading' | 'table-row' | 'empty' | 'dash-item' | 'note';
		text: string;
		num?: string;
		cols?: string[];
		label?: string;
		desc?: string;
	}

	function parseContent(raw: string): RichLine[] {
		const lines = raw.split('\n');
		const result: RichLine[] = [];

		for (const line of lines) {
			const trimmed = line.trim();

			if (!trimmed) {
				if (result.length > 0 && result[result.length - 1].kind !== 'empty') {
					result.push({ kind: 'empty', text: '' });
				}
				continue;
			}

			if (/^\d+(\s+\d+)*$/.test(trimmed) && trimmed.length < 20) continue;

			const noteMatch = trimmed.match(/^(NOTE|TIP|IMPORTANT|WARNING)\s*:\s*(.+)/i);
			if (noteMatch) {
				result.push({ kind: 'note', text: noteMatch[2], label: noteMatch[1].toUpperCase() });
				continue;
			}

			const numMatch = trimmed.match(/^(\d+)\.\s*(.+)/);
			if (numMatch) {
				result.push({ kind: 'numbered', text: numMatch[2], num: numMatch[1] });
				continue;
			}

			if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
				result.push({ kind: 'bullet', text: trimmed.slice(2) });
				continue;
			}

			const dashItem = trimmed.match(/^(.+?)\s+[–—-]\s+(.+)$/);
			if (dashItem && dashItem[1].length < 50 && dashItem[2].length > 10) {
				result.push({ kind: 'dash-item', text: trimmed, label: dashItem[1], desc: dashItem[2] });
				continue;
			}

			if (
				trimmed === trimmed.toUpperCase() &&
				trimmed.length < 60 &&
				trimmed.length > 3 &&
				!trimmed.match(/^\d/) &&
				!trimmed.includes(':')
			) {
				result.push({ kind: 'heading', text: titleCase(trimmed) });
				continue;
			}

			const sizeRow = trimmed.match(/^(Size|Bust|Waist|Hip|Chest|Shoulder|Sleeve\s*Length|Full\s*Length|Bottom\s*Sweep|Back\s*Width|Arm\s*Hole)\s+(.+)/i);
			if (sizeRow) {
				const vals = sizeRow[2].trim().split(/\s+/);
				if (vals.length >= 3 && vals.every(v => /^[\d.]+$/.test(v) || /^[XSML2]+$/.test(v.toUpperCase()))) {
					result.push({ kind: 'table-row', text: trimmed, cols: [sizeRow[1], ...vals] });
					continue;
				}
			}

			const tabCols = trimmed.split(/\t+/);
			if (tabCols.length >= 3) {
				result.push({ kind: 'table-row', text: trimmed, cols: tabCols });
				continue;
			}

			const kvMatch = trimmed.match(/^(.+?):\s+(.+)$/);
			if (kvMatch && kvMatch[1].length < 40) {
				result.push({ kind: 'text', text: trimmed, label: kvMatch[1], desc: kvMatch[2] });
				continue;
			}

			result.push({ kind: 'text', text: trimmed });
		}

		return result;
	}

	interface TableGroup { kind: 'table'; rows: RichLine[] }
	type GroupedItem = RichLine | TableGroup;

	function groupTableRows(lines: RichLine[]): GroupedItem[] {
		const result: GroupedItem[] = [];
		let tableBuffer: RichLine[] = [];

		for (const line of lines) {
			if (line.kind === 'table-row') {
				tableBuffer.push(line);
			} else {
				if (tableBuffer.length > 0) {
					result.push({ kind: 'table', rows: [...tableBuffer] });
					tableBuffer = [];
				}
				result.push(line);
			}
		}
		if (tableBuffer.length > 0) {
			result.push({ kind: 'table', rows: [...tableBuffer] });
		}
		return result;
	}
</script>

<svelte:head>
	<title>Instructions — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter h-full flex flex-col bg-warm-50">
	<!-- Top bar -->
	<div class="shrink-0 glass border-b border-rosys-border/30 px-5 py-3 z-20">
		<div class="flex items-center justify-between max-w-3xl mx-auto">
			<a href="/patterns/{pattern.pattern_slug}" class="flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium transition-colors">
				<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
				<span class="hidden sm:inline">{pattern.pattern_name}</span>
				<span class="sm:hidden">Back</span>
			</a>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all
						{showToc ? 'bg-rosys-500 text-white shadow-sm' : 'bg-warm-100 text-rosys-fg-muted hover:text-rosys-fg hover:bg-warm-200'}"
					onclick={() => { showToc = !showToc; showSizeChart = false; }}
				>
					<span class="flex items-center gap-1.5">
						<ListOrdered class="w-3.5 h-3.5" strokeWidth={1.5} />
						<span class="hidden sm:inline">Contents</span>
					</span>
				</button>
				{#if sizeChart}
					<button
						type="button"
						class="px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all
							{showSizeChart ? 'bg-rosys-500 text-white shadow-sm' : 'bg-warm-100 text-rosys-fg-muted hover:text-rosys-fg hover:bg-warm-200'}"
						onclick={() => { showSizeChart = !showSizeChart; showToc = false; }}
					>
						<span class="flex items-center gap-1.5">
							<Ruler class="w-3.5 h-3.5" strokeWidth={1.5} />
							Sizes
						</span>
					</button>
				{/if}
				<span class="text-[12px] text-rosys-fg-faint tabular-nums ml-1 bg-warm-50 px-2 py-0.5 rounded-md">{currentSection + 1} / {total}</span>
			</div>
		</div>
		<!-- Progress bar -->
		<div class="max-w-3xl mx-auto mt-2.5">
			<div class="w-full bg-warm-100 rounded-full h-[3px]">
				<div
					class="bg-gradient-to-r from-rosys-400 to-rosys-500 h-[3px] rounded-full transition-all duration-500 ease-out"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- TOC overlay -->
	{#if showToc}
		<div class="shrink-0 bg-white/95 backdrop-blur-md border-b border-rosys-border/30 px-5 py-4 overflow-y-auto max-h-[55vh] z-10 shadow-lg shadow-black/[0.03]">
			<div class="max-w-3xl mx-auto">
				<h3 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Table of Contents</h3>
				<div class="grid gap-0.5">
					{#each sections as sec, i}
						<button
							type="button"
							class="text-left flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-[13px]
								{i === currentSection
								? 'bg-rosys-50 text-rosys-700 font-medium'
								: 'text-rosys-fg-muted hover:bg-warm-50 hover:text-rosys-fg'}"
							onclick={() => goTo(i)}
						>
							<span class="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0
								{i < currentSection ? 'bg-emerald-50 text-emerald-500' : i === currentSection ? 'bg-rosys-100 text-rosys-600' : 'bg-warm-100 text-rosys-fg-faint'}">
								{#if i < currentSection}
									<CheckCircle2 class="w-3.5 h-3.5" strokeWidth={2} />
								{:else}
									{i + 1}
								{/if}
							</span>
							<span class="truncate">{titleCase(sec.title)}</span>
							{#if !sec.content}
								<span class="text-[10px] text-rosys-fg-faint/40 ml-auto shrink-0">header</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Size chart overlay -->
	{#if showSizeChart && sizeChart}
		<div class="shrink-0 bg-white/95 backdrop-blur-md border-b border-rosys-border/30 px-5 py-4 overflow-x-auto z-10 shadow-lg shadow-black/[0.03]">
			<div class="max-w-3xl mx-auto">
				<h3 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Size Chart</h3>
				<div class="text-[12px] text-rosys-fg-muted whitespace-pre leading-relaxed font-mono bg-warm-50 rounded-xl p-4 border border-rosys-border/30">
					{sizeChart}
				</div>
			</div>
		</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-auto">
		<div class="max-w-3xl mx-auto px-5 sm:px-8 py-8 md:py-12">
			{#key currentSection}
				{@const section = sections[currentSection]}
				{@const Icon = sectionIcon(section.type)}
				{@const parsed = parseContent(section.content)}
				{@const grouped = groupTableRows(parsed)}
				<div class="page-enter">
					<!-- Section header -->
					<div class="flex items-start gap-3.5 mb-8">
						<div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 {sectionIconBg(section.type)}">
							<Icon class="w-5 h-5" strokeWidth={1.5} />
						</div>
						<div>
							<h2 class="text-rosys-fg text-[20px] md:text-[24px] font-bold tracking-[-0.02em] leading-tight">
								{titleCase(section.title)}
							</h2>
							<p class="text-[12px] text-rosys-fg-faint mt-1">Section {currentSection + 1} of {total}</p>
						</div>
					</div>

					<!-- Rich content -->
					{#if section.content}
						<div class="instruction-content space-y-1">
							{#each grouped as item}
								{#if 'rows' in item && item.kind === 'table'}
									<!-- Table -->
									<div class="my-5 overflow-x-auto rounded-xl border border-rosys-border/40 bg-white">
										<table class="w-full text-[13px]">
											{#each item.rows as row, ri}
												<tr class="{ri === 0 ? 'bg-rosys-50/60' : ri % 2 === 0 ? 'bg-warm-50/30' : ''} border-b border-rosys-border/15 last:border-b-0">
													{#each (row as RichLine).cols || [] as cell, ci}
														{#if ri === 0}
															<th class="px-3 py-2.5 text-left text-[11px] uppercase tracking-wider text-rosys-fg-muted font-semibold">{cell.trim()}</th>
														{:else if ci === 0}
															<td class="px-3 py-2 text-rosys-fg font-medium">{cell.trim()}</td>
														{:else}
															<td class="px-3 py-2 text-rosys-fg-secondary tabular-nums">{cell.trim()}</td>
														{/if}
													{/each}
												</tr>
											{/each}
										</table>
									</div>
								{:else if (item as RichLine).kind === 'heading'}
									<h3 class="text-[15px] font-semibold text-rosys-fg pt-5 pb-1 tracking-[-0.01em]">
										{(item as RichLine).text}
									</h3>
								{:else if (item as RichLine).kind === 'note'}
									<div class="my-4 flex gap-3 px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-200/50">
										<Info class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
										<div>
											<span class="text-[11px] font-bold uppercase tracking-wider text-amber-700">{(item as RichLine).label}</span>
											<p class="text-[13px] text-amber-900/80 leading-relaxed mt-0.5">{(item as RichLine).text}</p>
										</div>
									</div>
								{:else if (item as RichLine).kind === 'numbered'}
									{@const numLine = item as RichLine}
									{@const hasDash = numLine.text.match(/^(.+?)\s+[–—-]\s+(.+)$/)}
									<div class="flex gap-3 py-1.5">
										<span class="w-6 h-6 rounded-lg bg-rosys-50 text-rosys-600 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">{numLine.num}</span>
										<p class="text-[14px] text-rosys-fg-secondary leading-relaxed flex-1">
											{#if hasDash}
												<span class="font-medium text-rosys-fg">{hasDash[1]}</span> — {hasDash[2]}
											{:else}
												{numLine.text}
											{/if}
										</p>
									</div>
								{:else if (item as RichLine).kind === 'dash-item'}
									<div class="flex gap-3 py-2 px-4 rounded-xl bg-white border border-rosys-border/25 my-1.5">
										<div class="w-1.5 h-1.5 rounded-full bg-rosys-300 mt-2.5 shrink-0"></div>
										<p class="text-[14px] leading-relaxed flex-1">
											<span class="font-medium text-rosys-fg">{(item as RichLine).label}</span>
											<span class="text-rosys-fg-muted"> — </span>
											<span class="text-rosys-fg-secondary">{(item as RichLine).desc}</span>
										</p>
									</div>
								{:else if (item as RichLine).kind === 'bullet'}
									<div class="flex gap-3 py-0.5 pl-1">
										<span class="w-1.5 h-1.5 rounded-full bg-rosys-300 mt-2.5 shrink-0"></span>
										<p class="text-[14px] text-rosys-fg-secondary leading-relaxed flex-1">{(item as RichLine).text}</p>
									</div>
								{:else if (item as RichLine).kind === 'empty'}
									<div class="h-3"></div>
								{:else}
									{@const textLine = item as RichLine}
									<p class="text-[14px] md:text-[15px] text-rosys-fg-secondary leading-[1.8]">
										{#if textLine.label && textLine.desc}
											<span class="font-medium text-rosys-fg">{textLine.label}:</span> {textLine.desc}
										{:else}
											{textLine.text}
										{/if}
									</p>
								{/if}
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center py-16 text-center">
							<div class="w-14 h-14 rounded-2xl bg-warm-100 flex items-center justify-center mb-4">
								<Info class="w-6 h-6 text-rosys-fg-faint/30" strokeWidth={1.5} />
							</div>
							<p class="text-[14px] text-rosys-fg-faint font-medium">Section header</p>
							<p class="text-[12px] text-rosys-fg-faint/50 mt-1 max-w-xs">This section marks a new part of the instructions. Tap Next to continue.</p>
						</div>
					{/if}
				</div>
			{/key}
		</div>
	</div>

	<!-- Navigation footer -->
	<div class="shrink-0 glass border-t border-rosys-border/30 px-5 py-3.5">
		<div class="max-w-3xl mx-auto flex items-center justify-between">
			<button
				type="button"
				disabled={currentSection === 0}
				onclick={prev}
				class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all
					{currentSection === 0 ? 'text-rosys-fg-faint/25 cursor-default' : 'text-rosys-fg hover:bg-warm-100 active:scale-[0.97]'}"
			>
				<ChevronLeft class="w-4 h-4" strokeWidth={1.5} />
				<span class="hidden sm:inline">Previous</span>
			</button>

			<!-- Compact progress dots -->
			<div class="flex gap-[3px] max-w-[200px] sm:max-w-[280px] overflow-hidden items-center justify-center">
				{#each sections as _, i}
					<button
						type="button"
						onclick={() => (currentSection = i)}
						class="h-[6px] rounded-full transition-all duration-300 shrink-0
							{i === currentSection ? 'bg-rosys-500 w-5' : i < currentSection ? 'bg-rosys-300 w-[6px]' : 'bg-rosys-200/60 w-[6px]'}"
					></button>
				{/each}
			</div>

			<button
				type="button"
				disabled={currentSection === total - 1}
				onclick={next}
				class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all
					{currentSection === total - 1 ? 'text-rosys-fg-faint/25 cursor-default' : 'rosys-btn-primary text-white'}"
			>
				<span class="hidden sm:inline">Next</span>
				<ChevronRight class="w-4 h-4" strokeWidth={1.5} />
			</button>
		</div>
	</div>
</div>
