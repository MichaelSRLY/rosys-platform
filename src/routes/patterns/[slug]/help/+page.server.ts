import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	// Get YouTube tutorials for quick links
	const tutorials = await query<{ description: string; metadata: Record<string, string> }>(
		`SELECT description, metadata FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'youtube_tutorial'
		 ORDER BY chunk_index`,
		[params.slug]
	);

	return {
		pattern: patterns[0],
		tutorials: tutorials.map((t) => ({ title: t.description, url: t.metadata?.video_url || '' }))
	};
};
