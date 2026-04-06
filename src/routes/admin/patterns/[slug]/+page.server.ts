import { query } from '$lib/db.server';
import { error, json } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase;

	// Pattern from Railway catalog
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

	// Illustration pages
	const illustrations = await query<{ page: number }>(
		`SELECT (metadata->>'page')::int as page FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'instruction_illustration'
		 ORDER BY (metadata->>'page')::int`,
		[params.slug]
	);

	// Sewing steps from parsed instructions
	const instructionsChunk = await query<{ description: string }>(
		`SELECT description FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'instructions_text' AND chunk_index = 0`,
		[params.slug]
	);

	// Count sewing steps
	const stepsMatch = (instructionsChunk[0]?.description || '').match(/STEP\s+\d+/gi);
	const stepCount = stepsMatch ? stepsMatch.length : 0;

	// Admin config from Supabase
	const { data: adminConfig } = await supabase
		.from('pattern_admin')
		.select('*')
		.eq('pattern_slug', params.slug)
		.single();

	// Storage files
	const { data: storageFiles } = await supabase.storage
		.from('pattern-files')
		.list(params.slug, { limit: 50 });

	// Get subfolders content
	const allFiles: string[] = [];
	if (storageFiles) {
		for (const item of storageFiles) {
			if (!item.id) {
				// It's a folder, list its contents
				const { data: subFiles } = await supabase.storage
					.from('pattern-files')
					.list(`${params.slug}/${item.name}`, { limit: 20 });
				if (subFiles) {
					for (const f of subFiles) {
						if (f.id) allFiles.push(`${params.slug}/${item.name}/${f.name}`);
					}
				}
			} else {
				allFiles.push(`${params.slug}/${item.name}`);
			}
		}
	}

	return {
		catalog,
		adminConfig,
		embeddingStats,
		illustrationPages: illustrations.map((i) => i.page),
		stepCount,
		storageFiles: allFiles,
		slug: params.slug
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const form = await request.formData();
		const supabase = locals.supabase;

		const data = {
			pattern_slug: params.slug,
			display_name: form.get('display_name') as string || null,
			category: form.get('category') as string || null,
			difficulty: form.get('difficulty') as string || null,
			description: form.get('description') as string || null,
			is_published: form.get('is_published') === 'true',
			step_illustrations: JSON.parse(form.get('step_illustrations') as string || '[]'),
			overview_pages: JSON.parse(form.get('overview_pages') as string || '[]'),
			updated_at: new Date().toISOString()
		};

		// Use service role for admin writes
		const { createClient } = await import('@supabase/supabase-js');
		const { env } = await import('$env/dynamic/private');
		const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');
		const admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');

		const { error: upsertError } = await admin
			.from('pattern_admin')
			.upsert(data, { onConflict: 'pattern_slug' });

		if (upsertError) {
			return { success: false, error: upsertError.message };
		}

		return { success: true };
	}
};
