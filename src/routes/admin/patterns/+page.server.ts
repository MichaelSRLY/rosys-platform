import { query } from '$lib/db.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get all patterns from Railway catalog
	const patterns = await query<{
		pattern_slug: string;
		pattern_name: string;
		has_a0: boolean;
		has_instructions: boolean;
		has_finished_images: boolean;
		has_dxf: boolean;
		embedding_chunk_count: number;
	}>(
		`SELECT pattern_slug, pattern_name, has_a0, has_instructions, has_finished_images, has_dxf, embedding_chunk_count
		 FROM cs_pattern_catalog ORDER BY pattern_name`
	);

	// Get admin config status from Supabase
	const { data: adminConfigs } = await locals.supabase
		.from('pattern_admin')
		.select('pattern_slug, is_published, category, difficulty');

	const configMap = new Map((adminConfigs || []).map((c: any) => [c.pattern_slug, c]));

	const enriched = patterns.map((p) => ({
		...p,
		isConfigured: configMap.has(p.pattern_slug),
		isPublished: configMap.get(p.pattern_slug)?.is_published || false,
		category: configMap.get(p.pattern_slug)?.category || null,
		adminDifficulty: configMap.get(p.pattern_slug)?.difficulty || null
	}));

	return { patterns: enriched };
};
