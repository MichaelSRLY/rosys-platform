<script lang="ts">
	import { Ruler, Sparkles, Search } from 'lucide-svelte';

	let { data } = $props();
	let search = $state('');

	const filtered = $derived(
		data.patterns.filter((p) =>
			p.pattern_name.toLowerCase().includes(search.toLowerCase())
		)
	);
</script>

<svelte:head>
	<title>Find Your Size — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-5 py-8 md:px-8 md:py-12 max-w-2xl mx-auto">

	<div class="text-center mb-10">
		<div class="w-14 h-14 rounded-[18px] bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rosys-500/20">
			<Sparkles class="w-6 h-6 text-white" strokeWidth={1.5} />
		</div>
		<h1 class="text-rosys-fg text-[28px] font-bold tracking-[-0.04em] mb-2">Find Your Size</h1>
		<p class="text-rosys-fg-muted text-[15px] leading-relaxed max-w-sm mx-auto">
			Choose a pattern and our AI will analyze your measurements against the full size chart, finished garment data, and pattern pieces.
		</p>
	</div>

	<!-- Search -->
	{#if data.patterns.length > 8}
		<div class="relative mb-6">
			<Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rosys-fg-faint" strokeWidth={1.5} />
			<input type="text" placeholder="Search patterns..." bind:value={search}
				class="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-rosys-border/50 text-[14px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-400 transition-all shadow-sm" />
		</div>
	{/if}

	<!-- Pattern grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
		{#each filtered as p}
			<a href="/patterns/{p.pattern_slug}/sizing"
				class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-rosys-border/30 shadow-sm hover:shadow-md hover:border-rosys-300 transition-all active:scale-[0.98] group">
				<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rosys-100 to-rosys-200 flex items-center justify-center group-hover:from-rosys-200 group-hover:to-rosys-300 transition-colors">
					<Ruler class="w-5 h-5 text-rosys-500" strokeWidth={1.5} />
				</div>
				<p class="text-[13px] font-medium text-rosys-fg text-center leading-tight">{p.pattern_name}</p>
			</a>
		{/each}
	</div>

	{#if filtered.length === 0}
		<div class="text-center py-12">
			<p class="text-rosys-fg-faint text-[14px]">No patterns found with size charts.</p>
		</div>
	{/if}
</div>
