import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session) throw redirect(303, '/login');

	const { data: profiles, error: err } = await locals.supabase
		.from('measurement_profiles')
		.select('*')
		.eq('user_id', locals.session.user.id)
		.order('created_at', { ascending: false });

	if (err) throw error(500, 'Failed to load profiles');

	return { profiles: profiles ?? [] };
};

export const actions = {
	save: async ({ request, locals }) => {
		if (!locals.session) throw error(401, 'Not authenticated');

		const form = await request.formData();
		const id = form.get('id') as string | null;
		const name = (form.get('name') as string) || 'Default';

		const profile = {
			user_id: locals.session.user.id,
			name,
			bust_cm: parseFloat(form.get('bust_cm') as string),
			waist_cm: parseFloat(form.get('waist_cm') as string),
			hip_cm: parseFloat(form.get('hip_cm') as string),
			height_cm: form.get('height_cm') ? parseFloat(form.get('height_cm') as string) : null,
			neck_cm: form.get('neck_cm') ? parseFloat(form.get('neck_cm') as string) : null,
			shoulder_width_cm: form.get('shoulder_width_cm') ? parseFloat(form.get('shoulder_width_cm') as string) : null,
			high_bust_cm: form.get('high_bust_cm') ? parseFloat(form.get('high_bust_cm') as string) : null,
			underbust_cm: form.get('underbust_cm') ? parseFloat(form.get('underbust_cm') as string) : null,
			arm_length_cm: form.get('arm_length_cm') ? parseFloat(form.get('arm_length_cm') as string) : null,
			upper_arm_cm: form.get('upper_arm_cm') ? parseFloat(form.get('upper_arm_cm') as string) : null,
			wrist_cm: form.get('wrist_cm') ? parseFloat(form.get('wrist_cm') as string) : null,
			inseam_cm: form.get('inseam_cm') ? parseFloat(form.get('inseam_cm') as string) : null,
			source: (form.get('source') as string) || 'manual',
			updated_at: new Date().toISOString()
		};

		if (id) {
			const { error: err } = await locals.supabase
				.from('measurement_profiles')
				.update(profile)
				.eq('id', id)
				.eq('user_id', locals.session.user.id);
			if (err) throw error(500, 'Failed to update profile');
		} else {
			const { error: err } = await locals.supabase
				.from('measurement_profiles')
				.insert(profile);
			if (err) throw error(500, 'Failed to create profile');
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.session) throw error(401, 'Not authenticated');

		const form = await request.formData();
		const id = form.get('id') as string;

		const { error: err } = await locals.supabase
			.from('measurement_profiles')
			.delete()
			.eq('id', id)
			.eq('user_id', locals.session.user.id);

		if (err) throw error(500, 'Failed to delete profile');
		return { success: true };
	}
} satisfies Actions;
