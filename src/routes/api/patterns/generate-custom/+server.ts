import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calculateGrading } from '$lib/pattern-grading.server';
import type { GradingResult } from '$lib/pattern-grading.server';
import { generateCustomPatternFiles } from '$lib/pattern-files.server';
import { loadGradeRules, computeGradeSteps, computeTargetCoords } from '$lib/grade-rules.server';
import type { GradeRulesRow, GradeTarget } from '$lib/grade-rules.server';
import { generateGradedDxfFromRules } from '$lib/dxf-grader-rules.server';
import { query } from '$lib/db.server';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Generate custom-graded files using per-vertex grade rules.
 * Called when measurements exceed the 4% uniform-scaling cap but grade rules exist.
 */
async function generateGradedFiles(
	patternSlug: string,
	grading: GradingResult,
	gradeRulesRow: GradeRulesRow,
	gradeTarget: GradeTarget,
	stepResult: { steps_beyond: number; largest_size: string },
	bust: number, waist: number, hip: number,
	format?: string
) {
	const { exec } = await import('child_process');
	const { promisify } = await import('util');
	const { writeFile: fsWrite, readFile: fsRead, unlink: fsUnlink } = await import('fs/promises');
	const { tmpdir } = await import('os');
	const { join } = await import('path');
	const { randomUUID } = await import('crypto');
	const execAsync = promisify(exec);

	const admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');

	const patterns = await query<{ pattern_name: string }>(
		'SELECT pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1',
		[patternSlug]
	);
	const patternName = patterns[0]?.pattern_name || patternSlug;
	const cleanName = patternName.toLowerCase().replace(/\s+/g, '-');
	const customLabel = `GRADED (bust ${bust}, waist ${waist}, hip ${hip})`;

	console.log(`[grade-rules] Generating for ${patternSlug}: steps_beyond=${stepResult.steps_beyond} from ${stepResult.largest_size}`);

	const results: { format: string; label: string; filename: string; data: Uint8Array; mimeType: string }[] = [];

	// Serialize grade rules to JSON for the Python script
	const rulesJson = JSON.stringify(gradeRulesRow.grade_data);

	// Generate PDFs (A0, A4, US Letter) using grade-pattern-pdf.py
	const pdfFormats = [
		{ format: 'a0', folder: 'a0', label: 'A0 Pattern Sheet' },
		{ format: 'a4', folder: 'a4', label: 'A4 Tiled Pattern' },
		{ format: 'us_letter', folder: 'us_letter', label: 'US Letter Tiled Pattern' }
	];

	// If specific format requested, only generate that one
	const formatsToGenerate = format && format !== 'dxf'
		? pdfFormats.filter(f => f.format === format)
		: pdfFormats;

	for (const fmt of formatsToGenerate) {
		try {
			// Download original multi-size PDF
			const originalPath = `${patternSlug}/${fmt.folder}/${fmt.folder}.pdf`;
			const { data: original, error: dlErr } = await admin.storage
				.from('pattern-files')
				.download(originalPath);

			if (dlErr || !original) {
				console.warn(`[grade-rules] No ${fmt.format} PDF for ${patternSlug}`);
				continue;
			}

			const tmpId = randomUUID();
			const inputPath = join(tmpdir(), `${tmpId}-grade-in.pdf`);
			const outputPath = join(tmpdir(), `${tmpId}-grade-out.pdf`);
			const rulesPath = join(tmpdir(), `${tmpId}-rules.json`);

			try {
				await fsWrite(inputPath, Buffer.from(await original.arrayBuffer()));
				await fsWrite(rulesPath, rulesJson);

				const scriptPath = join(process.cwd(), 'scripts', 'grade-pattern-pdf.py');
				const pieceStepsJson = JSON.stringify(gradeTarget.pieces.map(p => p.piece_steps));
				const cmd = `python3 "${scriptPath}" "${inputPath}" --rules "${rulesPath}" --steps ${stepResult.steps_beyond} --size "${stepResult.largest_size}" --piece-steps '${pieceStepsJson}' -o "${outputPath}"`;
				console.log(`[grade-rules] Running: ${fmt.format} steps=${stepResult.steps_beyond} (per-piece blended)`);
				const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
				if (stdout) console.log(`[grade-rules] ${fmt.format}: ${stdout.trim()}`);
				if (stderr) console.error(`[grade-rules] ${fmt.format} stderr: ${stderr.trim()}`);

				const outputBuffer = await fsRead(outputPath);
				results.push({
					format: fmt.format,
					label: fmt.label,
					filename: `${cleanName}-graded-${fmt.format}.pdf`,
					data: new Uint8Array(outputBuffer),
					mimeType: 'application/pdf'
				});
			} finally {
				await fsUnlink(inputPath).catch(() => {});
				await fsUnlink(outputPath).catch(() => {});
				await fsUnlink(rulesPath).catch(() => {});
			}
		} catch (e: any) {
			console.error(`[grade-rules] Failed ${fmt.format} for ${patternSlug}:`, e.message);
		}
	}

	// Generate DXF using per-piece grade-rule scaling
	if (!format || format === 'dxf') {
		try {
			const dxfResult = await generateGradedDxfFromRules(patternSlug, gradeTarget, customLabel);
			if (dxfResult) {
				results.push({
					format: 'dxf',
					label: 'DXF Cutting File',
					filename: dxfResult.filename,
					data: new TextEncoder().encode(dxfResult.content),
					mimeType: 'application/dxf'
				});
			}
		} catch (e: any) {
			console.error(`[grade-rules] DXF failed for ${patternSlug}:`, e.message);
		}
	}

	if (results.length === 0) {
		throw error(500, 'No graded pattern files could be generated');
	}

	// If specific format requested, return as binary download
	if (format) {
		const file = results.find(f => f.format === format);
		if (!file) throw error(404, `Format ${format} not available`);

		return new Response(file.data.buffer as ArrayBuffer, {
			headers: {
				'Content-Type': file.mimeType,
				'Content-Disposition': `attachment; filename="${file.filename}"`,
				'Content-Length': file.data.length.toString()
			}
		});
	}

	// Return metadata about all available files
	return json({
		grading,
		grading_method: 'grade_rules',
		steps_beyond: stepResult.steps_beyond,
		files: results.map(f => ({
			format: f.format,
			label: f.label,
			filename: f.filename,
			size: f.data.length
		}))
	});
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { pattern_slug, bust, waist, hip, generate, format } = body;

	if (!pattern_slug || !bust || !waist || !hip) {
		throw error(400, 'pattern_slug, bust, waist, and hip are required');
	}

	const grading = await calculateGrading(pattern_slug, { bust_cm: bust, waist_cm: waist, hip_cm: hip });
	if (!grading) throw error(404, 'Pattern not found or missing size chart data');

	// Cap scaling at 4% — validated by pattern expert as max for clean output
	// (no piece overlap, seam allowances stay accurate, no edge clipping)
	// Check if adjustment exceeds 4% uniform scaling cap
	const scalePct = Math.abs(grading.pdf_scale_width - 1);
	if (scalePct > 0.04) {
		// Check if grade rules exist — use per-piece scaling via proven pipeline
		const gradeRulesRow = await loadGradeRules(pattern_slug);
		if (gradeRulesRow) {
			const stepResult = await computeGradeSteps(
				pattern_slug,
				{ bust_cm: bust, waist_cm: waist, hip_cm: hip },
				gradeRulesRow
			);

			if (stepResult && stepResult.steps_beyond > 0) {
				// Cap at 5% — uniform scaling from 1.0cm → 1.05cm SA is visually imperceptible.
				// Beyond 5%, per-piece scaling would produce visible SA non-uniformity (Jovita's
				// original complaint) and per-vertex inconsistent-piece fallback is still WIP.
				if (scalePct > 0.05) {
					return json({
						grading,
						scale_pct: +(scalePct * 100).toFixed(1),
						grading_method: 'grade_rules_exceeded',
						steps_beyond: stepResult.steps_beyond,
						error: `Your measurements are ${(scalePct * 100).toFixed(1)}% beyond size ${grading.target_size}. Custom-fit patterns work best within 5% adjustment. For larger differences, we recommend downloading the standard ${grading.target_size} size and applying manual alterations.`
					});
				}

				// Compute per-piece scale factors from grade rules
				// Cap each piece at the uniform scale — per-piece can reduce but never exceed uniform
				const gradeTarget = computeTargetCoords(gradeRulesRow.grade_data, stepResult);
				const maxSw = grading.pdf_scale_width;
				const maxSh = grading.pdf_scale_height;
				const pieceScales: [number, number][] = gradeTarget.pieces.map(p => [
					Math.round(Math.min(p.scale_w, maxSw) * 10000) / 10000,
					Math.round(Math.min(p.scale_h, maxSh) * 10000) / 10000
				]);

				// Preview — return grading info (no error = frontend shows downloads)
				if (!generate) {
					return json({
						grading,
						grading_method: 'grade_rules',
						steps_beyond: stepResult.steps_beyond,
						bust_steps: stepResult.bust_steps,
						waist_steps: stepResult.waist_steps,
						hip_steps: stepResult.hip_steps,
						largest_size: stepResult.largest_size,
						piece_steps: gradeTarget.pieces.map(p => ({ i: p.index, s: p.piece_steps, sw: +(Math.min(p.scale_w, maxSw).toFixed(4)), sh: +(Math.min(p.scale_h, maxSh).toFixed(4)) })),
						high_extrapolation: stepResult.steps_beyond > 5
					});
				}

				// Generate files — use proven extract-single-size.py with per-piece scales
				const patterns = await query<{ pattern_name: string }>(
					'SELECT pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1',
					[pattern_slug]
				);
				const patternName = patterns[0]?.pattern_name || pattern_slug;
				const customLabel = `GRADED (bust ${bust}, waist ${waist}, hip ${hip})`;

				console.log(`[grade-rules] Generating for ${pattern_slug}: ${pieceScales.length} per-piece scales via proven pipeline`);

				try {
					const files = await generateCustomPatternFiles(
						pattern_slug,
						patternName,
						{ width: grading.scale_width, height: grading.scale_height },
						{ width: grading.pdf_scale_width, height: grading.pdf_scale_height },
						customLabel,
						grading.target_size,
						pieceScales  // ← per-piece scales passed to extract-single-size.py
					);

					if (files.length === 0) {
						throw error(500, 'No pattern files could be generated');
					}

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

					return json({
						grading,
						grading_method: 'grade_rules',
						steps_beyond: stepResult.steps_beyond,
						files: files.map(f => ({
							format: f.format, label: f.label, filename: f.filename, size: f.data.length
						}))
					});
				} catch (e: any) {
					console.error('[grade-rules] Generation failed:', e);
					if (e?.status) throw e;
					throw error(500, `Generation failed: ${e?.message || 'unknown error'}`);
				}
			}
		}

		// No grade rules — return existing "too large" error
		return json({
			grading,
			scale_pct: +(scalePct * 100).toFixed(1),
			error: `Your measurements are ${(scalePct * 100).toFixed(0)}% beyond the nearest size (${grading.target_size}). Custom-fit patterns work best within 4% adjustment. For larger differences, we recommend downloading the nearest standard size and making manual alterations.`
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
