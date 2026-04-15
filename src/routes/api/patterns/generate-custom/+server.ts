import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calculateGrading } from '$lib/pattern-grading.server';
import { generateCustomPatternFiles } from '$lib/pattern-files.server';
import { query } from '$lib/db.server';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { pattern_slug, bust, waist, hip, generate, format } = body;

	if (!pattern_slug || !bust || !waist || !hip) {
		throw error(400, 'pattern_slug, bust, waist, and hip are required');
	}

	const grading = await calculateGrading(pattern_slug, { bust_cm: bust, waist_cm: waist, hip_cm: hip });
	if (!grading) throw error(404, 'Pattern not found or missing size chart data');

	// Cap scaling at +/- 25% (check PDF scale — relative to nearest size, not sample)
	if (Math.abs(grading.pdf_scale_width - 1) > 0.25) {
		return json({
			grading,
			error: `Adjustment too large (${((grading.pdf_scale_width - 1) * 100).toFixed(0)}%). Custom fit works best within 25% of the nearest standard size.`
		});
	}

	// Preview only — return grading data
	if (!generate) {
		return json({ grading });
	}

	// Generate files
	const patterns = await query<{ pattern_name: string }>(
		'SELECT pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1',
		[pattern_slug]
	);
	const patternName = patterns[0]?.pattern_name || pattern_slug;
	const customLabel = `CUSTOM (bust ${bust}, waist ${waist}, hip ${hip})`;

	console.log(`[custom-fit] Generating for ${pattern_slug}: size=${grading.target_size} dxfScale=${grading.scale_width}x${grading.scale_height} pdfScale=${grading.pdf_scale_width}x${grading.pdf_scale_height}`);

	try {
		const files = await generateCustomPatternFiles(
			pattern_slug,
			patternName,
			{ width: grading.scale_width, height: grading.scale_height },
			{ width: grading.pdf_scale_width, height: grading.pdf_scale_height },
			customLabel,
			grading.target_size // extract this size first, then scale
		);

		if (files.length === 0) {
			throw error(500, 'No pattern files could be generated');
		}

		// If a specific format requested, return that file as binary download
		if (format) {
			const file = files.find(f => f.format === format);
			if (!file) throw error(404, `Format ${format} not available`);

			return new Response(file.data.buffer as ArrayBuffer, {
				headers: {
					'Content-Type': file.mimeType,
					'Content-Disposition': `attachment; filename="${file.filename}"`,
					'Content-Length': file.data.length.toString()
				}
			});
		}

		// Otherwise return metadata about all available files
		return json({
			grading,
			files: files.map(f => ({
				format: f.format,
				label: f.label,
				filename: f.filename,
				size: f.data.length
			}))
		});
	} catch (e: any) {
		console.error('Pattern generation error:', e);
		if (e?.status) throw e;
		throw error(500, `Generation failed: ${e?.message || 'unknown error'}`);
	}
};
