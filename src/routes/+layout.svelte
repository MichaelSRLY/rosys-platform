<script lang="ts">
	import '../app.css';
	import { createClient } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Nav from '$lib/components/layout/Nav.svelte';

	let { children, data } = $props();

	const supabase = createClient();

	const isLoginPage = $derived(page.url.pathname.startsWith('/login'));

	onMount(() => {
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_, session) => {
			if (session?.expires_at !== data.session?.expires_at) {
				invalidateAll();
			}
		});

		return () => subscription.unsubscribe();
	});
</script>

{#if isLoginPage}
	{@render children()}
{:else}
	<div class="grain h-screen md:p-4 md:flex md:gap-3 overflow-hidden mesh-bg">
		<!-- Sidebar wrapper with floating depth -->
		<Nav session={data.session} />

		<!-- Main content area with glass effect -->
		<main
			class="flex-1 overflow-auto pb-24 md:pb-0 md:rounded-3xl md:border md:border-white/60 relative"
			style="
				background: linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%);
				backdrop-filter: saturate(180%) blur(20px);
				-webkit-backdrop-filter: saturate(180%) blur(20px);
				box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.5) inset;
			"
		>
			{@render children()}
		</main>
	</div>
{/if}
