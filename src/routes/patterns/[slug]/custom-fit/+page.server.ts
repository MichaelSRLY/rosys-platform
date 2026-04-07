import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	// Check if pattern has DXF data
	const dxfCheck = await query<{ count: string }>(
		`SELECT COUNT(*) as count FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'dxf_pattern_piece'`,
		[params.slug]
	);
	const hasDxf = parseInt(dxfCheck[0]?.count ?? '0') > 0;

	// Load saved measurement profile
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
		hasDxf,
		savedProfile
	};
};
