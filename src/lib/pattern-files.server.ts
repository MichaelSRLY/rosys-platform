/**
 * Pattern file operations — download, scale, and package custom-fit patterns.
 * Handles all formats: A0 PDF, A4 PDF, US Letter PDF, DXF.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

function getAdmin() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');
}

export interface PatternFile {
	format: 'a0' | 'a4' | 'us_letter' | 'dxf';
	label: string;
	filename: string;
	data: Uint8Array;
	mimeType: string;
}

interface ScaleFactors {
	width: number;
	height: number;
}

/**
 * Find all available pattern files for a slug.
 */
async function listPatternFiles(slug: string): Promise<{ format: string; path: string; name: string }[]> {
	const admin = getAdmin();
	const formats = [
		{ format: 'a0', folder: 'a0' },
		{ format: 'a4', folder: 'a4' },
		{ format: 'us_letter', folder: 'us_letter' },
		{ format: 'dxf', folder: 'dxf' }
	];

	const found: { format: string; path: string; name: string }[] = [];

	for (const fmt of formats) {
		for (const folder of [fmt.folder, `${fmt.folder} `]) {
			const { data: files } = await admin.storage
				.from('pattern-files')
				.list(`${slug}/${folder}`, { limit: 5 });

			if (!files) continue;

			const target = files.find(f =>
				f.name.endsWith('.pdf') || f.name.endsWith('.dxf')
			);

			if (target) {
				found.push({
					format: fmt.format,
					path: `${slug}/${folder}/${target.name}`,
					name: target.name
				});
				break;
			}
		}
	}

	return found;
}

/**
 * Download a file from Supabase storage.
 */
async function downloadFile(path: string): Promise<Uint8Array> {
	const admin = getAdmin();
	const { data, error } = await admin.storage
		.from('pattern-files')
		.download(path);

	if (error || !data) {
		throw new Error(`Download failed for ${path}: ${error?.message}`);
	}

	const buffer = await data.arrayBuffer();
	return new Uint8Array(buffer);
}

/**
 * Scale a PDF using Python/pikepdf for precise control.
 * Wraps pattern content in a scale transform while preserving
 * the test square (2x2cm calibration) at true print size.
 * Page dimensions (A0, A4, etc.) are unchanged.
 */
async function scalePdf(
	pdfBytes: Uint8Array,
	scale: ScaleFactors,
	targetSize: string,
): Promise<Uint8Array> {
	const { exec } = await import('child_process');
	const { promisify } = await import('util');
	const { writeFile: fsWrite, readFile: fsRead, unlink: fsUnlink } = await import('fs/promises');
	const { tmpdir } = await import('os');
	const { join } = await import('path');
	const { randomUUID } = await import('crypto');
	const execAsync = promisify(exec);

	const tmpId = randomUUID();
	const inputPath = join(tmpdir(), `${tmpId}-scale-in.pdf`);
	const outputPath = join(tmpdir(), `${tmpId}-scale-out.pdf`);

	try {
		await fsWrite(inputPath, Buffer.from(pdfBytes));
		const scriptPath = join(process.cwd(), 'scripts', 'scale-pattern.py');
		const cmd = `python3 "${scriptPath}" "${inputPath}" ${scale.width} ${scale.height} "${targetSize}" "${outputPath}"`;
		console.log(`[custom-fit] Running: scale W=${scale.width} H=${scale.height} size=${targetSize}`);
		const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
		if (stdout) console.log(`[custom-fit] Scale output: ${stdout.trim()}`);
		if (stderr) console.error(`[custom-fit] Scale error: ${stderr.trim()}`);
		const outputBuffer = await fsRead(outputPath);
		console.log(`[custom-fit] Scaled PDF: ${pdfBytes.length} -> ${outputBuffer.length} bytes`);
		return new Uint8Array(outputBuffer);
	} finally {
		await fsUnlink(inputPath).catch(() => {});
		await fsUnlink(outputPath).catch(() => {});
	}
}

/**
 * Scale a DXF file by modifying vertex coordinates.
 */
function scaleDxf(
	dxfContent: string,
	scale: ScaleFactors,
	customLabel: string
): string {
	let content = dxfContent.replace(/\r\n/g, '\n');

	const blockPattern = /(\n\s*0\nBLOCK\n[\s\S]*?\n\s*2\n\s*)(\S+)([\s\S]*?\n\s*0\nENDBLK)/g;

	content = content.replace(blockPattern, (fullMatch, prefix, blockName, blockContent) => {
		if (blockName.startsWith('*')) return fullMatch;

		const coordPairs: { x: number; y: number }[] = [];
		const vertexPattern = /\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*([\d.-]+)\n\s*20\n\s*([\d.-]+)/g;
		let vm;
		while ((vm = vertexPattern.exec(blockContent)) !== null) {
			coordPairs.push({ x: parseFloat(vm[1]), y: parseFloat(vm[2]) });
		}

		if (coordPairs.length === 0) return fullMatch;

		const cx = coordPairs.reduce((s, p) => s + p.x, 0) / coordPairs.length;
		const cy = coordPairs.reduce((s, p) => s + p.y, 0) / coordPairs.length;

		let scaled = blockContent.replace(
			/(\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				const newX = cx + (parseFloat(m[2]) - cx) * scale.width;
				const newY = cy + (parseFloat(m[4]) - cy) * scale.height;
				return `${m[1]}${newX.toFixed(6)}${m[3]}${newY.toFixed(6)}`;
			}
		);

		scaled = scaled.replace(
			/(\n\s*0\nLINE\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)(\n\s*11\n\s*)([\d.-]+)(\n\s*21\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				return `${m[1]}${(cx + (parseFloat(m[2]) - cx) * scale.width).toFixed(6)}${m[3]}${(cy + (parseFloat(m[4]) - cy) * scale.height).toFixed(6)}${m[5]}${(cx + (parseFloat(m[6]) - cx) * scale.width).toFixed(6)}${m[7]}${(cy + (parseFloat(m[8]) - cy) * scale.height).toFixed(6)}`;
			}
		);

		scaled = scaled.replace(
			/(\n\s*0\nPOINT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				return `${m[1]}${(cx + (parseFloat(m[2]) - cx) * scale.width).toFixed(6)}${m[3]}${(cy + (parseFloat(m[4]) - cy) * scale.height).toFixed(6)}`;
			}
		);

		scaled = scaled.replace(
			/(\n\s*0\nTEXT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				return `${m[1]}${(cx + (parseFloat(m[2]) - cx) * scale.width).toFixed(6)}${m[3]}${(cy + (parseFloat(m[4]) - cy) * scale.height).toFixed(6)}`;
			}
		);

		scaled = scaled.replace(/(\n\s*1\n\s*)Size: .+/g, `$1Size: ${customLabel}`);

		return `${prefix}${blockName}${scaled}`;
	});

	return content;
}

/**
 * Extract a single-size PDF using Python pikepdf OCG layer toggling.
 * Optionally applies a scale transform for custom-fit patterns.
 */
async function extractSingleSizePdf(
	slug: string,
	size: string,
	format: string,
	scale?: ScaleFactors
): Promise<Uint8Array | null> {
	const admin = getAdmin();

	// Check cache first (only for unscaled single-size exports)
	const cachePath = `${slug}/single-size/${size}/${format}.pdf`;
	if (!scale) {
		const { data: cached } = await admin.storage
			.from('pattern-files')
			.download(cachePath);

		if (cached) {
			return new Uint8Array(await cached.arrayBuffer());
		}
	}

	// Not cached — try to extract using Python script
	try {
		const { exec } = await import('child_process');
		const { promisify } = await import('util');
		const { writeFile: fsWrite, readFile: fsRead, unlink: fsUnlink } = await import('fs/promises');
		const { tmpdir } = await import('os');
		const { join } = await import('path');
		const { randomUUID } = await import('crypto');
		const execAsync = promisify(exec);

		// Download original multi-size PDF
		const originalPath = `${slug}/${format}/${format}.pdf`;
		const { data: original, error } = await admin.storage
			.from('pattern-files')
			.download(originalPath);

		if (error || !original) return null;

		const tmpId = randomUUID();
		const inputPath = join(tmpdir(), `${tmpId}-input.pdf`);
		const outputPath = join(tmpdir(), `${tmpId}-output.pdf`);

		try {
			await fsWrite(inputPath, Buffer.from(await original.arrayBuffer()));
			const scriptPath = join(process.cwd(), 'scripts', 'extract-single-size.py');
			const scaleArgs = scale ? ` --scale-w ${scale.width} --scale-h ${scale.height}` : '';
			console.log(`[extract] Running: size=${size} format=${format}${scaleArgs}`);
			await execAsync(`python3 "${scriptPath}" "${inputPath}" "${size}" "${outputPath}"${scaleArgs}`, { timeout: 30000 });
			const outputBuffer = await fsRead(outputPath);

			// Cache only unscaled single-size exports
			if (!scale) {
				await admin.storage.from('pattern-files').upload(cachePath, outputBuffer, { contentType: 'application/pdf', upsert: true });
			}

			return new Uint8Array(outputBuffer);
		} finally {
			await fsUnlink(inputPath).catch(() => {});
			await fsUnlink(outputPath).catch(() => {});
		}
	} catch (e: any) {
		console.error(`Single-size extraction failed for ${slug}/${size}/${format}:`, e.message);
		return null;
	}
}

/**
 * Generate custom-fit pattern files.
 *
 * For PDFs: extracts the single closest size first (removes other color lines),
 * then scales the single-size PDF proportionally. Customer gets a clean PDF
 * with only their custom-fit line.
 *
 * For DXF: scales geometry coordinates directly (DXF is already single-size).
 */
export async function generateCustomPatternFiles(
	patternSlug: string,
	patternName: string,
	dxfScale: ScaleFactors,
	pdfScale: ScaleFactors,
	customLabel: string,
	baseSize?: string
): Promise<PatternFile[]> {
	const available = await listPatternFiles(patternSlug);
	if (available.length === 0) {
		throw new Error(`No pattern files found for ${patternSlug}`);
	}

	const results: PatternFile[] = [];
	const cleanName = patternName.toLowerCase().replace(/\s+/g, '-');

	const formatLabels: Record<string, string> = {
		a0: 'A0 Pattern Sheet',
		a4: 'A4 Tiled Pattern',
		us_letter: 'US Letter Tiled Pattern',
		dxf: 'DXF Cutting File'
	};

	for (const file of available) {
		try {
			if (file.format === 'dxf') {
				const raw = await downloadFile(file.path);
				const text = new TextDecoder().decode(raw);
				const scaled = scaleDxf(text, dxfScale, customLabel);
				results.push({
					format: 'dxf',
					label: formatLabels.dxf,
					filename: `${cleanName}-custom-fit.dxf`,
					data: new TextEncoder().encode(scaled),
					mimeType: 'application/dxf'
				});
			} else {
				// PDF: extract single size + apply scale in one Python call
				let pdfBytes: Uint8Array | null = null;

				if (baseSize) {
					console.log(`[custom-fit] Extracting+scaling ${baseSize} for ${patternSlug}/${file.format} (W=${pdfScale.width} H=${pdfScale.height})`);
					pdfBytes = await extractSingleSizePdf(patternSlug, baseSize, file.format, pdfScale);
					if (pdfBytes) {
						console.log(`[custom-fit] Extract+scale OK (${pdfBytes.length} bytes)`);
					} else {
						console.warn(`[custom-fit] Extract+scale FAILED`);
					}
				}

				if (!pdfBytes) {
					pdfBytes = await downloadFile(file.path);
				}

				const scaled = pdfBytes;
				results.push({
					format: file.format as PatternFile['format'],
					label: formatLabels[file.format] || file.format,
					filename: `${cleanName}-custom-fit-${file.format}.pdf`,
					data: new Uint8Array(scaled),
					mimeType: 'application/pdf'
				});
			}
		} catch (e: any) {
			console.error(`Failed to process ${file.format} for ${patternSlug}:`, e.message);
		}
	}

	return results;
}

// Keep the DXF-only export for backwards compatibility
export async function generateCustomDxfFile(
	patternSlug: string,
	patternName: string,
	scale: ScaleFactors,
	customLabel: string
): Promise<PatternFile> {
	const files = await generateCustomPatternFiles(patternSlug, patternName, scale, scale, customLabel, undefined);
	const dxf = files.find(f => f.format === 'dxf');
	if (!dxf) throw new Error(`No DXF file found for ${patternSlug}`);
	return dxf;
}
