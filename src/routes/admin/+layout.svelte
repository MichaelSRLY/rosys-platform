<script lang="ts">
	import { page } from '$app/state';
	import { Scissors, BookOpen, Shield, ArrowLeft, Settings } from 'lucide-svelte';

	let { children } = $props();

	const navItems = [
		{ href: '/admin', label: 'Dashboard', icon: Shield, exact: true },
		{ href: '/admin/patterns', label: 'Patterns', icon: Scissors },
		{ href: '/admin/editions', label: 'Editions & Rounds', icon: BookOpen }
	];

	function isActive(href: string, exact?: boolean) {
		if (exact) return page.url.pathname === href;
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="h-full flex flex-col">
	<!-- Admin top bar -->
	<div class="shrink-0 bg-rosys-fg text-white px-5 py-2.5 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a href="/" class="flex items-center gap-1.5 text-white/60 hover:text-white text-[12px] transition-colors">
				<ArrowLeft class="w-3.5 h-3.5" strokeWidth={1.5} />
				App
			</a>
			<div class="w-px h-4 bg-white/20"></div>
			<div class="flex items-center gap-2">
				<Shield class="w-4 h-4 text-amber-400" strokeWidth={2} />
				<span class="text-[13px] font-semibold tracking-[-0.01em]">Admin Panel</span>
			</div>
		</div>
		<nav class="flex items-center gap-1">
			{#each navItems as item}
				{@const active = isActive(item.href, item.exact)}
				<a href={item.href}
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
						{active ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}">
					<item.icon class="w-3.5 h-3.5" strokeWidth={1.5} />
					{item.label}
				</a>
			{/each}
		</nav>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto bg-rosys-bg">
		{@render children()}
	</div>
</div>
