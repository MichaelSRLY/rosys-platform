import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CACHE_DIR = join(tmpdir(), 'rosys-page-cache');

function getAdmin() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const slug = url.searchParams.get('slug');
	const page = parseInt(url.searchParams.get('page') || '0');
	if (!slug || !page) throw error(400, 'slug and page required');

	// Check cache
	if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
	const cachePath = join(CACHE_DIR, `${slug}_p${page}.png`);

	if (existsSync(cachePath)) {
		const cached = readFileSync(cachePath);
		return new Response(cached, {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'public, max-age=86400'
			}
		});
	}

	// Download PDF from Supabase
	const admin = getAdmin();
	let pdfData: ArrayBuffer | null = null;

	for (const folder of ['instructions', 'instructions ']) {
		const { data, error: dlError } = await admin.storage
			.from('pattern-files')
			.download(`${slug}/${folder}/instructions.pdf`);
		if (!dlError && data) {
			pdfData = await data.arrayBuffer();
			break;
		}
	}

	if (!pdfData) throw error(404, 'Instructions PDF not found');

	// Write PDF to temp, convert page to PNG
	const pdfPath = join(CACHE_DIR, `${slug}_temp.pdf`);
	writeFileSync(pdfPath, Buffer.from(pdfData));

	try {
		const outPrefix = join(CACHE_DIR, `${slug}_p${page}`);
		execSync(
			`pdftoppm -png -f ${page} -l ${page} -r 200 -cropbox "${pdfPath}" "${outPrefix}"`,
			{ timeout: 15000 }
		);

		// pdftoppm zero-pads page numbers: -9.png or -09.png
		const possiblePaths = [
			`${outPrefix}-${page}.png`,
			`${outPrefix}-${String(page).padStart(2, '0')}.png`,
			`${outPrefix}-${String(page).padStart(3, '0')}.png`
		];
		const actualPath = possiblePaths.find((p) => existsSync(p));
		if (!actualPath) throw error(500, 'Page conversion failed');

		// Rename to cache path
		const png = readFileSync(actualPath);
		writeFileSync(cachePath, png);
		unlinkSync(actualPath);

		return new Response(png, {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'public, max-age=86400'
			}
		});
	} finally {
		if (existsSync(pdfPath)) unlinkSync(pdfPath);
	}
};
