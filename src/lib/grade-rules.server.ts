/**
 * Grade rules loader and computation engine.
 * Loads per-vertex grade rules extracted from multi-size PDFs,
 * computes fractional grade steps from customer measurements,
 * and generates target coordinates for any custom size.
 *
 * KEY FEATURE: Per-piece blended steps.
 * When a customer has disproportionate measurements (e.g., large bust, normal hips),
 * each piece gets its OWN extrapolation amount based on how much it grows per step.
 * Bodice pieces (high growth) lean toward bust_steps. Skirt pieces (low growth) lean
 * toward hip_steps. This means only the body parts that need adjustment get adjusted.
 *
 * This is a NEW module — does not modify any existing grading code.
 */

import { query } from '$lib/db.server';

// ─── Types ───

export interface GradeRulePiece {
	index: number;
	vertex_count: number;
	consistent: boolean;
	base_anchor: [number, number];
	anchor_deltas: [number, number][];       // per size step
	base_coords: [number, number][];         // base size coordinates in PDF pts
	base_ops: string[];                      // 'm', 'l', 'c1', 'c2', 'c3'
	coord_deltas: ([number, number][] | null)[]; // per size step (null if vertex count changed)
	per_size_coords?: Record<string, [number, number][]>; // for inconsistent pieces
}

export interface GradeRules {
	sizes: string[];
	base_size: string;
	piece_count: number;
	pieces: GradeRulePiece[];
}

export interface GradeRulesRow {
	pattern_slug: string;
	sizes: string[];
	base_size: string;
	piece_count: number;
	grade_data: GradeRules;
	vertex_counts_consistent: boolean;
	validation_max_error_pt: number | null;
}

export interface GradeTarget {
	/** Max grade steps beyond the largest standard size */
	steps_beyond: number;
	/** Per-measurement steps */
	bust_steps: number;
	waist_steps: number;
	hip_steps: number;
	/** The largest standard size (starting point for extrapolation) */
	largest_size: string;
	/** Target coordinates per piece in PDF points */
	pieces: GradeTargetPiece[];
}

export interface GradeTargetPiece {
	index: number;
	/** This piece's blended step count (based on its growth rate) */
	piece_steps: number;
	anchor: [number, number];
	coords: [number, number][];
	ops: string[];
	bbox: { minX: number; minY: number; maxX: number; maxY: number };
	base_bbox: { minX: number; minY: number; maxX: number; maxY: number };
	scale_w: number;
	scale_h: number;
}

const SIZE_ORDER: Record<string, number> = {
	XXS: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5, '2XL': 6, '3XL': 7, '4XL': 8, '5XL': 9
};

const STANDARD_EASE = { bust: 5, waist: 4, hip: 4 };

// ─── Load grade rules from DB ───

export async function loadGradeRules(patternSlug: string): Promise<GradeRulesRow | null> {
	const rows = await query<GradeRulesRow>(
		`SELECT pattern_slug, sizes, base_size, piece_count,
		        grade_data, vertex_counts_consistent, validation_max_error_pt
		 FROM cs_pattern_grade_rules
		 WHERE pattern_slug = $1`,
		[patternSlug]
	);
	return rows.length > 0 ? rows[0] : null;
}

// ─── Compute per-measurement grade steps ───

export interface CustomerMeasurements {
	bust_cm: number;
	waist_cm: number;
	hip_cm: number;
}

export interface GradeStepsResult {
	steps_beyond: number;      // max of all three (for cap checking)
	bust_steps: number;        // how many steps bust needs (can be 0 or negative)
	waist_steps: number;
	hip_steps: number;
	largest_size: string;
	within_range: boolean;
}

/**
 * Compute per-measurement grade steps beyond the largest standard size.
 * Returns separate step counts for bust, waist, and hip.
 */
export async function computeGradeSteps(
	patternSlug: string,
	measurements: CustomerMeasurements,
	gradeRules: GradeRulesRow
): Promise<GradeStepsResult | null> {
	const sizes = gradeRules.sizes;
	const largestSize = sizes[sizes.length - 1];
	const secondLargest = sizes.length >= 2 ? sizes[sizes.length - 2] : null;

	const finishedRows = await query<{
		size: string; bust_cm: number | null; waist_cm: number | null; hip_cm: number | null;
	}>(
		`SELECT size, bust_cm, waist_cm, hip_cm FROM cs_pattern_size_charts
		 WHERE pattern_slug = $1 AND chart_type = 'finished'
		 ORDER BY CASE size WHEN 'XXS' THEN 0 WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3
		   WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN '2XL' THEN 6 WHEN '3XL' THEN 7
		   WHEN '4XL' THEN 8 WHEN '5XL' THEN 9 END`,
		[patternSlug]
	);

	if (finishedRows.length === 0) return null;

	const custFinBust = measurements.bust_cm + STANDARD_EASE.bust;
	const custFinWaist = measurements.waist_cm + STANDARD_EASE.waist;
	const custFinHip = measurements.hip_cm + STANDARD_EASE.hip;

	const largest = finishedRows.find(r => r.size === largestSize);
	const second = secondLargest ? finishedRows.find(r => r.size === secondLargest) : null;

	if (!largest) return null;

	const largestBust = largest.bust_cm ? Number(largest.bust_cm) : null;
	const largestWaist = largest.waist_cm ? Number(largest.waist_cm) : null;
	const largestHip = largest.hip_cm ? Number(largest.hip_cm) : null;

	// If customer fits within standard range, no extrapolation needed
	if (largestBust && custFinBust <= largestBust &&
		(!largestWaist || custFinWaist <= largestWaist) &&
		(!largestHip || custFinHip <= largestHip)) {
		return { steps_beyond: 0, bust_steps: 0, waist_steps: 0, hip_steps: 0,
			largest_size: largestSize, within_range: true };
	}

	// Compute measurement delta per size step (between last two standard sizes)
	let bustStep = 0, waistStep = 0, hipStep = 0;
	if (second) {
		const secondBust = second.bust_cm ? Number(second.bust_cm) : null;
		const secondWaist = second.waist_cm ? Number(second.waist_cm) : null;
		const secondHip = second.hip_cm ? Number(second.hip_cm) : null;
		if (largestBust && secondBust) bustStep = largestBust - secondBust;
		if (largestWaist && secondWaist) waistStep = largestWaist - secondWaist;
		if (largestHip && secondHip) hipStep = largestHip - secondHip;
	}

	// Per-measurement steps (can be 0 or negative if customer is smaller)
	const bustBeyond = bustStep > 0 && largestBust
		? Math.max(0, (custFinBust - largestBust) / bustStep) : 0;
	const waistBeyond = waistStep > 0 && largestWaist
		? Math.max(0, (custFinWaist - largestWaist) / waistStep) : 0;
	const hipBeyond = hipStep > 0 && largestHip
		? Math.max(0, (custFinHip - largestHip) / hipStep) : 0;

	const maxSteps = Math.max(bustBeyond, waistBeyond, hipBeyond);

	return {
		steps_beyond: Math.round(maxSteps * 100) / 100,
		bust_steps: Math.round(bustBeyond * 100) / 100,
		waist_steps: Math.round(waistBeyond * 100) / 100,
		hip_steps: Math.round(hipBeyond * 100) / 100,
		largest_size: largestSize,
		within_range: false
	};
}

// ─── Compute target coordinates with per-piece blending ───

function bboxOf(coords: [number, number][]): { minX: number; minY: number; maxX: number; maxY: number } {
	const xs = coords.map(c => c[0]);
	const ys = coords.map(c => c[1]);
	return {
		minX: Math.min(...xs), minY: Math.min(...ys),
		maxX: Math.max(...xs), maxY: Math.max(...ys)
	};
}

/**
 * Compute target piece coordinates with per-piece blended grade steps.
 *
 * Each piece gets its own step count based on its "growth rate" — how much
 * it grows per standard grade step relative to other pieces.
 *
 * High-growth pieces (bodice) → lean toward the largest measurement step (e.g., bust)
 * Low-growth pieces (skirt) → lean toward the smallest measurement step (e.g., hip)
 *
 * This means: bust=130 + hip=100 → bodice expands a lot, skirt barely changes.
 */
export function computeTargetCoords(
	gradeRules: GradeRules,
	stepResult: GradeStepsResult
): GradeTarget {
	const sizes = gradeRules.sizes;
	const largestSize = sizes[sizes.length - 1];
	const numSteps = sizes.length - 1;
	const avgWindow = Math.min(3, numSteps);
	const startStep = numSteps - avgWindow;

	const { bust_steps, waist_steps, hip_steps } = stepResult;
	const minSteps = Math.min(bust_steps, waist_steps, hip_steps);
	const maxSteps = Math.max(bust_steps, waist_steps, hip_steps);

	// First pass: compute each piece's average width growth per step
	const pieceGrowthRates: number[] = [];
	for (const piece of gradeRules.pieces) {
		// Compute how much this piece's bbox WIDTH changes per step (last few steps)
		let totalWidthGrowth = 0;
		if (piece.consistent && piece.coord_deltas.every(d => d !== null)) {
			for (let s = startStep; s < numSteps; s++) {
				const deltas = piece.coord_deltas[s]!;
				// Width growth = range of x-deltas (max dx - min dx gives expansion)
				const dxs = deltas.map(d => d[0]);
				const maxDx = Math.max(...dxs);
				const minDx = Math.min(...dxs);
				totalWidthGrowth += (maxDx - minDx);
			}
		} else {
			// For inconsistent pieces, use anchor x-delta as proxy
			for (let s = startStep; s < numSteps; s++) {
				totalWidthGrowth += Math.abs(piece.anchor_deltas[s][0]);
			}
		}
		pieceGrowthRates.push(totalWidthGrowth / avgWindow);
	}

	// Normalize growth rates to [0, 1] range
	const minRate = Math.min(...pieceGrowthRates);
	const maxRate = Math.max(...pieceGrowthRates);
	const rateRange = maxRate - minRate;

	// Second pass: compute target coords with per-piece blended steps
	const targetPieces: GradeTargetPiece[] = [];

	for (let pi = 0; pi < gradeRules.pieces.length; pi++) {
		const piece = gradeRules.pieces[pi];

		// Blend factor: 0 = low growth (use minSteps), 1 = high growth (use maxSteps)
		const t = rateRange > 0.01
			? (pieceGrowthRates[pi] - minRate) / rateRange
			: 0.5; // if all pieces grow the same, use middle

		// This piece's blended step count
		const pieceSteps = minSteps + t * (maxSteps - minSteps);

		// Reconstruct the largest size's coordinates
		let largestAnchor: [number, number] = [...piece.base_anchor];
		for (let s = 0; s < numSteps; s++) {
			largestAnchor[0] += piece.anchor_deltas[s][0];
			largestAnchor[1] += piece.anchor_deltas[s][1];
		}

		let largestCoords: [number, number][];
		if (piece.consistent && piece.coord_deltas.every(d => d !== null)) {
			largestCoords = piece.base_coords.map(c => [...c] as [number, number]);
			for (let s = 0; s < numSteps; s++) {
				const deltas = piece.coord_deltas[s]!;
				for (let k = 0; k < largestCoords.length; k++) {
					largestCoords[k][0] += deltas[k][0];
					largestCoords[k][1] += deltas[k][1];
				}
			}
		} else if (piece.per_size_coords && piece.per_size_coords[largestSize]) {
			largestCoords = piece.per_size_coords[largestSize].map(c => [...c] as [number, number]);
		} else {
			largestCoords = piece.base_coords.map(c => [...c] as [number, number]);
		}

		const largestBbox = bboxOf(largestCoords);

		// Compute average delta per step (last 2-3 steps)
		let avgAnchorDelta: [number, number] = [0, 0];
		for (let s = startStep; s < numSteps; s++) {
			avgAnchorDelta[0] += piece.anchor_deltas[s][0];
			avgAnchorDelta[1] += piece.anchor_deltas[s][1];
		}
		avgAnchorDelta[0] /= avgWindow;
		avgAnchorDelta[1] /= avgWindow;

		let avgCoordDeltas: [number, number][] | null = null;
		if (piece.consistent && piece.coord_deltas.every(d => d !== null)) {
			avgCoordDeltas = piece.base_coords.map(() => [0, 0] as [number, number]);
			for (let s = startStep; s < numSteps; s++) {
				const deltas = piece.coord_deltas[s]!;
				for (let k = 0; k < avgCoordDeltas.length; k++) {
					avgCoordDeltas[k][0] += deltas[k][0];
					avgCoordDeltas[k][1] += deltas[k][1];
				}
			}
			for (let k = 0; k < avgCoordDeltas.length; k++) {
				avgCoordDeltas[k][0] /= avgWindow;
				avgCoordDeltas[k][1] /= avgWindow;
			}
		}

		// Extrapolate using THIS PIECE'S blended step count
		const targetAnchor: [number, number] = [
			largestAnchor[0] + avgAnchorDelta[0] * pieceSteps,
			largestAnchor[1] + avgAnchorDelta[1] * pieceSteps
		];

		let targetCoords: [number, number][];
		if (avgCoordDeltas) {
			targetCoords = largestCoords.map((c, k) => [
				c[0] + avgCoordDeltas![k][0] * pieceSteps,
				c[1] + avgCoordDeltas![k][1] * pieceSteps
			]);
		} else {
			const scaleFromAnchor = largestBbox.maxX - largestBbox.minX > 0
				? 1 + (Math.abs(avgAnchorDelta[0]) * pieceSteps) / (largestBbox.maxX - largestBbox.minX)
				: 1;
			const cx = (largestBbox.minX + largestBbox.maxX) / 2;
			const cy = (largestBbox.minY + largestBbox.maxY) / 2;
			targetCoords = largestCoords.map(c => [
				cx + (c[0] - cx) * scaleFromAnchor,
				cy + (c[1] - cy) * scaleFromAnchor
			]);
		}

		const targetBbox = bboxOf(targetCoords);
		const lw = largestBbox.maxX - largestBbox.minX;
		const lh = largestBbox.maxY - largestBbox.minY;
		const tw = targetBbox.maxX - targetBbox.minX;
		const th = targetBbox.maxY - targetBbox.minY;

		targetPieces.push({
			index: piece.index,
			piece_steps: Math.round(pieceSteps * 100) / 100,
			anchor: targetAnchor,
			coords: targetCoords,
			ops: piece.base_ops,
			bbox: targetBbox,
			base_bbox: largestBbox,
			scale_w: lw > 0 ? tw / lw : 1,
			scale_h: lh > 0 ? th / lh : 1
		});
	}

	return {
		steps_beyond: stepResult.steps_beyond,
		bust_steps,
		waist_steps,
		hip_steps,
		largest_size: largestSize,
		pieces: targetPieces
	};
}
