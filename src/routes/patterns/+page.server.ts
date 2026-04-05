import { query } from '$lib/db.server';
import type { PageServerLoad } from './$types';

interface PatternRow {
	pattern_slug: string;
	pattern_name: string;
	has_a0: boolean;
	has_instructions: boolean;
	has_finished_images: boolean;
	has_dxf: boolean;
	shopify_name: string | null;
}

export const load: PageServerLoad = async () => {
	const patterns = await query<PatternRow>(
		`SELECT pattern_slug, pattern_name, has_a0, has_instructions, has_finished_images, has_dxf, shopify_name
		 FROM cs_pattern_catalog
		 ORDER BY pattern_name`
	);

	return { patterns };
};
