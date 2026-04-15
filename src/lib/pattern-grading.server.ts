/**
 * Pattern grading calculation engine.
 * Computes scale factors from size chart deltas for proportional grading.
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
	target_size: string; // nearest standard size
	scale_width: number; // horizontal scale factor (from sample size, for DXF)
	scale_height: number; // vertical scale factor (from sample size, for DXF)
	pdf_scale_width: number; // horizontal scale factor (from target size, for PDF)
	pdf_scale_height: number; // vertical scale factor (from target size, for PDF)
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

/**
 * Calculate grading parameters for a custom-fit pattern.
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

	// Get size chart data
	const bodyRows = await query<{
		size: string; bust_cm: number | null; waist_cm: number | null; hip_cm: number | null;
	}>(
		`SELECT size, bust_cm, waist_cm, hip_cm FROM cs_pattern_size_charts
		 WHERE pattern_slug = $1 AND chart_type = 'body'
		 ORDER BY CASE size WHEN 'XXS' THEN 0 WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3
		   WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN '2XL' THEN 6 WHEN '3XL' THEN 7
		   WHEN '4XL' THEN 8 WHEN '5XL' THEN 9 END`,
		[patternSlug]
	);

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

	if (bodyRows.length === 0 || finishedRows.length === 0) return null;

	// Find the closest standard size to the user's measurements
	let bestSize = bodyRows[0].size;
	let bestScore = Infinity;
	for (const row of bodyRows) {
		const bustDiff = row.bust_cm ? Math.abs(Number(row.bust_cm) - measurements.bust_cm) : 0;
		const waistDiff = row.waist_cm ? Math.abs(Number(row.waist_cm) - measurements.waist_cm) : 0;
		const hipDiff = row.hip_cm ? Math.abs(Number(row.hip_cm) - measurements.hip_cm) : 0;
		const score = bustDiff * 1.5 + waistDiff + hipDiff * 1.2;
		if (score < bestScore) {
			bestScore = score;
			bestSize = row.size;
		}
	}

	// Get finished measurements for sample size and target size
	const sampleFinished = finishedRows.find((r) => r.size === sampleSize);
	const targetFinished = finishedRows.find((r) => r.size === bestSize);

	if (!sampleFinished) return null;

	// Calculate ease at target size (finished - body)
	const targetBody = bodyRows.find((r) => r.size === bestSize);
	const bustEase = targetFinished?.bust_cm && targetBody?.bust_cm
		? Number(targetFinished.bust_cm) - Number(targetBody.bust_cm)
		: 4; // default 4cm ease if unknown

	// Custom finished measurements = user body + ease from target size
	const waistEase = targetFinished?.waist_cm && targetBody?.waist_cm
		? Number(targetFinished.waist_cm) - Number(targetBody.waist_cm)
		: 4;
	const hipEase = targetFinished?.hip_cm && targetBody?.hip_cm
		? Number(targetFinished.hip_cm) - Number(targetBody.hip_cm)
		: 4;

	const customFinished = {
		bust_cm: measurements.bust_cm + bustEase,
		waist_cm: measurements.waist_cm + waistEase,
		hip_cm: measurements.hip_cm + hipEase,
		full_length_cm: targetFinished?.full_length_cm ? Number(targetFinished.full_length_cm) : null
	};

	// Scale factors relative to sample size (for DXF — DXF is in sample size)
	const sampleBust = sampleFinished.bust_cm ? Number(sampleFinished.bust_cm) : null;
	const sampleLength = sampleFinished.full_length_cm ? Number(sampleFinished.full_length_cm) : null;
	const scaleWidth = sampleBust ? customFinished.bust_cm / sampleBust : 1;
	const scaleHeight = sampleLength && customFinished.full_length_cm
		? customFinished.full_length_cm / sampleLength
		: Math.sqrt(scaleWidth);

	// Scale factors relative to target size (for PDF — we extract target size first)
	const targetBust = targetFinished?.bust_cm ? Number(targetFinished.bust_cm) : null;
	const targetLength = targetFinished?.full_length_cm ? Number(targetFinished.full_length_cm) : null;
	const pdfScaleWidth = targetBust ? customFinished.bust_cm / targetBust : 1;
	const pdfScaleHeight = targetLength && customFinished.full_length_cm
		? customFinished.full_length_cm / targetLength
		: Math.sqrt(pdfScaleWidth);

	// Compute deltas
	const adjustments = {
		bust_delta_cm: customFinished.bust_cm - (sampleBust ?? customFinished.bust_cm),
		waist_delta_cm: customFinished.waist_cm - (sampleFinished.waist_cm ? Number(sampleFinished.waist_cm) : customFinished.waist_cm),
		hip_delta_cm: customFinished.hip_cm - (sampleFinished.hip_cm ? Number(sampleFinished.hip_cm) : customFinished.hip_cm),
		length_delta_cm: sampleLength && customFinished.full_length_cm
			? customFinished.full_length_cm - sampleLength
			: null
	};

	// Confidence assessment
	const warnings: string[] = [];
	let confidence: 'high' | 'medium' | 'low' = 'high';

	if (Math.abs(scaleWidth - 1) > 0.15) {
		warnings.push('Large width adjustment (>15%) — curved pieces like armholes may not scale perfectly.');
		confidence = 'medium';
	}
	if (Math.abs(scaleWidth - 1) > 0.25) {
		warnings.push('Very large adjustment (>25%) — consider using a different base size if available.');
		confidence = 'low';
	}

	// Check if user is outside the pattern's size range
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
		target_finished: targetFinished ? {
			bust_cm: targetFinished.bust_cm ? Number(targetFinished.bust_cm) : null,
			waist_cm: targetFinished.waist_cm ? Number(targetFinished.waist_cm) : null,
			hip_cm: targetFinished.hip_cm ? Number(targetFinished.hip_cm) : null,
			full_length_cm: targetFinished.full_length_cm ? Number(targetFinished.full_length_cm) : null
		} : { bust_cm: null, waist_cm: null, hip_cm: null, full_length_cm: null },
		custom_finished: customFinished,
		confidence,
		warnings
	};
}
