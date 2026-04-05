import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface PatternRow {
	pattern_slug: string;
	pattern_name: string;
	has_a0: boolean;
	has_instructions: boolean;
	has_finished_images: boolean;
	has_dxf: boolean;
	has_cover_image: boolean;
	shopify_name: string | null;
	old_name: string | null;
	etsy_name: string | null;
	embedding_chunk_count: number;
}

interface EmbeddingRow {
	chunk_type: string;
	description: string;
	metadata: Record<string, unknown>;
}

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<PatternRow>(
		`SELECT * FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);

	if (patterns.length === 0) {
		throw error(404, 'Pattern not found');
	}

	const pattern = patterns[0];

	// Fetch YouTube tutorials and product identity from embeddings
	const extras = await query<EmbeddingRow>(
		`SELECT chunk_type, description, metadata
		 FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type IN ('youtube_tutorial', 'product_identity')
		 ORDER BY chunk_type, chunk_index`,
		[params.slug]
	);

	const tutorials = extras
		.filter((e) => e.chunk_type === 'youtube_tutorial')
		.map((e) => ({
			title: e.description,
			url: (e.metadata as Record<string, string>)?.video_url || ''
		}));

	const identity = extras.find((e) => e.chunk_type === 'product_identity');

	return {
		pattern,
		tutorials,
		description: identity?.description || null
	};
};
