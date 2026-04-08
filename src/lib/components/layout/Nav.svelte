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
		{ href: '/sizing', label: 'Sizing', icon: Ruler }
	];

	function isActive(href: string, exact?: boolean) {
		if (exact) return page.url.pathname === href;
		return page.url.pathname.startsWith(href);
	}
</script>

<!-- Desktop sidebar -->
<div class="hidden md:block w-[240px] shrink-0">
	<aside class="flex flex-col h-full bg-white/90 backdrop-blur-xl rounded-2xl border border-rosys-border/40 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden mr-3">
		<!-- Brand -->
		<div class="px-5 pt-5 pb-4">
			<div class="flex items-center gap-2.5">
				<img src="/logowhite.png" alt="Rosys" class="w-8 h-8" />
				<span class="text-[16px] font-semibold text-rosys-fg tracking-[-0.02em]">
					Rosys Patterns
				</span>
			</div>
		</div>

		<!-- Nav items -->
		<nav class="flex-1 px-2.5 space-y-[2px]">
			{#each navItems as item}
				{@const active = isActive(item.href, item.exact)}
				<a
					href={item.href}
					class="flex items-center gap-3 px-3.5 py-[9px] rounded-xl text-[13px] font-medium tracking-[-0.008em] transition-all duration-150
						{active
						? 'bg-rosys-50 text-rosys-700 shadow-[0_0_0_1px_rgba(232,54,109,0.08)]'
						: 'text-rosys-fg-muted hover:bg-warm-50 hover:text-rosys-fg active:bg-warm-100'}"
				>
					<item.icon class="w-[18px] h-[18px]" strokeWidth={active ? 1.8 : 1.5} />
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- User section -->
		<div class="px-2.5 py-3 mt-auto border-t border-rosys-border/30">
			{#if session?.user}
				<div class="px-3.5 py-2 mb-1">
					<p class="text-[10px] text-rosys-fg-faint font-semibold tracking-[0.1em] uppercase">Account</p>
					<p class="text-[12px] text-rosys-fg-secondary truncate mt-0.5">{session.user.email}</p>
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

<!-- Mobile tab bar — frosted glass -->
<nav class="md:hidden fixed bottom-3 left-3 right-3 glass rounded-2xl border border-white/30 shadow-[0_4px_30px_rgba(0,0,0,0.1)] z-50">
	<div class="flex justify-around items-center h-[54px]">
		{#each navItems as item}
			{@const active = isActive(item.href, item.exact)}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center gap-[3px] w-14 transition-all duration-150
					{active ? 'text-rosys-600' : 'text-rosys-fg-faint'}"
			>
				<item.icon class="w-[21px] h-[21px]" strokeWidth={active ? 2 : 1.4} />
				<span class="text-[10px] font-medium {active ? 'opacity-100' : 'opacity-70'}">{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
