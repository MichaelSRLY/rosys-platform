import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// Use service role key for signed URLs (bypasses RLS)
function getAdminClient() {
	const url = 'https://lahzrlyhojyfadjasdrc.supabase.co';
	const key = env.SUPABASE_SERVICE_KEY || '';
	return createClient(url, key);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const { paths } = await request.json();
	if (!Array.isArray(paths) || paths.length === 0) {
		throw error(400, 'paths array required');
	}

	// Limit to 20 URLs per request
	const limitedPaths = paths.slice(0, 20);
	const admin = getAdminClient();

	const results: Record<string, string | null> = {};

	for (const path of limitedPaths) {
		// Validate path is within pattern-files bucket
		if (typeof path !== 'string' || path.includes('..')) {
			results[path] = null;
			continue;
		}

		const { data, error: signError } = await admin.storage
			.from('pattern-files')
			.createSignedUrl(path, 3600); // 1 hour expiry

		results[path] = signError ? null : data.signedUrl;
	}

	return json({ urls: results });
};
