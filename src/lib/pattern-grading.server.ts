/**
 * Pattern grading calculation engine.
 * Uses FINISHED garment measurements only (from authoritative xlsx spec sheets).
 * No body chart needed — customer body measurements + standard ease = custom finished.
 */

import { query } from '$lib/db.server';

export interface GradingInput {
	bust_cm: number;
	waist_cm: number;
	hip_cm: number;
	height_cm?: number;
}

export interface GradingResult {
	pattern_slug: string;
	sample_size: string;
	target_size: string;
	scale_width: number;
	scale_height: number;
	pdf_scale_width: number;
	pdf_scale_height: number;
	adjustments: {
		bust_delta_cm: number;
		waist_delta_cm: number;
		hip_delta_cm: number;
		length_delta_cm: number | null;
	};
	sample_finished: {
		bust_cm: number | null;
		waist_cm: number | null;
		hip_cm: number | null;
		full_length_cm: number | null;
	};
	target_finished: {
		bust_cm: number | null;
		waist_cm: number | null;
		hip_cm: number | null;
		full_length_cm: number | null;
	};
	custom_finished: {
		bust_cm: number;
		waist_cm: number;
		hip_cm: number;
		full_length_cm: number | null;
	};
	confidence: 'high' | 'medium' | 'low';
	warnings: string[];
}

const SIZE_ORDER: Record<string, number> = {
	XXS: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5, '2XL': 6, '3XL': 7, '4XL': 8, '5XL': 9
};

// Standard ease values (cm) — the difference between body measurement and finished garment.
// These are typical for Rosys patterns (fitted dresses/tops with 1cm seam allowance).
const STANDARD_EASE = { bust: 5, waist: 4, hip: 4 };

/**
 * Calculate grading parameters for a custom-fit pattern.
 * Logic: customer body + standard ease → custom finished → compare to finished chart → scale.
 */
export async function calculateGrading(
	patternSlug: string,
	measurements: GradingInput
): Promise<GradingResult | null> {
	// Get DXF metadata (sample size)
	const dxfChunks = await query<{ description: string; metadata: string }>(
		`SELECT description, metadata::text FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'dxf_pattern_piece'
		 LIMIT 1`,
		[patternSlug]
	);

	if (dxfChunks.length === 0) return null;

	const meta = JSON.parse(dxfChunks[0].metadata);
	const sampleSize = meta.sample_size as string;

	// Get finished garment measurements (the only chart we need)
	const finishedRows = await query<{
		size: string; bust_cm: number | null; waist_cm: number | null;
		hip_cm: number | null; full_length_cm: number | null;
	}>(
		`SELECT size, bust_cm, waist_cm, hip_cm, full_length_cm FROM cs_pattern_size_charts
		 WHERE pattern_slug = $1 AND chart_type = 'finished'
		 ORDER BY CASE size WHEN 'XXS' THEN 0 WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3
		   WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN '2XL' THEN 6 WHEN '3XL' THEN 7
		   WHEN '4XL' THEN 8 WHEN '5XL' THEN 9 END`,
		[patternSlug]
	);

	if (finishedRows.length === 0) return null;

	// Compute what the customer's finished garment should measure
	// (body measurement + standard ease = what the garment needs to be)
	const customerFinishedBust = measurements.bust_cm + STANDARD_EASE.bust;
	const customerFinishedWaist = measurements.waist_cm + STANDARD_EASE.waist;
	const customerFinishedHip = measurements.hip_cm + STANDARD_EASE.hip;

	// Find the closest size by comparing customer's ideal finished measurements
	// against the actual finished garment chart
	let bestSize = finishedRows[0].size;
	let bestScore = Infinity;
	for (const row of finishedRows) {
		const bustDiff = row.bust_cm ? Math.abs(Number(row.bust_cm) - customerFinishedBust) : 0;
		const waistDiff = row.waist_cm ? Math.abs(Number(row.waist_cm) - customerFinishedWaist) : 0;
		const hipDiff = row.hip_cm ? Math.abs(Number(row.hip_cm) - customerFinishedHip) : 0;
		const score = bustDiff * 1.5 + waistDiff + hipDiff * 1.2;
		if (score < bestScore) {
			bestScore = score;
			bestSize = row.size;
		}
	}

	const sampleFinished = finishedRows.find((r) => r.size === sampleSize);
	const targetFinished = finishedRows.find((r) => r.size === bestSize);

	if (!sampleFinished) return null;

	// Custom finished = customer body + standard ease
	const customFinished = {
		bust_cm: customerFinishedBust,
		waist_cm: customerFinishedWaist,
		hip_cm: customerFinishedHip,
		full_length_cm: targetFinished?.full_length_cm ? Number(targetFinished.full_length_cm) : null
	};

	// Target finished measurements (what the standard size garment actually measures)
	const tBust = targetFinished?.bust_cm ? Number(targetFinished.bust_cm) : null;
	const tWaist = targetFinished?.waist_cm ? Number(targetFinished.waist_cm) : null;
	const tHip = targetFinished?.hip_cm ? Number(targetFinished.hip_cm) : null;
	const tLength = targetFinished?.full_length_cm ? Number(targetFinished.full_length_cm) : null;

	// Scale factors relative to sample size (for DXF)
	const sampleBust = sampleFinished.bust_cm ? Number(sampleFinished.bust_cm) : null;
	const sampleLength = sampleFinished.full_length_cm ? Number(sampleFinished.full_length_cm) : null;
	const scaleWidth = sampleBust ? customFinished.bust_cm / sampleBust : 1;
	const scaleHeight = sampleLength && customFinished.full_length_cm
		? customFinished.full_length_cm / sampleLength
		: Math.sqrt(scaleWidth);

	// Scale factors relative to target size (for PDF)
	// Use max ratio so the pattern fits the customer's widest measurement
	const bustRatio = tBust ? customFinished.bust_cm / tBust : 1;
	const waistRatio = tWaist ? customFinished.waist_cm / tWaist : 1;
	const hipRatio = tHip ? customFinished.hip_cm / tHip : 1;
	const pdfScaleWidth = Math.max(bustRatio, waistRatio, hipRatio);
	const pdfScaleHeight = tLength && customFinished.full_length_cm
		? customFinished.full_length_cm / tLength
		: Math.sqrt(pdfScaleWidth);

	// Deltas (custom vs sample — how much the DXF needs to change)
	const adjustments = {
		bust_delta_cm: customFinished.bust_cm - (sampleBust ?? customFinished.bust_cm),
		waist_delta_cm: customFinished.waist_cm - (sampleFinished.waist_cm ? Number(sampleFinished.waist_cm) : customFinished.waist_cm),
		hip_delta_cm: customFinished.hip_cm - (sampleFinished.hip_cm ? Number(sampleFinished.hip_cm) : customFinished.hip_cm),
		length_delta_cm: sampleLength && customFinished.full_length_cm
			? customFinished.full_length_cm - sampleLength : null
	};

	// Confidence
	const warnings: string[] = [];
	let confidence: 'high' | 'medium' | 'low' = 'high';

	if (Math.abs(pdfScaleWidth - 1) > 0.04) {
		warnings.push('Adjustment exceeds 4% — pattern accuracy decreases. Consider standard size with manual alterations.');
		confidence = 'medium';
	}

	const sizeIdx = SIZE_ORDER[bestSize] ?? 3;
	const sampleIdx = SIZE_ORDER[sampleSize] ?? 1;
	if (Math.abs(sizeIdx - sampleIdx) > 3) {
		warnings.push(`Grading across ${Math.abs(sizeIdx - sampleIdx)} sizes from sample — accuracy decreases with distance.`);
		if (confidence === 'high') confidence = 'medium';
	}

	return {
		pattern_slug: patternSlug,
		sample_size: sampleSize,
		target_size: bestSize,
		scale_width: Math.round(scaleWidth * 10000) / 10000,
		scale_height: Math.round(scaleHeight * 10000) / 10000,
		pdf_scale_width: Math.round(pdfScaleWidth * 10000) / 10000,
		pdf_scale_height: Math.round(pdfScaleHeight * 10000) / 10000,
		adjustments,
		sample_finished: {
			bust_cm: sampleBust,
			waist_cm: sampleFinished.waist_cm ? Number(sampleFinished.waist_cm) : null,
			hip_cm: sampleFinished.hip_cm ? Number(sampleFinished.hip_cm) : null,
			full_length_cm: sampleLength
		},
		target_finished: {
			bust_cm: tBust,
			waist_cm: tWaist,
			hip_cm: tHip,
			full_length_cm: tLength
		},
		custom_finished: customFinished,
		confidence,
		warnings
	};
}
