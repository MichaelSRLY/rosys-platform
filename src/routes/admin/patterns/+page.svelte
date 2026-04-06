<script lang="ts">
	import { Search, Check, X, Scissors, FileText, Box, Image } from 'lucide-svelte';

	let { data } = $props();
	let search = $state('');
	let filter = $state<'all' | 'configured' | 'unconfigured'>('all');

	const filtered = $derived(
		data.patterns
			.filter((p) => p.pattern_name.toLowerCase().includes(search.toLowerCase()))
			.filter((p) => filter === 'all' ? true : filter === 'configured' ? p.isConfigured : !p.isConfigured)
	);

	const stats = $derived({
		total: data.patterns.length,
		configured: data.patterns.filter((p) => p.isConfigured).length,
		published: data.patterns.filter((p) => p.isPublished).length
	});
</script>

<svelte:head><title>Patterns — Admin</title></svelte:head>

<div class="page-enter px-6 py-8 max-w-6xl mx-auto">
	<div class="flex items-end justify-between mb-6">
		<div>
			<h1 class="text-[24px] font-bold text-rosys-fg">Patterns</h1>
			<p class="text-[13px] text-rosys-fg-faint mt-1">
				{stats.configured}/{stats.total} configured · {stats.published} published
			</p>
		</div>
		<div class="flex items-center gap-3">
			<!-- Filter tabs -->
			<div class="flex bg-rosys-bg-alt rounded-lg p-0.5">
				{#each [['all', 'All'], ['configured', 'Configured'], ['unconfigured', 'Todo']] as [val, label]}
					<button onclick={() => (filter = val as any)}
						class="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all
							{filter === val ? 'bg-rosys-card shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}">{label}</button>
				{/each}
			</div>
			<div class="relative w-56">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rosys-fg-faint/60" strokeWidth={1.5} />
				<input type="text" bind:value={search} placeholder="Search..."
					class="w-full pl-9 pr-4 py-2 rounded-lg bg-rosys-card border border-rosys-border text-[12px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15" />
			</div>
		</div>
	</div>

	<!-- Pattern table -->
	<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 shadow-sm overflow-hidden">
		<table class="w-full text-[13px]">
			<thead>
				<tr class="border-b border-rosys-border/40 text-[11px] text-rosys-fg-faint uppercase tracking-wider">
					<th class="text-left py-3 px-4 font-semibold">Pattern</th>
					<th class="text-center px-2 font-semibold">PDF</th>
					<th class="text-center px-2 font-semibold">A0</th>
					<th class="text-center px-2 font-semibold">DXF</th>
					<th class="text-center px-2 font-semibold">Images</th>
					<th class="text-center px-2 font-semibold">Embeds</th>
					<th class="text-center px-2 font-semibold">Status</th>
					<th class="text-right px-4 font-semibold"></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as pattern}
					<tr class="border-b border-rosys-border/15 hover:bg-rosys-bg/50 transition-colors">
						<td class="py-3 px-4">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 rounded-lg {pattern.isPublished ? 'bg-emerald-50' : 'bg-rosys-bg-alt'} flex items-center justify-center shrink-0">
									<Scissors class="w-4 h-4 {pattern.isPublished ? 'text-emerald-500' : 'text-rosys-fg/20'}" strokeWidth={1.5} />
								</div>
								<div>
									<p class="font-medium text-rosys-fg">{pattern.pattern_name}</p>
									<p class="text-[11px] text-rosys-fg-faint">{pattern.pattern_slug}</p>
								</div>
							</div>
						</td>
						<td class="text-center px-2">{#if pattern.has_instructions}<Check class="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={2} />{:else}<X class="w-4 h-4 text-rosys-fg/15 mx-auto" strokeWidth={1.5} />{/if}</td>
						<td class="text-center px-2">{#if pattern.has_a0}<Check class="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={2} />{:else}<X class="w-4 h-4 text-rosys-fg/15 mx-auto" strokeWidth={1.5} />{/if}</td>
						<td class="text-center px-2">{#if pattern.has_dxf}<Check class="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={2} />{:else}<X class="w-4 h-4 text-rosys-fg/15 mx-auto" strokeWidth={1.5} />{/if}</td>
						<td class="text-center px-2">{#if pattern.has_finished_images}<Check class="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={2} />{:else}<X class="w-4 h-4 text-rosys-fg/15 mx-auto" strokeWidth={1.5} />{/if}</td>
						<td class="text-center px-2"><span class="text-[12px] {pattern.embedding_chunk_count > 0 ? 'text-blue-600 font-semibold' : 'text-rosys-fg-faint'}">{pattern.embedding_chunk_count || 0}</span></td>
						<td class="text-center px-2">
							{#if pattern.isPublished}
								<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-700">LIVE</span>
							{:else if pattern.isConfigured}
								<span class="px-2 py-0.5 rounded-md bg-amber-100 text-[10px] font-bold text-amber-700">DRAFT</span>
							{:else}
								<span class="px-2 py-0.5 rounded-md bg-rosys-bg-alt text-[10px] font-bold text-rosys-fg-faint">—</span>
							{/if}
						</td>
						<td class="text-right px-4">
							<a href="/admin/patterns/{pattern.pattern_slug}" class="px-3 py-1.5 rounded-lg bg-rosys-fg text-white text-[11px] font-semibold hover:bg-rosys-fg/90 transition-all">Edit</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
