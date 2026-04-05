import { createServerSupabase } from '$lib/supabase.server';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const supabase = createServerSupabase(event.cookies);

	const {
		data: { session }
	} = await supabase.auth.getSession();

	event.locals.supabase = supabase;
	event.locals.session = session;

	// Protect all routes except login and static assets
	const isLoginRoute = event.url.pathname.startsWith('/login');
	const isAuthCallback = event.url.pathname.startsWith('/auth');

	if (!session && !isLoginRoute && !isAuthCallback) {
		throw redirect(303, '/login');
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
