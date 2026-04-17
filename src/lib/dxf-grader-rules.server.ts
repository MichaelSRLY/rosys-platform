/**
 * DXF grading using per-vertex grade rules.
 *
 * Since DXF files use POLYLINE vertices (many short segments approximating curves)
 * while PDF grade rules use Bézier control points, we can't do 1:1 vertex mapping.
 * Instead, we derive PER-PIECE scale factors from the grade rules — each piece gets
 * its own scale based on how it actually grows across sizes.
 *
 * This is much better than uniform scaling because:
 * - Bodice pieces scale more for bust, less for height
 * - Skirt pieces scale more for hip
 * - Sleeve pieces scale proportionally
 * Each piece behaves according to Rosa's original grading intent.
 *
 * This is a NEW module — does not modify dxf-grader.server.ts.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { GradeTarget, GradeTargetPiece } from '$lib/grade-rules.server';

function getAdmin() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');
}

export interface GradedDxfResult {
	content: string;
	filename: string;
	pieces: {
		name: string;
		originalMm: { w: number; h: number };
		gradedMm: { w: number; h: number };
		scale_w: number;
		scale_h: number;
	}[];
}

// ─── DXF Download ───

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

// ─── Per-Piece Scaling ───

interface DxfBlock {
	name: string;
	pieceName: string;
	startIdx: number;
	endIdx: number;
	vertices: { x: number; y: number }[];
	centerX: number;
	centerY: number;
	bbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

function parseDxfBlocks(content: string): DxfBlock[] {
	const blocks: DxfBlock[] = [];
	const blockPattern = /\n\s*0\nBLOCK\n([\s\S]*?)\n\s*0\nENDBLK/g;
	let match;

	while ((match = blockPattern.exec(content)) !== null) {
		const blockContent = match[1];
		const nameMatch = blockContent.match(/\n\s*2\n\s*(.+)/);
		if (!nameMatch) continue;
		const name = nameMatch[1].trim();
		if (name.startsWith('*')) continue;

		// Get piece name
		let pieceName = '';
		const textMatches = blockContent.matchAll(/\n\s*0\nTEXT[\s\S]*?\n\s*1\n\s*(.+)/g);
		for (const tm of textMatches) {
			const text = tm[1].trim();
			if (text.startsWith('Piece Name:')) pieceName = text.replace('Piece Name:', '').trim();
		}

		// Get vertices from POLYLINE sections (layers 1 and 14)
		const vertices: { x: number; y: number }[] = [];
		const vertPattern = /\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*([\d.-]+)\n\s*20\n\s*([\d.-]+)/g;
		let vm;
		while ((vm = vertPattern.exec(blockContent)) !== null) {
			vertices.push({ x: parseFloat(vm[1]), y: parseFloat(vm[2]) });
		}

		if (vertices.length === 0) continue;

		const xs = vertices.map(v => v.x);
		const ys = vertices.map(v => v.y);
		const minX = Math.min(...xs), maxX = Math.max(...xs);
		const minY = Math.min(...ys), maxY = Math.max(...ys);

		blocks.push({
			name,
			pieceName,
			startIdx: match.index,
			endIdx: match.index + match[0].length,
			vertices,
			centerX: (minX + maxX) / 2,
			centerY: (minY + maxY) / 2,
			bbox: { minX, minY, maxX, maxY }
		});
	}

	return blocks;
}

function scaleDxfBlock(
	blockContent: string,
	cx: number,
	cy: number,
	scaleW: number,
	scaleH: number,
	customLabel: string
): string {
	// Scale VERTEX coordinates
	let result = blockContent.replace(
		/(\n\s*0\nVERTEX\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
		(_, prefix, xStr, mid, yStr) => {
			const newX = cx + (parseFloat(xStr) - cx) * scaleW;
			const newY = cy + (parseFloat(yStr) - cy) * scaleH;
			return `${prefix}${newX.toFixed(6)}${mid}${newY.toFixed(6)}`;
		}
	);

	// Scale LINE coordinates
	result = result.replace(
		/(\n\s*0\nLINE\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)(\n\s*11\n\s*)([\d.-]+)(\n\s*21\n\s*)([\d.-]+)/g,
		(_, p1, x1, p2, y1, p3, x2, p4, y2) => {
			const nx1 = cx + (parseFloat(x1) - cx) * scaleW;
			const ny1 = cy + (parseFloat(y1) - cy) * scaleH;
			const nx2 = cx + (parseFloat(x2) - cx) * scaleW;
			const ny2 = cy + (parseFloat(y2) - cy) * scaleH;
			return `${p1}${nx1.toFixed(6)}${p2}${ny1.toFixed(6)}${p3}${nx2.toFixed(6)}${p4}${ny2.toFixed(6)}`;
		}
	);

	// Scale POINT coordinates
	result = result.replace(
		/(\n\s*0\nPOINT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
		(_, prefix, xStr, mid, yStr) => {
			const newX = cx + (parseFloat(xStr) - cx) * scaleW;
			const newY = cy + (parseFloat(yStr) - cy) * scaleH;
			return `${prefix}${newX.toFixed(6)}${mid}${newY.toFixed(6)}`;
		}
	);

	// Scale TEXT positions
	result = result.replace(
		/(\n\s*0\nTEXT\n\s*8\n\s*\w+\n\s*10\n\s*)([\d.-]+)(\n\s*20\n\s*)([\d.-]+)/g,
		(_, prefix, xStr, mid, yStr) => {
			const newX = cx + (parseFloat(xStr) - cx) * scaleW;
			const newY = cy + (parseFloat(yStr) - cy) * scaleH;
			return `${prefix}${newX.toFixed(6)}${mid}${newY.toFixed(6)}`;
		}
	);

	// Update Size label
	result = result.replace(
		/(\n\s*1\n\s*)Size: .+/g,
		`$1Size: ${customLabel}`
	);

	return result;
}

/**
 * Generate a custom-graded DXF using per-piece scale factors from grade rules.
 *
 * Each piece gets its own scale_w/scale_h derived from how that piece actually
 * grows across sizes in Rosa's grading. This is much more accurate than uniform scaling.
 */
export async function generateGradedDxfFromRules(
	patternSlug: string,
	gradeTarget: GradeTarget,
	customLabel: string
): Promise<GradedDxfResult | null> {
	// Download DXF
	const dxfPath = await findDxfPath(patternSlug);
	if (!dxfPath) return null;

	let content = await downloadDxf(dxfPath);
	content = content.replace(/\r\n/g, '\n');

	// Parse blocks
	const blocks = parseDxfBlocks(content);
	if (blocks.length === 0) return null;

	const gradedPieces: GradedDxfResult['pieces'] = [];

	// Match DXF blocks to grade target pieces by index
	const blockPattern = /(\n\s*0\nBLOCK\n[\s\S]*?\n\s*2\n\s*)(\S+)([\s\S]*?\n\s*0\nENDBLK)/g;
	const replacements: { start: number; end: number; newContent: string }[] = [];
	let blockIdx = 0;

	for (const section of content.matchAll(blockPattern)) {
		const blockName = section[2].trim();
		if (blockName.startsWith('*')) continue;

		const block = blocks.find(b => b.name === blockName);
		if (!block || !block.bbox) { blockIdx++; continue; }

		// Get per-piece scale factors from grade target
		const target = blockIdx < gradeTarget.pieces.length
			? gradeTarget.pieces[blockIdx]
			: null;

		const scaleW = target ? target.scale_w : 1;
		const scaleH = target ? target.scale_h : 1;

		const origW = block.bbox.maxX - block.bbox.minX;
		const origH = block.bbox.maxY - block.bbox.minY;

		// Scale the block content
		const scaled = scaleDxfBlock(
			section[3],
			block.centerX,
			block.centerY,
			scaleW,
			scaleH,
			customLabel
		);

		gradedPieces.push({
			name: block.pieceName || block.name,
			originalMm: { w: Math.round(origW), h: Math.round(origH) },
			gradedMm: { w: Math.round(origW * scaleW), h: Math.round(origH * scaleH) },
			scale_w: Math.round(scaleW * 10000) / 10000,
			scale_h: Math.round(scaleH * 10000) / 10000
		});

		replacements.push({
			start: section.index! + section[1].length + section[2].length,
			end: section.index! + section[0].length - '\n  0\nENDBLK'.length,
			newContent: scaled
		});

		blockIdx++;
	}

	// Apply replacements in reverse order
	let result = content;
	for (const rep of replacements.sort((a, b) => b.start - a.start)) {
		result = result.slice(0, rep.start) + rep.newContent + result.slice(rep.end);
	}

	const patternName = patternSlug.replace(/^\d+_/, '').replace(/_/g, '-');

	return {
		content: result,
		filename: `${patternName}-graded-custom.dxf`,
		pieces: gradedPieces
	};
}
