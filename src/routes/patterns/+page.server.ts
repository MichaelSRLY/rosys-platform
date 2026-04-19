import { getAllPatterns, matchProductsToPatterns, getFreePatterns, type Pattern } from '$lib/patterns.server';
import { fetchOrdersByEmail, extractProductTitles } from '$lib/shopify.server';
import { signPatternUrls, getThumbnailPath, getFinishedFrontPath } from '$lib/storage.server';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;
	const allPatterns = await getAllPatterns();

	let purchasedPatterns: Pattern[] = [];
	let freePatterns: Pattern[] = [];
	let orderCount = 0;

	// BYPASS_PATTERN_LOCK=true unlocks every pattern for all signed-in users.
	// Remove from Railway env when real customer entitlements are re-enabled.
	const bypassLock = env.BYPASS_PATTERN_LOCK === 'true';

	if (session?.user?.email) {
		if (bypassLock) {
			purchasedPatterns = allPatterns;
			orderCount = 0;
		} else {
			const orders = await fetchOrdersByEmail(session.user.email);
			orderCount = orders.length;

			if (orders.length > 0) {
				const productTitles = extractProductTitles(orders);
				purchasedPatterns = matchProductsToPatterns(productTitles, allPatterns);
			}

			const { data: profile } = await locals.supabase
				.from('profiles')
				.select('created_at')
				.eq('id', session.user.id)
				.single();

			freePatterns = await getFreePatterns(profile?.created_at || null, allPatterns, locals.supabase);

			const purchasedSlugs = new Set(purchasedPatterns.map((p) => p.pattern_slug));
			freePatterns = freePatterns.filter((p) => !purchasedSlugs.has(p.pattern_slug));
		}
	}

	// Generate signed thumbnail URLs for all patterns that have images
	const ownedPatterns = [...purchasedPatterns, ...freePatterns];
	const thumbPaths: string[] = [];
	for (const p of allPatterns) {
		if (p.has_finished_images) {
			thumbPaths.push(getThumbnailPath(p.pattern_slug, p.pattern_name));
			thumbPaths.push(getFinishedFrontPath(p.pattern_slug, p.pattern_name));
		}
	}

	const signedUrls = thumbPaths.length > 0 ? await signPatternUrls(thumbPaths) : {};

	// Build thumbnail map: slug -> signed URL (prefer thumbnail, fallback to finished front)
	const thumbnails: Record<string, string> = {};
	for (const p of allPatterns) {
		if (!p.has_finished_images) continue;
		const thumbPath = getThumbnailPath(p.pattern_slug, p.pattern_name);
		const frontPath = getFinishedFrontPath(p.pattern_slug, p.pattern_name);
		thumbnails[p.pattern_slug] = signedUrls[thumbPath] || signedUrls[frontPath] || '';
	}

	return {
		purchasedPatterns,
		freePatterns,
		allPatterns,
		orderCount,
		thumbnails
	};
};
