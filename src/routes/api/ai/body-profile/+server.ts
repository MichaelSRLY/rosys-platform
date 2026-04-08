import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { predictBodyProfile } from '$lib/body-profile-predictor.server';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const { bust, waist, hip, height } = await request.json();
	if (!bust || !waist || !hip || !height) {
		throw error(400, 'bust, waist, hip, and height are required');
	}

	const profile = predictBodyProfile(bust, waist, hip, height);
	return json({ profile });
};
