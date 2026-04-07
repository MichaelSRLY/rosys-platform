import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calculateGrading } from '$lib/pattern-grading.server';
import { generateCustomDxfFile } from '$lib/pattern-files.server';
import { query } from '$lib/db.server';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { pattern_slug, bust, waist, hip, generate } = body;

	if (!pattern_slug || !bust || !waist || !hip) {
		throw error(400, 'pattern_slug, bust, waist, and hip are required');
	}

	const grading = await calculateGrading(pattern_slug, { bust_cm: bust, waist_cm: waist, hip_cm: hip });
	if (!grading) throw error(404, 'Pattern not found or missing size chart data');

	// Cap scaling at +/- 25% — beyond that, proportional grading distorts curves
	if (Math.abs(grading.scale_width - 1) > 0.25) {
		return json({
			grading,
			error: `Adjustment too large (${((grading.scale_width - 1) * 100).toFixed(0)}%). Custom fit works best within 25% of the base pattern size. Please use the standard size chart for the best results.`
		});
	}

	if (!generate) {
		return json({ grading });
	}

	const patterns = await query<{ pattern_name: string }>(
		'SELECT pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1',
		[pattern_slug]
	);
	const patternName = patterns[0]?.pattern_name || pattern_slug;
	const customLabel = `CUSTOM (bust ${bust}, waist ${waist}, hip ${hip})`;

	try {
		const file = await generateCustomDxfFile(
			pattern_slug,
			patternName,
			{ width: grading.scale_width, height: grading.scale_height },
			customLabel
		);

		return new Response(file.data.buffer as ArrayBuffer, {
			headers: {
				'Content-Type': file.mimeType,
				'Content-Disposition': `attachment; filename="${file.filename}"`,
				'Content-Length': file.data.length.toString()
			}
		});
	} catch (e: any) {
		console.error('DXF generation error:', e);
		if (e?.status) throw e;
		throw error(500, `Generation failed: ${e?.message || 'unknown error'}`);
	}
};
