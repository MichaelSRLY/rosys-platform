import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPatternSizeChart, type PatternSizeChart } from '$lib/size-matching.server';

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	// Get structured size chart from new table
	const chart = await getPatternSizeChart(params.slug);

	// Fallback: get raw size chart text from embeddings
	let rawSizeChart: string | null = null;
	if (!chart) {
		const sizeChunks = await query<{ description: string }>(
			`SELECT description FROM cs_pattern_embeddings
			 WHERE pattern_slug = $1 AND chunk_type = 'size_chart_text'
			 AND description NOT ILIKE '%no size chart%' AND LENGTH(description) > 50
			 ORDER BY chunk_index LIMIT 1`,
			[params.slug]
		);
		rawSizeChart = sizeChunks[0]?.description || null;
	}

	return {
		pattern: patterns[0],
		chart,
		rawSizeChart
	};
};
