<script lang="ts">
	import { Scissors, BookOpen, Link, Database, Gift, Layers } from 'lucide-svelte';

	let { data } = $props();
</script>

<svelte:head><title>Admin — Rosys Patterns</title></svelte:head>

<div class="page-enter px-6 py-8 max-w-5xl mx-auto">
	<h1 class="text-[24px] font-bold text-rosys-fg mb-6">Dashboard</h1>

	<!-- Stats grid -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
		<div class="bg-rosys-card rounded-xl border border-rosys-border/40 p-4 shadow-sm">
			<div class="flex items-center gap-2 mb-2">
				<Database class="w-4 h-4 text-blue-500" strokeWidth={1.5} />
				<span class="text-[11px] text-rosys-fg-faint font-semibold uppercase tracking-wider">Catalog</span>
			</div>
			<p class="text-[28px] font-bold text-rosys-fg">{data.catalogTotal}</p>
			<p class="text-[12px] text-rosys-fg-faint">{data.catalogEmbedded} embedded</p>
		</div>
		<div class="bg-rosys-card rounded-xl border border-rosys-border/40 p-4 shadow-sm">
			<div class="flex items-center gap-2 mb-2">
				<Scissors class="w-4 h-4 text-amber-500" strokeWidth={1.5} />
				<span class="text-[11px] text-rosys-fg-faint font-semibold uppercase tracking-wider">Configured</span>
			</div>
			<p class="text-[28px] font-bold text-rosys-fg">{data.adminConfigured}</p>
			<p class="text-[12px] text-rosys-fg-faint">of {data.catalogTotal} patterns</p>
		</div>
		<div class="bg-rosys-card rounded-xl border border-rosys-border/40 p-4 shadow-sm">
			<div class="flex items-center gap-2 mb-2">
				<Link class="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
				<span class="text-[11px] text-rosys-fg-faint font-semibold uppercase tracking-wider">Shopify Links</span>
			</div>
			<p class="text-[28px] font-bold text-rosys-fg">{data.productLinks}</p>
			<p class="text-[12px] text-rosys-fg-faint">product mappings</p>
		</div>
		<div class="bg-rosys-card rounded-xl border border-rosys-border/40 p-4 shadow-sm">
			<div class="flex items-center gap-2 mb-2">
				<Gift class="w-4 h-4 text-pink-500" strokeWidth={1.5} />
				<span class="text-[11px] text-rosys-fg-faint font-semibold uppercase tracking-wider">Free Rounds</span>
			</div>
			<p class="text-[28px] font-bold text-rosys-fg">{data.roundCount}</p>
			<p class="text-[12px] text-rosys-fg-faint">{data.activeRounds.length} active</p>
		</div>
	</div>

	<!-- Active free pattern rounds -->
	{#if data.activeRounds.length > 0}
		<div class="bg-rosys-card rounded-2xl border border-emerald-200/50 p-5 mb-8 shadow-sm">
			<h2 class="text-[14px] font-semibold text-rosys-fg mb-3 flex items-center gap-2">
				<Gift class="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
				Active Free Pattern Rounds
			</h2>
			{#each data.activeRounds as round}
				<div class="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
					<div>
						<p class="text-[14px] font-medium text-rosys-fg">{round.round_name}</p>
						<p class="text-[12px] text-emerald-600">{round.pattern_slugs?.length || 0} patterns</p>
					</div>
					<div class="flex gap-1.5">
						{#each round.pattern_slugs || [] as slug}
							<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-[11px] font-medium text-emerald-700">{slug.replace(/^\d+_/, '')}</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Recent editions -->
	<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
		<h2 class="text-[14px] font-semibold text-rosys-fg mb-3 flex items-center gap-2">
			<BookOpen class="w-4 h-4 text-violet-500" strokeWidth={1.5} />
			Recent Editions
		</h2>
		<div class="space-y-2">
			{#each data.editions as edition}
				<div class="flex items-center justify-between p-3 bg-rosys-bg rounded-xl">
					<div>
						<p class="text-[14px] font-medium text-rosys-fg">{edition.name}</p>
						<p class="text-[12px] text-rosys-fg-faint">{edition.month_label} {edition.year}</p>
					</div>
					<span class="px-2.5 py-1 rounded-lg text-[11px] font-semibold
						{edition.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
						 edition.status === 'review' ? 'bg-amber-100 text-amber-700' :
						 'bg-slate-100 text-slate-600'}">{edition.status}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
