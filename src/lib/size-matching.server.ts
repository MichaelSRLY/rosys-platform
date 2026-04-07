/**
 * Deterministic size matching engine.
 * Queries structured size charts and returns precise recommendations
 * without relying on LLM for arithmetic.
 */

import { query } from '$lib/db.server';

export interface SizeChartRow {
	pattern_slug: string;
	chart_type: 'body' | 'finished';
	size: string;
	bust_cm: number | null;
	waist_cm: number | null;
	hip_cm: number | null;
	shoulder_cm: number | null;
	sleeve_length_cm: number | null;
	full_length_cm: number | null;
	bottom_sweep_cm: number | null;
	zipper_length_cm: number | null;
	extra_measurements: Record<string, number>;
}

export interface PatternSizeChart {
	pattern_slug: string;
	sizes: string[];
	body: SizeChartRow[];
	finished: SizeChartRow[];
}

export interface MeasurementFit {
	label: string;
	user_cm: number;
	chart_cm: number;
	diff_cm: number;
	fit: 'tight' | 'exact' | 'comfortable' | 'loose';
}

export interface SizeMatch {
	size: string;
	score: number; // lower = better match
	bust: MeasurementFit | null;
	waist: MeasurementFit | null;
	hip: MeasurementFit | null;
	ease: { bust_cm: number | null; waist_cm: number | null; hip_cm: number | null };
}

export interface SizeRecommendation {
	recommended: SizeMatch;
	allMatches: SizeMatch[];
	betweenSizes: boolean;
	lowerSize: string | null;
	upperSize: string | null;
	patternChart: PatternSizeChart;
}

const SIZE_ORDER: Record<string, number> = {
	XXS: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5, '2XL': 6, '3XL': 7, '4XL': 8, '5XL': 9
};

function fitCategory(diff: number): MeasurementFit['fit'] {
	if (diff < -2) return 'tight';
	if (diff <= 2) return 'exact';
	if (diff <= 6) return 'comfortable';
	return 'loose';
}

function makeFit(label: string, userVal: number, chartVal: number | null): MeasurementFit | null {
	if (chartVal === null) return null;
	const diff = chartVal - userVal;
	return { label, user_cm: userVal, chart_cm: chartVal, diff_cm: diff, fit: fitCategory(diff) };
}

export async function getPatternSizeChart(patternSlug: string): Promise<PatternSizeChart | null> {
	const rows = await query<SizeChartRow>(
		`SELECT pattern_slug, chart_type, size, bust_cm, waist_cm, hip_cm,
		        shoulder_cm, sleeve_length_cm, full_length_cm, bottom_sweep_cm,
		        zipper_length_cm, extra_measurements
		 FROM cs_pattern_size_charts
		 WHERE pattern_slug = $1
		 ORDER BY chart_type,
		   CASE size
		     WHEN 'XXS' THEN 0 WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3
		     WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN '2XL' THEN 6 WHEN '3XL' THEN 7
		     WHEN '4XL' THEN 8 WHEN '5XL' THEN 9 ELSE 10
		   END`,
		[patternSlug]
	);

	if (rows.length === 0) return null;

	const body = rows.filter((r) => r.chart_type === 'body');
	const finished = rows.filter((r) => r.chart_type === 'finished');
	const sizes = [...new Set(body.map((r) => r.size))];

	return { pattern_slug: patternSlug, sizes, body, finished };
}

export function matchSize(
	bust: number,
	waist: number,
	hip: number,
	chart: PatternSizeChart
): SizeRecommendation {
	const matches: SizeMatch[] = [];

	for (const bodyRow of chart.body) {
		const size = bodyRow.size;
		const bustFit = makeFit('Bust', bust, bodyRow.bust_cm ? Number(bodyRow.bust_cm) : null);
		const waistFit = makeFit('Waist', waist, bodyRow.waist_cm ? Number(bodyRow.waist_cm) : null);
		const hipFit = makeFit('Hip', hip, bodyRow.hip_cm ? Number(bodyRow.hip_cm) : null);

		// Score: weighted sum of absolute differences (bust matters most for most garments)
		const bustDiff = bustFit ? Math.abs(bustFit.diff_cm) : 0;
		const waistDiff = waistFit ? Math.abs(waistFit.diff_cm) : 0;
		const hipDiff = hipFit ? Math.abs(hipFit.diff_cm) : 0;
		const score = bustDiff * 1.5 + waistDiff * 1.0 + hipDiff * 1.2;

		// Calculate ease from finished measurements
		const finRow = chart.finished.find((f) => f.size === size);
		const ease = {
			bust_cm: finRow?.bust_cm && bodyRow.bust_cm
				? Number(finRow.bust_cm) - Number(bodyRow.bust_cm)
				: null,
			waist_cm: finRow?.waist_cm && bodyRow.waist_cm
				? Number(finRow.waist_cm) - Number(bodyRow.waist_cm)
				: null,
			hip_cm: finRow?.hip_cm && bodyRow.hip_cm
				? Number(finRow.hip_cm) - Number(bodyRow.hip_cm)
				: null
		};

		matches.push({ size, score, bust: bustFit, waist: waistFit, hip: hipFit, ease });
	}

	// Sort by score
	matches.sort((a, b) => a.score - b.score);

	const recommended = matches[0];

	// Detect "between sizes"
	let betweenSizes = false;
	let lowerSize: string | null = null;
	let upperSize: string | null = null;

	if (matches.length >= 2) {
		const best = matches[0];
		const second = matches[1];

		// If the top two scores are close, user is between sizes
		if (second.score - best.score < 4) {
			const bestOrder = SIZE_ORDER[best.size] ?? 99;
			const secondOrder = SIZE_ORDER[second.size] ?? 99;

			betweenSizes = true;
			if (bestOrder < secondOrder) {
				lowerSize = best.size;
				upperSize = second.size;
			} else {
				lowerSize = second.size;
				upperSize = best.size;
			}
		}
	}

	return {
		recommended,
		allMatches: matches,
		betweenSizes,
		lowerSize,
		upperSize,
		patternChart: chart
	};
}
