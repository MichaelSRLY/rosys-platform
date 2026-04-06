import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import { signPatternUrls, getFinishedFrontPath } from '$lib/storage.server';
import { parsePatternInstructions } from '$lib/pattern-parser';
import type { PageServerLoad } from './$types';

interface PatternRow {
	pattern_slug: string;
	pattern_name: string;
	has_a0: boolean;
	has_instructions: boolean;
	has_finished_images: boolean;
	has_dxf: boolean;
	shopify_name: string | null;
	old_name: string | null;
}

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<PatternRow>(
		`SELECT * FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	const pattern = patterns[0];
	const slug = pattern.pattern_slug;
	const name = pattern.pattern_name;

	// Fetch ALL embeddings for this pattern in one query
	const embeddings = await query<{ chunk_type: string; chunk_index: number; description: string; metadata: Record<string, unknown> }>(
		`SELECT chunk_type, chunk_index, description, metadata
		 FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1
		 ORDER BY chunk_type, chunk_index`,
		[params.slug]
	);

	// Extract structured data
	const instructionsText = embeddings.find((e) => e.chunk_type === 'instructions_text' && e.chunk_index === 0)?.description || '';
	const sizeChartText = embeddings.find((e) => e.chunk_type === 'instructions_text' && e.chunk_index === 1)?.description || '';
	const parsedPattern = parsePatternInstructions(instructionsText, sizeChartText);

	const tutorials = embeddings
		.filter((e) => e.chunk_type === 'youtube_tutorial')
		.map((e) => ({
			title: e.description,
			url: (e.metadata as Record<string, string>)?.video_url || ''
		}));

	const identity = embeddings.find((e) => e.chunk_type === 'product_identity');
	const dxfData = embeddings.find((e) => e.chunk_type === 'dxf_pattern_piece');
	const illustrationCount = embeddings.filter((e) => e.chunk_type === 'instruction_illustration').length;

	// Sign file URLs
	const filePaths: string[] = [];
	const dxfName = name.toUpperCase().replace(/_/g, ' ');

	if (pattern.has_instructions) filePaths.push(`${slug}/instructions/instructions.pdf`);
	if (pattern.has_a0) filePaths.push(`${slug}/a0/a0.pdf`);
	filePaths.push(`${slug}/a4/a4.pdf`);
	filePaths.push(`${slug}/us_letter/us_letter.pdf`);
	if (pattern.has_dxf) filePaths.push(`${slug}/dxf/${dxfName}.dxf`);
	if (pattern.has_finished_images) {
		filePaths.push(getFinishedFrontPath(slug, name));
		filePaths.push(`${slug}/thumbnail/thumbnail.webp`);
	}

	const signedUrls = await signPatternUrls(filePaths);

	const downloads = [
		pattern.has_instructions && { label: 'Instructions PDF', sub: 'Step-by-step sewing guide', href: signedUrls[`${slug}/instructions/instructions.pdf`] },
		pattern.has_a0 && { label: 'A0 Pattern Sheet', sub: 'Print at copy shop', href: signedUrls[`${slug}/a0/a0.pdf`] },
		{ label: 'A4 Pattern', sub: 'Home printer format', href: signedUrls[`${slug}/a4/a4.pdf`] },
		{ label: 'US Letter Pattern', sub: 'US paper size', href: signedUrls[`${slug}/us_letter/us_letter.pdf`] },
		pattern.has_dxf && { label: 'DXF Pattern File', sub: 'For projector cutting', href: signedUrls[`${slug}/dxf/${dxfName}.dxf`] }
	].filter(Boolean) as Array<{ label: string; sub: string; href: string | null }>;

	const imageUrl = signedUrls[`${slug}/thumbnail/thumbnail.webp`] || signedUrls[getFinishedFrontPath(slug, name)] || null;

	return {
		pattern,
		parsedPattern,
		tutorials,
		description: identity?.description || null,
		downloads,
		imageUrl,
		hasDxf: !!dxfData,
		illustrationCount,
		pieceCount: parsedPattern.patternPieces.length
	};
};
