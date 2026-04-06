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

<div class="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6">
	<!-- Accent bar -->
	<div class="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-rosys-400 via-rosys-500 to-rosys-600"></div>

	<!-- Logo -->
	<div class="mb-10 text-center">
		<div class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-rosys-500 to-rosys-600 flex items-center justify-center shadow-lg">
			<img src="/logowhite.png" alt="Rosys Patterns" class="w-9 h-9 brightness-0 invert" />
		</div>
		<h1 class="text-rosys-fg text-[24px] font-bold tracking-[-0.03em]">
			Rosys Patterns
		</h1>
		<p class="text-rosys-fg-faint text-[13px] mt-1">Your sewing pattern community</p>
	</div>

	<!-- Card -->
	<div class="w-full max-w-[380px]">
		<form onsubmit={submit} class="rosys-card p-7 space-y-5">
			<!-- Toggle -->
			<div class="flex bg-warm-100 rounded-xl p-0.5">
				<button
					type="button"
					class="flex-1 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-200
						{mode === 'login' ? 'bg-white shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}"
					onclick={() => (mode = 'login')}
				>Sign In</button>
				<button
					type="button"
					class="flex-1 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-200
						{mode === 'register' ? 'bg-white shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}"
					onclick={() => (mode = 'register')}
				>Register</button>
			</div>

			{#if mode === 'register'}
				<div>
					<label for="username" class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-1.5">Username</label>
					<input id="username" type="text" bind:value={username} required
						class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-400/25 focus:border-rosys-300 transition-all"
						placeholder="Choose a username" />
				</div>
			{/if}

			<div>
				<label for="email" class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-1.5">Email</label>
				<input id="email" type="email" bind:value={email} required
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-400/25 focus:border-rosys-300 transition-all"
					placeholder="your@email.com" />
			</div>

			<div>
				<label for="password" class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-1.5">Password</label>
				<input id="password" type="password" bind:value={password} required
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-400/25 focus:border-rosys-300 transition-all"
					placeholder="••••••" />
			</div>

			{#if mode === 'register'}
				<div>
					<label for="key" class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-1.5">Community Key</label>
					<input id="key" type="text" bind:value={communityKey} required
						class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-400/25 focus:border-rosys-300 transition-all"
						placeholder="Enter community key" />
				</div>
			{/if}

			{#if error}
				<p class="text-rosys-500 text-[13px] font-medium">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="rosys-btn-primary w-full py-3.5"
			>
				{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
			</button>
		</form>
	</div>

	<!-- Footer -->
	<p class="mt-6 text-[12px] text-rosys-fg-faint/60">
		Need help? <a href="mailto:support@rosyspatterns.com" class="text-rosys-500 hover:text-rosys-600 font-medium">support@rosyspatterns.com</a>
	</p>
</div>
