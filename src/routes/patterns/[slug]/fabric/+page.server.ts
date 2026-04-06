import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface DxfPiece {
	piece_id: string;
	cut_width: number;
	cut_height: number;
	finished_width: number;
	finished_height: number;
	fold: boolean;
	qty: number;
}

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	// Get DXF data with piece dimensions
	const dxfChunks = await query<{ description: string }>(
		`SELECT description FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'dxf_pattern_piece'
		 ORDER BY chunk_index`,
		[params.slug]
	);

	// Get fabric requirements from instructions
	const fabricChunks = await query<{ description: string }>(
		`SELECT description FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'instructions_text'
		 AND (description ILIKE '%fabric requirement%' OR description ILIKE '%fabric suggestion%' OR description ILIKE '%you will need%')
		 ORDER BY chunk_index LIMIT 1`,
		[params.slug]
	);

	// Parse DXF pieces
	const pieces: DxfPiece[] = [];
	for (const chunk of dxfChunks) {
		const lines = chunk.description.split('\n');
		for (const line of lines) {
			const match = line.match(/^(@?)P(\d+): cut (\d+)x(\d+)mm, finished (\d+)x(\d+)mm, fold=([YN]), qty=(\d+)/);
			if (match) {
				pieces.push({
					piece_id: `${match[1]}P${match[2]}`,
					cut_width: parseInt(match[3]),
					cut_height: parseInt(match[4]),
					finished_width: parseInt(match[5]),
					finished_height: parseInt(match[6]),
					fold: match[7] === 'Y',
					qty: parseInt(match[8])
				});
			}
		}
	}

	// Extract grade rule info
	let gradeInfo = '';
	if (dxfChunks.length > 0) {
		const firstLine = dxfChunks[0].description.split('\n')[1] || '';
		gradeInfo = firstLine.trim();
	}

	return {
		pattern: patterns[0],
		pieces,
		gradeInfo,
		fabricText: fabricChunks[0]?.description || null,
		hasDxf: dxfChunks.length > 0
	};
};
