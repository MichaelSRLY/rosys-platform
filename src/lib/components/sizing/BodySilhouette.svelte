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
	let armDisplay = $state(0);
	let legDisplay = $state(0);

	// Draw-in progress (0→1)
	let silhouetteProgress = $state(0);
	let bustLine = $state(0);
	let waistLine = $state(0);
	let hipLine = $state(0);
	let heightLine = $state(0);
	let profileLines = $state(0);

	function animateValue(from: number, to: number, duration: number, cb: (v: number) => void) {
		const start = performance.now();
		function tick(now: number) {
			const t = Math.min((now - start) / duration, 1);
			const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
			cb(from + (to - from) * eased);
			if (t < 1) requestAnimationFrame(tick);
		}
		requestAnimationFrame(tick);
	}

	$effect(() => {
		// Staggered animation sequence
		animateValue(0, 1, 1000, (v) => silhouetteProgress = v);

		setTimeout(() => {
			bustLine = 1;
			animateValue(0, bust, 700, (v) => bustDisplay = v);
		}, 600);

		setTimeout(() => {
			waistLine = 1;
			animateValue(0, waist, 700, (v) => waistDisplay = v);
		}, 1000);

		setTimeout(() => {
			hipLine = 1;
			animateValue(0, hips, 700, (v) => hipsDisplay = v);
		}, 1400);

		setTimeout(() => {
			heightLine = 1;
			animateValue(0, height, 700, (v) => heightDisplay = v);
		}, 1800);

		// Predicted measurements
		if (profile) {
			setTimeout(() => {
				profileLines = 1;
				if (profile!.shoulder_cm) animateValue(0, profile!.shoulder_cm, 700, (v) => shoulderDisplay = v);
				if (profile!.arm_length_cm) animateValue(0, profile!.arm_length_cm, 700, (v) => armDisplay = v);
				if (profile!.leg_length_cm) animateValue(0, profile!.leg_length_cm, 700, (v) => legDisplay = v);
			}, 2400);
		}
	});
</script>

<div class="relative w-full max-w-[260px] mx-auto">
	<svg viewBox="0 0 280 420" class="w-full h-auto" aria-label="Body measurement diagram">
		<!-- Body silhouette -->
		<path
			d="M 140 30 C 140 30, 125 30, 125 45 L 125 50 C 125 55, 130 58, 132 60 L 120 62 C 105 65, 95 80, 92 95 L 88 120 C 86 130, 88 135, 90 140 L 95 160 C 98 170, 100 175, 100 180 L 98 210 C 96 230, 95 240, 98 260 L 100 280 C 102 295, 105 310, 108 320 L 110 340 C 112 355, 115 370, 118 385 L 120 400 L 130 400 L 128 380 C 126 365, 128 350, 130 340 L 135 310 C 137 300, 138 290, 140 280 C 142 290, 143 300, 145 310 L 150 340 C 152 350, 154 365, 152 380 L 150 400 L 160 400 L 162 385 C 165 370, 168 355, 170 340 L 172 320 C 175 310, 178 295, 180 280 L 182 260 C 185 240, 184 230, 182 210 L 180 180 C 180 175, 182 170, 185 160 L 190 140 C 192 135, 194 130, 192 120 L 188 95 C 185 80, 175 65, 160 62 L 148 60 C 150 58, 155 55, 155 50 L 155 45 C 155 30, 140 30, 140 30 Z"
			fill="none"
			stroke="#e8366d"
			stroke-width="1.5"
			stroke-linejoin="round"
			stroke-dasharray="1200"
			stroke-dashoffset={1200 * (1 - silhouetteProgress)}
			style="filter: drop-shadow(0 0 4px rgba(232,54,109,0.15)); transition: stroke-dashoffset 0.05s linear;"
		/>

		<!-- Bust measurement line -->
		<line x1="60" y1="115" x2="88" y2="115" stroke="#e8366d" stroke-width="1.5" stroke-dasharray="4 2"
			opacity={bustLine} style="transition: opacity 0.3s ease;" />
		<line x1="192" y1="115" x2="220" y2="115" stroke="#e8366d" stroke-width="1.5" stroke-dasharray="4 2"
			opacity={bustLine} style="transition: opacity 0.3s ease;" />
		<g opacity={bustLine} style="transition: opacity 0.4s ease 0.2s;">
			<text x="16" y="112" class="text-[10px] uppercase tracking-wider" fill="#999">Bust</text>
			<text x="16" y="126" class="text-[11px] font-semibold tabular-nums" fill="#333">
				{bustDisplay.toFixed(1)} {units}
			</text>
		</g>

		<!-- Waist measurement line -->
		<line x1="60" y1="175" x2="98" y2="175" stroke="#e8366d" stroke-width="1.5" stroke-dasharray="4 2"
			opacity={waistLine} style="transition: opacity 0.3s ease;" />
		<line x1="182" y1="175" x2="220" y2="175" stroke="#e8366d" stroke-width="1.5" stroke-dasharray="4 2"
			opacity={waistLine} style="transition: opacity 0.3s ease;" />
		<g opacity={waistLine} style="transition: opacity 0.4s ease 0.2s;">
			<text x="16" y="172" class="text-[10px] uppercase tracking-wider" fill="#999">Waist</text>
			<text x="16" y="186" class="text-[11px] font-semibold tabular-nums" fill="#333">
				{waistDisplay.toFixed(1)} {units}
			</text>
		</g>

		<!-- Hip measurement line -->
		<line x1="60" y1="245" x2="96" y2="245" stroke="#e8366d" stroke-width="1.5" stroke-dasharray="4 2"
			opacity={hipLine} style="transition: opacity 0.3s ease;" />
		<line x1="184" y1="245" x2="220" y2="245" stroke="#e8366d" stroke-width="1.5" stroke-dasharray="4 2"
			opacity={hipLine} style="transition: opacity 0.3s ease;" />
		<g opacity={hipLine} style="transition: opacity 0.4s ease 0.2s;">
			<text x="16" y="242" class="text-[10px] uppercase tracking-wider" fill="#999">Hip</text>
			<text x="16" y="256" class="text-[11px] font-semibold tabular-nums" fill="#333">
				{hipsDisplay.toFixed(1)} {units}
			</text>
		</g>

		<!-- Height line (right side, vertical) -->
		<line x1="240" y1="30" x2="240" y2="400" stroke="#c4245a" stroke-width="1" stroke-dasharray="4 2"
			opacity={heightLine} style="transition: opacity 0.3s ease;" />
		<line x1="236" y1="30" x2="244" y2="30" stroke="#c4245a" stroke-width="1.5"
			opacity={heightLine} style="transition: opacity 0.3s ease;" />
		<line x1="236" y1="400" x2="244" y2="400" stroke="#c4245a" stroke-width="1.5"
			opacity={heightLine} style="transition: opacity 0.3s ease;" />
		<g opacity={heightLine} style="transition: opacity 0.4s ease 0.2s;">
			<text x="248" y="218" class="text-[10px] uppercase tracking-wider" fill="#999"
				transform="rotate(90 248 218)">Height</text>
			<text x="248" y="235" class="text-[11px] font-semibold tabular-nums" fill="#333"
				transform="rotate(90 248 235)">
				{heightDisplay.toFixed(1)} {units}
			</text>
		</g>

		<!-- Predicted measurements (MLP) -->
		{#if profile?.shoulder_cm}
			<line x1="105" y1="68" x2="175" y2="68" stroke="#ff94ac" stroke-width="1" stroke-dasharray="3 2"
				opacity={profileLines} style="transition: opacity 0.3s ease;" />
			<g opacity={profileLines} style="transition: opacity 0.4s ease 0.2s;">
				<text x="225" y="60" class="text-[8px] uppercase tracking-wider" fill="#999">Shoulder</text>
				<text x="225" y="72" class="text-[10px] font-medium tabular-nums" fill="#ff5c82">
					{shoulderDisplay.toFixed(1)} {units}
				</text>
			</g>
		{/if}

		{#if profile?.arm_length_cm}
			<g opacity={profileLines} style="transition: opacity 0.4s ease 0.4s;">
				<text x="16" y="296" class="text-[8px] uppercase tracking-wider" fill="#999">Arm</text>
				<text x="16" y="308" class="text-[10px] font-medium tabular-nums" fill="#ff5c82">
					{armDisplay.toFixed(1)} {units}
				</text>
			</g>
		{/if}

		{#if profile?.leg_length_cm}
			<g opacity={profileLines} style="transition: opacity 0.4s ease 0.6s;">
				<text x="16" y="360" class="text-[8px] uppercase tracking-wider" fill="#999">Inseam</text>
				<text x="16" y="372" class="text-[10px] font-medium tabular-nums" fill="#ff5c82">
					{legDisplay.toFixed(1)} {units}
				</text>
			</g>
		{/if}
	</svg>

	<!-- Predicted badge -->
	{#if profile}
		<div class="text-center mt-1" style="opacity: {profileLines}; transition: opacity 0.4s ease 0.8s;">
			<span class="text-[10px] text-rosys-fg-faint">
				Additional measurements predicted from 59,000 body records
			</span>
		</div>
	{/if}
</div>
