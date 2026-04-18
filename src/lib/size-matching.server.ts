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

function fitCategory(diff: number, easeStd: number): MeasurementFit['fit'] {
	// diff = chart_cm - body_cm. Classify relative to standard ease.
	if (diff < 0) return 'tight';                       // garment smaller than body
	if (diff < easeStd - 2) return 'exact';             // less ease than standard
	if (diff <= easeStd + 3) return 'comfortable';      // around standard ease
	return 'loose';                                      // more ease than standard
}

function makeFit(label: string, bodyVal: number, chartVal: number | null, easeStd: number): MeasurementFit | null {
	if (chartVal === null) return null;
	const diff = chartVal - bodyVal;
	return { label, user_cm: bodyVal, chart_cm: chartVal, diff_cm: diff, fit: fitCategory(diff, easeStd) };
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
	// Use finished sizes as primary — body chart is unreliable
	const sizes = [...new Set((finished.length > 0 ? finished : body).map((r) => r.size))];

	return { pattern_slug: patternSlug, sizes, body, finished };
}

export function matchSize(
	bust: number,
	waist: number,
	hip: number,
	chart: PatternSizeChart
): SizeRecommendation {
	const matches: SizeMatch[] = [];

	// Match against finished garment measurements, compared to the user's BODY
	// measurements directly. Ease is used to classify fit, not to inflate user_cm.
	const EASE = { bust: 5, waist: 4, hip: 4 }; // standard ease (bust +5, waist +4, hip +4)

	const matchRows = chart.finished.length > 0 ? chart.finished : chart.body;

	for (const row of matchRows) {
		const size = row.size;
		const rowBust = row.bust_cm ? Number(row.bust_cm) : null;
		const rowWaist = row.waist_cm ? Number(row.waist_cm) : null;
		const rowHip = row.hip_cm ? Number(row.hip_cm) : null;

		// Show user's BODY vs finished garment directly — more intuitive for customers.
		// Standard ease is used to classify the fit category but not shown in user_cm.
		const bustFit = makeFit('Bust', bust, rowBust, EASE.bust);
		const waistFit = makeFit('Waist', waist, rowWaist, EASE.waist);
		const hipFit = makeFit('Hip', hip, rowHip, EASE.hip);

		const bustRaw = bustFit ? bustFit.diff_cm : 0;
		const waistRaw = waistFit ? waistFit.diff_cm : 0;
		const hipRaw = hipFit ? hipFit.diff_cm : 0;

		// Penalize garments smaller than body — can't wear a dress smaller than your bust
		const bustDiff = bustRaw < 0 ? Math.abs(bustRaw) * 2.5 : Math.abs(bustRaw);
		const waistDiff = waistRaw < 0 ? Math.abs(waistRaw) * 2 : Math.abs(waistRaw);
		const hipDiff = hipRaw < 0 ? Math.abs(hipRaw) * 2.5 : Math.abs(hipRaw);
		const score = bustDiff * 1.5 + waistDiff * 1.0 + hipDiff * 1.2;

		// Ease = finished garment - user body (how much room the garment gives)
		const ease = {
			bust_cm: rowBust ? rowBust - bust : null,
			waist_cm: rowWaist ? rowWaist - waist : null,
			hip_cm: rowHip ? rowHip - hip : null,
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
