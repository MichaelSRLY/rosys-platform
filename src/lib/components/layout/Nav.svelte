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

	const userInitial = $derived(
		session?.user?.email?.[0]?.toUpperCase() ?? '?'
	);
</script>

<!-- Desktop sidebar — premium floating panel -->
<div class="hidden md:block w-[260px] shrink-0">
	<aside
		class="flex flex-col h-full rounded-3xl overflow-hidden relative"
		style="
			background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(253,252,251,0.88) 100%);
			backdrop-filter: saturate(200%) blur(24px);
			-webkit-backdrop-filter: saturate(200%) blur(24px);
			box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.6) inset;
			border: 1px solid rgba(0,0,0,0.03);
		"
	>
		<!-- Brand section -->
		<div class="px-6 pt-7 pb-5">
			<div class="flex items-center gap-3">
				<div class="relative">
					<img src="/logowhite.png" alt="Rosys" class="w-10 h-10 relative z-10" />
					<div
						class="absolute inset-0 rounded-xl"
						style="box-shadow: 0 0 24px rgba(232,54,109,0.12);"
					></div>
				</div>
				<span class="text-[17px] font-bold text-rosys-fg tracking-[-0.03em]">
					Rosys Patterns
				</span>
			</div>
			<!-- Thin divider -->
			<div
				class="mt-5 h-px"
				style="background: linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent);"
			></div>
		</div>

		<!-- Nav items -->
		<nav class="flex-1 px-3 space-y-1">
			{#each navItems as item, i}
				{@const active = isActive(item.href, item.exact)}
				<a
					href={item.href}
					class="group flex items-center gap-3.5 px-4 py-[11px] rounded-2xl text-[14px] font-medium tracking-[-0.01em] transition-all duration-300 relative
						{active
						? 'text-rosys-600'
						: 'text-rosys-fg-muted hover:text-rosys-fg hover:bg-warm-50/80 active:scale-[0.98]'}"
					style={active
						? 'background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.03)); box-shadow: 0 0 0 1px rgba(232,54,109,0.06);'
						: ''}
				>
					<!-- Active accent dot -->
					{#if active}
						<div
							class="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-rosys-500"
							style="box-shadow: 0 0 8px rgba(232,54,109,0.4), 0 0 16px rgba(232,54,109,0.15);"
						></div>
					{/if}

					<item.icon
						class="w-[18px] h-[18px] transition-all duration-300 {active ? 'text-rosys-500' : 'group-hover:scale-105'}"
						strokeWidth={active ? 2 : 1.5}
					/>
					<span class={active ? 'font-semibold' : ''}>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- User section -->
		<div class="px-3 py-4 mt-auto">
			<!-- Divider -->
			<div
				class="mb-4 h-px mx-3"
				style="background: linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent);"
			></div>

			{#if session?.user}
				<div class="flex items-center gap-3 px-4 py-2.5 mb-2">
					<!-- Premium avatar with gradient ring -->
					<div
						class="p-[2px] rounded-full shrink-0"
						style="background: linear-gradient(135deg, var(--color-rosys-400), var(--color-rosys-600)); box-shadow: 0 2px 8px rgba(232,54,109,0.2);"
					>
						<div
							class="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
							style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600));"
						>
							{userInitial}
						</div>
					</div>
					<div class="min-w-0">
						<p class="text-[10px] rosys-section-label">Account</p>
						<p class="text-[12px] text-rosys-fg-secondary truncate mt-0.5">
							{session.user.email}
						</p>
					</div>
				</div>
			{/if}
			<button
				onclick={handleLogout}
				class="flex items-center gap-3 px-4 py-[10px] rounded-2xl text-[13px] font-medium text-rosys-fg-faint hover:bg-red-50/80 hover:text-red-500 transition-all duration-300 w-full active:scale-[0.98]"
			>
				<LogOut class="w-[17px] h-[17px]" strokeWidth={1.5} />
				Sign Out
			</button>
		</div>
	</aside>
</div>

<!-- Mobile tab bar — floating frosted glass -->
<nav
	class="md:hidden fixed bottom-0 left-0 right-0 z-50"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
	<div
		class="mx-4 mb-4 rounded-[22px] overflow-hidden"
		style="
			background: rgba(255, 255, 255, 0.75);
			backdrop-filter: saturate(200%) blur(32px);
			-webkit-backdrop-filter: saturate(200%) blur(32px);
			box-shadow: 0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(255,255,255,0.5) inset;
			border: 1px solid rgba(255,255,255,0.3);
		"
	>
		<div class="flex justify-around items-center h-[62px]">
			{#each navItems as item}
				{@const active = isActive(item.href, item.exact)}
				<a
					href={item.href}
					class="flex flex-col items-center justify-center gap-1 w-14 transition-all duration-300
						{active ? 'text-rosys-600' : 'text-rosys-fg-faint'}"
				>
					<item.icon
						class="transition-all duration-300 {active ? 'bounce-in' : ''}"
						size={22}
						strokeWidth={active ? 2.2 : 1.4}
					/>
					<span class="text-[10px] font-semibold tracking-[-0.01em] {active ? 'opacity-100' : 'opacity-50'}">
						{item.label}
					</span>
					{#if active}
						<div
							class="w-[5px] h-[5px] rounded-full bg-rosys-500 -mt-0.5"
							style="
								box-shadow: 0 0 8px rgba(232,54,109,0.5), 0 0 16px rgba(232,54,109,0.2);
								animation: scaleIn 0.3s var(--ease-bounce);
							"
						></div>
					{/if}
				</a>
			{/each}
		</div>
	</div>
</nav>
