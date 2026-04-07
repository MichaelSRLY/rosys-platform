/**
 * DXF parser, grader, and writer.
 * Parses Optitex DXF files, applies proportional scaling to pattern piece
 * geometry, validates results, and outputs a new DXF.
 *
 * Runs server-side on Vercel (pure TypeScript, no Python dependency).
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

function getAdmin() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');
}

// ─── DXF Data Structures ───

interface DxfVertex {
	x: number;
	y: number;
	z: number;
}

interface DxfPolyline {
	layer: string;
	vertices: DxfVertex[];
	startIndex: number; // position in the raw DXF text
	endIndex: number;
}

interface DxfPiece {
	blockName: string;
	pieceName: string;
	size: string;
	fold: boolean;
	quantity: number;
	polylines: DxfPolyline[];
	centerX: number;
	centerY: number;
	cutBbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
	finishedBbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

export interface GradedDxf {
	content: string;
	filename: string;
	pieces: {
		name: string;
		originalCutMm: { w: number; h: number };
		gradedCutMm: { w: number; h: number };
		deltaW: number;
		deltaH: number;
	}[];
	validation: {
		passed: boolean;
		checks: { name: string; expected: number; actual: number; tolerance: number; passed: boolean }[];
	};
}

// ─── Supabase Storage ───

async function findDxfPath(slug: string): Promise<string | null> {
	const admin = getAdmin();

	for (const prefix of [`${slug}/dxf`, `${slug}/dxf `]) {
		const { data: files, error } = await admin.storage
			.from('pattern-files')
			.list(prefix, { limit: 10 });

		if (error || !files) continue;

		const dxf = files.find((f) => f.name.endsWith('.dxf'));
		if (dxf) return `${prefix}/${dxf.name}`;
	}
	return null;
}

async function downloadDxf(path: string): Promise<string> {
	const admin = getAdmin();
	const { data, error } = await admin.storage
		.from('pattern-files')
		.download(path);

	if (error || !data) {
		throw new Error(`Failed to download DXF at ${path}: ${error?.message || 'no data'}`);
	}

	return await data.text();
}

// ─── DXF Parsing ───

function parsePieces(dxfContent: string): DxfPiece[] {
	const pieces: DxfPiece[] = [];

	// Split into BLOCK sections
	// Blocks are between BLOCK and ENDBLK
	const blockPattern = /\n\s*0\nBLOCK\n([\s\S]*?)\n\s*0\nENDBLK/g;
	let match;

	while ((match = blockPattern.exec(dxfContent)) !== null) {
		const blockContent = match[1];
		const blockStart = match.index;

		// Get block name (group code 2)
		const nameMatch = blockContent.match(/\n\s*2\n\s*(.+)/);
		if (!nameMatch) continue;
		const blockName = nameMatch[1].trim();

		// Skip system blocks
		if (blockName.startsWith('*')) continue;

		// Extract piece metadata from TEXT entities
		let pieceName = '';
		let size = '';
		let fold = false;
		let quantity = 1;

		const textMatches = blockContent.matchAll(/\n\s*0\nTEXT[\s\S]*?\n\s*1\n\s*(.+)/g);
		for (const tm of textMatches) {
			const text = tm[1].trim();
			if (text.startsWith('Piece Name:')) pieceName = text.replace('Piece Name:', '').trim();
			else if (text.startsWith('Size:')) size = text.replace('Size:', '').trim();
			else if (text.startsWith('Fold:')) fold = text.replace('Fold:', '').trim() === 'Y';
			else if (text.startsWith('Quantity:')) quantity = parseInt(text.replace('Quantity:', '').trim()) || 1;
		}

		// Extract POLYLINE entities with their vertices
		const polylines: DxfPolyline[] = [];
		const polyPattern = /\n\s*0\nPOLYLINE\n([\s\S]*?)\n\s*0\nSEQEND/g;
		let polyMatch;

		while ((polyMatch = polyPattern.exec(blockContent)) !== null) {
			const polyContent = polyMatch[1];

			// Get layer
			const layerMatch = polyContent.match(/\n\s*8\n\s*(.+)/);
			const layer = layerMatch ? layerMatch[1].trim() : '0';

			// Extract vertices
			const vertices: DxfVertex[] = [];
			const vertPattern = /\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*([\d.-]+)\n\s*20\n\s*([\d.-]+)/g;
			let vertMatch;
			while ((vertMatch = vertPattern.exec(polyContent)) !== null) {
				vertices.push({
					x: parseFloat(vertMatch[1]),
					y: parseFloat(vertMatch[2]),
					z: 0
				});
			}

			if (vertices.length > 0) {
				polylines.push({
					layer,
					vertices,
					startIndex: blockStart + polyMatch.index,
					endIndex: blockStart + polyMatch.index + polyMatch[0].length
				});
			}
		}

		// Calculate center and bounding boxes
		const cutPolys = polylines.filter(p => p.layer === '1');
		const finPolys = polylines.filter(p => p.layer === '14');

		function bbox(polys: DxfPolyline[]) {
			const allX = polys.flatMap(p => p.vertices.map(v => v.x));
			const allY = polys.flatMap(p => p.vertices.map(v => v.y));
			if (allX.length === 0) return null;
			return { minX: Math.min(...allX), minY: Math.min(...allY), maxX: Math.max(...allX), maxY: Math.max(...allY) };
		}

		const allPolys = [...cutPolys, ...finPolys];
		const allX = allPolys.flatMap(p => p.vertices.map(v => v.x));
		const allY = allPolys.flatMap(p => p.vertices.map(v => v.y));

		pieces.push({
			blockName,
			pieceName,
			size,
			fold,
			quantity,
			polylines,
			centerX: allX.length > 0 ? (Math.min(...allX) + Math.max(...allX)) / 2 : 0,
			centerY: allY.length > 0 ? (Math.min(...allY) + Math.max(...allY)) / 2 : 0,
			cutBbox: bbox(cutPolys),
			finishedBbox: bbox(finPolys)
		});
	}

	return pieces;
}

// ─── DXF Scaling ───

function scaleDxfContent(
	dxfContent: string,
	scaleW: number,
	scaleH: number,
	pieces: DxfPiece[],
	customLabel: string
): { content: string; gradedPieces: GradedDxf['pieces'] } {
	let result = dxfContent;
	const gradedPieces: GradedDxf['pieces'] = [];

	// We need to scale coordinates within each BLOCK
	// Strategy: find each BLOCK, scale all numeric coordinates within it

	for (const piece of pieces) {
		const cx = piece.centerX;
		const cy = piece.centerY;

		const originalCut = piece.cutBbox;
		if (!originalCut) continue;

		const origW = originalCut.maxX - originalCut.minX;
		const origH = originalCut.maxY - originalCut.minY;

		// We'll track the graded dimensions after applying the scale
		gradedPieces.push({
			name: piece.pieceName || piece.blockName,
			originalCutMm: { w: Math.round(origW), h: Math.round(origH) },
			gradedCutMm: { w: Math.round(origW * scaleW), h: Math.round(origH * scaleH) },
			deltaW: Math.round(origW * scaleW - origW),
			deltaH: Math.round(origH * scaleH - origH)
		});
	}

	// Apply scaling by modifying coordinate values in the DXF text
	// Find each BLOCK section and scale coordinates within it

	const blockSections = result.matchAll(/(\n\s*0\nBLOCK\n[\s\S]*?\n\s*2\n\s*)(\S+)([\s\S]*?\n\s*0\nENDBLK)/g);

	const replacements: { start: number; end: number; newContent: string }[] = [];

	for (const section of blockSections) {
		const blockName = section[2].trim();
		if (blockName.startsWith('*')) continue;

		const piece = pieces.find(p => p.blockName === blockName);
		if (!piece) continue;

		const cx = piece.centerX;
		const cy = piece.centerY;
		let blockContent = section[3];

		// Scale all coordinate pairs (group codes 10/20 for X/Y)
		// This is within POLYLINE/VERTEX, LINE, POINT, TEXT entities

		// Replace VERTEX coordinates
		blockContent = blockContent.replace(
			/(\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(_, prefix, xStr, mid, yStr) => {
				const x = parseFloat(xStr);
				const y = parseFloat(yStr);
				const newX = cx + (x - cx) * scaleW;
				const newY = cy + (y - cy) * scaleH;
				return `${prefix}${newX.toFixed(6)}${mid}${newY.toFixed(6)}`;
			}
		);

		// Replace LINE start/end coordinates
		blockContent = blockContent.replace(
			/(\n\s*0\nLINE\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)(\n\s*11\n\s*)([\d.-]+)(\n\s*21\n\s*)([\d.-]+)/g,
			(_, p1, x1, p2, y1, p3, x2, p4, y2) => {
				const nx1 = cx + (parseFloat(x1) - cx) * scaleW;
				const ny1 = cy + (parseFloat(y1) - cy) * scaleH;
				const nx2 = cx + (parseFloat(x2) - cx) * scaleW;
				const ny2 = cy + (parseFloat(y2) - cy) * scaleH;
				return `${p1}${nx1.toFixed(6)}${p2}${ny1.toFixed(6)}${p3}${nx2.toFixed(6)}${p4}${ny2.toFixed(6)}`;
			}
		);

		// Replace POINT coordinates
		blockContent = blockContent.replace(
			/(\n\s*0\nPOINT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(_, prefix, xStr, mid, yStr) => {
				const x = parseFloat(xStr);
				const y = parseFloat(yStr);
				const newX = cx + (x - cx) * scaleW;
				const newY = cy + (y - cy) * scaleH;
				return `${prefix}${newX.toFixed(6)}${mid}${newY.toFixed(6)}`;
			}
		);

		// Replace TEXT insert positions
		blockContent = blockContent.replace(
			/(\n\s*0\nTEXT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
			(_, prefix, xStr, mid, yStr) => {
				const x = parseFloat(xStr);
				const y = parseFloat(yStr);
				const newX = cx + (x - cx) * scaleW;
				const newY = cy + (y - cy) * scaleH;
				return `${prefix}${newX.toFixed(6)}${mid}${newY.toFixed(6)}`;
			}
		);

		// Update Size label
		blockContent = blockContent.replace(
			/(\n\s*1\n\s*)Size: .+/g,
			`$1Size: ${customLabel}`
		);

		replacements.push({
			start: section.index! + section[1].length + section[2].length,
			end: section.index! + section[0].length - '\n  0\nENDBLK'.length,
			newContent: blockContent
		});
	}

	// Apply replacements in reverse order to preserve indices
	for (const rep of replacements.sort((a, b) => b.start - a.start)) {
		result = result.slice(0, rep.start) + rep.newContent + result.slice(rep.end);
	}

	return { content: result, gradedPieces };
}

// ─── Validation ───

interface ValidationCheck {
	name: string;
	expected: number;
	actual: number;
	tolerance: number;
	passed: boolean;
}

function validateGradedDxf(
	originalPieces: DxfPiece[],
	gradedContent: string,
	scaleW: number,
	scaleH: number
): { passed: boolean; checks: ValidationCheck[] } {
	const checks: ValidationCheck[] = [];

	// Re-parse the graded DXF to get actual dimensions
	const gradedPieces = parsePieces(gradedContent.replace(/\r\n/g, '\n'));

	for (const orig of originalPieces) {
		if (!orig.cutBbox) continue;

		const graded = gradedPieces.find(p => p.blockName === orig.blockName);
		if (!graded?.cutBbox) continue;

		const origW = orig.cutBbox.maxX - orig.cutBbox.minX;
		const origH = orig.cutBbox.maxY - orig.cutBbox.minY;
		const expectedW = origW * scaleW;
		const expectedH = origH * scaleH;
		const actualW = graded.cutBbox.maxX - graded.cutBbox.minX;
		const actualH = graded.cutBbox.maxY - graded.cutBbox.minY;

		// Allow 1mm tolerance
		const tolerance = 1;

		checks.push({
			name: `${orig.pieceName || orig.blockName} width`,
			expected: Math.round(expectedW),
			actual: Math.round(actualW),
			tolerance,
			passed: Math.abs(actualW - expectedW) <= tolerance
		});

		checks.push({
			name: `${orig.pieceName || orig.blockName} height`,
			expected: Math.round(expectedH),
			actual: Math.round(actualH),
			tolerance,
			passed: Math.abs(actualH - expectedH) <= tolerance
		});
	}

	return {
		passed: checks.every(c => c.passed),
		checks
	};
}

// ─── Main Export ───

export async function generateCustomDxf(
	patternSlug: string,
	scaleW: number,
	scaleH: number,
	customLabel: string
): Promise<GradedDxf | null> {
	// 1. Find and download the DXF
	const dxfPath = await findDxfPath(patternSlug);
	if (!dxfPath) {
		throw new Error(`No DXF path found for ${patternSlug}`);
	}

	let originalContent = await downloadDxf(dxfPath);

	// Normalize line endings — DXF files from Windows use \r\n
	originalContent = originalContent.replace(/\r\n/g, '\n');

	// 2. Parse pieces
	const pieces = parsePieces(originalContent);
	if (pieces.length === 0) return null;

	// 3. Apply scaling
	const { content: gradedContent, gradedPieces } = scaleDxfContent(
		originalContent,
		scaleW,
		scaleH,
		pieces,
		customLabel
	);

	// 4. Validate
	const validation = validateGradedDxf(pieces, gradedContent, scaleW, scaleH);

	// 5. Generate filename
	const patternName = patternSlug.replace(/^\d+_/, '').replace(/_/g, '-');
	const filename = `${patternName}-custom-fit.dxf`;

	return {
		content: gradedContent,
		filename,
		pieces: gradedPieces,
		validation
	};
}
