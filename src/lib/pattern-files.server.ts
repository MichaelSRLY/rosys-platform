/**
 * Pattern file operations — download, scale, and package custom-fit patterns.
 * Handles all formats: A0 PDF, A4 PDF, US Letter PDF, DXF.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PDFDocument } from 'pdf-lib';

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
 * Scale a PDF by applying a transformation to all pages.
 * Uses pdf-lib to modify the page content stream scaling.
 */
async function scalePdf(
	pdfBytes: Uint8Array,
	scale: ScaleFactors,
): Promise<Uint8Array> {
	const doc = await PDFDocument.load(pdfBytes);
	const pages = doc.getPages();

	for (const page of pages) {
		const { width, height } = page.getSize();
		const newWidth = width * scale.width;
		const newHeight = height * scale.height;
		page.setSize(newWidth, newHeight);
		page.scaleContent(scale.width, scale.height);
	}

	return await doc.save();
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
 * Generate custom-fit pattern files in all available formats.
 * PDFs are scaled using pdf-lib page transforms.
 * DXF is scaled by modifying geometry coordinates.
 */
export async function generateCustomPatternFiles(
	patternSlug: string,
	patternName: string,
	scale: ScaleFactors,
	customLabel: string
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
			const raw = await downloadFile(file.path);

			if (file.format === 'dxf') {
				const text = new TextDecoder().decode(raw);
				const scaled = scaleDxf(text, scale, customLabel);
				results.push({
					format: 'dxf',
					label: formatLabels.dxf,
					filename: `${cleanName}-custom-fit.dxf`,
					data: new TextEncoder().encode(scaled),
					mimeType: 'application/dxf'
				});
			} else {
				const scaled = await scalePdf(raw, scale);
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
	const files = await generateCustomPatternFiles(patternSlug, patternName, scale, customLabel);
	const dxf = files.find(f => f.format === 'dxf');
	if (!dxf) throw new Error(`No DXF file found for ${patternSlug}`);
	return dxf;
}
