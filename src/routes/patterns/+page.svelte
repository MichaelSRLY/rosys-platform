<script lang="ts">
	import { Scissors, Search } from 'lucide-svelte';

	let { data } = $props();
	let search = $state('');

	const STORAGE_BASE = 'https://lahzrlyhojyfadjasdrc.supabase.co/storage/v1/object/public/pattern-files';

	const filteredPatterns = $derived(
		data.patterns.filter((p) =>
			p.pattern_name.toLowerCase().includes(search.toLowerCase())
		)
	);

	function thumbUrl(slug: string, name: string): string {
		const clean = name.toLowerCase().replace(/\s+/g, '_');
		return `${STORAGE_BASE}/${slug}/finished_${clean}_images/finished_${clean}_front.webp`;
	}
</script>

<svelte:head>
	<title>Patterns — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
		<div>
			<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[28px] font-light tracking-tight">Patterns</h1>
			<p class="text-rosys-fg-faint text-[14px] mt-1">{data.patterns.length} designs in your library</p>
		</div>

		<!-- Search -->
		<div class="relative w-full sm:w-72">
			<Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rosys-fg-faint/60" strokeWidth={1.5} />
			<input
				type="text"
				bind:value={search}
				placeholder="Search patterns..."
				class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-rosys-card border border-rosys-border text-[14px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-fg/15 focus:border-transparent transition-all"
			/>
		</div>
	</div>

	<!-- Grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
		{#each filteredPatterns as pattern (pattern.pattern_slug)}
			<a
				href="/patterns/{pattern.pattern_slug}"
				class="group bg-rosys-card rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] border border-rosys-border/50 transition-all duration-300 hover:-translate-y-1"
			>
				<div class="aspect-[3/4] bg-rosys-bg-alt overflow-hidden">
					{#if pattern.has_finished_images}
						<img
							src={thumbUrl(pattern.pattern_slug, pattern.pattern_name)}
							alt={pattern.pattern_name}
							class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
							loading="lazy"
							onerror={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-10 h-10 text-rosys-fg/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 4-6 16m-1-5H3m18-6h-5"/></svg></div>'; }}
						/>
					{:else}
						<div class="w-full h-full flex items-center justify-center">
							<Scissors class="w-10 h-10 text-rosys-fg/10" strokeWidth={1.5} />
						</div>
					{/if}
				</div>
				<div class="px-3 py-3">
					<h3 class="text-[13px] font-medium text-rosys-fg truncate leading-tight">{pattern.pattern_name}</h3>
					<p class="text-[11px] text-rosys-fg-faint mt-0.5">
						{[pattern.has_instructions && 'PDF', pattern.has_a0 && 'A0', pattern.has_dxf && 'DXF'].filter(Boolean).join(' · ')}
					</p>
				</div>
			</a>
		{/each}
	</div>

	{#if filteredPatterns.length === 0}
		<div class="text-center py-20">
			<Scissors class="w-12 h-12 mx-auto mb-4 text-rosys-fg/10" strokeWidth={1.5} />
			<p class="text-rosys-fg-faint text-[15px]">No patterns match "{search}"</p>
		</div>
	{/if}
</div>
