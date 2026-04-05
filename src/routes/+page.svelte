<script lang="ts">
	import { redirect } from '@sveltejs/kit';
</script>

<svelte:head>
	<title>Rosys Patterns</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
	<h1 class="text-3xl font-serif italic text-rosys-brown mb-4">Welcome to Rosys Patterns</h1>
	<p class="text-rosys-brown/70 mb-8">Your sewing pattern platform — magazine, patterns, voting, and more.</p>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<a href="/magazine" class="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-rosys-brown/10">
			<h2 class="text-lg font-semibold text-rosys-brown mb-2">Magazine</h2>
			<p class="text-rosys-brown/60 text-sm">Browse the latest edition</p>
		</a>
		<a href="/patterns" class="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-rosys-brown/10">
			<h2 class="text-lg font-semibold text-rosys-brown mb-2">Patterns</h2>
			<p class="text-rosys-brown/60 text-sm">Your pattern library</p>
		</a>
		<a href="/voting" class="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-rosys-brown/10">
			<h2 class="text-lg font-semibold text-rosys-brown mb-2">Voting</h2>
			<p class="text-rosys-brown/60 text-sm">Vote for new designs</p>
		</a>
		<a href="/size-assistant" class="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-rosys-brown/10">
			<h2 class="text-lg font-semibold text-rosys-brown mb-2">Size Assistant</h2>
			<p class="text-rosys-brown/60 text-sm">AI-powered size recommendations</p>
		</a>
	</div>
</div>
