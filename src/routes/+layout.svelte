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
	<div class="flex min-h-screen bg-rosys-bg md:py-3 md:pr-3">
		<Nav session={data.session} />
		<main class="flex-1 overflow-auto pb-24 md:pb-0 md:bg-rosys-card/40 md:rounded-2xl md:border md:border-rosys-border/30">
			{@render children()}
		</main>
	</div>
{/if}
