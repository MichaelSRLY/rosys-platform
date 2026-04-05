<script lang="ts">
	import { Scissors, FileText, Image, Box } from 'lucide-svelte';

	let { data } = $props();
	let search = $state('');

	const STORAGE_BASE = 'https://lahzrlyhojyfadjasdrc.supabase.co/storage/v1/object/public/pattern-files';

	const filteredPatterns = $derived(
		data.patterns.filter((p) =>
			p.pattern_name.toLowerCase().includes(search.toLowerCase())
		)
	);

	function getImageUrl(slug: string, name: string): string {
		const cleanName = name.toLowerCase().replace(/\s+/g, '_');
		return `${STORAGE_BASE}/${slug}/finished_${cleanName}_images/finished_${cleanName}_front.webp`;
	}
</script>

<svelte:head>
	<title>Patterns — Rosys Patterns</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-serif italic text-rosys-brown">Pattern Library</h1>
			<p class="text-rosys-brown/60 text-sm mt-1">{data.patterns.length} patterns available</p>
		</div>
	</div>

	<!-- Search -->
	<div class="mb-6">
		<input
			type="text"
			bind:value={search}
			placeholder="Search patterns..."
			class="w-full max-w-md px-4 py-3 rounded-xl border border-rosys-brown/15 bg-white focus:outline-none focus:ring-2 focus:ring-rosys-brown/30"
		/>
	</div>

	<!-- Pattern Grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
		{#each filteredPatterns as pattern (pattern.pattern_slug)}
			<a
				href="/patterns/{pattern.pattern_slug}"
				class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-rosys-brown/10 group"
			>
				<!-- Thumbnail -->
				<div class="aspect-[3/4] bg-rosys-cream overflow-hidden">
					{#if pattern.has_finished_images}
						<img
							src={getImageUrl(pattern.pattern_slug, pattern.pattern_name)}
							alt={pattern.pattern_name}
							class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
							loading="lazy"
							onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
						/>
					{:else}
						<div class="w-full h-full flex items-center justify-center">
							<Scissors class="w-12 h-12 text-rosys-brown/20" />
						</div>
					{/if}
				</div>

				<!-- Info -->
				<div class="p-3">
					<h3 class="font-medium text-rosys-brown text-sm truncate">{pattern.pattern_name}</h3>
					<div class="flex gap-2 mt-2">
						{#if pattern.has_instructions}
							<FileText class="w-3.5 h-3.5 text-rosys-brown/40" />
						{/if}
						{#if pattern.has_a0}
							<Box class="w-3.5 h-3.5 text-rosys-brown/40" />
						{/if}
						{#if pattern.has_finished_images}
							<Image class="w-3.5 h-3.5 text-rosys-brown/40" />
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>

	{#if filteredPatterns.length === 0}
		<div class="text-center py-12 text-rosys-brown/50">
			<Scissors class="w-12 h-12 mx-auto mb-3 opacity-30" />
			<p>No patterns found for "{search}"</p>
		</div>
	{/if}
</div>
