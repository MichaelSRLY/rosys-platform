<script lang="ts">
	import { createClient } from '$lib/supabase';
	import { goto, invalidateAll } from '$app/navigation';

	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let username = $state('');
	let password = $state('');
	let communityKey = $state('');
	let error = $state('');
	let loading = $state(false);

	const supabase = createClient();

	async function handleLogin() {
		loading = true;
		error = '';

		const { error: err } = await supabase.auth.signInWithPassword({ email, password });
		if (err) { error = err.message; loading = false; return; }

		await invalidateAll();
		goto('/');
	}

	async function handleRegister() {
		loading = true;
		error = '';

		if (communityKey !== 'Community2025') { error = 'Invalid community key.'; loading = false; return; }
		if (password.length < 6) { error = 'Password must be at least 6 characters.'; loading = false; return; }

		const clean = username.toLowerCase().trim();
		const { data: existing } = await supabase.from('profiles').select('id').eq('username', clean).single();
		if (existing) { error = 'Username already taken.'; loading = false; return; }

		const { error: err } = await supabase.auth.signUp({
			email: email.toLowerCase().trim(),
			password,
			options: { data: { username: clean } }
		});
		if (err) { error = err.message; loading = false; return; }

		await invalidateAll();
		goto('/');
	}

	function submit(e: Event) {
		e.preventDefault();
		mode === 'login' ? handleLogin() : handleRegister();
	}
</script>

<svelte:head>
	<title>Sign In — Rosys Patterns</title>
</svelte:head>

<div class="min-h-screen bg-rosys-bg flex flex-col items-center justify-center px-6">
	<!-- Logo -->
	<div class="mb-10 text-center">
		<img src="/logowhite.png" alt="Rosys Patterns" class="w-14 h-14 mx-auto mb-5" />
		<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[28px] tracking-wide font-light">
			Rosys Patterns
		</h1>
	</div>

	<!-- Card -->
	<div class="w-full max-w-[380px]">
		<form onsubmit={submit} class="bg-rosys-card rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] p-7 space-y-5">
			<!-- Toggle -->
			<div class="flex bg-rosys-bg rounded-[10px] p-0.5">
				<button
					type="button"
					class="flex-1 py-2 rounded-[8px] text-[13px] font-medium transition-all duration-200
						{mode === 'login' ? 'bg-rosys-card shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}"
					onclick={() => (mode = 'login')}
				>Sign In</button>
				<button
					type="button"
					class="flex-1 py-2 rounded-[8px] text-[13px] font-medium transition-all duration-200
						{mode === 'register' ? 'bg-rosys-card shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}"
					onclick={() => (mode = 'register')}
				>Register</button>
			</div>

			{#if mode === 'register'}
				<div>
					<label for="username" class="block text-[12px] font-medium text-rosys-fg-faint uppercase tracking-wider mb-1.5">Username</label>
					<input id="username" type="text" bind:value={username} required
						class="w-full px-4 py-3 rounded-xl bg-rosys-bg border-none text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-fg/20 transition-shadow"
						placeholder="Choose a username" />
				</div>
			{/if}

			<div>
				<label for="email" class="block text-[12px] font-medium text-rosys-fg-faint uppercase tracking-wider mb-1.5">Email</label>
				<input id="email" type="email" bind:value={email} required
					class="w-full px-4 py-3 rounded-xl bg-rosys-bg border-none text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-fg/20 transition-shadow"
					placeholder="your@email.com" />
			</div>

			<div>
				<label for="password" class="block text-[12px] font-medium text-rosys-fg-faint uppercase tracking-wider mb-1.5">Password</label>
				<input id="password" type="password" bind:value={password} required
					class="w-full px-4 py-3 rounded-xl bg-rosys-bg border-none text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-fg/20 transition-shadow"
					placeholder="••••••" />
			</div>

			{#if mode === 'register'}
				<div>
					<label for="key" class="block text-[12px] font-medium text-rosys-fg-faint uppercase tracking-wider mb-1.5">Community Key</label>
					<input id="key" type="text" bind:value={communityKey} required
						class="w-full px-4 py-3 rounded-xl bg-rosys-bg border-none text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-fg/20 transition-shadow"
						placeholder="Enter community key" />
				</div>
			{/if}

			{#if error}
				<p class="text-rosys-pink text-[13px] font-medium">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="w-full py-3.5 rounded-xl bg-rosys-fg text-white text-[14px] font-semibold tracking-[-0.01em] hover:bg-rosys-fg/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-40"
			>
				{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
			</button>
		</form>
	</div>
</div>
