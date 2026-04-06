import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import { parsePatternInstructions } from '$lib/pattern-parser';
import { signPatternUrls } from '$lib/storage.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	const pattern = patterns[0];

	// Fetch all instruction-related embeddings
	const embeddings = await query<{ chunk_type: string; chunk_index: number; description: string; metadata: Record<string, unknown> }>(
		`SELECT chunk_type, chunk_index, description, metadata
		 FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type IN ('instructions_text', 'instruction_illustration')
		 ORDER BY chunk_type, chunk_index`,
		[params.slug]
	);

	const instructionsText = embeddings.find((e) => e.chunk_type === 'instructions_text' && e.chunk_index === 0)?.description || '';
	const sizeChartText = embeddings.find((e) => e.chunk_type === 'instructions_text' && e.chunk_index === 1)?.description || '';

	if (!instructionsText) throw error(404, 'No instructions available');

	// Parse structured data
	const parsed = parsePatternInstructions(instructionsText, sizeChartText);

	// Get illustration page images (signed URLs)
	const illustrations = embeddings
		.filter((e) => e.chunk_type === 'instruction_illustration')
		.map((e) => ({
			page: parseInt((e.metadata?.page as string) || '0'),
			description: e.description
		}))
		.sort((a, b) => a.page - b.page);

	// Sign illustration PDF page images — we'll use the instruction PDF pages
	// For now, return the illustration metadata so the UI knows which pages have diagrams
	const illustrationPages = illustrations.map((i) => i.page);

	return {
		pattern,
		parsed,
		sizeChartRaw: sizeChartText,
		illustrationPages,
		totalSteps: parsed.sewingSteps.length,
		totalPieces: parsed.patternPieces.length
	};
};
