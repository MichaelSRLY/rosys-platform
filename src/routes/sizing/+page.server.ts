import { query } from '$lib/db.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Get patterns that have size charts (the ones sizing works for)
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT DISTINCT c.pattern_slug, c.pattern_name
		 FROM cs_pattern_catalog c
		 INNER JOIN cs_pattern_size_charts s ON s.pattern_slug = c.pattern_slug
		 ORDER BY c.pattern_name`
	);

	return { patterns };
};
