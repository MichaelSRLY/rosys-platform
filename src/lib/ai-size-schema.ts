/**
 * Structured output schemas for the AI Size Intelligence layer.
 * Used with Anthropic API (tool_use) or any LLM with JSON mode.
 *
 * The AI receives ALL available data and returns a comprehensive,
 * structured recommendation — not just a size, but alterations,
 * confidence, reasoning, and warnings.
 */

import { z } from 'zod';

// ─── Input: Everything we know about the customer + pattern ───

export const SizeIntelligenceInput = z.object({
	// Customer measurements (from tape measure OR photo model)
	measurements: z.object({
		bust_cm: z.number(),
		waist_cm: z.number(),
		hip_cm: z.number(),
		height_cm: z.number().optional(),
		weight_kg: z.number().optional(),
		shoulder_cm: z.number().optional(),
		arm_length_cm: z.number().optional(),
		measurement_source: z.enum(['tape_measure', 'photo_model', 'neckstimate']),
	}),

	// Pattern data (from our database)
	pattern: z.object({
		name: z.string(),
		slug: z.string(),
		category: z.string().optional(), // dress, jacket, top, etc.
		sizes: z.array(z.string()),

		// Body measurement chart per size
		body_chart: z.array(z.object({
			size: z.string(),
			bust_cm: z.number().nullable(),
			waist_cm: z.number().nullable(),
			hip_cm: z.number().nullable(),
		})),

		// Finished garment measurements per size
		finished_chart: z.array(z.object({
			size: z.string(),
			bust_cm: z.number().nullable(),
			waist_cm: z.number().nullable(),
			hip_cm: z.number().nullable(),
			full_length_cm: z.number().nullable(),
			sleeve_length_cm: z.number().nullable(),
			bottom_sweep_cm: z.number().nullable(),
		})),

		// DXF piece info (if available)
		dxf_sample_size: z.string().optional(),
		dxf_pieces: z.array(z.object({
			name: z.string(),
			cut_width_mm: z.number(),
			cut_height_mm: z.number(),
			finished_width_mm: z.number(),
			finished_height_mm: z.number(),
		})).optional(),

		// Ease at closest size (finished - body)
		ease: z.object({
			bust_cm: z.number().nullable(),
			waist_cm: z.number().nullable(),
			hip_cm: z.number().nullable(),
		}).optional(),
	}),

	// MLP predictions (if available)
	predicted_profile: z.object({
		shoulder_cm: z.number(),
		arm_length_cm: z.number(),
		thigh_cm: z.number(),
		leg_length_cm: z.number(),
		arm_circ_cm: z.number(),
	}).optional(),
});

// ─── Output: Comprehensive structured recommendation ───

export const SizeRecommendation = z.object({
	// Primary recommendation
	recommended_size: z.string(),
	confidence: z.enum(['high', 'medium', 'low']),

	// Fit analysis per measurement
	fit_analysis: z.array(z.object({
		measurement: z.string(), // "bust", "waist", "hip"
		user_cm: z.number(),
		chart_cm: z.number(), // body chart value for recommended size
		finished_cm: z.number().nullable(), // finished garment value
		ease_cm: z.number().nullable(), // how much room
		fit: z.enum(['tight', 'exact', 'comfortable', 'loose']),
		concern: z.string().nullable(), // "hip might be snug" or null
	})),

	// Between sizes?
	between_sizes: z.boolean(),
	size_down: z.string().nullable(),
	size_up: z.string().nullable(),
	between_sizes_advice: z.string().nullable(), // "size up for comfort" or "size down for fitted look"

	// Length adjustments (based on height)
	length_adjustments: z.array(z.object({
		area: z.string(), // "bodice", "skirt", "sleeve"
		adjust_cm: z.number(), // positive = lengthen, negative = shorten
		reason: z.string(),
	})),

	// Width adjustments (based on proportions)
	width_adjustments: z.array(z.object({
		area: z.string(), // "shoulder", "bust", "hip"
		adjust_cm: z.number(),
		reason: z.string(),
	})),

	// Garment-specific advice
	garment_notes: z.string(), // "This dress runs fitted at the bust. The fabric suggestion is stretch jersey which adds 2-3cm of give."

	// Summary for the customer (2-3 sentences, warm and helpful)
	customer_summary: z.string(),
});

export type SizeIntelligenceInputType = z.infer<typeof SizeIntelligenceInput>;
export type SizeRecommendationType = z.infer<typeof SizeRecommendation>;
