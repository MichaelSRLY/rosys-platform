<script lang="ts">
	import { createClient } from '$lib/supabase';
	import { goto, invalidateAll } from '$app/navigation';
	import { Loader2, AlertTriangle } from 'lucide-svelte';

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

<div class="grain mesh-bg-vibrant min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
	<!-- Ambient glow orbs for depth -->
	<div
		class="absolute pointer-events-none"
		style="
			width: 500px; height: 500px; top: -10%; left: -10%;
			background: radial-gradient(circle, rgba(232,54,109,0.07) 0%, transparent 70%);
			filter: blur(60px);
			animation: float 12s ease-in-out infinite;
		"
	></div>
	<div
		class="absolute pointer-events-none"
		style="
			width: 400px; height: 400px; bottom: -5%; right: -5%;
			background: radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%);
			filter: blur(60px);
			animation: float 10s ease-in-out infinite reverse;
		"
	></div>

	<!-- Logo — large floating with glow -->
	<div class="mb-12 text-center relative z-10" style="animation: fadeUp 0.6s var(--ease-spring) both;">
		<div
			class="float w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center relative"
			style="
				background: linear-gradient(135deg, var(--color-rosys-500) 0%, var(--color-rosys-600) 100%);
				box-shadow: 0 12px 40px rgba(232,54,109,0.3), 0 4px 12px rgba(232,54,109,0.2), 0 0 0 1px rgba(255,255,255,0.1) inset;
			"
		>
			<img src="/logowhite.png" alt="Rosys Patterns" class="w-11 h-11 brightness-0 invert relative z-10" />
			<!-- Outer glow ring -->
			<div
				class="absolute inset-[-6px] rounded-[22px] pointer-events-none"
				style="
					background: linear-gradient(135deg, rgba(232,54,109,0.15), transparent);
					filter: blur(8px);
				"
			></div>
		</div>
		<h1 class="text-rosys-fg text-[28px] font-extrabold tracking-[-0.04em] leading-tight">
			Rosys Patterns
		</h1>
		<p class="text-rosys-fg-faint text-[14px] mt-2 tracking-[-0.01em]">
			Your sewing pattern community
		</p>
	</div>

	<!-- Card with animated glow border -->
	<div
		class="w-full max-w-[420px] relative z-10"
		style="animation: fadeUp 0.6s var(--ease-spring) 0.1s both;"
	>
		<form
			onsubmit={submit}
			class="glow-border rounded-[22px] bg-white/95 p-10 space-y-6 relative"
			style="
				backdrop-filter: saturate(180%) blur(20px);
				-webkit-backdrop-filter: saturate(180%) blur(20px);
				box-shadow: var(--shadow-2xl), 0 0 0 1px rgba(255,255,255,0.6) inset;
			"
		>
			<!-- Toggle -->
			<div class="rosys-toggle">
				<button
					type="button"
					class="rosys-toggle-item"
					data-active={mode === 'login'}
					onclick={() => (mode = 'login')}
				>Sign In</button>
				<button
					type="button"
					class="rosys-toggle-item"
					data-active={mode === 'register'}
					onclick={() => (mode = 'register')}
				>Register</button>
			</div>

			{#if mode === 'register'}
				<div style="animation: slideDown 0.35s var(--ease-spring);">
					<label for="username" class="block rosys-section-label mb-2">Username</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						required
						class="rosys-input"
						placeholder="Choose a username"
					/>
				</div>
			{/if}

			<div>
				<label for="email" class="block rosys-section-label mb-2">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					class="rosys-input"
					placeholder="your@email.com"
				/>
			</div>

			<div>
				<label for="password" class="block rosys-section-label mb-2">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					class="rosys-input"
					placeholder="••••••"
				/>
			</div>

			{#if mode === 'register'}
				<div style="animation: slideDown 0.35s var(--ease-spring) 0.05s both;">
					<label for="key" class="block rosys-section-label mb-2">Community Key</label>
					<input
						id="key"
						type="text"
						bind:value={communityKey}
						required
						class="rosys-input"
						placeholder="Enter community key"
					/>
				</div>
			{/if}

			{#if error}
				<div
					class="flex items-start gap-3 p-4 rounded-2xl bg-red-50/80 border border-red-100/80"
					style="animation: slideDown 0.35s var(--ease-spring);"
				>
					<div
						class="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0"
					>
						<AlertTriangle class="w-4 h-4 text-red-500" strokeWidth={2.2} />
					</div>
					<div class="pt-1">
						<p class="text-red-700 text-[13px] font-semibold leading-snug">{error}</p>
					</div>
				</div>
			{/if}

			<!-- Submit button with shine -->
			<button
				type="submit"
				disabled={loading}
				class="rosys-btn-primary shine-effect w-full py-4 text-[15px] tracking-[-0.01em]"
			>
				{#if loading}
					<Loader2 class="w-[18px] h-[18px] animate-spin" strokeWidth={2.2} />
					<span>Please wait...</span>
				{:else}
					{mode === 'login' ? 'Sign In' : 'Create Account'}
				{/if}
			</button>
		</form>
	</div>

	<!-- Footer -->
	<p
		class="mt-10 text-[12px] text-rosys-fg-faint/50 relative z-10 tracking-[-0.01em]"
		style="animation: fadeUp 0.6s var(--ease-spring) 0.25s both;"
	>
		Need help? <a
			href="mailto:support@rosyspatterns.com"
			class="text-rosys-500 hover:text-rosys-600 font-medium transition-colors duration-300"
		>support@rosyspatterns.com</a>
	</p>
</div>
