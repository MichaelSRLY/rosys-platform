import { getAllPatterns, matchProductsToPatterns, getFreePatterns, type Pattern } from '$lib/patterns.server';
import { fetchOrdersByEmail, extractProductTitles } from '$lib/shopify.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;
	const allPatterns = await getAllPatterns();

	let purchasedPatterns: Pattern[] = [];
	let freePatterns: Pattern[] = [];
	let orderCount = 0;

	if (session?.user?.email) {
		// Fetch Shopify orders by email
		const orders = await fetchOrdersByEmail(session.user.email);
		orderCount = orders.length;

		if (orders.length > 0) {
			const productTitles = extractProductTitles(orders);
			purchasedPatterns = matchProductsToPatterns(productTitles, allPatterns);
		}

		// Get profile signup date for free pattern entitlement
		const { data: profile } = await locals.supabase
			.from('profiles')
			.select('created_at')
			.eq('id', session.user.id)
			.single();

		freePatterns = getFreePatterns(profile?.created_at || null, allPatterns);

		// Remove duplicates — if a free pattern was also purchased, keep it in purchased only
		const purchasedSlugs = new Set(purchasedPatterns.map((p) => p.pattern_slug));
		freePatterns = freePatterns.filter((p) => !purchasedSlugs.has(p.pattern_slug));
	}

	return {
		purchasedPatterns,
		freePatterns,
		allPatterns,
		orderCount
	};
};
