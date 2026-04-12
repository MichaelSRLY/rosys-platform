<script lang="ts">
	import { BookOpen, Scissors, Vote, Ruler, ChevronRight } from 'lucide-svelte';

	function getGreeting(): string {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 18) return 'Good afternoon';
		return 'Good evening';
	}

	const sections = [
		{
			href: '/magazine',
			title: 'Magazine',
			subtitle: 'Browse the latest edition',
			icon: BookOpen,
			iconBg: 'bg-amber-50',
			iconColor: 'text-amber-600',
			gradient: 'from-amber-50/80 to-orange-50/50',
			hoverBorder: 'hover:border-amber-200',
			meshColor: 'rgba(245,158,11,0.06)',
			glowColor: 'rgba(245,158,11,0.15)',
			iconGradient: 'linear-gradient(135deg, #fef3c7, #fde68a)'
		},
		{
			href: '/patterns',
			title: 'Patterns',
			subtitle: '130 patterns in your library',
			icon: Scissors,
			iconBg: 'bg-rosys-50',
			iconColor: 'text-rosys-600',
			gradient: 'from-rosys-50/80 to-rosys-100/50',
			hoverBorder: 'hover:border-rosys-200',
			meshColor: 'rgba(232,54,109,0.05)',
			glowColor: 'rgba(232,54,109,0.15)',
			iconGradient: 'linear-gradient(135deg, #ffe0e8, #ffc2d4)'
		},
		{
			href: '/voting',
			title: 'Voting',
			subtitle: 'Vote for the next collection',
			icon: Vote,
			iconBg: 'bg-violet-50',
			iconColor: 'text-violet-600',
			gradient: 'from-violet-50/80 to-indigo-50/50',
			hoverBorder: 'hover:border-violet-200',
			meshColor: 'rgba(139,92,246,0.05)',
			glowColor: 'rgba(139,92,246,0.15)',
			iconGradient: 'linear-gradient(135deg, #ede9fe, #ddd6fe)'
		},
		{
			href: '/size-assistant',
			title: 'Size Assistant',
			subtitle: 'AI-powered recommendations',
			icon: Ruler,
			iconBg: 'bg-emerald-50',
			iconColor: 'text-emerald-600',
			gradient: 'from-emerald-50/80 to-teal-50/50',
			hoverBorder: 'hover:border-emerald-200',
			meshColor: 'rgba(16,185,129,0.05)',
			glowColor: 'rgba(16,185,129,0.15)',
			iconGradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
		}
	];
</script>

<svelte:head>
	<title>Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-10 md:px-12 md:py-16 max-w-5xl mx-auto">
	<!-- Hero greeting -->
	<div class="mb-14" style="animation: fadeUp 0.6s var(--ease-spring) both;">
		<h1 class="text-rosys-fg text-[48px] md:text-[56px] font-extrabold leading-[1.05] tracking-[-0.04em]">
			{getGreeting()}
		</h1>
		<p class="text-rosys-fg-muted text-[16px] mt-3 tracking-[-0.01em]">
			Your sewing pattern platform
		</p>
	</div>

	<!-- Cards grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
		{#each sections as s, i}
			<a
				href={s.href}
				class="stagger-item group relative rosys-card p-7 overflow-hidden {s.hoverBorder}"
				style="--i: {i};"
			>
				<!-- Per-card mesh gradient overlay -->
				<div
					class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
					style="background: radial-gradient(ellipse at 30% 20%, {s.meshColor} 0%, transparent 60%);"
				></div>

				<!-- Content -->
				<div class="relative flex items-start justify-between">
					<div>
						<!-- Icon container with colored gradient background and glow -->
						<div
							class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-all duration-400 group-hover:scale-110 group-hover:-rotate-3"
							style="
								background: {s.iconGradient};
								box-shadow: 0 4px 12px {s.glowColor}, 0 1px 3px rgba(0,0,0,0.04);
							"
						>
							<s.icon class="w-[22px] h-[22px] {s.iconColor}" strokeWidth={1.5} />
						</div>

						<h2 class="text-[18px] font-semibold text-rosys-fg tracking-[-0.02em]">
							{s.title}
						</h2>
						<p class="text-rosys-fg-muted text-[14px] mt-1.5 leading-relaxed">
							{s.subtitle}
						</p>
					</div>

					<!-- Chevron that slides right on hover -->
					<ChevronRight
						class="w-[18px] h-[18px] text-rosys-fg-faint/20 group-hover:text-rosys-fg-faint/50 group-hover:translate-x-1 transition-all duration-400 mt-1 shrink-0"
						strokeWidth={1.5}
					/>
				</div>
			</a>
		{/each}
	</div>
</div>
