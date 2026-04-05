<script lang="ts">
	import { page } from '$app/state';
	import { createClient } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { BookOpen, Scissors, Vote, Ruler, LogOut } from 'lucide-svelte';

	let { session } = $props<{ session: any }>();

	const supabase = createClient();

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/login');
	}

	const navItems = [
		{ href: '/magazine', label: 'Magazine', icon: BookOpen },
		{ href: '/patterns', label: 'Patterns', icon: Scissors },
		{ href: '/voting', label: 'Voting', icon: Vote },
		{ href: '/size-assistant', label: 'Sizing', icon: Ruler }
	];
</script>

<!-- Desktop sidebar -->
<aside class="hidden md:flex flex-col w-64 bg-white border-r border-rosys-brown/10 h-screen sticky top-0">
	<div class="p-6 border-b border-rosys-brown/10">
		<div class="flex items-center gap-3">
			<img src="/logowhite.png" alt="Rosys" class="w-10 h-10" />
			<div>
				<h1 class="font-serif italic text-rosys-brown text-lg tracking-widest">Rosys</h1>
				<p class="text-rosys-brown/50 text-xs">Patterns Platform</p>
			</div>
		</div>
	</div>

	<nav class="flex-1 p-4 space-y-1">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
					{page.url.pathname.startsWith(item.href)
					? 'bg-rosys-cream text-rosys-brown'
					: 'text-rosys-brown/60 hover:bg-rosys-cream/50 hover:text-rosys-brown'}"
			>
				<item.icon class="w-5 h-5" />
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="p-4 border-t border-rosys-brown/10">
		<button
			onclick={handleLogout}
			class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rosys-brown/60 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
		>
			<LogOut class="w-5 h-5" />
			Sign Out
		</button>
	</div>
</aside>

<!-- Mobile bottom nav -->
<nav class="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-rosys-brown/10 z-50 pb-[env(safe-area-inset-bottom)]">
	<div class="flex justify-around py-2">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors
					{page.url.pathname.startsWith(item.href)
					? 'text-rosys-brown'
					: 'text-rosys-brown/40'}"
			>
				<item.icon class="w-5 h-5" />
				{item.label}
			</a>
		{/each}
	</div>
</nav>
