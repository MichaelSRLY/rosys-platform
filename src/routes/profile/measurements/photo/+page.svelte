<script lang="ts">
	import { ArrowLeft, Camera, Upload, Loader2, Check, RotateCcw, Save } from 'lucide-svelte';
	import { detectPose, estimateMeasurements, drawPoseOnCanvas, type PoseResult, type BodyMeasurements } from '$lib/body-measurement';

	let frontFile = $state<File | null>(null);
	let frontPreview = $state('');
	let frontPose = $state<PoseResult | null>(null);

	let heightInput = $state('');
	let loading = $state(false);
	let step = $state<'upload' | 'detect' | 'results'>('upload');
	let measurements = $state<BodyMeasurements | null>(null);
	let errorMsg = $state('');

	let canvasRef = $state<HTMLCanvasElement | null>(null);

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		const file = input.files[0];
		frontFile = file;
		frontPreview = URL.createObjectURL(file);
		frontPose = null;
		measurements = null;
		step = 'upload';
	}

	async function analyzePhoto() {
		if (!frontFile || !heightInput) return;
		loading = true;
		errorMsg = '';

		try {
			// Create image element for MediaPipe
			const img = new Image();
			img.crossOrigin = 'anonymous';
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = frontPreview;
			});

			step = 'detect';

			// Detect pose
			const pose = await detectPose(img);
			if (!pose) {
				errorMsg = 'Could not detect a person in the photo. Please try a clearer full-body photo.';
				loading = false;
				step = 'upload';
				return;
			}

			frontPose = pose;

			// Draw pose on canvas
			if (canvasRef) {
				canvasRef.width = img.naturalWidth;
				canvasRef.height = img.naturalHeight;
				const ctx = canvasRef.getContext('2d')!;
				ctx.drawImage(img, 0, 0);
				drawPoseOnCanvas(ctx, pose.landmarks, img.naturalWidth, img.naturalHeight);
			}

			// Estimate measurements
			const height = parseFloat(heightInput);
			measurements = estimateMeasurements(pose, height);
			step = 'results';
		} catch (err) {
			errorMsg = 'Analysis failed. Please try a different photo.';
			step = 'upload';
		} finally {
			loading = false;
		}
	}

	function reset() {
		frontFile = null;
		frontPreview = '';
		frontPose = null;
		measurements = null;
		step = 'upload';
		errorMsg = '';
	}

	async function saveProfile() {
		if (!measurements) return;
		loading = true;

		try {
			const res = await fetch('/profile/measurements?/save', {
				method: 'POST',
				body: new URLSearchParams({
					name: 'Photo Measurement',
					bust_cm: measurements.bust_cm.toString(),
					waist_cm: measurements.waist_cm.toString(),
					hip_cm: measurements.hip_cm.toString(),
					height_cm: measurements.height_cm.toString(),
					shoulder_width_cm: measurements.shoulder_cm.toString(),
					arm_length_cm: measurements.arm_length_cm?.toString() ?? '',
					inseam_cm: measurements.inseam_cm?.toString() ?? '',
					source: 'photo'
				})
			});

			if (res.ok) {
				window.location.href = '/profile/measurements';
			}
		} catch {
			errorMsg = 'Failed to save profile.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Photo Measurement — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-3xl mx-auto">
	<a href="/profile/measurements" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		Measurements
	</a>

	<div class="flex items-center gap-3 mb-8">
		<div class="rosys-section-icon bg-gradient-to-br from-blue-500 to-blue-600">
			<Camera class="w-5 h-5 text-white" strokeWidth={1.5} />
		</div>
		<div>
			<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em]">Photo Measurement</h1>
			<p class="text-rosys-fg-faint text-[13px]">Estimate your measurements from a photo</p>
		</div>
	</div>

	<!-- Instructions -->
	{#if step === 'upload'}
		<div class="rosys-card p-5 mb-6">
			<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">How it works</h2>
			<div class="space-y-2 text-[13px] text-rosys-fg-muted">
				<p>1. Upload a <strong class="text-rosys-fg">full-body front-facing photo</strong></p>
				<p>2. Enter your <strong class="text-rosys-fg">height</strong> for scale calibration</p>
				<p>3. AI detects your body landmarks and estimates measurements</p>
			</div>
			<div class="mt-4 p-3 rounded-lg bg-amber-50/50 border border-amber-200/40 text-[12px] text-amber-700">
				For best results: wear fitted clothing, stand straight, arms slightly away from body, well-lit room. Accuracy: +/- 3-5cm.
			</div>
		</div>

		<!-- Height input -->
		<div class="rosys-card p-5 mb-4">
			<label for="height" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Your Height (cm)</label>
			<input
				id="height" type="number" bind:value={heightInput}
				placeholder="e.g. 168"
				class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[15px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-300 transition-all"
			/>
		</div>

		<!-- Photo upload -->
		<div class="rosys-card p-5 mb-6">
			{#if frontPreview}
				<div class="relative mb-4">
					<img src={frontPreview} alt="Your photo" class="w-full max-h-[400px] object-contain rounded-xl" />
					<button
						type="button"
						onclick={reset}
						class="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
					>
						<RotateCcw class="w-4 h-4" strokeWidth={2} />
					</button>
				</div>
			{:else}
				<label class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-rosys-border/50 rounded-2xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/20 transition-all">
					<Upload class="w-8 h-8 text-rosys-fg-faint mb-3" strokeWidth={1.5} />
					<span class="text-[14px] font-medium text-rosys-fg-muted mb-1">Upload front photo</span>
					<span class="text-[12px] text-rosys-fg-faint">Full body, facing camera</span>
					<input type="file" accept="image/*" capture="user" onchange={handleFileSelect} class="hidden" />
				</label>
			{/if}
		</div>

		{#if errorMsg}
			<p class="text-rosys-500 text-[13px] mb-4">{errorMsg}</p>
		{/if}

		<button
			type="button"
			disabled={!frontFile || !heightInput || loading}
			onclick={analyzePhoto}
			class="w-full py-3.5 inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{#if loading}
				<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
				Analyzing...
			{:else}
				<Camera class="w-4 h-4" strokeWidth={2} />
				Analyze Photo
			{/if}
		</button>
	{/if}

	<!-- Detection in progress -->
	{#if step === 'detect'}
		<div class="rosys-card p-12 text-center">
			<Loader2 class="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" strokeWidth={1.5} />
			<p class="text-[15px] font-medium text-rosys-fg">Detecting body landmarks...</p>
			<p class="text-[12px] text-rosys-fg-faint mt-1">This may take a few seconds on first use</p>
		</div>
	{/if}

	<!-- Results -->
	{#if step === 'results' && measurements}
		<!-- Pose visualization -->
		<div class="rosys-card p-4 mb-6 page-enter">
			<canvas
				bind:this={canvasRef}
				class="w-full max-h-[400px] object-contain rounded-xl"
			></canvas>
			<div class="flex items-center gap-2 mt-2">
				<div class="w-3 h-3 rounded-full bg-rosys-500"></div>
				<span class="text-[11px] text-rosys-fg-faint">Detected landmarks (confidence: {(measurements.confidence * 100).toFixed(0)}%)</span>
			</div>
		</div>

		<!-- Measurement results -->
		<div class="rosys-card border-blue-200/60 p-6 mb-6 page-enter">
			<div class="flex items-center gap-2 mb-5">
				<div class="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center">
					<Check class="w-4 h-4 text-white" strokeWidth={2.5} />
				</div>
				<div>
					<p class="text-[11px] font-semibold text-blue-600 uppercase tracking-[0.1em]">Estimated Measurements</p>
					<p class="text-[12px] text-rosys-fg-faint">From photo analysis (+/- 3-5cm accuracy)</p>
				</div>
			</div>

			<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
				{#each [
					{ label: 'Bust', value: measurements.bust_cm, unit: 'cm' },
					{ label: 'Waist', value: measurements.waist_cm, unit: 'cm' },
					{ label: 'Hip', value: measurements.hip_cm, unit: 'cm' },
					{ label: 'Shoulder', value: measurements.shoulder_cm, unit: 'cm' },
					{ label: 'Arm Length', value: measurements.arm_length_cm, unit: 'cm' },
					{ label: 'Inseam', value: measurements.inseam_cm, unit: 'cm' }
				] as item}
					{#if item.value}
						<div class="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
							<p class="text-[11px] text-blue-500 font-semibold uppercase tracking-wider mb-0.5">{item.label}</p>
							<p class="text-[20px] font-bold text-rosys-fg">{item.value}<span class="text-[13px] font-normal text-rosys-fg-muted">{item.unit}</span></p>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				type="button"
				onclick={saveProfile}
				disabled={loading}
				class="rosys-btn-primary flex-1 py-3"
			>
				{#if loading}
					<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
				{:else}
					<Save class="w-4 h-4" strokeWidth={2} />
				{/if}
				Save as Profile
			</button>
			<button
				type="button"
				onclick={reset}
				class="px-4 py-3 rounded-xl text-[14px] font-medium text-rosys-fg-muted hover:bg-warm-100 transition-colors"
			>
				Retake
			</button>
		</div>
	{/if}
</div>
