<script lang="ts">
	import { BookOpen, Scissors, Vote, Ruler } from 'lucide-svelte';

	const sections = [
		{
			href: '/magazine',
			title: 'Magazine',
			subtitle: 'Browse the latest edition',
			icon: BookOpen,
			gradient: 'from-amber-50 to-orange-50'
		},
		{
			href: '/patterns',
			title: 'Patterns',
			subtitle: '130 patterns in your library',
			icon: Scissors,
			gradient: 'from-rose-50 to-pink-50'
		},
		{
			href: '/voting',
			title: 'Voting',
			subtitle: 'Vote for the next collection',
			icon: Vote,
			gradient: 'from-violet-50 to-indigo-50'
		},
		{
			href: '/size-assistant',
			title: 'Size Assistant',
			subtitle: 'AI-powered recommendations',
			icon: Ruler,
			gradient: 'from-emerald-50 to-teal-50'
		}
	];
</script>

<svelte:head>
	<title>Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<!-- Hero -->
	<div class="mb-10">
		<h1 class="font-[var(--font-display)] italic text-rosys-fg text-[32px] md:text-[40px] font-light leading-tight tracking-tight">
			Welcome back
		</h1>
		<p class="text-rosys-fg-faint text-[15px] mt-2">Your sewing pattern platform</p>
	</div>

	<!-- Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		{#each sections as s}
			<a
				href={s.href}
				class="group relative bg-rosys-card rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-rosys-border/60 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
			>
				<div class="absolute inset-0 bg-gradient-to-br {s.gradient} opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
				<div class="relative">
					<div class="w-10 h-10 rounded-xl bg-rosys-fg/[0.06] flex items-center justify-center mb-4 group-hover:bg-rosys-fg/[0.1] transition-colors">
						<s.icon class="w-5 h-5 text-rosys-fg/70" strokeWidth={1.5} />
					</div>
					<h2 class="text-[17px] font-semibold text-rosys-fg tracking-[-0.02em]">{s.title}</h2>
					<p class="text-rosys-fg-faint text-[13px] mt-1">{s.subtitle}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
