import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import { signPatternUrls } from '$lib/storage.server';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase;

	const patterns = await query<any>(
		`SELECT * FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');
	const catalog = patterns[0];

	// Embeddings summary
	const embeddingStats = await query<{ chunk_type: string; count: number }>(
		`SELECT chunk_type, count(*)::int as count FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 GROUP BY chunk_type ORDER BY chunk_type`,
		[params.slug]
	);

	// Sewing steps count
	const instructionsChunk = await query<{ description: string }>(
		`SELECT description FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'instructions_text' AND chunk_index = 0`,
		[params.slug]
	);
	const stepsMatch = (instructionsChunk[0]?.description || '').match(/STEP\s+\d+/gi);
	const stepCount = stepsMatch ? stepsMatch.length : 0;

	// Admin config
	const { data: adminConfig } = await supabase
		.from('pattern_admin')
		.select('*')
		.eq('pattern_slug', params.slug)
		.single();

	// Get existing step illustration files from storage
	const stepIllustrationPaths: string[] = [];
	const { createClient } = await import('@supabase/supabase-js');
	const { env } = await import('$env/dynamic/private');
	const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');
	const admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');

	const { data: stepFiles } = await admin.storage
		.from('pattern-files')
		.list(`${params.slug}/step-illustrations`, { limit: 100 });

	if (stepFiles) {
		for (const f of stepFiles) {
			if (f.id) stepIllustrationPaths.push(`${params.slug}/step-illustrations/${f.name}`);
		}
	}

	// Sign illustration URLs
	const signedIllustrations = stepIllustrationPaths.length > 0
		? await signPatternUrls(stepIllustrationPaths)
		: {};

	// Storage files
	const allFiles: string[] = [];
	const { data: storageFiles } = await supabase.storage.from('pattern-files').list(params.slug, { limit: 50 });
	if (storageFiles) {
		for (const item of storageFiles) {
			if (!item.id) {
				const { data: sub } = await supabase.storage.from('pattern-files').list(`${params.slug}/${item.name}`, { limit: 20 });
				if (sub) for (const f of sub) { if (f.id) allFiles.push(`${params.slug}/${item.name}/${f.name}`); }
			} else {
				allFiles.push(`${params.slug}/${item.name}`);
			}
		}
	}

	return {
		catalog,
		adminConfig,
		embeddingStats,
		stepCount,
		storageFiles: allFiles,
		stepIllustrations: signedIllustrations,
		stepIllustrationPaths,
		slug: params.slug
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const form = await request.formData();

		const { createClient } = await import('@supabase/supabase-js');
		const { env } = await import('$env/dynamic/private');
		const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');
		const admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');

		const data = {
			pattern_slug: params.slug,
			display_name: form.get('display_name') as string || null,
			category: form.get('category') as string || null,
			difficulty: form.get('difficulty') as string || null,
			description: form.get('description') as string || null,
			is_published: form.get('is_published') === 'true',
			steps_config: JSON.parse(form.get('steps_config') as string || '[]'),
			overview_pages: JSON.parse(form.get('overview_pages') as string || '[]'),
			updated_at: new Date().toISOString()
		};

		const { error: upsertError } = await admin
			.from('pattern_admin')
			.upsert(data, { onConflict: 'pattern_slug' });

		if (upsertError) return { success: false, error: upsertError.message };
		return { success: true };
	}
};
