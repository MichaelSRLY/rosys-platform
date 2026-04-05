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

		const { error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			error = signInError.message;
			loading = false;
			return;
		}

		await invalidateAll();
		goto('/');
	}

	async function handleRegister() {
		loading = true;
		error = '';

		if (communityKey !== 'Community2025') {
			error = 'Invalid community key. Please try again.';
			loading = false;
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters.';
			loading = false;
			return;
		}

		const cleanUsername = username.toLowerCase().trim();
		const cleanEmail = email.toLowerCase().trim();

		// Check if username taken
		const { data: existing } = await supabase
			.from('profiles')
			.select('id')
			.eq('username', cleanUsername)
			.single();

		if (existing) {
			error = 'This username is already taken.';
			loading = false;
			return;
		}

		const { error: signUpError } = await supabase.auth.signUp({
			email: cleanEmail,
			password,
			options: { data: { username: cleanUsername } }
		});

		if (signUpError) {
			error = signUpError.message;
			loading = false;
			return;
		}

		await invalidateAll();
		goto('/');
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (mode === 'login') handleLogin();
		else handleRegister();
	}
</script>

<svelte:head>
	<title>Login — Rosys Patterns</title>
</svelte:head>

<div class="min-h-screen bg-rosys-cream flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="text-center mb-8">
			<img src="/logowhite.png" alt="Rosys Patterns" class="w-16 h-16 mx-auto mb-4" />
			<h1 class="font-serif italic text-rosys-brown text-2xl tracking-widest">Rosys Patterns</h1>
			<p class="text-rosys-brown/60 text-sm mt-1">Your sewing pattern platform</p>
		</div>

		<!-- Form -->
		<form
			onsubmit={handleSubmit}
			class="bg-white rounded-2xl shadow-lg p-8 space-y-5"
		>
			<div class="flex gap-2 mb-2">
				<button
					type="button"
					class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors {mode === 'login'
						? 'bg-rosys-brown text-white'
						: 'bg-rosys-cream text-rosys-brown'}"
					onclick={() => (mode = 'login')}
				>
					Login
				</button>
				<button
					type="button"
					class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors {mode === 'register'
						? 'bg-rosys-brown text-white'
						: 'bg-rosys-cream text-rosys-brown'}"
					onclick={() => (mode = 'register')}
				>
					Register
				</button>
			</div>

			{#if mode === 'register'}
				<div>
					<label for="username" class="block text-sm font-medium text-rosys-brown mb-1">Username</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						required
						class="w-full px-4 py-3 rounded-lg border border-rosys-brown/20 focus:outline-none focus:ring-2 focus:ring-rosys-brown/40"
						placeholder="Choose a username"
					/>
				</div>
			{/if}

			<div>
				<label for="email" class="block text-sm font-medium text-rosys-brown mb-1">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					class="w-full px-4 py-3 rounded-lg border border-rosys-brown/20 focus:outline-none focus:ring-2 focus:ring-rosys-brown/40"
					placeholder="your@email.com"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-rosys-brown mb-1">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					class="w-full px-4 py-3 rounded-lg border border-rosys-brown/20 focus:outline-none focus:ring-2 focus:ring-rosys-brown/40"
					placeholder="••••••"
				/>
			</div>

			{#if mode === 'register'}
				<div>
					<label for="key" class="block text-sm font-medium text-rosys-brown mb-1">Community Key</label>
					<input
						id="key"
						type="text"
						bind:value={communityKey}
						required
						class="w-full px-4 py-3 rounded-lg border border-rosys-brown/20 focus:outline-none focus:ring-2 focus:ring-rosys-brown/40"
						placeholder="Enter your community key"
					/>
				</div>
			{/if}

			{#if error}
				<p class="text-red-500 text-sm">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="w-full py-3 rounded-lg bg-rosys-brown text-white font-medium hover:bg-rosys-brown/90 transition-colors disabled:opacity-50"
			>
				{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
			</button>
		</form>
	</div>
</div>
