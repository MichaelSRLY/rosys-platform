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

<!-- Desktop sidebar — fixed floating panel -->
<div class="hidden md:block w-[260px] shrink-0">
	<aside class="flex flex-col h-full bg-rosys-card/80 backdrop-blur-xl rounded-2xl border border-rosys-border/50 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden mr-3">
		<!-- Brand -->
		<div class="px-5 pt-6 pb-4">
			<div class="flex items-center gap-3">
				<img src="/logowhite.png" alt="Rosys" class="w-8 h-8" />
				<span class="font-[var(--font-logo)] italic text-rosys-fg text-[18px] font-medium tracking-[0.01em]">
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
						? 'bg-rosys-fg text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
						: 'text-rosys-fg-muted hover:bg-black/[0.04] hover:text-rosys-fg active:bg-black/[0.06]'}"
				>
					<item.icon class="w-[18px] h-[18px]" strokeWidth={active ? 1.8 : 1.5} />
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- User section -->
		<div class="px-2.5 py-3 mt-auto border-t border-rosys-border/40">
			{#if session?.user}
				<div class="px-3.5 py-2 mb-1">
					<p class="text-[11px] text-rosys-fg-faint font-medium tracking-wide uppercase">Account</p>
					<p class="text-[13px] text-rosys-fg-secondary truncate mt-0.5">{session.user.email}</p>
				</div>
			{/if}
			<button
				onclick={handleLogout}
				class="flex items-center gap-3 px-3.5 py-[9px] rounded-xl text-[13px] font-medium text-rosys-fg-faint hover:bg-red-500/[0.06] hover:text-red-500 transition-all duration-150 w-full"
			>
				<LogOut class="w-[18px] h-[18px]" strokeWidth={1.5} />
				Sign Out
			</button>
		</div>
	</aside>
</div>

<!-- Mobile tab bar — frosted glass, floating -->
<nav class="md:hidden fixed bottom-3 left-3 right-3 glass rounded-2xl border border-white/30 shadow-[0_4px_30px_rgba(0,0,0,0.1)] z-50">
	<div class="flex justify-around items-center h-[54px]">
		{#each navItems as item}
			{@const active = isActive(item.href, item.exact)}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center gap-[3px] w-14 transition-all duration-150
					{active ? 'text-rosys-fg' : 'text-rosys-fg-faint'}"
			>
				<item.icon class="w-[21px] h-[21px]" strokeWidth={active ? 2 : 1.4} />
				<span class="text-[10px] font-medium {active ? 'opacity-100' : 'opacity-70'}">{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
