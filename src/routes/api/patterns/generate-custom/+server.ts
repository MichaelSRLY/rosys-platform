import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calculateGrading } from '$lib/pattern-grading.server';
import { generateCustomDxf } from '$lib/dxf-grader.server';

/** Calculate grading parameters (preview) */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { pattern_slug, bust, waist, hip, generate } = body;

	if (!pattern_slug || !bust || !waist || !hip) {
		throw error(400, 'pattern_slug, bust, waist, and hip are required');
	}

	const grading = await calculateGrading(pattern_slug, { bust_cm: bust, waist_cm: waist, hip_cm: hip });
	if (!grading) throw error(404, 'Pattern not found or missing size chart data');

	// If generate flag is set, produce the actual DXF
	if (generate) {
		const customLabel = `CUSTOM (bust ${bust}, waist ${waist}, hip ${hip})`;
		const result = await generateCustomDxf(
			pattern_slug,
			grading.scale_width,
			grading.scale_height,
			customLabel
		);

		if (!result) {
			throw error(500, 'Failed to generate custom DXF — pattern may not have DXF files in storage');
		}

		return json({
			grading,
			dxf: {
				filename: result.filename,
				content: result.content,
				pieces: result.pieces,
				validation: result.validation
			}
		});
	}

	return json({ grading });
};
