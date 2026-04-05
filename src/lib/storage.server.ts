import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdmin() {
	if (!adminClient) {
		adminClient = createClient(
			'https://lahzrlyhojyfadjasdrc.supabase.co',
			env.SUPABASE_SERVICE_KEY || ''
		);
	}
	return adminClient;
}

/**
 * Generate a signed URL for a file in the pattern-files bucket.
 * Returns null if file doesn't exist or signing fails.
 */
export async function signPatternUrl(path: string, expiresIn = 3600): Promise<string | null> {
	const { data, error } = await getAdmin().storage
		.from('pattern-files')
		.createSignedUrl(path, expiresIn);
	return error ? null : data.signedUrl;
}

/**
 * Generate signed URLs for multiple files.
 */
export async function signPatternUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string | null>> {
	const results: Record<string, string | null> = {};
	// Batch sign — Supabase supports createSignedUrls (plural)
	const { data, error } = await getAdmin().storage
		.from('pattern-files')
		.createSignedUrls(paths, expiresIn);

	if (error || !data) {
		for (const p of paths) results[p] = null;
		return results;
	}

	for (const item of data) {
		results[item.path || ''] = item.signedUrl || null;
	}
	return results;
}

/**
 * Get the best thumbnail path for a pattern.
 * Prefers thumbnail/thumbnail.webp, falls back to finished_*_front.webp.
 */
export function getThumbnailPath(slug: string, name: string): string {
	return `${slug}/thumbnail/thumbnail.webp`;
}

export function getFinishedFrontPath(slug: string, name: string): string {
	const clean = name.toLowerCase().replace(/\s+/g, '_');
	return `${slug}/finished_${clean}_images/finished_${clean}_front.webp`;
}
