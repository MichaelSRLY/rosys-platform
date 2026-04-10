<script lang="ts">
	interface Props {
		bust: number;
		waist: number;
		hips: number;
		height: number;
		units?: string;
	}

	let { bust, waist, hips, height, units = 'cm' }: Props = $props();

	// Animated counters
	let bustDisplay = $state(0);
	let waistDisplay = $state(0);
	let hipsDisplay = $state(0);
	let heightDisplay = $state(0);

	// Visibility
	let show = $state(false);
	let showBust = $state(false);
	let showWaist = $state(false);
	let showHip = $state(false);
	let showHeight = $state(false);

	function animate(to: number, duration: number, cb: (v: number) => void) {
		const start = performance.now();
		function tick(now: number) {
			const t = Math.min((now - start) / duration, 1);
			cb(to * (1 - Math.pow(1 - t, 3)));
			if (t < 1) requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	}

	$effect(() => {
		setTimeout(() => show = true, 200);
		setTimeout(() => { showBust = true; animate(bust, 900, v => bustDisplay = v); }, 700);
		setTimeout(() => { showWaist = true; animate(waist, 900, v => waistDisplay = v); }, 1200);
		setTimeout(() => { showHip = true; animate(hips, 900, v => hipsDisplay = v); }, 1700);
		setTimeout(() => { showHeight = true; animate(height, 900, v => heightDisplay = v); }, 2200);
	});
</script>

<div class="body-viz" style="opacity: {show ? 1 : 0}">
	<!-- Measurement cards arranged around a central icon -->
	<div class="body-center">
		<!-- Simple, elegant dress form icon -->
		<svg viewBox="0 0 80 160" class="dress-form" aria-hidden="true">
			<defs>
				<linearGradient id="formGrad" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--color-rosys-200, #ffc2d1)" />
					<stop offset="100%" stop-color="var(--color-rosys-100, #ffe0e6)" />
				</linearGradient>
			</defs>
			<!-- Dress form silhouette — clean, fashion-illustration style -->
			<path d="M 40 8 C 44 8, 47 11, 47 15 C 47 19, 44 22, 40 22 C 36 22, 33 19, 33 15 C 33 11, 36 8, 40 8 Z" fill="url(#formGrad)" />
			<path d="M 37 22 L 37 26 C 37 26, 24 30, 22 38 C 20 46, 22 52, 24 56 C 26 60, 30 62, 32 62 C 32 66, 30 72, 28 78 C 26 84, 24 88, 24 92 C 24 96, 26 100, 28 104 L 28 140 C 28 144, 30 146, 32 146 L 34 146 L 34 140 C 34 134, 36 128, 38 124 C 38.5 123, 39.5 122, 40 122 C 40.5 122, 41.5 123, 42 124 C 44 128, 46 134, 46 140 L 46 146 L 48 146 C 50 146, 52 144, 52 140 L 52 104 C 54 100, 56 96, 56 92 C 56 88, 54 84, 52 78 C 50 72, 48 66, 48 62 C 50 62, 54 60, 56 56 C 58 52, 60 46, 58 38 C 56 30, 43 26, 43 26 L 43 22"
				fill="url(#formGrad)" stroke="var(--color-rosys-300, #ff94ac)" stroke-width="0.5" stroke-linejoin="round" />
		</svg>
	</div>

	<!-- Measurement labels -->
	<div class="measurements">
		<div class="measure-row" style="opacity: {showBust ? 1 : 0}; transform: translateY({showBust ? 0 : 8}px)">
			<div class="measure-dot"></div>
			<div class="measure-info">
				<span class="measure-label">Bust</span>
				<span class="measure-value">{bustDisplay.toFixed(1)}<span class="measure-unit"> {units}</span></span>
			</div>
		</div>

		<div class="measure-row" style="opacity: {showWaist ? 1 : 0}; transform: translateY({showWaist ? 0 : 8}px)">
			<div class="measure-dot"></div>
			<div class="measure-info">
				<span class="measure-label">Waist</span>
				<span class="measure-value">{waistDisplay.toFixed(1)}<span class="measure-unit"> {units}</span></span>
			</div>
		</div>

		<div class="measure-row" style="opacity: {showHip ? 1 : 0}; transform: translateY({showHip ? 0 : 8}px)">
			<div class="measure-dot"></div>
			<div class="measure-info">
				<span class="measure-label">Hip</span>
				<span class="measure-value">{hipsDisplay.toFixed(1)}<span class="measure-unit"> {units}</span></span>
			</div>
		</div>

		<div class="measure-row" style="opacity: {showHeight ? 1 : 0}; transform: translateY({showHeight ? 0 : 8}px)">
			<div class="measure-dot dot-muted"></div>
			<div class="measure-info">
				<span class="measure-label">Height</span>
				<span class="measure-value">{heightDisplay.toFixed(1)}<span class="measure-unit"> {units}</span></span>
			</div>
		</div>
	</div>
</div>

<style>
	.body-viz {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		padding: 1.5rem 0;
		transition: opacity 0.6s ease;
	}

	.body-center {
		flex-shrink: 0;
	}

	.dress-form {
		width: 100px;
		height: 200px;
		filter: drop-shadow(0 2px 8px rgba(232, 54, 109, 0.08));
	}

	.measurements {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.measure-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		transition: opacity 0.5s ease, transform 0.5s ease;
	}

	.measure-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-rosys-400, #ff5c82);
		flex-shrink: 0;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-rosys-400, #ff5c82) 15%, transparent);
	}

	.dot-muted {
		background: var(--color-rosys-300, #ff94ac);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-rosys-300, #ff94ac) 12%, transparent);
	}

	.measure-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.measure-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-rosys-fg-faint, #999);
	}

	.measure-value {
		font-size: 20px;
		font-weight: 700;
		color: var(--color-rosys-fg, #1a1a1a);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.measure-unit {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-rosys-fg-faint, #999);
	}
</style>
