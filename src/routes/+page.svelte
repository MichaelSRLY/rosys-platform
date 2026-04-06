<script lang="ts">
	import { BookOpen, Scissors, Vote, Ruler } from 'lucide-svelte';

	const sections = [
		{ href: '/magazine', title: 'Magazine', subtitle: 'Browse the latest edition', icon: BookOpen, color: 'from-rosys-400/20 to-rosys-500/10' },
		{ href: '/patterns', title: 'Patterns', subtitle: '130 patterns in your library', icon: Scissors, color: 'from-amber-400/20 to-amber-500/10' },
		{ href: '/voting', title: 'Voting', subtitle: 'Vote for the next collection', icon: Vote, color: 'from-violet-400/20 to-violet-500/10' },
		{ href: '/size-assistant', title: 'Size Assistant', subtitle: 'AI-powered recommendations', icon: Ruler, color: 'from-emerald-400/20 to-emerald-500/10' }
	];
</script>

<svelte:head><title>Rosys Patterns</title></svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<div class="mb-10">
		<h1 class="text-[32px] md:text-[40px] font-bold text-rosys-fg leading-tight tracking-tight">Welcome back</h1>
		<p class="text-rosys-fg-faint text-[15px] mt-2">Your sewing pattern platform</p>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		{#each sections as s}
			<a href={s.href} class="rosys-card group relative p-6 overflow-hidden hover:-translate-y-0.5 transition-all duration-300">
				<div class="absolute inset-0 bg-gradient-to-br {s.color} opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
				<div class="relative">
					<div class="rosys-section-icon mb-4">
						<s.icon class="w-5 h-5" strokeWidth={1.5} />
					</div>
					<h2 class="text-[17px] font-semibold text-rosys-fg tracking-tight">{s.title}</h2>
					<p class="text-rosys-fg-faint text-[13px] mt-1">{s.subtitle}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
