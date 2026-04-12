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

<div class="page-enter px-6 py-10 md:px-12 md:py-16 max-w-7xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col gap-8 mb-12">
		<div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
			<div>
				<h1 class="text-rosys-fg text-[32px] md:text-[40px] font-bold tracking-[-0.04em] leading-[1.1]">My Patterns</h1>
				<p class="text-rosys-fg-faint text-[14px] mt-2.5 tracking-[-0.01em]">
					{#if myPatterns.length > 0}
						{data.purchasedPatterns.length} purchased &middot; {data.freePatterns.length} free
					{:else}
						Your pattern collection
					{/if}
				</p>
			</div>

			<div class="flex items-center gap-4">
				<!-- Toggle -->
				<div class="rosys-toggle">
					<button
						type="button"
						class="rosys-toggle-item"
						data-active={!showAll}
						onclick={() => (showAll = false)}
					>My Library</button>
					<button
						type="button"
						class="rosys-toggle-item"
						data-active={showAll}
						onclick={() => (showAll = true)}
					>All Patterns</button>
				</div>

				<!-- Search -->
				<div class="relative w-64">
					<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rosys-fg-faint/50" strokeWidth={1.5} />
					<input
						type="text"
						bind:value={search}
						placeholder="Search patterns..."
						class="rosys-input !py-2.5 !pl-10 !pr-4 !text-[13px]"
					/>
				</div>
			</div>
		</div>
	</div>

	{#if !showAll && myPatterns.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center py-24 rosys-card">
			<div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-rosys-50 to-rosys-100 flex items-center justify-center mb-6 float" style="box-shadow: 0 0 40px rgba(232,54,109,0.1)">
				<Scissors class="w-7 h-7 text-rosys-400" strokeWidth={1.5} />
			</div>
			<h2 class="text-[18px] font-semibold text-rosys-fg mb-2 tracking-[-0.02em]">No patterns yet</h2>
			<p class="text-rosys-fg-faint text-[14px] text-center max-w-sm leading-relaxed mb-8">
				Your free monthly patterns and any purchased patterns will appear here.
			</p>
			<button
				type="button"
				class="rosys-btn-primary"
				style="animation: pulseSoft 2.5s ease-in-out infinite"
				onclick={() => (showAll = true)}
			>Browse All Patterns</button>
		</div>
	{:else}
		<!-- My Library: Purchased section -->
		{#if !showAll && data.purchasedPatterns.length > 0}
			<div class="mb-12">
				<div class="flex items-center gap-3 mb-6">
					<div class="w-1.5 h-1.5 rounded-full bg-rosys-500" style="box-shadow: 0 0 8px rgba(232,54,109,0.4)"></div>
					<ShoppingBag class="w-4 h-4 text-rosys-fg-muted" strokeWidth={1.5} />
					<h2 class="rosys-section-label">Purchased</h2>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
					{#each data.purchasedPatterns.filter((p) => p.pattern_name.toLowerCase().includes(search.toLowerCase())) as pattern, index (pattern.pattern_slug)}
						<div class="stagger-item" style="--i: {Math.min(index, 19)}">
							{@render patternCard(pattern, 'purchased')}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- My Library: Free patterns section -->
		{#if !showAll && data.freePatterns.length > 0}
			<div class="mb-12">
				<div class="flex items-center gap-3 mb-6">
					<div class="w-1.5 h-1.5 rounded-full bg-emerald-500" style="box-shadow: 0 0 8px rgba(16,185,129,0.4)"></div>
					<Gift class="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
					<h2 class="rosys-section-label">Free This Month</h2>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
					{#each data.freePatterns.filter((p) => p.pattern_name.toLowerCase().includes(search.toLowerCase())) as pattern, index (pattern.pattern_slug)}
						<div class="stagger-item" style="--i: {Math.min(index, 19)}">
							{@render patternCard(pattern, 'free')}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- All Patterns grid -->
		{#if showAll}
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
				{#each displayPatterns as pattern, index (pattern.pattern_slug)}
					{@const owned = myPatternSlugs.has(pattern.pattern_slug)}
					<div class="stagger-item" style="--i: {Math.min(index, 19)}">
						{@render patternCard(pattern, owned ? (isPurchased(pattern.pattern_slug) ? 'purchased' : 'free') : 'locked')}
					</div>
				{/each}
			</div>
		{/if}

		{#if displayPatterns.length === 0 && search}
			<div class="text-center py-24">
				<div class="float">
					<Scissors class="w-16 h-16 mx-auto mb-5 text-rosys-200" strokeWidth={1} />
				</div>
				<p class="text-rosys-fg-muted text-[15px] font-medium mb-1">No results</p>
				<p class="text-rosys-fg-faint text-[13px]">No patterns match "{search}"</p>
			</div>
		{/if}
	{/if}
</div>

{#snippet patternCard(pattern: typeof data.allPatterns[0], status: 'purchased' | 'free' | 'locked')}
	{@const isLocked = status === 'locked'}
	<a
		href={isLocked ? undefined : `/patterns/${pattern.pattern_slug}`}
		class="group rosys-card overflow-hidden transition-all duration-[400ms]
			{isLocked ? 'opacity-55 cursor-default' : 'hover:-translate-y-1.5'}"
		style={isLocked ? '' : 'transition-timing-function: var(--ease-spring)'}
	>
		<div class="aspect-[3/4] bg-warm-100 overflow-hidden relative">
			{#if pattern.has_finished_images}
				<img
					src={thumbUrl(pattern.pattern_slug)}
					alt={pattern.pattern_name}
					class="w-full h-full object-cover transition-transform duration-700 ease-out {isLocked ? 'blur-[2px] scale-[1.02]' : 'group-hover:scale-[1.08]'}"
					loading="lazy"
					onerror={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-10 h-10 text-rosys-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 4-6 16m-1-5H3m18-6h-5"/></svg></div>'; }}
				/>
			{:else}
				<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-warm-50 to-warm-100">
					<Scissors class="w-10 h-10 text-rosys-200" strokeWidth={1.5} />
				</div>
			{/if}

			<!-- Bottom gradient overlay for depth -->
			<div class="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/8 via-black/3 to-transparent pointer-events-none"></div>

			{#if status === 'free'}
				<div class="absolute top-2.5 left-2.5 glass-tinted px-2.5 py-1 rounded-lg text-rosys-700 text-[10px] font-bold uppercase tracking-[0.06em]"
					style="background: rgba(16, 185, 129, 0.82); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: white; border: 1px solid rgba(255,255,255,0.2);">
					Free
				</div>
			{:else if status === 'locked'}
				<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/5 via-black/10 to-black/25">
					<div class="w-12 h-12 rounded-2xl flex items-center justify-center" style="background: rgba(255,255,255,0.15); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.2);">
						<Lock class="w-5 h-5 text-white drop-shadow-lg" strokeWidth={1.5} />
					</div>
				</div>
			{/if}
		</div>

		<div class="px-3.5 py-3.5">
			<h3 class="text-[13px] font-semibold text-rosys-fg truncate leading-tight tracking-[-0.01em]">{pattern.pattern_name}</h3>
			<p class="text-[11px] text-rosys-fg-faint mt-1">
				{#if isLocked}
					Purchase to unlock
				{:else}
					{[pattern.has_instructions && 'PDF', pattern.has_a0 && 'A0', pattern.has_dxf && 'DXF'].filter(Boolean).join(' · ')}
				{/if}
			</p>
		</div>
	</a>
{/snippet}
