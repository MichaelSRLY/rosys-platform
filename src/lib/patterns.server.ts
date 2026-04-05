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

// Free patterns by month — add new entries each edition
// Key: 'YYYY-MM', Value: pattern slugs available that month
const FREE_PATTERNS_BY_MONTH: Record<string, string[]> = {
	'2026-04': ['121_aylani_coat', '115_tereza_set']
	// Future: '2026-05': ['xxx_pattern_slug']
};

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
 * Users get patterns from their signup month onward (up to current month).
 */
export function getFreePatterns(
	signupDate: string | null,
	allPatterns: Pattern[]
): Pattern[] {
	const now = new Date();
	const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

	if (!signupDate) {
		// No signup date — only current month
		const slugs = FREE_PATTERNS_BY_MONTH[currentKey] || [];
		return allPatterns.filter((p) => slugs.includes(p.pattern_slug));
	}

	const signup = new Date(signupDate);
	const entitled: string[] = [];

	// Walk from signup month to current month
	const cursor = new Date(signup.getFullYear(), signup.getMonth(), 1);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

	while (cursor <= end) {
		const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
		const slugs = FREE_PATTERNS_BY_MONTH[key] || [];
		entitled.push(...slugs);
		cursor.setMonth(cursor.getMonth() + 1);
	}

	const uniqueSlugs = [...new Set(entitled)];
	return allPatterns.filter((p) => uniqueSlugs.includes(p.pattern_slug));
}
