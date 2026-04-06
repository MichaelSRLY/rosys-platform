import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	// Fetch reviews with usernames
	const { data: reviews } = await locals.supabase
		.from('pattern_reviews')
		.select('*, profiles:profiles(username)')
		.eq('pattern_slug', params.slug)
		.order('created_at', { ascending: false });

	// Check if current user has reviewed
	let userReview = null;
	if (locals.session?.user) {
		const { data } = await locals.supabase
			.from('pattern_reviews')
			.select('*')
			.eq('pattern_slug', params.slug)
			.eq('user_id', locals.session.user.id)
			.single();
		userReview = data;
	}

	// Calculate average rating
	const allReviews = reviews || [];
	const avgRating = allReviews.length > 0
		? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length
		: 0;

	return {
		pattern: patterns[0],
		reviews: allReviews.map((r: any) => ({
			id: r.id,
			rating: r.rating,
			fit_notes: r.fit_notes,
			review_text: r.review_text,
			username: r.profiles?.username || 'Anonymous',
			created_at: r.created_at
		})),
		userReview,
		avgRating,
		reviewCount: allReviews.length
	};
};
