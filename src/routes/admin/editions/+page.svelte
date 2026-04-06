<script lang="ts">
	import { Gift, BookOpen, Plus, Power } from 'lucide-svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();
	let showCreateForm = $state(false);
	let selectedPatterns = $state<string[]>([]);
	let patternSearch = $state('');

	const filteredPatterns = $derived(
		data.allPatterns.filter((p) =>
			p.pattern_name.toLowerCase().includes(patternSearch.toLowerCase()) &&
			!selectedPatterns.includes(p.pattern_slug)
		).slice(0, 10)
	);

	function addPattern(slug: string) {
		selectedPatterns = [...selectedPatterns, slug];
		patternSearch = '';
	}
	function removePattern(slug: string) {
		selectedPatterns = selectedPatterns.filter((s) => s !== slug);
	}
</script>

<svelte:head><title>Editions & Rounds — Admin</title></svelte:head>

<div class="page-enter px-6 py-8 max-w-5xl mx-auto">
	<h1 class="text-[24px] font-bold text-rosys-fg mb-6">Editions & Free Pattern Rounds</h1>

	<!-- Free Pattern Rounds -->
	<div class="mb-10">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-[16px] font-semibold text-rosys-fg flex items-center gap-2">
				<Gift class="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
				Free Pattern Rounds
			</h2>
			<button onclick={() => (showCreateForm = !showCreateForm)}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rosys-fg text-white text-[12px] font-semibold hover:bg-rosys-fg/90 transition-all">
				<Plus class="w-3.5 h-3.5" strokeWidth={2} /> New Round
			</button>
		</div>

		{#if showCreateForm}
			<form method="POST" action="?/createRound" use:enhance class="bg-rosys-card rounded-2xl border border-emerald-200/50 p-5 shadow-sm mb-4 space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Round Name</label>
						<input name="round_name" type="text" required placeholder="e.g. May/June 2026"
							class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15" />
					</div>
					<div>
						<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Linked Edition</label>
						<select name="edition_id" class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15">
							<option value="">None</option>
							{#each data.editions as ed}<option value={ed.id}>{ed.name}</option>{/each}
						</select>
					</div>
					<div>
						<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Starts</label>
						<input name="starts_at" type="date" required class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15" />
					</div>
					<div>
						<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Ends <span class="text-rosys-fg-faint">(optional)</span></label>
						<input name="ends_at" type="date" class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15" />
					</div>
				</div>

				<!-- Pattern picker -->
				<div>
					<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Patterns</label>
					<input type="text" bind:value={patternSearch} placeholder="Search patterns to add..."
						class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15 mb-2" />

					{#if patternSearch && filteredPatterns.length > 0}
						<div class="bg-rosys-bg rounded-xl p-2 mb-2 max-h-40 overflow-auto">
							{#each filteredPatterns as p}
								<button type="button" onclick={() => addPattern(p.pattern_slug)}
									class="w-full text-left px-3 py-2 rounded-lg text-[13px] text-rosys-fg hover:bg-rosys-card transition-colors">
									{p.pattern_name} <span class="text-rosys-fg-faint">({p.pattern_slug})</span>
								</button>
							{/each}
						</div>
					{/if}

					<div class="flex flex-wrap gap-2">
						{#each selectedPatterns as slug}
							<span class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-[12px] font-medium text-emerald-700">
								{slug.replace(/^\d+_/, '')}
								<button type="button" onclick={() => removePattern(slug)} class="text-emerald-400 hover:text-emerald-700">&times;</button>
							</span>
						{/each}
					</div>
					<input type="hidden" name="pattern_slugs" value={selectedPatterns.join(',')} />
				</div>

				<button type="submit" class="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition-all">
					Create Round
				</button>
			</form>
		{/if}

		<!-- Existing rounds -->
		<div class="space-y-2">
			{#each data.rounds as round}
				<div class="bg-rosys-card rounded-xl border {round.is_active ? 'border-emerald-200/50' : 'border-rosys-border/40'} p-4 shadow-sm flex items-center gap-4">
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<p class="text-[14px] font-medium text-rosys-fg">{round.round_name}</p>
							{#if round.is_active}
								<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-700">ACTIVE</span>
							{:else}
								<span class="px-2 py-0.5 rounded-md bg-rosys-bg-alt text-[10px] font-bold text-rosys-fg-faint">INACTIVE</span>
							{/if}
						</div>
						<div class="flex gap-1.5 mt-2 flex-wrap">
							{#each round.pattern_slugs || [] as slug}
								<span class="px-2 py-0.5 rounded-md bg-rosys-bg-alt text-[11px] font-medium text-rosys-fg-muted">{slug.replace(/^\d+_/, '')}</span>
							{/each}
						</div>
					</div>
					<form method="POST" action="?/toggleRound" use:enhance>
						<input type="hidden" name="id" value={round.id} />
						<input type="hidden" name="is_active" value={String(round.is_active)} />
						<button type="submit" class="p-2 rounded-lg {round.is_active ? 'hover:bg-red-50 text-red-400' : 'hover:bg-emerald-50 text-emerald-400'} transition-colors">
							<Power class="w-4 h-4" strokeWidth={2} />
						</button>
					</form>
				</div>
			{/each}
		</div>
	</div>

	<!-- Magazine Editions -->
	<div>
		<h2 class="text-[16px] font-semibold text-rosys-fg mb-4 flex items-center gap-2">
			<BookOpen class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
			Magazine Editions
		</h2>
		<div class="space-y-2">
			{#each data.editions as edition}
				<div class="bg-rosys-card rounded-xl border border-rosys-border/40 p-4 shadow-sm flex items-center justify-between">
					<div>
						<p class="text-[14px] font-medium text-rosys-fg">{edition.name}</p>
						<p class="text-[12px] text-rosys-fg-faint">{edition.month_label} {edition.year} · {edition.gift_count} gifts</p>
					</div>
					<span class="px-2.5 py-1 rounded-lg text-[11px] font-bold
						{edition.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
						 edition.status === 'review' ? 'bg-amber-100 text-amber-700' :
						 'bg-slate-100 text-slate-600'}">{edition.status}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
