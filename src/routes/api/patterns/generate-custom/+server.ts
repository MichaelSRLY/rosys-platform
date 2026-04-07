import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { calculateGrading } from '$lib/pattern-grading.server';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { pattern_slug, bust, waist, hip } = body;

	if (!pattern_slug || !bust || !waist || !hip) {
		throw error(400, 'pattern_slug, bust, waist, and hip are required');
	}

	const grading = await calculateGrading(pattern_slug, { bust_cm: bust, waist_cm: waist, hip_cm: hip });

	if (!grading) {
		throw error(404, 'Pattern not found or missing size chart data');
	}

	return json({ grading });
};
