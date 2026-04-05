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

<!-- Desktop sidebar — clean, minimal, Apple-like -->
<aside class="hidden md:flex flex-col w-[260px] bg-rosys-card/60 backdrop-blur-xl border-r border-rosys-border h-screen sticky top-0">
	<!-- Brand -->
	<div class="px-6 pt-8 pb-6">
		<div class="flex items-center gap-3">
			<img src="/logowhite.png" alt="Rosys" class="w-9 h-9" />
			<div>
				<h1 class="font-[var(--font-display)] italic text-rosys-fg text-[17px] tracking-wide font-medium">Rosys Patterns</h1>
			</div>
		</div>
	</div>

	<!-- Nav -->
	<nav class="flex-1 px-3 space-y-0.5">
		{#each navItems as item}
			{@const active = isActive(item.href, item.exact)}
			<a
				href={item.href}
				class="flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-[13px] font-medium tracking-[-0.01em] transition-all duration-200
					{active
					? 'bg-rosys-fg text-white shadow-sm'
					: 'text-rosys-fg-muted hover:bg-rosys-bg-alt hover:text-rosys-fg'}"
			>
				<item.icon class="w-[18px] h-[18px] {active ? 'opacity-100' : 'opacity-60'}" strokeWidth={active ? 2 : 1.5} />
				{item.label}
			</a>
		{/each}
	</nav>

	<!-- User + Logout -->
	<div class="px-3 py-4 border-t border-rosys-border">
		{#if session?.user}
			<div class="px-4 py-2 mb-1">
				<p class="text-[11px] text-rosys-fg-faint uppercase tracking-widest font-medium">Signed in</p>
				<p class="text-[13px] text-rosys-fg truncate mt-0.5">{session.user.email}</p>
			</div>
		{/if}
		<button
			onclick={handleLogout}
			class="flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-rosys-fg-faint hover:bg-red-50 hover:text-red-500 transition-all duration-200 w-full"
		>
			<LogOut class="w-[18px] h-[18px] opacity-60" strokeWidth={1.5} />
			Sign Out
		</button>
	</div>
</aside>

<!-- Mobile bottom tab bar — iOS-style glass -->
<nav class="md:hidden fixed bottom-0 inset-x-0 glass border-t border-white/20 z-50 pb-[env(safe-area-inset-bottom)]">
	<div class="flex justify-around items-center h-[50px]">
		{#each navItems as item}
			{@const active = isActive(item.href, item.exact)}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center gap-0.5 w-16 transition-all duration-200
					{active ? 'text-rosys-fg' : 'text-rosys-fg-faint'}"
			>
				<item.icon class="w-[22px] h-[22px]" strokeWidth={active ? 2 : 1.5} />
				<span class="text-[10px] font-medium tracking-tight">{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
