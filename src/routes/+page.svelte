<script lang="ts">
	import { BookOpen, Scissors, Vote, Ruler } from 'lucide-svelte';

	const sections = [
		{
			href: '/magazine',
			title: 'Magazine',
			subtitle: 'Browse the latest edition',
			icon: BookOpen,
			iconBg: 'bg-amber-50',
			iconColor: 'text-amber-600',
			gradient: 'from-amber-50/60 to-orange-50/40'
		},
		{
			href: '/patterns',
			title: 'Patterns',
			subtitle: '130 patterns in your library',
			icon: Scissors,
			iconBg: 'bg-rosys-50',
			iconColor: 'text-rosys-600',
			gradient: 'from-rosys-50/60 to-rosys-100/40'
		},
		{
			href: '/voting',
			title: 'Voting',
			subtitle: 'Vote for the next collection',
			icon: Vote,
			iconBg: 'bg-violet-50',
			iconColor: 'text-violet-600',
			gradient: 'from-violet-50/60 to-indigo-50/40'
		},
		{
			href: '/size-assistant',
			title: 'Size Assistant',
			subtitle: 'AI-powered recommendations',
			icon: Ruler,
			iconBg: 'bg-emerald-50',
			iconColor: 'text-emerald-600',
			gradient: 'from-emerald-50/60 to-teal-50/40'
		}
	];
</script>

<svelte:head>
	<title>Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<!-- Hero -->
	<div class="mb-10">
		<h1 class="text-rosys-fg text-[28px] md:text-[36px] font-bold leading-tight tracking-[-0.03em]">
			Welcome back
		</h1>
		<p class="text-rosys-fg-faint text-[14px] mt-1.5">Your sewing pattern platform</p>
	</div>

	<!-- Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		{#each sections as s}
			<a
				href={s.href}
				class="group relative rosys-card p-6 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
			>
				<div class="absolute inset-0 bg-gradient-to-br {s.gradient} opacity-50 group-hover:opacity-80 transition-opacity duration-300"></div>
				<div class="relative">
					<div class="w-10 h-10 rounded-xl {s.iconBg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
						<s.icon class="w-5 h-5 {s.iconColor}" strokeWidth={1.5} />
					</div>
					<h2 class="text-[16px] font-semibold text-rosys-fg tracking-[-0.02em]">{s.title}</h2>
					<p class="text-rosys-fg-faint text-[13px] mt-1">{s.subtitle}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
