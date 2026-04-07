import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

const VALID_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL'];
const VALID_FORMATS = ['a0', 'a4', 'us_letter'];

function getAdmin() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY || '');
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const slug = url.searchParams.get('slug');
	const size = url.searchParams.get('size')?.toUpperCase();
	const format = url.searchParams.get('format') || 'a0';

	if (!slug || !size) throw error(400, 'slug and size are required');
	if (!VALID_SIZES.includes(size)) throw error(400, `Invalid size. Valid: ${VALID_SIZES.join(', ')}`);
	if (!VALID_FORMATS.includes(format)) throw error(400, `Invalid format. Valid: ${VALID_FORMATS.join(', ')}`);

	const admin = getAdmin();
	const cachePath = `${slug}/single-size/${size}/${format}.pdf`;

	// Check cache first
	const { data: cached } = await admin.storage
		.from('pattern-files')
		.createSignedUrl(cachePath, 3600);

	if (cached?.signedUrl) {
		// Cached version exists — redirect to signed URL
		return new Response(null, {
			status: 302,
			headers: { Location: cached.signedUrl }
		});
	}

	// Not cached — generate it
	// 1. Download the original multi-size PDF
	const originalPath = `${slug}/${format}/${format}.pdf`;
	const { data: originalFile, error: dlError } = await admin.storage
		.from('pattern-files')
		.download(originalPath);

	if (dlError || !originalFile) {
		throw error(404, `Original ${format} PDF not found for this pattern`);
	}

	// 2. Write to temp file
	const tmpId = randomUUID();
	const inputPath = join(tmpdir(), `${tmpId}-input.pdf`);
	const outputPath = join(tmpdir(), `${tmpId}-output.pdf`);

	try {
		const buffer = Buffer.from(await originalFile.arrayBuffer());
		await writeFile(inputPath, buffer);

		// 3. Run Python extractor
		const scriptPath = join(process.cwd(), 'scripts', 'extract-single-size.py');
		const { stderr } = await execAsync(
			`python3 "${scriptPath}" "${inputPath}" "${size}" "${outputPath}"`,
			{ timeout: 30000 }
		);

		if (stderr && !stderr.includes('Done:')) {
			console.error('Extractor stderr:', stderr);
		}

		// 4. Read output
		const outputBuffer = await readFile(outputPath);

		// 5. Cache in Supabase storage
		await admin.storage
			.from('pattern-files')
			.upload(cachePath, outputBuffer, {
				contentType: 'application/pdf',
				upsert: true
			});

		// 6. Return the PDF
		const patternName = slug.replace(/^\d+_/, '').replace(/_/g, '-');
		const filename = `${patternName}-${size}-${format}.pdf`;

		return new Response(outputBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': outputBuffer.length.toString(),
				'Cache-Control': 'public, max-age=86400'
			}
		});
	} finally {
		// Cleanup temp files
		await unlink(inputPath).catch(() => {});
		await unlink(outputPath).catch(() => {});
	}
};
