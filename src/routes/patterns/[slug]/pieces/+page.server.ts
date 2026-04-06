import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface PatternPiece {
	id: string;
	cutWidth: number;
	cutHeight: number;
	finishedWidth: number;
	finishedHeight: number;
	fold: boolean;
	qty: number;
	seamAllowanceW: number;
	seamAllowanceH: number;
}

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	const dxfChunks = await query<{ description: string }>(
		`SELECT description FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'dxf_pattern_piece'
		 ORDER BY chunk_index`,
		[params.slug]
	);

	if (dxfChunks.length === 0) throw error(404, 'No pattern pieces available');

	const pieces: PatternPiece[] = [];
	let gradeRule = '';
	let sampleSize = '';

	for (const chunk of dxfChunks) {
		const lines = chunk.description.split('\n');
		for (const line of lines) {
			// Parse grade info
			const gradeMatch = line.match(/Grade Rule: (.+?) \| Sample Size: (.+?) \|/);
			if (gradeMatch) {
				gradeRule = gradeMatch[1];
				sampleSize = gradeMatch[2];
			}

			// Parse piece
			const match = line.match(/^(@?)P(\d+): cut (\d+)x(\d+)mm, finished (\d+)x(\d+)mm, fold=([YN]), qty=(\d+)/);
			if (match) {
				const cutW = parseInt(match[3]);
				const cutH = parseInt(match[4]);
				const finW = parseInt(match[5]);
				const finH = parseInt(match[6]);
				pieces.push({
					id: `${match[1]}P${match[2]}`,
					cutWidth: cutW,
					cutHeight: cutH,
					finishedWidth: finW,
					finishedHeight: finH,
					fold: match[7] === 'Y',
					qty: parseInt(match[8]),
					seamAllowanceW: (cutW - finW) / 2,
					seamAllowanceH: (cutH - finH) / 2
				});
			}
		}
	}

	return {
		pattern: patterns[0],
		pieces,
		gradeRule,
		sampleSize
	};
};
