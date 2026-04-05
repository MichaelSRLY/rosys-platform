<script lang="ts">
	import { Scissors, Search, Gift, ShoppingBag, Lock } from 'lucide-svelte';

	let { data } = $props();
	let search = $state('');
	let showAll = $state(false);

	const myPatterns = $derived([...data.purchasedPatterns, ...data.freePatterns]);
	const myPatternSlugs = $derived(new Set(myPatterns.map((p) => p.pattern_slug)));

	const displayPatterns = $derived(
		showAll
			? data.allPatterns.filter((p) =>
					p.pattern_name.toLowerCase().includes(search.toLowerCase())
				)
			: myPatterns.filter((p) =>
					p.pattern_name.toLowerCase().includes(search.toLowerCase())
				)
	);

	function thumbUrl(slug: string): string {
		return data.thumbnails[slug] || '';
	}

	function isPurchased(slug: string): boolean {
		return data.purchasedPatterns.some((p) => p.pattern_slug === slug);
	}

	function isFree(slug: string): boolean {
		return data.freePatterns.some((p) => p.pattern_slug === slug);
	}
</script>

<svelte:head>
	<title>Patterns — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
		<div>
			<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[28px] font-light tracking-tight">My Patterns</h1>
			<p class="text-rosys-fg-faint text-[14px] mt-1">
				{#if myPatterns.length > 0}
					{data.purchasedPatterns.length} purchased · {data.freePatterns.length} free
				{:else}
					Your pattern collection
				{/if}
			</p>
		</div>

		<div class="flex items-center gap-3">
			<!-- Toggle -->
			<div class="flex bg-rosys-bg-alt rounded-xl p-0.5">
				<button
					type="button"
					class="px-4 py-1.5 rounded-[10px] text-[12px] font-medium transition-all duration-150
						{!showAll ? 'bg-rosys-card shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}"
					onclick={() => (showAll = false)}
				>My Library</button>
				<button
					type="button"
					class="px-4 py-1.5 rounded-[10px] text-[12px] font-medium transition-all duration-150
						{showAll ? 'bg-rosys-card shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}"
					onclick={() => (showAll = true)}
				>All Patterns</button>
			</div>

			<!-- Search -->
			<div class="relative w-56">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rosys-fg-faint/60" strokeWidth={1.5} />
				<input
					type="text"
					bind:value={search}
					placeholder="Search..."
					class="w-full pl-9 pr-4 py-2 rounded-xl bg-rosys-card border border-rosys-border text-[13px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-fg/15 focus:border-transparent transition-all"
				/>
			</div>
		</div>
	</div>

	{#if !showAll && myPatterns.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center py-20 bg-rosys-card rounded-3xl border border-rosys-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
			<div class="w-16 h-16 rounded-2xl bg-rosys-bg-alt flex items-center justify-center mb-5">
				<Scissors class="w-7 h-7 text-rosys-fg/20" strokeWidth={1.5} />
			</div>
			<h2 class="text-[17px] font-semibold text-rosys-fg mb-1">No patterns yet</h2>
			<p class="text-rosys-fg-faint text-[14px] text-center max-w-sm">
				Your free monthly patterns and any purchased patterns will appear here.
			</p>
			<button
				type="button"
				class="mt-5 px-5 py-2.5 rounded-xl bg-rosys-fg text-white text-[13px] font-medium hover:bg-rosys-fg/90 active:scale-[0.98] transition-all"
				onclick={() => (showAll = true)}
			>Browse All Patterns</button>
		</div>
	{:else}
		<!-- My Library: Purchased section -->
		{#if !showAll && data.purchasedPatterns.length > 0}
			<div class="mb-8">
				<div class="flex items-center gap-2 mb-4">
					<ShoppingBag class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
					<h2 class="text-[12px] font-semibold text-rosys-fg-muted uppercase tracking-[0.08em]">Purchased</h2>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
					{#each data.purchasedPatterns.filter((p) => p.pattern_name.toLowerCase().includes(search.toLowerCase())) as pattern (pattern.pattern_slug)}
						{@render patternCard(pattern, 'purchased')}
					{/each}
				</div>
			</div>
		{/if}

		<!-- My Library: Free patterns section -->
		{#if !showAll && data.freePatterns.length > 0}
			<div class="mb-8">
				<div class="flex items-center gap-2 mb-4">
					<Gift class="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
					<h2 class="text-[12px] font-semibold text-rosys-fg-muted uppercase tracking-[0.08em]">Free This Month</h2>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
					{#each data.freePatterns.filter((p) => p.pattern_name.toLowerCase().includes(search.toLowerCase())) as pattern (pattern.pattern_slug)}
						{@render patternCard(pattern, 'free')}
					{/each}
				</div>
			</div>
		{/if}

		<!-- All Patterns grid -->
		{#if showAll}
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
				{#each displayPatterns as pattern (pattern.pattern_slug)}
					{@const owned = myPatternSlugs.has(pattern.pattern_slug)}
					{@render patternCard(pattern, owned ? (isPurchased(pattern.pattern_slug) ? 'purchased' : 'free') : 'locked')}
				{/each}
			</div>
		{/if}

		{#if displayPatterns.length === 0 && search}
			<div class="text-center py-16">
				<Scissors class="w-10 h-10 mx-auto mb-3 text-rosys-fg/10" strokeWidth={1.5} />
				<p class="text-rosys-fg-faint text-[14px]">No patterns match "{search}"</p>
			</div>
		{/if}
	{/if}
</div>

{#snippet patternCard(pattern: typeof data.allPatterns[0], status: 'purchased' | 'free' | 'locked')}
	{@const isLocked = status === 'locked'}
	<a
		href={isLocked ? undefined : `/patterns/${pattern.pattern_slug}`}
		class="group bg-rosys-card rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-rosys-border/50 transition-all duration-300
			{isLocked ? 'opacity-60 cursor-default' : 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:-translate-y-1'}"
	>
		<div class="aspect-[3/4] bg-rosys-bg-alt overflow-hidden relative">
			{#if pattern.has_finished_images}
				<img
					src={thumbUrl(pattern.pattern_slug)}
					alt={pattern.pattern_name}
					class="w-full h-full object-cover {isLocked ? 'blur-[2px]' : 'group-hover:scale-[1.04]'} transition-transform duration-500 ease-out"
					loading="lazy"
					onerror={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-10 h-10 text-rosys-fg/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 4-6 16m-1-5H3m18-6h-5"/></svg></div>'; }}
				/>
			{:else}
				<div class="w-full h-full flex items-center justify-center">
					<Scissors class="w-10 h-10 text-rosys-fg/10" strokeWidth={1.5} />
				</div>
			{/if}

			<!-- Status badge -->
			{#if status === 'free'}
				<div class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-semibold uppercase tracking-wider">
					Free
				</div>
			{:else if status === 'locked'}
				<div class="absolute inset-0 flex items-center justify-center bg-black/10">
					<Lock class="w-6 h-6 text-white/80 drop-shadow" strokeWidth={1.5} />
				</div>
			{/if}
		</div>

		<div class="px-3 py-3">
			<h3 class="text-[13px] font-medium text-rosys-fg truncate leading-tight">{pattern.pattern_name}</h3>
			<p class="text-[11px] text-rosys-fg-faint mt-0.5">
				{#if isLocked}
					Purchase to unlock
				{:else}
					{[pattern.has_instructions && 'PDF', pattern.has_a0 && 'A0', pattern.has_dxf && 'DXF'].filter(Boolean).join(' · ')}
				{/if}
			</p>
		</div>
	</a>
{/snippet}
