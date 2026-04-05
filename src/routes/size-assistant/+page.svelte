<script lang="ts">
	import { Ruler } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Size Assistant — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[28px] font-light tracking-tight mb-2">Size Assistant</h1>
	<p class="text-rosys-fg-faint text-[14px] mb-10">AI-powered size recommendations for every pattern</p>

	<div class="flex flex-col items-center justify-center py-20 bg-rosys-card rounded-3xl border border-rosys-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
		<div class="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
			<Ruler class="w-7 h-7 text-emerald-400" strokeWidth={1.5} />
		</div>
		<h2 class="text-[17px] font-semibold text-rosys-fg mb-1">Coming Soon</h2>
		<p class="text-rosys-fg-faint text-[14px]">AI size recommendations are being built</p>
	</div>
</div>
