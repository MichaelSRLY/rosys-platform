/**
 * Grade rules loader and computation engine.
 * Loads per-vertex grade rules extracted from multi-size PDFs,
 * computes fractional grade steps from customer measurements,
 * and generates target coordinates for any custom size.
 *
 * This is a NEW module — does not modify any existing grading code.
 * The existing uniform-scaling system (pattern-grading.server.ts) is untouched.
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
	/** How many grade steps beyond the largest standard size (can be fractional) */
	steps_beyond: number;
	/** The largest standard size (starting point for extrapolation) */
	largest_size: string;
	/** Target coordinates per piece in PDF points */
	pieces: GradeTargetPiece[];
}

export interface GradeTargetPiece {
	index: number;
	anchor: [number, number];
	coords: [number, number][];
	ops: string[];
	/** Bounding box of target coordinates */
	bbox: { minX: number; minY: number; maxX: number; maxY: number };
	/** Bounding box of base (largest standard) coordinates */
	base_bbox: { minX: number; minY: number; maxX: number; maxY: number };
	/** Per-piece scale factors (target / largest) for DXF scaling */
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

// ─── Compute how many grade steps the customer needs ───

export interface CustomerMeasurements {
	bust_cm: number;
	waist_cm: number;
	hip_cm: number;
}

/**
 * Compute the fractional number of grade steps beyond the largest standard size.
 * Uses the finished garment measurement chart to determine position on the size scale.
 */
export async function computeGradeSteps(
	patternSlug: string,
	measurements: CustomerMeasurements,
	gradeRules: GradeRulesRow
): Promise<{ steps_beyond: number; largest_size: string; within_range: boolean } | null> {
	// Get finished measurements for the largest standard size
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

	// Customer's ideal finished measurements
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
		return { steps_beyond: 0, largest_size: largestSize, within_range: true };
	}

	// Compute the measurement delta per size step (between last two sizes)
	let bustStep = 0, waistStep = 0, hipStep = 0;
	if (second) {
		const secondBust = second.bust_cm ? Number(second.bust_cm) : null;
		const secondWaist = second.waist_cm ? Number(second.waist_cm) : null;
		const secondHip = second.hip_cm ? Number(second.hip_cm) : null;
		if (largestBust && secondBust) bustStep = largestBust - secondBust;
		if (largestWaist && secondWaist) waistStep = largestWaist - secondWaist;
		if (largestHip && secondHip) hipStep = largestHip - secondHip;
	}

	// How many steps beyond the largest size?
	// Use the measurement that requires the most steps (worst case)
	let maxSteps = 0;
	if (bustStep > 0 && largestBust) {
		const bustBeyond = (custFinBust - largestBust) / bustStep;
		maxSteps = Math.max(maxSteps, bustBeyond);
	}
	if (waistStep > 0 && largestWaist) {
		const waistBeyond = (custFinWaist - largestWaist) / waistStep;
		maxSteps = Math.max(maxSteps, waistBeyond);
	}
	if (hipStep > 0 && largestHip) {
		const hipBeyond = (custFinHip - largestHip) / hipStep;
		maxSteps = Math.max(maxSteps, hipBeyond);
	}

	return {
		steps_beyond: Math.round(maxSteps * 100) / 100,
		largest_size: largestSize,
		within_range: false
	};
}

// ─── Compute target coordinates ───

function bbox(coords: [number, number][]): { minX: number; minY: number; maxX: number; maxY: number } {
	const xs = coords.map(c => c[0]);
	const ys = coords.map(c => c[1]);
	return {
		minX: Math.min(...xs), minY: Math.min(...ys),
		maxX: Math.max(...xs), maxY: Math.max(...ys)
	};
}

/**
 * Compute target piece coordinates for a custom size by extrapolating grade rules.
 *
 * For each piece, reconstructs the largest standard size's coordinates from base + deltas,
 * then extrapolates by `steps_beyond` using the average of the last 2-3 grade deltas.
 */
export function computeTargetCoords(
	gradeRules: GradeRules,
	stepsBeyond: number
): GradeTarget {
	const sizes = gradeRules.sizes;
	const largestSize = sizes[sizes.length - 1];
	const numSteps = sizes.length - 1; // number of size-to-size transitions

	const targetPieces: GradeTargetPiece[] = [];

	for (const piece of gradeRules.pieces) {
		// Step 1: Reconstruct the largest size's coordinates from base + all deltas
		let largestAnchor: [number, number] = [...piece.base_anchor];
		for (let s = 0; s < numSteps; s++) {
			largestAnchor[0] += piece.anchor_deltas[s][0];
			largestAnchor[1] += piece.anchor_deltas[s][1];
		}

		let largestCoords: [number, number][];

		if (piece.consistent && piece.coord_deltas.every(d => d !== null)) {
			// Reconstruct from base + accumulated deltas
			largestCoords = piece.base_coords.map(c => [...c] as [number, number]);
			for (let s = 0; s < numSteps; s++) {
				const deltas = piece.coord_deltas[s]!;
				for (let k = 0; k < largestCoords.length; k++) {
					largestCoords[k][0] += deltas[k][0];
					largestCoords[k][1] += deltas[k][1];
				}
			}
		} else if (piece.per_size_coords && piece.per_size_coords[largestSize]) {
			// Use stored snapshot for the largest size
			largestCoords = piece.per_size_coords[largestSize].map(c => [...c] as [number, number]);
		} else {
			// Fallback: use base coords (no extrapolation possible)
			largestCoords = piece.base_coords.map(c => [...c] as [number, number]);
		}

		const largestBbox = bbox(largestCoords);

		// Step 2: Compute average delta per step (from last 2-3 steps for smoothing)
		const avgWindow = Math.min(3, numSteps);
		const startStep = numSteps - avgWindow;

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

		// Step 3: Extrapolate
		const targetAnchor: [number, number] = [
			largestAnchor[0] + avgAnchorDelta[0] * stepsBeyond,
			largestAnchor[1] + avgAnchorDelta[1] * stepsBeyond
		];

		let targetCoords: [number, number][];
		if (avgCoordDeltas) {
			targetCoords = largestCoords.map((c, k) => [
				c[0] + avgCoordDeltas![k][0] * stepsBeyond,
				c[1] + avgCoordDeltas![k][1] * stepsBeyond
			]);
		} else {
			// For inconsistent pieces: uniform scale based on anchor delta growth
			// (best we can do without per-vertex data)
			const scaleFromAnchor = largestBbox.maxX - largestBbox.minX > 0
				? 1 + (Math.abs(avgAnchorDelta[0]) * stepsBeyond) / (largestBbox.maxX - largestBbox.minX)
				: 1;
			const cx = (largestBbox.minX + largestBbox.maxX) / 2;
			const cy = (largestBbox.minY + largestBbox.maxY) / 2;
			targetCoords = largestCoords.map(c => [
				cx + (c[0] - cx) * scaleFromAnchor,
				cy + (c[1] - cy) * scaleFromAnchor
			]);
		}

		const targetBbox = bbox(targetCoords);

		// Per-piece scale factors (for DXF scaling)
		const lw = largestBbox.maxX - largestBbox.minX;
		const lh = largestBbox.maxY - largestBbox.minY;
		const tw = targetBbox.maxX - targetBbox.minX;
		const th = targetBbox.maxY - targetBbox.minY;

		targetPieces.push({
			index: piece.index,
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
		steps_beyond: stepsBeyond,
		largest_size: largestSize,
		pieces: targetPieces
	};
}
