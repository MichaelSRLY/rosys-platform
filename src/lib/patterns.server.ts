import { query } from './db.server';

export interface Pattern {
	pattern_slug: string;
	pattern_name: string;
	has_a0: boolean;
	has_instructions: boolean;
	has_finished_images: boolean;
	has_dxf: boolean;
	shopify_name: string | null;
	old_name: string | null;
}

// Free patterns now managed via admin panel (free_pattern_rounds table in Supabase)

export async function getAllPatterns(): Promise<Pattern[]> {
	return query<Pattern>(
		`SELECT pattern_slug, pattern_name, has_a0, has_instructions, has_finished_images, has_dxf, shopify_name, old_name
		 FROM cs_pattern_catalog
		 ORDER BY pattern_name`
	);
}

/**
 * Match Shopify product titles to pattern catalog entries.
 * Tries: exact shopify_name match, exact old_name match, then fuzzy pattern_name containment.
 */
export function matchProductsToPatterns(
	productTitles: string[],
	allPatterns: Pattern[]
): Pattern[] {
	const matched = new Set<string>();

	for (const title of productTitles) {
		const lower = title.toLowerCase();

		// 1. Exact shopify_name match
		const byShopify = allPatterns.find(
			(p) => p.shopify_name && lower.includes(p.shopify_name.toLowerCase().split('|')[0].trim())
		);
		if (byShopify) { matched.add(byShopify.pattern_slug); continue; }

		// 2. Exact old_name match
		const byOldName = allPatterns.find(
			(p) => p.old_name && lower.includes(p.old_name.toLowerCase())
		);
		if (byOldName) { matched.add(byOldName.pattern_slug); continue; }

		// 3. Fuzzy: check if pattern_name words appear in the product title
		for (const p of allPatterns) {
			const words = p.pattern_name.toLowerCase().split(/\s+/);
			if (words.length >= 2 && words.every((w) => lower.includes(w))) {
				matched.add(p.pattern_slug);
				break;
			}
		}
	}

	return allPatterns.filter((p) => matched.has(p.pattern_slug));
}

/**
 * Get free patterns a user is entitled to based on their signup date.
 * Reads from free_pattern_rounds table (managed via admin panel).
 * Users get patterns from rounds that were active during or after their signup.
 */
export async function getFreePatterns(
	signupDate: string | null,
	allPatterns: Pattern[],
	supabase: any
): Promise<Pattern[]> {
	// Get all active rounds, plus rounds that started after user signup
	const { data: rounds } = await supabase
		.from('free_pattern_rounds')
		.select('pattern_slugs, starts_at, is_active')
		.order('starts_at', { ascending: false });

	if (!rounds || rounds.length === 0) return [];

	const signup = signupDate ? new Date(signupDate) : new Date();
	const entitled = new Set<string>();

	for (const round of rounds) {
		const roundStart = new Date(round.starts_at);
		// User gets patterns from rounds that started during or after their membership
		if (round.is_active || roundStart >= signup) {
			for (const slug of round.pattern_slugs || []) {
				entitled.add(slug);
			}
		}
	}

	return allPatterns.filter((p) => entitled.has(p.pattern_slug));
}
