import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	// Get size chart from instructions
	const sizeChunks = await query<{ description: string }>(
		`SELECT description FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'instructions_text'
		 AND description ILIKE '%size chart%'
		 ORDER BY chunk_index LIMIT 1`,
		[params.slug]
	);

	return {
		pattern: patterns[0],
		sizeChart: sizeChunks[0]?.description || null
	};
};
