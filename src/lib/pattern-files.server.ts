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
	format: 'dxf';
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
 * Find the DXF file for a pattern.
 */
async function findDxfFile(slug: string): Promise<{ path: string; name: string } | null> {
	const admin = getAdmin();

	for (const folder of ['dxf', 'dxf ']) {
		const { data: files } = await admin.storage
			.from('pattern-files')
			.list(`${slug}/${folder}`, { limit: 5 });

		if (!files) continue;
		const dxf = files.find(f => f.name.endsWith('.dxf'));
		if (dxf) return { path: `${slug}/${folder}/${dxf.name}`, name: dxf.name };
	}

	return null;
}

/**
 * Download a file from Supabase storage as text.
 */
async function downloadFileText(path: string): Promise<string> {
	const admin = getAdmin();
	const { data, error } = await admin.storage
		.from('pattern-files')
		.download(path);

	if (error || !data) {
		throw new Error(`Download failed for ${path}: ${error?.message}`);
	}

	return await data.text();
}

/**
 * Scale a DXF file by modifying vertex coordinates.
 * Normalizes line endings and scales all geometry around each block's center.
 */
function scaleDxf(
	dxfContent: string,
	scale: ScaleFactors,
	customLabel: string
): string {
	// Normalize Windows line endings
	let content = dxfContent.replace(/\r\n/g, '\n');

	// Find each BLOCK section
	const blockPattern = /(\n\s*0\nBLOCK\n[\s\S]*?\n\s*2\n\s*)(\S+)([\s\S]*?\n\s*0\nENDBLK)/g;

	content = content.replace(blockPattern, (fullMatch, prefix, blockName, blockContent) => {
		if (blockName.startsWith('*')) return fullMatch;

		// Find center of polyline geometry in this block
		const coordPairs: { x: number; y: number }[] = [];
		const vertexPattern = /\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*([\d.-]+)\n\s*20\n\s*([\d.-]+)/g;
		let vm;
		while ((vm = vertexPattern.exec(blockContent)) !== null) {
			coordPairs.push({ x: parseFloat(vm[1]), y: parseFloat(vm[2]) });
		}

		if (coordPairs.length === 0) return fullMatch;

		const cx = coordPairs.reduce((s, p) => s + p.x, 0) / coordPairs.length;
		const cy = coordPairs.reduce((s, p) => s + p.y, 0) / coordPairs.length;

		// Scale VERTEX coordinates
		let scaled = blockContent.replace(
			/(\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				const newX = cx + (parseFloat(m[2]) - cx) * scale.width;
				const newY = cy + (parseFloat(m[4]) - cy) * scale.height;
				return `${m[1]}${newX.toFixed(6)}${m[3]}${newY.toFixed(6)}`;
			}
		);

		// Scale LINE coordinates
		scaled = scaled.replace(
			/(\n\s*0\nLINE\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)(\n\s*11\n\s*)([\d.-]+)(\n\s*21\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				return `${m[1]}${(cx + (parseFloat(m[2]) - cx) * scale.width).toFixed(6)}${m[3]}${(cy + (parseFloat(m[4]) - cy) * scale.height).toFixed(6)}${m[5]}${(cx + (parseFloat(m[6]) - cx) * scale.width).toFixed(6)}${m[7]}${(cy + (parseFloat(m[8]) - cy) * scale.height).toFixed(6)}`;
			}
		);

		// Scale POINT coordinates
		scaled = scaled.replace(
			/(\n\s*0\nPOINT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				return `${m[1]}${(cx + (parseFloat(m[2]) - cx) * scale.width).toFixed(6)}${m[3]}${(cy + (parseFloat(m[4]) - cy) * scale.height).toFixed(6)}`;
			}
		);

		// Scale TEXT insert positions
		scaled = scaled.replace(
			/(\n\s*0\nTEXT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(...m: string[]) => {
				return `${m[1]}${(cx + (parseFloat(m[2]) - cx) * scale.width).toFixed(6)}${m[3]}${(cy + (parseFloat(m[4]) - cy) * scale.height).toFixed(6)}`;
			}
		);

		// Update Size label
		scaled = scaled.replace(/(\n\s*1\n\s*)Size: .+/g, `$1Size: ${customLabel}`);

		return `${prefix}${blockName}${scaled}`;
	});

	return content;
}

/**
 * Generate a custom-fit DXF pattern file.
 * Only DXF is supported for custom scaling — DXF files contain a single size,
 * so proportional scaling produces an accurate custom-fit pattern.
 * Multi-size PDFs should NOT be scaled (it would make 6 of 7 size lines wrong).
 */
export async function generateCustomDxfFile(
	patternSlug: string,
	patternName: string,
	scale: ScaleFactors,
	customLabel: string
): Promise<PatternFile> {
	const dxfFile = await findDxfFile(patternSlug);
	if (!dxfFile) {
		throw new Error(`No DXF file found for ${patternSlug}`);
	}

	const raw = await downloadFileText(dxfFile.path);
	const scaled = scaleDxf(raw, scale, customLabel);
	const cleanName = patternName.toLowerCase().replace(/\s+/g, '-');

	return {
		format: 'dxf',
		label: 'Custom-Fit DXF Pattern',
		filename: `${cleanName}-custom-fit.dxf`,
		data: new TextEncoder().encode(scaled),
		mimeType: 'application/dxf'
	};
}
