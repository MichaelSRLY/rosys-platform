import { query } from '$lib/db.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;

	// Pattern stats from Railway
	const [catalogStats] = await query<{ total: number; embedded: number }>(
		`SELECT count(*) as total, count(embedded_at) as embedded FROM cs_pattern_catalog`
	);

	// Supabase stats
	const { count: adminPatternCount } = await supabase.from('pattern_admin').select('id', { count: 'exact', head: true });
	const { count: roundCount } = await supabase.from('free_pattern_rounds').select('id', { count: 'exact', head: true });
	const { data: activeRounds } = await supabase.from('free_pattern_rounds').select('*').eq('is_active', true);
	const { data: editions } = await supabase.from('magazine_editions').select('*').order('created_at', { ascending: false }).limit(3);
	const { count: productLinks } = await supabase.from('product_file_links').select('id', { count: 'exact', head: true });

	return {
		catalogTotal: catalogStats?.total || 0,
		catalogEmbedded: catalogStats?.embedded || 0,
		adminConfigured: adminPatternCount || 0,
		activeRounds: activeRounds || [],
		editions: editions || [],
		productLinks: productLinks || 0,
		roundCount: roundCount || 0
	};
};
