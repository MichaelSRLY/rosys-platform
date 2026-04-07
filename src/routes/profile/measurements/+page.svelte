<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Ruler, Plus, Trash2, Save, Sparkles, AlertTriangle, Camera } from 'lucide-svelte';
	import { estimateKeyMeasurements, validateProportions } from '$lib/neckstimate';

	let { data, form: actionResult } = $props();

	let profiles = $state(data.profiles);
	let editing = $state<any>(null);
	let showAdvanced = $state(false);
	let neckInput = $state('');
	let warnings = $state<string[]>([]);

	function startNew() {
		editing = {
			id: null,
			name: 'My Measurements',
			bust_cm: '', waist_cm: '', hip_cm: '', height_cm: '',
			neck_cm: '', shoulder_width_cm: '', high_bust_cm: '', underbust_cm: '',
			arm_length_cm: '', upper_arm_cm: '', wrist_cm: '', inseam_cm: '',
			source: 'manual'
		};
		showAdvanced = false;
		warnings = [];
	}

	function editProfile(p: any) {
		editing = { ...p };
		showAdvanced = !!(p.neck_cm || p.shoulder_width_cm || p.high_bust_cm);
		warnings = [];
	}

	function estimateFromNeck() {
		if (!neckInput) return;
		const neck = parseFloat(neckInput);
		if (isNaN(neck) || neck < 25 || neck > 60) return;

		const est = estimateKeyMeasurements(neck, 'female');
		editing.bust_cm = est.bust_cm.toFixed(1);
		editing.waist_cm = est.waist_cm.toFixed(1);
		editing.hip_cm = est.hip_cm.toFixed(1);
		editing.shoulder_width_cm = est.shoulder_cm.toFixed(1);
		editing.neck_cm = neck.toString();
		editing.source = 'neckstimate';
	}

	function checkProportions() {
		if (!editing?.bust_cm || !editing?.waist_cm || !editing?.hip_cm) {
			warnings = [];
			return;
		}
		warnings = validateProportions(
			parseFloat(editing.bust_cm),
			parseFloat(editing.waist_cm),
			parseFloat(editing.hip_cm),
			'female'
		);
	}

	$effect(() => {
		if (actionResult?.success) {
			editing = null;
			// Data will be reloaded by SvelteKit
		}
	});
</script>

<svelte:head>
	<title>My Measurements — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-3xl mx-auto">
	<a href="/patterns" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		Patterns
	</a>

	<div class="flex items-center justify-between mb-8">
		<div class="flex items-center gap-3">
			<div class="rosys-section-icon">
				<Ruler class="w-5 h-5 text-white" strokeWidth={1.5} />
			</div>
			<div>
				<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em]">My Measurements</h1>
				<p class="text-rosys-fg-faint text-[13px]">Save once, use for every pattern</p>
			</div>
		</div>
		{#if !editing}
			<div class="flex items-center gap-2">
				<a href="/profile/measurements/photo" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
					<Camera class="w-4 h-4" strokeWidth={1.5} />
					From Photo
				</a>
				<button type="button" onclick={startNew} class="rosys-btn-primary">
					<Plus class="w-4 h-4" strokeWidth={2} />
					Manual
				</button>
			</div>
		{/if}
	</div>

	<!-- Existing profiles -->
	{#if !editing && data.profiles.length > 0}
		<div class="space-y-3 mb-8">
			{#each data.profiles as profile}
				<button
					type="button"
					onclick={() => editProfile(profile)}
					class="w-full text-left rosys-card p-5 hover:shadow-md transition-shadow"
				>
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-[15px] font-semibold text-rosys-fg">{profile.name}</h3>
						<span class="text-[11px] text-rosys-fg-faint bg-warm-100 px-2 py-0.5 rounded-md">{profile.source}</span>
					</div>
					<div class="flex gap-6 text-[13px] text-rosys-fg-muted">
						<span>Bust: <strong class="text-rosys-fg">{profile.bust_cm}cm</strong></span>
						<span>Waist: <strong class="text-rosys-fg">{profile.waist_cm}cm</strong></span>
						<span>Hip: <strong class="text-rosys-fg">{profile.hip_cm}cm</strong></span>
						{#if profile.height_cm}
							<span>Height: <strong class="text-rosys-fg">{profile.height_cm}cm</strong></span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{:else if !editing}
		<div class="rosys-card p-8 text-center mb-8">
			<Ruler class="w-10 h-10 text-rosys-fg/10 mx-auto mb-3" strokeWidth={1} />
			<p class="text-[14px] text-rosys-fg-muted mb-1">No measurement profiles yet</p>
			<p class="text-[12px] text-rosys-fg-faint">Save your measurements once and get instant size recommendations for every pattern.</p>
		</div>
	{/if}

	<!-- Edit/Create form -->
	{#if editing}
		<div class="rosys-card p-6 mb-6 page-enter">
			<!-- Neckstimate quick fill -->
			<div class="flex items-center gap-3 p-4 mb-6 rounded-xl bg-violet-50/50 border border-violet-200/40">
				<Sparkles class="w-5 h-5 text-violet-500 shrink-0" strokeWidth={1.5} />
				<div class="flex-1">
					<p class="text-[13px] font-medium text-violet-800 mb-1">Quick estimate from neck measurement</p>
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={neckInput}
							placeholder="Neck (cm)"
							class="w-28 px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-[13px] text-rosys-fg focus:outline-none focus:ring-2 focus:ring-violet-300/30"
						/>
						<button
							type="button"
							onclick={estimateFromNeck}
							disabled={!neckInput}
							class="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-[12px] font-semibold hover:bg-violet-600 disabled:opacity-40 transition-colors"
						>
							Estimate
						</button>
						<span class="text-[11px] text-violet-500">Uses FreeSewing proportional model</span>
					</div>
				</div>
			</div>

			<form method="POST" action="?/save" use:enhance>
				{#if editing.id}
					<input type="hidden" name="id" value={editing.id} />
				{/if}
				<input type="hidden" name="source" value={editing.source} />

				<div class="mb-5">
					<label for="name" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Profile Name</label>
					<input id="name" name="name" type="text" bind:value={editing.name}
						class="w-full px-4 py-2.5 rounded-xl bg-warm-50 border border-rosys-border/50 text-[14px] text-rosys-fg focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-300 transition-all" />
				</div>

				<h3 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Essential Measurements (cm)</h3>
				<div class="grid grid-cols-2 gap-4 mb-6">
					{#each [
						{ id: 'bust_cm', label: 'Bust', placeholder: '88' },
						{ id: 'waist_cm', label: 'Waist', placeholder: '72' },
						{ id: 'hip_cm', label: 'Hip', placeholder: '96' },
						{ id: 'height_cm', label: 'Height', placeholder: '168', optional: true }
					] as field}
						<div>
							<label for={field.id} class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">
								{field.label}
								{#if field.optional}<span class="text-rosys-fg-faint">(optional)</span>{/if}
							</label>
							<input
								id={field.id} name={field.id} type="number" step="0.1"
								bind:value={editing[field.id]}
								onblur={checkProportions}
								placeholder={field.placeholder}
								required={!field.optional}
								class="w-full px-4 py-2.5 rounded-xl bg-warm-50 border border-rosys-border/50 text-[14px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-300 transition-all"
							/>
						</div>
					{/each}
				</div>

				<!-- Proportion warnings -->
				{#if warnings.length > 0}
					<div class="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
						{#each warnings as w}
							<div class="flex items-start gap-2 text-[12px] text-amber-700">
								<AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
								<span>{w}</span>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Advanced measurements toggle -->
				<button
					type="button"
					onclick={() => showAdvanced = !showAdvanced}
					class="text-[12px] font-medium text-rosys-fg-faint hover:text-rosys-600 mb-4 transition-colors"
				>
					{showAdvanced ? 'Hide' : 'Show'} advanced measurements
				</button>

				{#if showAdvanced}
					<div class="grid grid-cols-2 gap-4 mb-6 page-enter">
						{#each [
							{ id: 'neck_cm', label: 'Neck', placeholder: '34' },
							{ id: 'shoulder_width_cm', label: 'Shoulder Width', placeholder: '42' },
							{ id: 'high_bust_cm', label: 'High Bust', placeholder: '86' },
							{ id: 'underbust_cm', label: 'Underbust', placeholder: '78' },
							{ id: 'arm_length_cm', label: 'Arm Length', placeholder: '59' },
							{ id: 'upper_arm_cm', label: 'Upper Arm', placeholder: '27' },
							{ id: 'wrist_cm', label: 'Wrist', placeholder: '16' },
							{ id: 'inseam_cm', label: 'Inseam', placeholder: '77' }
						] as field}
							<div>
								<label for={field.id} class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">{field.label}</label>
								<input
									id={field.id} name={field.id} type="number" step="0.1"
									bind:value={editing[field.id]}
									placeholder={field.placeholder}
									class="w-full px-4 py-2.5 rounded-xl bg-warm-50 border border-rosys-border/50 text-[14px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 focus:border-rosys-300 transition-all"
								/>
							</div>
						{/each}
					</div>
				{/if}

				<div class="flex items-center gap-3">
					<button type="submit" class="rosys-btn-primary flex-1 py-3">
						<Save class="w-4 h-4" strokeWidth={2} />
						{editing.id ? 'Update' : 'Save'} Profile
					</button>
					<button
						type="button"
						onclick={() => editing = null}
						class="px-4 py-3 rounded-xl text-[14px] font-medium text-rosys-fg-muted hover:bg-warm-100 transition-colors"
					>
						Cancel
					</button>
				</div>
			</form>

			{#if editing.id}
				<form method="POST" action="?/delete" use:enhance class="mt-3">
					<input type="hidden" name="id" value={editing.id} />
					<button type="submit" class="flex items-center gap-1.5 text-[12px] text-rosys-fg-faint hover:text-red-500 transition-colors">
						<Trash2 class="w-3.5 h-3.5" strokeWidth={1.5} />
						Delete profile
					</button>
				</form>
			{/if}
		</div>
	{/if}
</div>
