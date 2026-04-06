import { query } from '$lib/db.server';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;

	const { data: editions } = await supabase.from('magazine_editions').select('*').order('created_at', { ascending: false });
	const { data: rounds } = await supabase.from('free_pattern_rounds').select('*').order('created_at', { ascending: false });

	// Get all pattern slugs for the picker
	const allPatterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog ORDER BY pattern_name`
	);

	return {
		editions: editions || [],
		rounds: rounds || [],
		allPatterns
	};
};

export const actions: Actions = {
	createRound: async ({ request, locals }) => {
		const form = await request.formData();
		const { createClient } = await import('@supabase/supabase-js');
		const { env } = await import('$env/dynamic/private');
		const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');
		const admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');

		const slugsRaw = form.get('pattern_slugs') as string;
		const slugs = slugsRaw.split(',').map((s) => s.trim()).filter(Boolean);

		const { error: insertError } = await admin.from('free_pattern_rounds').insert({
			edition_id: form.get('edition_id') || null,
			round_name: form.get('round_name'),
			pattern_slugs: slugs,
			starts_at: form.get('starts_at'),
			ends_at: form.get('ends_at') || null,
			is_active: true
		});

		return { success: !insertError, error: insertError?.message };
	},

	toggleRound: async ({ request }) => {
		const form = await request.formData();
		const { createClient } = await import('@supabase/supabase-js');
		const { env } = await import('$env/dynamic/private');
		const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');
		const admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');

		const id = form.get('id') as string;
		const isActive = form.get('is_active') === 'true';

		await admin.from('free_pattern_rounds').update({ is_active: !isActive }).eq('id', id);
		return { success: true };
	}
};
