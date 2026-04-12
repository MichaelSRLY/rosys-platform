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
		}
	});
</script>

<svelte:head>
	<title>My Measurements — Rosys Patterns</title>
</svelte:head>

<div class="page-enter mesh-bg min-h-screen px-6 py-10 md:px-10 md:py-14 max-w-3xl mx-auto">
	<a href="/patterns" class="rosys-back-link mb-10 inline-flex">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		Patterns
	</a>

	<!-- Header row -->
	<div class="flex items-center justify-between mb-10" style="animation: fadeUp 0.45s var(--ease-spring) 0.05s both;">
		<div class="flex items-center gap-4">
			<div class="rosys-section-icon">
				<Ruler class="w-5 h-5 text-white" strokeWidth={1.5} />
			</div>
			<div>
				<h1 class="text-rosys-fg text-[26px] md:text-[30px] font-bold tracking-[-0.04em]">My Measurements</h1>
				<p class="text-rosys-fg-faint text-[14px] mt-0.5">Save once, use for every pattern</p>
			</div>
		</div>
		{#if !editing}
			<div class="flex items-center gap-2.5">
				<a href="/profile/measurements/photo"
					class="rosys-btn-secondary text-[13px] text-blue-600 hover:border-blue-200"
					style="background: linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02)); border-color: rgba(59,130,246,0.12);">
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
		<div class="space-y-4 mb-10">
			{#each data.profiles as profile, i}
				<button
					type="button"
					onclick={() => editProfile(profile)}
					class="stagger-item w-full text-left rosys-card p-6 transition-all duration-300"
					style="--i: {i}; box-shadow: var(--shadow-md);"
				>
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-[16px] font-bold text-rosys-fg">{profile.name}</h3>
						<!-- Source badge as rosys-tag with colored variants -->
						<span class="rosys-tag
							{profile.source === 'neckstimate' ? 'text-violet-600' :
							 profile.source === 'photo' ? 'text-blue-600' :
							 ''}"
							style={profile.source === 'neckstimate'
								? 'background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03)); border-color: rgba(139,92,246,0.15);'
								: profile.source === 'photo'
									? 'background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03)); border-color: rgba(59,130,246,0.15);'
									: ''}
						>{profile.source}</span>
					</div>
					<div class="flex gap-7 text-[14px] text-rosys-fg-muted">
						<span>Bust: <strong class="text-rosys-fg tabular-nums">{profile.bust_cm}cm</strong></span>
						<span>Waist: <strong class="text-rosys-fg tabular-nums">{profile.waist_cm}cm</strong></span>
						<span>Hip: <strong class="text-rosys-fg tabular-nums">{profile.hip_cm}cm</strong></span>
						{#if profile.height_cm}
							<span>Height: <strong class="text-rosys-fg tabular-nums">{profile.height_cm}cm</strong></span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{:else if !editing}
		<div class="rosys-card p-12 text-center mb-10" style="box-shadow: var(--shadow-xl);">
			<div class="w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-5 float"
				style="background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.02)); border: 1px solid rgba(232,54,109,0.08);">
				<Ruler class="w-7 h-7 text-rosys-300" strokeWidth={1} />
			</div>
			<p class="text-[16px] text-rosys-fg font-semibold mb-2">No measurement profiles yet</p>
			<p class="text-[14px] text-rosys-fg-faint max-w-sm mx-auto leading-relaxed">Save your measurements once and get instant size recommendations for every pattern.</p>
		</div>
	{/if}

	<!-- Edit/Create form -->
	{#if editing}
		<div class="rosys-card p-8 mb-8" style="box-shadow: var(--shadow-xl); animation: scaleIn 0.45s var(--ease-spring);">
			<!-- Neckstimate quick fill — violet gradient card -->
			<div class="flex items-center gap-4 p-5 mb-8 rounded-2xl"
				style="background: linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02)); border: 1px solid rgba(139,92,246,0.12);">
				<div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
					style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); box-shadow: 0 4px 14px rgba(139,92,246,0.3);">
					<Sparkles class="w-5 h-5 text-white" strokeWidth={1.5} />
				</div>
				<div class="flex-1">
					<p class="text-[14px] font-bold text-violet-800 mb-2">Quick estimate from neck</p>
					<div class="flex items-center gap-2.5">
						<input
							type="number"
							bind:value={neckInput}
							placeholder="Neck (cm)"
							class="w-28 px-3.5 py-2 rounded-lg bg-white border border-violet-200/60 text-[13px] text-rosys-fg focus:outline-none focus:ring-2 focus:ring-violet-300/30 transition-all duration-200"
						/>
						<button
							type="button"
							onclick={estimateFromNeck}
							disabled={!neckInput}
							class="px-4 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
							style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); box-shadow: 0 4px 14px rgba(139,92,246,0.25);"
						>
							Estimate
						</button>
						<span class="text-[11px] text-violet-500 hidden sm:inline font-medium">FreeSewing model</span>
					</div>
				</div>
			</div>

			<form method="POST" action="?/save" use:enhance>
				{#if editing.id}
					<input type="hidden" name="id" value={editing.id} />
				{/if}
				<input type="hidden" name="source" value={editing.source} />

				<div class="mb-6">
					<label for="name" class="block text-[12px] font-semibold text-rosys-fg-muted mb-2">Profile Name</label>
					<input id="name" name="name" type="text" bind:value={editing.name}
						class="rosys-input" />
				</div>

				<h3 class="rosys-section-label mb-4">Essential Measurements (cm)</h3>
				<div class="grid grid-cols-2 gap-5 mb-7">
					{#each [
						{ id: 'bust_cm', label: 'Bust', placeholder: '88' },
						{ id: 'waist_cm', label: 'Waist', placeholder: '72' },
						{ id: 'hip_cm', label: 'Hip', placeholder: '96' },
						{ id: 'height_cm', label: 'Height', placeholder: '168', optional: true }
					] as field}
						<div>
							<label for={field.id} class="block text-[12px] font-semibold text-rosys-fg-muted mb-2">
								{field.label}
								{#if field.optional}<span class="text-rosys-fg-faint font-normal">(optional)</span>{/if}
							</label>
							<input
								id={field.id} name={field.id} type="number" step="0.1"
								bind:value={editing[field.id]}
								onblur={checkProportions}
								placeholder={field.placeholder}
								required={!field.optional}
								class="rosys-input"
							/>
						</div>
					{/each}
				</div>

				<!-- Proportion warnings -->
				{#if warnings.length > 0}
					<div class="mb-6 p-4 rounded-xl"
						style="background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03)); border: 1px solid rgba(245,158,11,0.15); animation: slideDown 0.35s var(--ease-spring);">
						{#each warnings as w}
							<div class="flex items-start gap-2.5 text-[13px] text-amber-700 py-0.5">
								<AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
								<span>{w}</span>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Advanced measurements toggle -->
				<button
					type="button"
					onclick={() => showAdvanced = !showAdvanced}
					class="text-[13px] font-semibold text-rosys-fg-faint hover:text-rosys-600 mb-5 transition-all duration-200"
				>
					{showAdvanced ? 'Hide' : 'Show'} advanced measurements
				</button>

				{#if showAdvanced}
					<div class="grid grid-cols-2 gap-5 mb-7" style="animation: slideDown 0.35s var(--ease-spring);">
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
								<label for={field.id} class="block text-[12px] font-semibold text-rosys-fg-muted mb-2">{field.label}</label>
								<input
									id={field.id} name={field.id} type="number" step="0.1"
									bind:value={editing[field.id]}
									placeholder={field.placeholder}
									class="rosys-input"
								/>
							</div>
						{/each}
					</div>
				{/if}

				<div class="flex items-center gap-3">
					<button type="submit" class="rosys-btn-primary shine-effect flex-1 py-3.5">
						<Save class="w-4 h-4" strokeWidth={2} />
						{editing.id ? 'Update' : 'Save'} Profile
					</button>
					<button
						type="button"
						onclick={() => editing = null}
						class="rosys-btn-secondary px-6 py-3.5"
					>
						Cancel
					</button>
				</div>
			</form>

			{#if editing.id}
				<form method="POST" action="?/delete" use:enhance class="mt-5 pt-4 border-t border-rosys-border/15">
					<input type="hidden" name="id" value={editing.id} />
					<button type="submit" class="flex items-center gap-2 text-[13px] text-rosys-fg-faint hover:text-red-500 transition-colors duration-200">
						<Trash2 class="w-3.5 h-3.5" strokeWidth={1.5} />
						Delete profile
					</button>
				</form>
			{/if}
		</div>
	{/if}
</div>
