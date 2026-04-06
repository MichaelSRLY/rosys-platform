<script lang="ts">
	import { page } from '$app/state';
	import { createClient } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { BookOpen, Scissors, Vote, Ruler, LogOut, Home } from 'lucide-svelte';

	let { session } = $props<{ session: any }>();
	const supabase = createClient();

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/login');
	}

	const navItems = [
		{ href: '/', label: 'Home', icon: Home, exact: true },
		{ href: '/magazine', label: 'Magazine', icon: BookOpen },
		{ href: '/patterns', label: 'Patterns', icon: Scissors },
		{ href: '/voting', label: 'Voting', icon: Vote },
		{ href: '/size-assistant', label: 'Sizing', icon: Ruler }
	];

	function isActive(href: string, exact?: boolean) {
		if (exact) return page.url.pathname === href;
		return page.url.pathname.startsWith(href);
	}
</script>

<!-- Desktop sidebar -->
<div class="hidden md:block w-[260px] shrink-0">
	<aside class="flex flex-col h-full bg-white/80 backdrop-blur-xl rounded-2xl border border-warm-200/50 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden mr-3">
		<div class="px-5 pt-6 pb-4">
			<div class="flex items-center gap-3">
				<div class="rosys-section-icon w-8 h-8 rounded-xl">
					<img src="/logowhite.png" alt="Rosys" class="w-5 h-5" />
				</div>
				<span class="text-[17px] font-semibold text-rosys-fg tracking-tight">Rosys Patterns</span>
			</div>
		</div>

		<nav class="flex-1 px-2.5 space-y-[2px]">
			{#each navItems as item}
				{@const active = isActive(item.href, item.exact)}
				<a
					href={item.href}
					class="flex items-center gap-3 px-3.5 py-[9px] rounded-xl text-[13px] font-medium tracking-[-0.008em] transition-all duration-150
						{active
						? 'bg-gradient-to-r from-rosys-500 to-rosys-600 text-white shadow-sm'
						: 'text-rosys-fg-muted hover:bg-warm-100 hover:text-rosys-fg'}"
				>
					<item.icon class="w-[18px] h-[18px]" strokeWidth={active ? 1.8 : 1.5} />
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="px-2.5 py-3 mt-auto border-t border-warm-200/40">
			{#if session?.user}
				<div class="px-3.5 py-2 mb-1">
					<p class="text-[11px] text-rosys-fg-faint font-medium tracking-wide uppercase">Account</p>
					<p class="text-[13px] text-rosys-fg-secondary truncate mt-0.5">{session.user.email}</p>
				</div>
			{/if}
			<button
				onclick={handleLogout}
				class="flex items-center gap-3 px-3.5 py-[9px] rounded-xl text-[13px] font-medium text-rosys-fg-faint hover:bg-red-50 hover:text-red-500 transition-all duration-150 w-full"
			>
				<LogOut class="w-[18px] h-[18px]" strokeWidth={1.5} />
				Sign Out
			</button>
		</div>
	</aside>
</div>

<!-- Mobile tab bar -->
<nav class="md:hidden fixed bottom-3 left-3 right-3 glass rounded-2xl border border-white/30 shadow-[0_4px_30px_rgba(0,0,0,0.1)] z-50">
	<div class="flex justify-around items-center h-[54px]">
		{#each navItems as item}
			{@const active = isActive(item.href, item.exact)}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center gap-[3px] w-14 transition-all duration-150
					{active ? 'text-rosys-500' : 'text-rosys-fg-faint'}"
			>
				<item.icon class="w-[21px] h-[21px]" strokeWidth={active ? 2 : 1.4} />
				<span class="text-[10px] font-medium">{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
