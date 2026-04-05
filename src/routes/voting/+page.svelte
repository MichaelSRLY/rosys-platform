<script lang="ts">
	import { Vote, Check, Clock, Trophy, X, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { createClient } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	const supabase = createClient();

	let voting = $state(false);
	let selectedDesign = $state<{ id: number; title: string; image_url: string | null } | null>(null);

	const votesUsed = $derived(data.userVotes.length);
	const votesLeft = $derived(data.maxVotes - votesUsed);

	// Countdown
	let timeLeft = $state('');
	$effect(() => {
		if (!data.period) return;
		const end = new Date(data.period.end_time).getTime();
		const tick = () => {
			const diff = Math.max(0, end - Date.now());
			if (diff <= 0) { timeLeft = 'Ended'; return; }
			const d = Math.floor(diff / 86400000);
			const h = Math.floor((diff % 86400000) / 3600000);
			const m = Math.floor((diff % 3600000) / 60000);
			timeLeft = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
		};
		tick();
		const interval = setInterval(tick, 60000);
		return () => clearInterval(interval);
	});

	function isVoted(designId: number): boolean {
		return data.userVotes.includes(designId);
	}

	async function toggleVote(designId: number) {
		if (!data.isVotingOpen) return;
		voting = true;

		if (isVoted(designId)) {
			await supabase.rpc('remove_vote', { p_design_id: designId });
		} else {
			if (votesLeft <= 0) { voting = false; return; }
			await supabase.rpc('vote_for_design', { p_design_id: designId });
		}

		await invalidateAll();
		voting = false;
	}

	// Top 3 for scoreboard
	const topDesigns = $derived(
		[...data.designs]
			.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
			.slice(0, 3)
	);
</script>

<svelte:head>
	<title>Voting — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
		<div>
			<h1 class="font-[var(--font-display)] italic text-rosys-fg text-[28px] font-light tracking-tight">Design Voting</h1>
			<p class="text-rosys-fg-faint text-[14px] mt-1">{data.designs.length} designs · {data.maxVotes} votes per person</p>
		</div>

		{#if data.isVotingOpen}
			<div class="flex items-center gap-4">
				<!-- Timer -->
				<div class="flex items-center gap-2 text-rosys-fg-faint">
					<Clock class="w-4 h-4" strokeWidth={1.5} />
					<span class="text-[13px] font-medium">{timeLeft} left</span>
				</div>

				<!-- Vote counter -->
				<div class="bg-rosys-card rounded-xl px-4 py-2 border border-rosys-border/60 shadow-sm">
					<div class="flex items-center gap-2">
						<span class="text-[22px] font-bold text-rosys-fg">{votesUsed}</span>
						<span class="text-[13px] text-rosys-fg-faint">/ {data.maxVotes} used</span>
					</div>
					<div class="w-full bg-rosys-bg-alt rounded-full h-1.5 mt-1.5">
						<div
							class="bg-rosys-fg h-1.5 rounded-full transition-all duration-500"
							style="width: {(votesUsed / data.maxVotes) * 100}%"
						></div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if !data.isVotingOpen}
		<!-- Results mode -->
		<div class="mb-8 bg-rosys-card rounded-2xl p-6 border border-rosys-border/50 shadow-sm">
			<div class="flex items-center gap-2 mb-4">
				<Trophy class="w-5 h-5 text-amber-500" strokeWidth={1.5} />
				<h2 class="text-[17px] font-semibold text-rosys-fg">Results</h2>
			</div>
			<div class="space-y-3">
				{#each topDesigns as design, i}
					<div class="flex items-center gap-4 p-3 rounded-xl {i === 0 ? 'bg-amber-50 border border-amber-200/60' : 'bg-rosys-bg'}">
						<span class="w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold
							{i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : 'bg-amber-700 text-white'}">
							{i + 1}
						</span>
						<div class="flex-1">
							<p class="text-[14px] font-medium text-rosys-fg">{design.title}</p>
							<p class="text-[12px] text-rosys-fg-faint">{design.vote_count} votes</p>
						</div>
						{#if design.image_url}
							<img src={design.image_url} alt={design.title} class="w-12 h-12 rounded-lg object-cover" />
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Design grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
		{#each data.designs as design (design.id)}
			{@const voted = isVoted(design.id)}
			<div
				class="bg-rosys-card rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] border transition-all duration-200
					{voted ? 'border-rosys-fg shadow-[0_0_0_2px_rgba(46,42,57,0.15)]' : 'border-rosys-border/50 hover:shadow-md hover:-translate-y-0.5'}"
			>
				<!-- Image -->
				<button
					type="button"
					class="w-full aspect-square bg-rosys-bg-alt overflow-hidden cursor-pointer"
					onclick={() => (selectedDesign = design)}
				>
					{#if design.image_url}
						<img src={design.image_url} alt={design.title} class="w-full h-full object-cover" loading="lazy" />
					{:else}
						<div class="w-full h-full flex items-center justify-center">
							<Vote class="w-8 h-8 text-rosys-fg/10" strokeWidth={1.5} />
						</div>
					{/if}
				</button>

				<!-- Info + vote button -->
				<div class="p-3 flex items-center justify-between">
					<div class="min-w-0">
						<p class="text-[12px] font-medium text-rosys-fg truncate">{design.title}</p>
						<p class="text-[11px] text-rosys-fg-faint">{design.vote_count || 0} votes</p>
					</div>

					{#if data.isVotingOpen}
						<button
							type="button"
							disabled={voting || (!voted && votesLeft <= 0)}
							onclick={() => toggleVote(design.id)}
							class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200
								{voted
								? 'bg-rosys-fg text-white'
								: 'bg-rosys-bg-alt text-rosys-fg-faint hover:bg-rosys-fg hover:text-white'}
								disabled:opacity-30"
						>
							<Check class="w-4 h-4" strokeWidth={2} />
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Design lightbox -->
{#if selectedDesign}
	<div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" role="dialog">
		<button
			type="button"
			class="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
			onclick={() => (selectedDesign = null)}
		>
			<X class="w-6 h-6" strokeWidth={1.5} />
		</button>

		<div class="max-w-lg w-full mx-4">
			{#if selectedDesign.image_url}
				<img src={selectedDesign.image_url} alt={selectedDesign.title} class="w-full rounded-2xl" />
			{/if}
			<div class="mt-4 flex items-center justify-between">
				<div>
					<p class="text-white text-[17px] font-medium">{selectedDesign.title}</p>
					<p class="text-white/60 text-[13px]">
						{data.designs.find(d => d.id === selectedDesign?.id)?.vote_count || 0} votes
					</p>
				</div>
				{#if data.isVotingOpen}
					{@const voted = isVoted(selectedDesign.id)}
					<button
						type="button"
						disabled={voting || (!voted && votesLeft <= 0)}
						onclick={() => { if (selectedDesign) toggleVote(selectedDesign.id); }}
						class="px-5 py-2.5 rounded-xl font-medium text-[14px] transition-all
							{voted ? 'bg-white text-rosys-fg' : 'bg-rosys-accent text-rosys-fg hover:bg-rosys-accent-hover'}"
					>
						{voted ? 'Remove Vote' : 'Vote'}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
