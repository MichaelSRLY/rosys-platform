<script lang="ts">
	import { ArrowLeft, Save, Eye, Upload, Trash2, Image, FileText, LayoutGrid, AlignLeft, AlignRight, Maximize } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form: actionResult } = $props();
	const { catalog, adminConfig, embeddingStats, stepCount, storageFiles, stepIllustrations, stepIllustrationPaths, slug } = data;

	let tab = $state<'overview' | 'steps' | 'files'>('overview');
	let displayName = $state(adminConfig?.display_name || catalog.pattern_name);
	let category = $state(adminConfig?.category || '');
	let difficulty = $state(adminConfig?.difficulty || '');
	let description = $state(adminConfig?.description || '');
	let isPublished = $state(adminConfig?.is_published || false);
	let saving = $state(false);

	// Steps config: per-step layout + illustration paths
	interface StepConfig {
		step: number;
		layout: 'text-left' | 'text-right' | 'image-top' | 'text-only';
		illustrations: string[]; // storage paths
	}

	let stepsConfig = $state<StepConfig[]>(
		adminConfig?.steps_config ||
		Array.from({ length: stepCount }, (_, i) => ({
			step: i + 1,
			layout: 'text-left' as const,
			illustrations: [] as string[]
		}))
	);

	// Ensure all steps have config
	$effect(() => {
		if (stepsConfig.length < stepCount) {
			const existing = new Set(stepsConfig.map((s) => s.step));
			for (let i = 1; i <= stepCount; i++) {
				if (!existing.has(i)) {
					stepsConfig = [...stepsConfig, { step: i, layout: 'text-left', illustrations: [] }];
				}
			}
		}
	});

	let uploading = $state<number | null>(null);

	async function uploadIllustration(stepNum: number, file: File, index: number) {
		uploading = stepNum;
		const form = new FormData();
		form.append('file', file);
		form.append('slug', slug);
		form.append('step', String(stepNum));
		form.append('index', String(index));

		try {
			const res = await fetch('/api/admin/upload-illustration', { method: 'POST', body: form });
			if (!res.ok) throw new Error('Upload failed');
			const { path } = await res.json();

			// Update step config
			stepsConfig = stepsConfig.map((s) => {
				if (s.step === stepNum) {
					const newIllustrations = [...s.illustrations];
					newIllustrations[index - 1] = path;
					return { ...s, illustrations: newIllustrations };
				}
				return s;
			});

			await invalidateAll();
		} catch (e) {
			console.error('Upload error:', e);
		} finally {
			uploading = null;
		}
	}

	function handleFileSelect(stepNum: number, index: number, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) uploadIllustration(stepNum, file, index);
	}

	function setLayout(stepNum: number, layout: StepConfig['layout']) {
		stepsConfig = stepsConfig.map((s) => s.step === stepNum ? { ...s, layout } : s);
	}

	function getSignedUrl(path: string): string {
		return stepIllustrations[path] || '';
	}

	const categories = ['dress', 'top', 'jacket', 'coat', 'skirt', 'set', 'bag', 'bundle', 'other'];
	const difficulties = ['beginner', 'intermediate', 'advanced'];

	const layouts = [
		{ value: 'text-left', label: 'Text Left', icon: AlignLeft },
		{ value: 'text-right', label: 'Text Right', icon: AlignRight },
		{ value: 'image-top', label: 'Image Top', icon: Maximize },
		{ value: 'text-only', label: 'Text Only', icon: FileText }
	] as const;
</script>

<svelte:head><title>{catalog.pattern_name} — Admin</title></svelte:head>

<div class="page-enter px-6 py-8 max-w-5xl mx-auto">
	<a href="/admin/patterns" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[12px] font-medium mb-6 transition-colors">
		<ArrowLeft class="w-3.5 h-3.5" strokeWidth={1.5} /> Patterns
	</a>

	<!-- Header -->
	<div class="flex items-start justify-between mb-6">
		<div>
			<h1 class="text-[24px] font-bold text-rosys-fg">{catalog.pattern_name}</h1>
			<p class="text-[13px] text-rosys-fg-faint">{slug} · {stepCount} steps · {storageFiles.length} files</p>
		</div>
		<div class="flex items-center gap-3">
			<a href="/patterns/{slug}" target="_blank" class="px-3 py-1.5 rounded-lg bg-rosys-bg-alt text-[12px] font-medium text-rosys-fg-muted hover:text-rosys-fg transition-colors">
				<Eye class="w-3.5 h-3.5 inline" strokeWidth={1.5} /> Preview
			</a>
			<span class="px-3 py-1.5 rounded-lg text-[12px] font-bold {isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-rosys-bg-alt text-rosys-fg-faint'}">
				{isPublished ? 'Published' : 'Draft'}
			</span>
		</div>
	</div>

	<!-- Embedding badges -->
	<div class="flex gap-1.5 mb-6 flex-wrap">
		{#each embeddingStats as stat}
			<span class="px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">{stat.chunk_type}: {stat.count}</span>
		{/each}
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 mb-6 bg-rosys-bg-alt rounded-lg p-0.5 w-fit">
		{#each [['overview', 'Overview'], ['steps', `Steps (${stepCount})`], ['files', 'Files']] as [val, label]}
			<button onclick={() => (tab = val as any)}
				class="px-4 py-2 rounded-md text-[12px] font-semibold transition-all {tab === val ? 'bg-rosys-card shadow-sm text-rosys-fg' : 'text-rosys-fg-faint'}">{label}</button>
		{/each}
	</div>

	<form method="POST" action="?/save" use:enhance={() => { saving = true; return async ({ update }) => { saving = false; update(); }; }}>
		<input type="hidden" name="steps_config" value={JSON.stringify(stepsConfig)} />
		<input type="hidden" name="overview_pages" value="[]" />
		<input type="hidden" name="is_published" value={String(isPublished)} />

		<!-- OVERVIEW TAB -->
		{#if tab === 'overview'}
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
						<span class="text-[13px] font-medium text-rosys-fg">Published</span>
					</label>
				</div>
				<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm">
					<h2 class="text-[13px] font-semibold text-rosys-fg mb-3">Quick Info</h2>
					<div class="space-y-2 text-[12px] text-rosys-fg-muted">
						<p>{storageFiles.length} files in storage</p>
						<p>{stepCount} sewing steps detected</p>
						<p>{stepsConfig.filter((s) => s.illustrations.length > 0).length} steps have illustrations</p>
						<div class="flex gap-2 mt-3 flex-wrap">
							{#if catalog.has_instructions}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">PDF</span>{/if}
							{#if catalog.has_a0}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">A0</span>{/if}
							{#if catalog.has_dxf}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">DXF</span>{/if}
							{#if catalog.has_finished_images}<span class="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">Images</span>{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- STEPS TAB -->
		{#if tab === 'steps'}
			<div class="space-y-4 mb-6">
				{#each stepsConfig.sort((a, b) => a.step - b.step) as stepCfg}
					{@const hasIllustrations = stepCfg.illustrations.filter(Boolean).length > 0}
					<div class="bg-rosys-card rounded-2xl border {hasIllustrations ? 'border-emerald-200/50' : 'border-rosys-border/40'} p-5 shadow-sm">
						<div class="flex items-center justify-between mb-4">
							<div class="flex items-center gap-3">
								<span class="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-[14px] font-bold text-pink-600">{stepCfg.step}</span>
								<h3 class="text-[14px] font-semibold text-rosys-fg">Step {stepCfg.step}</h3>
								{#if hasIllustrations}
									<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-700">{stepCfg.illustrations.filter(Boolean).length} image(s)</span>
								{/if}
							</div>

							<!-- Layout selector -->
							<div class="flex gap-1">
								{#each layouts as l}
									<button type="button" onclick={() => setLayout(stepCfg.step, l.value)}
										class="p-2 rounded-lg transition-all {stepCfg.layout === l.value ? 'bg-rosys-fg text-white' : 'bg-rosys-bg text-rosys-fg-faint hover:text-rosys-fg'}"
										title={l.label}>
										<l.icon class="w-4 h-4" strokeWidth={1.5} />
									</button>
								{/each}
							</div>
						</div>

						<!-- Illustration upload slots -->
						<div class="grid grid-cols-2 gap-3">
							{#each [1, 2] as imgIndex}
								{@const path = stepCfg.illustrations[imgIndex - 1]}
								{@const signedUrl = path ? getSignedUrl(path) : ''}
								<div class="relative">
									{#if signedUrl}
										<div class="aspect-[4/3] rounded-xl overflow-hidden border border-rosys-border/40 bg-white">
											<img src={signedUrl} alt="Step {stepCfg.step} illustration {imgIndex}" class="w-full h-full object-contain" />
										</div>
										<span class="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">#{imgIndex}</span>
									{:else}
										<label class="flex flex-col items-center justify-center aspect-[4/3] rounded-xl border-2 border-dashed border-rosys-border/40 hover:border-rosys-fg/30 cursor-pointer transition-colors bg-rosys-bg/50">
											<Upload class="w-6 h-6 text-rosys-fg/20 mb-2" strokeWidth={1.5} />
											<span class="text-[11px] text-rosys-fg-faint font-medium">
												{uploading === stepCfg.step ? 'Uploading...' : `Image ${imgIndex}`}
											</span>
											<input type="file" accept="image/*" class="hidden"
												onchange={(e) => handleFileSelect(stepCfg.step, imgIndex, e)} />
										</label>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- FILES TAB -->
		{#if tab === 'files'}
			<div class="bg-rosys-card rounded-2xl border border-rosys-border/40 p-5 shadow-sm mb-6">
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

		<!-- Save button -->
		{#if actionResult?.success}
			<div class="mb-4 px-4 py-2 rounded-lg bg-emerald-50 text-[13px] text-emerald-700 font-medium">Saved!</div>
		{/if}

		<button type="submit" disabled={saving}
			class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rosys-fg text-white text-[13px] font-semibold hover:bg-rosys-fg/90 active:scale-[0.98] transition-all disabled:opacity-40">
			<Save class="w-4 h-4" strokeWidth={1.5} />
			{saving ? 'Saving...' : 'Save Changes'}
		</button>
	</form>
</div>
