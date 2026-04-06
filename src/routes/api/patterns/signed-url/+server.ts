import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { signPatternUrls } from '$lib/storage.server';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const { paths } = await request.json();
	if (!Array.isArray(paths) || paths.length === 0) {
		throw error(400, 'paths array required');
	}

	// Validate and limit
	const validPaths = paths
		.filter((p): p is string => typeof p === 'string' && !p.includes('..'))
		.slice(0, 20);

	const urls = await signPatternUrls(validPaths);
	return json({ urls });
};
