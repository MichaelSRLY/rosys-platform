<script lang="ts">
	import { Vote } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Voting — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<h1 class="font-[var(--font-display)] italic text-rosys-fg text-[28px] font-light tracking-tight mb-2">Design Voting</h1>
	<p class="text-rosys-fg-faint text-[14px] mb-10">Vote for your favorite fabric designs</p>

	<div class="flex flex-col items-center justify-center py-20 bg-rosys-card rounded-3xl border border-rosys-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
		<div class="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
			<Vote class="w-7 h-7 text-violet-400" strokeWidth={1.5} />
		</div>
		<h2 class="text-[17px] font-semibold text-rosys-fg mb-1">Coming Soon</h2>
		<p class="text-rosys-fg-faint text-[14px]">The voting system is being migrated</p>
	</div>
</div>
