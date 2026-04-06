import { createServerSupabase } from '$lib/supabase.server';
import { redirect, error, type Handle } from '@sveltejs/kit';

// Simple in-memory rate limiter per IP
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120; // requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = rateLimits.get(ip);

	if (!entry || now > entry.resetAt) {
		rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
		return true;
	}

	entry.count++;
	if (entry.count > RATE_LIMIT) return false;
	return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of rateLimits) {
		if (now > entry.resetAt) rateLimits.delete(ip);
	}
}, 300_000);

export const handle: Handle = async ({ event, resolve }) => {
	// Rate limit API routes
	if (event.url.pathname.startsWith('/api/')) {
		const ip = event.getClientAddress();
		if (!checkRateLimit(ip)) {
			throw error(429, 'Too many requests');
		}
	}

	const supabase = createServerSupabase(event.cookies);

	const {
		data: { session }
	} = await supabase.auth.getSession();

	event.locals.supabase = supabase;
	event.locals.session = session;

	// Protect all routes except login, auth callback, and static assets
	const isPublic = event.url.pathname.startsWith('/login') ||
		event.url.pathname.startsWith('/auth');

	if (!session && !isPublic) {
		throw redirect(303, '/login');
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
