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

	const topDesigns = $derived(
		[...data.designs]
			.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
			.slice(0, 3)
	);

	const timerUrgency = $derived(() => {
		if (!timeLeft || timeLeft === 'Ended') return '';
		// Less than 1 hour
		if (timeLeft.match(/^0?h/) || (timeLeft.includes('m') && !timeLeft.includes('h'))) return 'text-red-500';
		// Less than 24 hours (0d)
		if (timeLeft.startsWith('0d') || (!timeLeft.includes('d') && timeLeft.includes('h'))) return 'text-amber-500';
		return '';
	});
</script>

<svelte:head>
	<title>Voting — Rosys Patterns</title>
</svelte:head>

<div class="page-enter mesh-bg min-h-screen px-6 py-10 md:px-10 md:py-14 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
		<div>
			<h1 class="text-rosys-fg text-[32px] font-bold tracking-[-0.04em] leading-tight">Design Voting</h1>
			<div class="flex items-center gap-2.5 mt-2.5">
				<span class="rosys-tag">{data.designs.length} designs</span>
				<span class="rosys-tag">{data.maxVotes} votes per person</span>
			</div>
		</div>

		{#if data.isVotingOpen}
			<div class="flex items-center gap-5">
				<!-- Timer badge -->
				<span class="rosys-tag {timerUrgency() || ''}">
					<Clock class="w-3.5 h-3.5" strokeWidth={1.5} />
					{timeLeft} left
				</span>

				<!-- Vote counter card -->
				<div class="rosys-card px-5 py-3.5" style="box-shadow: var(--shadow-lg);">
					<div class="flex items-center gap-3">
						<span class="text-[36px] font-bold text-rosys-600 tabular-nums leading-none">{votesUsed}</span>
						<span class="text-[14px] text-rosys-fg-faint">/ {data.maxVotes}<br/>used</span>
					</div>
					<div class="w-full bg-warm-100 rounded-full h-2 mt-3 overflow-hidden" style="box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);">
						<div
							class="h-2 rounded-full transition-all duration-700"
							style="width: {(votesUsed / data.maxVotes) * 100}%; background: linear-gradient(90deg, var(--color-rosys-400), var(--color-rosys-500), var(--color-rosys-600)); box-shadow: 0 0 12px rgba(232, 54, 109, 0.4), 0 0 4px rgba(232, 54, 109, 0.25);"
						></div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if !data.isVotingOpen}
		<!-- Results podium -->
		<div class="mb-12 rosys-card p-8" style="box-shadow: var(--shadow-xl);">
			<div class="flex items-center gap-3 mb-6">
				<div class="w-10 h-10 rounded-2xl flex items-center justify-center"
					style="background: linear-gradient(135deg, #FFD700, #FFC107); box-shadow: 0 4px 14px rgba(255, 193, 7, 0.3);">
					<Trophy class="w-5 h-5 text-white" strokeWidth={1.5} />
				</div>
				<h2 class="text-[20px] font-bold text-rosys-fg tracking-[-0.02em]">Results</h2>
			</div>
			<div class="space-y-3">
				{#each topDesigns as design, i}
					<div
						class="stagger-item flex items-center gap-5 p-5 rounded-2xl transition-all duration-300"
						style="--i: {i};
							{i === 0 ? 'background: linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,193,7,0.06)); border: 1px solid rgba(255,193,7,0.25); box-shadow: 0 4px 20px rgba(255,193,7,0.12);' :
							i === 1 ? 'background: linear-gradient(135deg, rgba(192,192,192,0.12), rgba(168,168,168,0.06)); border: 1px solid rgba(192,192,192,0.25);' :
							'background: linear-gradient(135deg, rgba(205,127,50,0.1), rgba(160,82,45,0.05)); border: 1px solid rgba(205,127,50,0.2);'}"
					>
						<span
							class="w-11 h-11 rounded-2xl flex items-center justify-center text-[16px] font-bold text-white shrink-0"
							style={i === 0
								? 'background: linear-gradient(135deg, #FFD700, #FFC107); box-shadow: 0 4px 14px rgba(255, 193, 7, 0.35);'
								: i === 1
									? 'background: linear-gradient(135deg, #C0C0C0, #A8A8A8); box-shadow: 0 4px 14px rgba(168, 168, 168, 0.35);'
									: 'background: linear-gradient(135deg, #CD7F32, #A0522D); box-shadow: 0 4px 14px rgba(160, 82, 45, 0.35);'}
						>
							{i + 1}
						</span>
						<div class="flex-1 min-w-0">
							<p class="text-[16px] font-semibold text-rosys-fg truncate">{design.title}</p>
							<p class="text-[13px] text-rosys-fg-faint mt-0.5">{design.vote_count} votes</p>
						</div>
						{#if design.image_url}
							<img src={design.image_url} alt={design.title} class="w-16 h-16 rounded-xl object-cover shrink-0" style="box-shadow: var(--shadow-md);" />
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Design grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
		{#each data.designs as design, index (design.id)}
			{@const voted = isVoted(design.id)}
			<div
				class="stagger-item rosys-card overflow-hidden relative
					{voted ? 'border-rosys-400' : 'hover:-translate-y-1'}"
				style="--i: {Math.min(index, 19)};
					{voted ? 'box-shadow: var(--shadow-brand-lg);' : ''}"
			>
				<!-- Voted checkmark badge -->
				{#if voted}
					<div class="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center bounce-in"
						style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-brand);">
						<Check class="w-4 h-4 text-white" strokeWidth={2.5} />
					</div>
				{/if}

				<button
					type="button"
					class="w-full aspect-square bg-warm-100 overflow-hidden cursor-pointer relative group rounded-t-xl"
					onclick={() => (selectedDesign = design)}
				>
					{#if design.image_url}
						<img src={design.image_url} alt={design.title} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
					{:else}
						<div class="w-full h-full flex items-center justify-center">
							<Vote class="w-10 h-10 text-rosys-200" strokeWidth={1.5} />
						</div>
					{/if}
					<div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
				</button>

				<div class="p-3.5 flex items-center justify-between">
					<div class="min-w-0 pr-2">
						<p class="text-[13px] font-semibold text-rosys-fg truncate">{design.title}</p>
						<p class="text-[11px] text-rosys-fg-faint mt-0.5">{design.vote_count || 0} votes</p>
					</div>

					{#if data.isVotingOpen}
						<button
							type="button"
							disabled={voting || (!voted && votesLeft <= 0)}
							onclick={() => toggleVote(design.id)}
							class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
								{voted
								? 'text-white bounce-in'
								: 'border border-rosys-border/60 text-rosys-fg-faint hover:text-white hover:border-transparent'}
								disabled:opacity-30"
							style={voted
								? 'background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-brand);'
								: 'hover:background: var(--color-rosys-500);'}
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
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		role="dialog"
		style="animation: fadeIn 0.3s ease-out both;"
	>
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

		<button
			type="button"
			class="absolute top-5 right-5 p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 z-10 transition-all duration-200"
			onclick={() => (selectedDesign = null)}
		>
			<X class="w-6 h-6" strokeWidth={1.5} />
		</button>

		<div class="relative max-w-lg w-full mx-5" style="animation: scaleIn 0.4s var(--ease-spring) both;">
			{#if selectedDesign.image_url}
				<img src={selectedDesign.image_url} alt={selectedDesign.title} class="w-full rounded-2xl" style="box-shadow: 0 32px 80px rgba(0,0,0,0.5);" />
			{/if}
			<div class="mt-5 flex items-center justify-between">
				<div>
					<p class="text-white text-[18px] font-semibold tracking-[-0.02em]">{selectedDesign.title}</p>
					<p class="text-white/50 text-[14px] mt-0.5">
						{data.designs.find(d => d.id === selectedDesign?.id)?.vote_count || 0} votes
					</p>
				</div>
				{#if data.isVotingOpen}
					{@const voted = isVoted(selectedDesign.id)}
					<button
						type="button"
						disabled={voting || (!voted && votesLeft <= 0)}
						onclick={() => { if (selectedDesign) toggleVote(selectedDesign.id); }}
						class="px-6 py-3 rounded-xl font-semibold text-[14px] transition-all duration-300
							{voted ? 'bg-white text-rosys-fg hover:bg-white/90' : 'rosys-btn-primary shine-effect'}"
					>
						{voted ? 'Remove Vote' : 'Vote'}
					</button>
				{/if}
			</div>
		</div>

		<!-- Navigation arrows -->
		{#if data.designs.findIndex(d => d.id === selectedDesign?.id) > 0}
			<button
				type="button"
				class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
				style="box-shadow: var(--shadow-lg);"
				onclick={() => { const idx = data.designs.findIndex(d => d.id === selectedDesign?.id); if (idx > 0) selectedDesign = data.designs[idx - 1]; }}
			>
				<ChevronLeft class="w-5 h-5" strokeWidth={1.5} />
			</button>
		{/if}
		{#if data.designs.findIndex(d => d.id === selectedDesign?.id) < data.designs.length - 1}
			<button
				type="button"
				class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
				style="box-shadow: var(--shadow-lg);"
				onclick={() => { const idx = data.designs.findIndex(d => d.id === selectedDesign?.id); if (idx < data.designs.length - 1) selectedDesign = data.designs[idx + 1]; }}
			>
				<ChevronRight class="w-5 h-5" strokeWidth={1.5} />
			</button>
		{/if}
	</div>
{/if}
