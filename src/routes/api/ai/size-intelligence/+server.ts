import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAISizeRecommendation } from '$lib/ai-size-intelligence.server';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { pattern_slug, bust, waist, hip, height, weight, source } = body;

	if (!pattern_slug || !bust || !waist || !hip) {
		throw error(400, 'pattern_slug, bust, waist, and hip are required');
	}

	try {
		const recommendation = await getAISizeRecommendation(
			pattern_slug,
			{
				bust_cm: bust,
				waist_cm: waist,
				hip_cm: hip,
				height_cm: height,
				weight_kg: weight,
			},
			source || 'tape_measure'
		);

		return json({ recommendation });
	} catch (e: any) {
		console.error('AI Size Intelligence error:', e);
		throw error(500, `AI analysis failed: ${e?.message || 'unknown error'}`);
	}
};
