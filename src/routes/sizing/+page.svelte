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

<div class="page-enter mesh-bg min-h-screen px-5 py-10 md:px-8 md:py-14 max-w-2xl mx-auto">

	<!-- Hero -->
	<div class="text-center mb-12" style="animation: fadeUp 0.55s var(--ease-spring) both;">
		<div class="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mx-auto mb-6 float"
			style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-glow-rose), var(--shadow-brand-lg);">
			<Sparkles class="w-8 h-8 text-white" strokeWidth={1.5} />
		</div>
		<h1 class="text-rosys-fg text-[32px] font-bold tracking-[-0.04em] mb-3">Find Your Size</h1>
		<p class="text-rosys-fg-muted text-[16px] leading-relaxed max-w-md mx-auto">
			Choose a pattern and our AI will analyze your measurements against the full size chart, finished garment data, and pattern pieces.
		</p>
	</div>

	<!-- Search -->
	{#if data.patterns.length > 8}
		<div class="relative mb-8" style="animation: fadeUp 0.45s var(--ease-spring) 0.1s both;">
			<Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-rosys-fg-faint" strokeWidth={1.5} />
			<input type="text" placeholder="Search patterns..." bind:value={search}
				class="rosys-input pl-12" />
		</div>
	{/if}

	<!-- Pattern grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
		{#each filtered as p, i}
			<a href="/patterns/{p.pattern_slug}/sizing"
				class="stagger-scale rosys-card flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 active:scale-[0.97] group"
				style="--i: {i};"
			>
				<div class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-400 group-hover:scale-110 group-hover:-rotate-3"
					style="background: linear-gradient(135deg, var(--color-rosys-100), var(--color-rosys-200)); box-shadow: 0 2px 8px rgba(232,54,109,0.08);">
					<Ruler class="w-5 h-5 text-rosys-500" strokeWidth={1.5} />
				</div>
				<p class="text-[14px] font-semibold text-rosys-fg text-center leading-tight">{p.pattern_name}</p>
			</a>
		{/each}
	</div>

	{#if filtered.length === 0}
		<div class="text-center py-20">
			<div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
				style="background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.02)); border: 1px solid rgba(232,54,109,0.08);">
				<Ruler class="w-6 h-6 text-rosys-300" strokeWidth={1.5} />
			</div>
			<p class="text-rosys-fg text-[15px] font-medium mb-1">No patterns found</p>
			<p class="text-rosys-fg-faint text-[14px]">Try a different search term.</p>
		</div>
	{/if}
</div>
