<script lang="ts">
	import { ArrowLeft, Save, Eye, EyeOff, Image, FileText, Layers, Check, Database } from 'lucide-svelte';
	import { enhance } from '$app/forms';

	let { data, form: actionResult } = $props();
	const { catalog, adminConfig, embeddingStats, illustrationPages, stepCount, storageFiles, slug } = data;

	let tab = $state<'overview' | 'illustrations' | 'files'>('overview');
	let displayName = $state(adminConfig?.display_name || catalog.pattern_name);
	let category = $state(adminConfig?.category || '');
	let difficulty = $state(adminConfig?.difficulty || '');
	let description = $state(adminConfig?.description || '');
	let isPublished = $state(adminConfig?.is_published || false);
	let stepIllustrations = $state<Array<{ step: number; page: number }>>(adminConfig?.step_illustrations || []);
	let overviewPages = $state<number[]>(adminConfig?.overview_pages || []);
	let saving = $state(false);

	const categories = ['dress', 'top', 'jacket', 'coat', 'skirt', 'set', 'bag', 'bundle', 'other'];
	const difficulties = ['beginner', 'intermediate', 'advanced'];

	function setStepPage(step: number, page: number) {
		stepIllustrations = [
			...stepIllustrations.filter((s) => s.step !== step),
			{ step, page }
		].sort((a, b) => a.step - b.step);
	}

	function toggleOverviewPage(page: number) {
		if (overviewPages.includes(page)) {
			overviewPages = overviewPages.filter((p) => p !== page);
		} else {
			overviewPages = [...overviewPages, page].sort((a, b) => a - b);
		}
	}

	function getPageForStep(step: number): number | null {
		return stepIllustrations.find((s) => s.step === step)?.page || null;
	}
</script>

<svelte:head><title>{catalog.pattern_name} — Admin</title></svelte:head>

<div class="page-enter px-6 py-8 max-w-5xl mx-auto">
	<a href="/admin/patterns" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[12px] font-medium mb-6 transition-colors">
		<ArrowLeft class="w-3.5 h-3.5" strokeWidth={1.5} />
		Patterns
	</a>

	<!-- Header -->
	<div class="flex items-start justify-between mb-6">
		<div>
			<h1 class="text-[24px] font-bold text-rosys-fg">{catalog.pattern_name}</h1>
			<p class="text-[13px] text-rosys-fg-faint">{slug}</p>
		</div>
		<div class="flex items-center gap-3">
			<a href="/patterns/{slug}" target="_blank" class="px-3 py-1.5 rounded-lg bg-rosys-bg-alt text-[12px] font-medium text-rosys-fg-muted hover:text-rosys-fg transition-colors">
				<span class="flex items-center gap-1.5"><Eye class="w-3.5 h-3.5" strokeWidth={1.5} /> Preview</span>
			</a>
			<span class="px-3 py-1.5 rounded-lg text-[12px] font-bold
				{isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-rosys-bg-alt text-rosys-fg-faint'}">
				{isPublished ? 'Published' : 'Draft'}
			</span>
		</div>
	</div>

	<!-- Embedding stats -->
	<div class="flex gap-2 mb-6 flex-wrap">
		{#each embeddingStats as stat}
			<span class="px-2.5 py-1 rounded-lg bg-blue-50 text-[11px] font-semibold text-blue-600">
				{stat.chunk_type}: {stat.count}
			</span>
		{/each}
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 mb-6 bg-rosys-bg-alt rounded-lg p-0.5 w-fit">
		{#each [['overview', 'Overview'], ['illustrations', 'Illustrations'], ['files', 'Files']] as [val, label]}
			<button onclick={() => (tab = val as any)}
				class="px-4 py-2 rounded-md text-[12px] font-semibold transition-all
					{tab === val ? 'bg-rosys-card shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}">{label}</button>
		{/each}
	</div>

	<!-- OVERVIEW TAB -->
	{#if tab === 'overview'}
		<form method="POST" action="?/save" use:enhance={() => { saving = true; return async ({ update }) => { saving = false; update(); }; }}>
			<input type="hidden" name="step_illustrations" value={JSON.stringify(stepIllustrations)} />
			<input type="hidden" name="overview_pages" value={JSON.stringify(overviewPages)} />
			<input type="hidden" name="is_published" value={String(isPublished)} />

			<div class="grid md:grid-cols-2 gap-5 mb-6">
				<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm space-y-4">
					<h2 class="text-[13px] font-semibold text-rosys-fg">Pattern Details</h2>

					<div>
						<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Display Name</label>
						<input name="display_name" type="text" bind:value={displayName}
							class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15" />
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Category</label>
							<select name="category" bind:value={category}
								class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15">
								<option value="">—</option>
								{#each categories as cat}<option value={cat}>{cat}</option>{/each}
							</select>
						</div>
						<div>
							<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Difficulty</label>
							<select name="difficulty" bind:value={difficulty}
								class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15">
								<option value="">—</option>
								{#each difficulties as d}<option value={d}>{d}</option>{/each}
							</select>
						</div>
					</div>

					<div>
						<label class="block text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-wider mb-1.5">Description</label>
						<textarea name="description" bind:value={description} rows="4"
							class="w-full px-3 py-2.5 rounded-xl bg-rosys-bg border-none text-[14px] focus:outline-none focus:ring-2 focus:ring-rosys-fg/15 resize-none"></textarea>
					</div>

					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" bind:checked={isPublished} class="w-4 h-4 rounded accent-emerald-500" />
						<span class="text-[13px] font-medium text-rosys-fg">Published (visible to users)</span>
					</label>
				</div>

				<!-- Quick info -->
				<div class="space-y-4">
					<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
						<h2 class="text-[13px] font-semibold text-rosys-fg mb-3">Storage</h2>
						<p class="text-[12px] text-rosys-fg-faint">{storageFiles.length} files in bucket</p>
						<div class="flex gap-2 mt-2 flex-wrap">
							{#if catalog.has_instructions}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">PDF</span>{/if}
							{#if catalog.has_a0}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">A0</span>{/if}
							{#if catalog.has_dxf}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">DXF</span>{/if}
							{#if catalog.has_finished_images}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">Images</span>{/if}
						</div>
					</div>

					<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
						<h2 class="text-[13px] font-semibold text-rosys-fg mb-3">Instructions</h2>
						<p class="text-[12px] text-rosys-fg-muted">{illustrationPages.length} illustration pages</p>
						<p class="text-[12px] text-rosys-fg-muted">{stepCount} sewing steps detected</p>
						<p class="text-[12px] text-rosys-fg-muted">{stepIllustrations.length} step-illustration mappings</p>
					</div>
				</div>
			</div>

			{#if actionResult?.success}
				<div class="mb-4 px-4 py-2 rounded-lg bg-emerald-50 text-[13px] text-emerald-700 font-medium">Saved successfully</div>
			{/if}
			{#if actionResult?.error}
				<div class="mb-4 px-4 py-2 rounded-lg bg-red-50 text-[13px] text-red-600">{actionResult.error}</div>
			{/if}

			<button type="submit" disabled={saving}
				class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rosys-fg text-white text-[13px] font-semibold hover:bg-rosys-fg/90 active:scale-[0.98] transition-all disabled:opacity-40">
				<Save class="w-4 h-4" strokeWidth={1.5} />
				{saving ? 'Saving...' : 'Save Changes'}
			</button>
		</form>
	{/if}

	<!-- ILLUSTRATIONS TAB -->
	{#if tab === 'illustrations'}
		<div class="space-y-6">
			<p class="text-[13px] text-rosys-fg-muted">
				Assign PDF pages to sewing steps. Pages marked as "Overview" are shown for About/Materials/Pieces sections.
			</p>

			<!-- Overview pages -->
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
				<h2 class="text-[13px] font-semibold text-rosys-fg mb-3">Overview Pages (About, Materials, Cutting)</h2>
				<div class="flex flex-wrap gap-2">
					{#each illustrationPages as page}
						<button onclick={() => toggleOverviewPage(page)}
							class="w-12 h-12 rounded-xl text-[13px] font-bold transition-all
								{overviewPages.includes(page) ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-400' : 'bg-rosys-bg text-rosys-fg-faint hover:bg-rosys-bg-alt'}">
							{page}
						</button>
					{/each}
				</div>
			</div>

			<!-- Step assignments -->
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
				<h2 class="text-[13px] font-semibold text-rosys-fg mb-3">Step → Illustration Page</h2>
				<div class="space-y-2">
					{#each Array.from({ length: stepCount }, (_, i) => i + 1) as stepNum}
						{@const assignedPage = getPageForStep(stepNum)}
						<div class="flex items-center gap-4 py-2 border-b border-rosys-border/15 last:border-0">
							<span class="w-20 text-[13px] font-semibold text-rosys-fg">Step {stepNum}</span>
							<div class="flex gap-1.5 flex-wrap">
								{#each illustrationPages.filter((p) => !overviewPages.includes(p)) as page}
									<button onclick={() => setStepPage(stepNum, page)}
										class="w-10 h-10 rounded-lg text-[12px] font-bold transition-all
											{assignedPage === page ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-400' : 'bg-rosys-bg text-rosys-fg-faint hover:bg-rosys-bg-alt'}">
										{page}
									</button>
								{/each}
							</div>
							{#if assignedPage}
								<img src="/api/patterns/page-image?slug={slug}&page={assignedPage}" alt="Page {assignedPage}" class="w-16 h-20 rounded-lg object-cover border border-rosys-border/30" loading="lazy" />
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Save -->
			<form method="POST" action="?/save" use:enhance>
				<input type="hidden" name="display_name" value={displayName} />
				<input type="hidden" name="category" value={category} />
				<input type="hidden" name="difficulty" value={difficulty} />
				<input type="hidden" name="description" value={description} />
				<input type="hidden" name="is_published" value={String(isPublished)} />
				<input type="hidden" name="step_illustrations" value={JSON.stringify(stepIllustrations)} />
				<input type="hidden" name="overview_pages" value={JSON.stringify(overviewPages)} />
				<button type="submit" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rosys-fg text-white text-[13px] font-semibold hover:bg-rosys-fg/90 active:scale-[0.98] transition-all">
					<Save class="w-4 h-4" strokeWidth={1.5} /> Save Mappings
				</button>
			</form>
		</div>
	{/if}

	<!-- FILES TAB -->
	{#if tab === 'files'}
		<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
			<h2 class="text-[13px] font-semibold text-rosys-fg mb-3">Storage Files ({storageFiles.length})</h2>
			<div class="space-y-1">
				{#each storageFiles as file}
					{@const ext = file.split('.').pop()?.toLowerCase()}
					<div class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-rosys-bg/50 transition-colors">
						<FileText class="w-4 h-4 shrink-0 {ext === 'pdf' ? 'text-red-400' : ext === 'webp' || ext === 'png' ? 'text-blue-400' : ext === 'dxf' ? 'text-amber-400' : 'text-rosys-fg/30'}" strokeWidth={1.5} />
						<span class="text-[12px] text-rosys-fg-muted flex-1 truncate">{file}</span>
						<span class="text-[10px] text-rosys-fg-faint uppercase font-bold">{ext}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
