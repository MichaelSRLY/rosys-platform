<script lang="ts">
	interface Props {
		bust: number;
		waist: number;
		hips: number;
		height: number;
		units?: string;
		profile?: {
			shoulder_cm?: number;
			arm_length_cm?: number;
			leg_length_cm?: number;
		} | null;
	}

	let { bust, waist, hips, height, units = 'cm', profile = null }: Props = $props();

	// Animated counters
	let bustDisplay = $state(0);
	let waistDisplay = $state(0);
	let hipsDisplay = $state(0);
	let heightDisplay = $state(0);
	let shoulderDisplay = $state(0);

	// Visibility states
	let showSilhouette = $state(false);
	let showBust = $state(false);
	let showWaist = $state(false);
	let showHip = $state(false);
	let showHeight = $state(false);
	let showProfile = $state(false);

	function animate(from: number, to: number, duration: number, cb: (v: number) => void) {
		const start = performance.now();
		function tick(now: number) {
			const t = Math.min((now - start) / duration, 1);
			const eased = 1 - Math.pow(1 - t, 3);
			cb(from + (to - from) * eased);
			if (t < 1) requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	}

	$effect(() => {
		setTimeout(() => showSilhouette = true, 100);
		setTimeout(() => { showBust = true; animate(0, bust, 800, v => bustDisplay = v); }, 800);
		setTimeout(() => { showWaist = true; animate(0, waist, 800, v => waistDisplay = v); }, 1300);
		setTimeout(() => { showHip = true; animate(0, hips, 800, v => hipsDisplay = v); }, 1800);
		setTimeout(() => { showHeight = true; animate(0, height, 800, v => heightDisplay = v); }, 2300);
		if (profile?.shoulder_cm) {
			setTimeout(() => { showProfile = true; animate(0, profile!.shoulder_cm!, 800, v => shoulderDisplay = v); }, 2800);
		}
	});
</script>

<div class="relative w-full max-w-[220px] mx-auto select-none">
	<svg viewBox="0 0 200 360" class="w-full h-auto" aria-label="Body measurement diagram">

		<!-- Feminine body silhouette — clean, minimal, fashion-illustration style -->
		<g style="opacity: {showSilhouette ? 1 : 0}; transition: opacity 0.8s ease;">
			<!-- Head -->
			<ellipse cx="100" cy="28" rx="12" ry="14" fill="none" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="1.2" />
			<!-- Neck -->
			<line x1="95" y1="42" x2="95" y2="52" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="1.2" />
			<line x1="105" y1="42" x2="105" y2="52" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="1.2" />
			<!-- Left side -->
			<path d="M 95 52 C 85 52, 68 56, 64 62 C 60 68, 60 78, 62 88 C 64 98, 66 100, 68 102 C 72 108, 78 110, 80 112 C 84 116, 86 120, 86 124 C 86 128, 82 134, 78 140 C 74 146, 72 150, 72 156 C 72 162, 74 170, 76 176 C 78 182, 80 186, 80 192 C 80 198, 78 210, 76 222 C 74 234, 72 246, 72 258 C 72 270, 74 280, 76 290 C 78 300, 80 310, 82 320 C 83 326, 84 330, 86 336 L 86 346 L 94 346 L 92 336 C 90 326, 90 316, 92 306 C 94 296, 96 286, 98 276"
				fill="none" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="1.2" stroke-linejoin="round" />
			<!-- Right side -->
			<path d="M 105 52 C 115 52, 132 56, 136 62 C 140 68, 140 78, 138 88 C 136 98, 134 100, 132 102 C 128 108, 122 110, 120 112 C 116 116, 114 120, 114 124 C 114 128, 118 134, 122 140 C 126 146, 128 150, 128 156 C 128 162, 126 170, 124 176 C 122 182, 120 186, 120 192 C 120 198, 122 210, 124 222 C 126 234, 128 246, 128 258 C 128 270, 126 280, 124 290 C 122 300, 120 310, 118 320 C 117 326, 116 330, 114 336 L 114 346 L 106 346 L 108 336 C 110 326, 110 316, 108 306 C 106 296, 104 286, 102 276"
				fill="none" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="1.2" stroke-linejoin="round" />
			<!-- Connect legs at bottom center -->
			<path d="M 98 276 C 99 272, 101 272, 102 276" fill="none" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="1.2" />
		</g>

		<!-- Bust line -->
		<g style="opacity: {showBust ? 1 : 0}; transition: opacity 0.4s ease;">
			<line x1="12" y1="100" x2="62" y2="100" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="0.8" stroke-dasharray="3 2" />
			<line x1="138" y1="100" x2="188" y2="100" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="0.8" stroke-dasharray="3 2" />
			<circle cx="62" cy="100" r="2" fill="var(--color-rosys-400, #ff5c82)" />
			<circle cx="138" cy="100" r="2" fill="var(--color-rosys-400, #ff5c82)" />
		</g>
		<g style="opacity: {showBust ? 1 : 0}; transition: opacity 0.5s ease 0.2s;">
			<text x="12" y="95" class="label">BUST</text>
			<text x="12" y="108" class="value">{bustDisplay.toFixed(1)} {units}</text>
		</g>

		<!-- Waist line -->
		<g style="opacity: {showWaist ? 1 : 0}; transition: opacity 0.4s ease;">
			<line x1="12" y1="148" x2="72" y2="148" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="0.8" stroke-dasharray="3 2" />
			<line x1="128" y1="148" x2="188" y2="148" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="0.8" stroke-dasharray="3 2" />
			<circle cx="72" cy="148" r="2" fill="var(--color-rosys-400, #ff5c82)" />
			<circle cx="128" cy="148" r="2" fill="var(--color-rosys-400, #ff5c82)" />
		</g>
		<g style="opacity: {showWaist ? 1 : 0}; transition: opacity 0.5s ease 0.2s;">
			<text x="12" y="143" class="label">WAIST</text>
			<text x="12" y="156" class="value">{waistDisplay.toFixed(1)} {units}</text>
		</g>

		<!-- Hip line -->
		<g style="opacity: {showHip ? 1 : 0}; transition: opacity 0.4s ease;">
			<line x1="12" y1="198" x2="72" y2="198" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="0.8" stroke-dasharray="3 2" />
			<line x1="128" y1="198" x2="188" y2="198" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="0.8" stroke-dasharray="3 2" />
			<circle cx="72" cy="198" r="2" fill="var(--color-rosys-400, #ff5c82)" />
			<circle cx="128" cy="198" r="2" fill="var(--color-rosys-400, #ff5c82)" />
		</g>
		<g style="opacity: {showHip ? 1 : 0}; transition: opacity 0.5s ease 0.2s;">
			<text x="12" y="193" class="label">HIP</text>
			<text x="12" y="206" class="value">{hipsDisplay.toFixed(1)} {units}</text>
		</g>

		<!-- Height (right side) -->
		<g style="opacity: {showHeight ? 1 : 0}; transition: opacity 0.4s ease;">
			<line x1="178" y1="16" x2="178" y2="346" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="0.6" stroke-dasharray="3 2" />
			<line x1="174" y1="16" x2="182" y2="16" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="1" />
			<line x1="174" y1="346" x2="182" y2="346" stroke="var(--color-rosys-400, #ff5c82)" stroke-width="1" />
		</g>
		<g style="opacity: {showHeight ? 1 : 0}; transition: opacity 0.5s ease 0.2s;">
			<text x="183" y="178" class="label" transform="rotate(90 183 178)">HEIGHT</text>
			<text x="183" y="192" class="value" transform="rotate(90 183 192)">{heightDisplay.toFixed(1)} {units}</text>
		</g>

		<!-- Shoulder (predicted) -->
		{#if profile?.shoulder_cm}
			<g style="opacity: {showProfile ? 1 : 0}; transition: opacity 0.5s ease;">
				<line x1="64" y1="62" x2="136" y2="62" stroke="var(--color-rosys-200, #ffc2d1)" stroke-width="0.8" stroke-dasharray="2 2" />
				<circle cx="64" cy="62" r="1.5" fill="var(--color-rosys-200, #ffc2d1)" />
				<circle cx="136" cy="62" r="1.5" fill="var(--color-rosys-200, #ffc2d1)" />
				<text x="143" y="58" class="label-sm">SHOULDER</text>
				<text x="143" y="67" class="value-sm">{shoulderDisplay.toFixed(1)}</text>
			</g>
		{/if}
	</svg>
</div>

<style>
	.label {
		font-size: 7px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		fill: var(--color-rosys-fg-faint, #999);
		font-family: var(--font-ui, Inter, sans-serif);
	}
	.value {
		font-size: 9px;
		font-weight: 700;
		fill: var(--color-rosys-fg, #1a1a1a);
		font-family: var(--font-ui, Inter, sans-serif);
		font-variant-numeric: tabular-nums;
	}
	.label-sm {
		font-size: 6px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		fill: var(--color-rosys-300, #ff94ac);
		font-family: var(--font-ui, Inter, sans-serif);
	}
	.value-sm {
		font-size: 8px;
		font-weight: 600;
		fill: var(--color-rosys-400, #ff5c82);
		font-family: var(--font-ui, Inter, sans-serif);
		font-variant-numeric: tabular-nums;
	}
</style>
