import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session || !locals.isAdmin) throw error(403, 'Admin access required');

	const formData = await request.formData();
	const file = formData.get('file') as File;
	const slug = formData.get('slug') as string;
	const stepNum = formData.get('step') as string;
	const imageIndex = formData.get('index') as string || '1';

	if (!file || !slug || !stepNum) throw error(400, 'file, slug, and step required');

	// Convert to buffer
	const buffer = Buffer.from(await file.arrayBuffer());
	const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
	const path = `${slug}/step-illustrations/step_${stepNum}_${imageIndex}.${ext}`;

	const admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');

	// Upload (upsert)
	const { error: uploadError } = await admin.storage
		.from('pattern-files')
		.upload(path, buffer, {
			contentType: file.type,
			upsert: true
		});

	if (uploadError) throw error(500, uploadError.message);

	// Generate signed URL for preview
	const { data: signed } = await admin.storage
		.from('pattern-files')
		.createSignedUrl(path, 3600);

	return json({
		path,
		signedUrl: signed?.signedUrl || null
	});
};
