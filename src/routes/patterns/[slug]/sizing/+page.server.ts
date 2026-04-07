import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPatternSizeChart, type PatternSizeChart } from '$lib/size-matching.server';

export const load: PageServerLoad = async ({ params, locals }) => {
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

	// Load saved measurement profile if user is authenticated
	let savedProfile: { bust_cm: number; waist_cm: number; hip_cm: number; height_cm: number | null } | null = null;
	if (locals.session) {
		const { data: profiles } = await locals.supabase
			.from('measurement_profiles')
			.select('bust_cm, waist_cm, hip_cm, height_cm')
			.eq('user_id', locals.session.user.id)
			.order('updated_at', { ascending: false })
			.limit(1);

		if (profiles && profiles.length > 0) {
			savedProfile = profiles[0];
		}
	}

	return {
		pattern: patterns[0],
		chart,
		rawSizeChart,
		savedProfile
	};
};
