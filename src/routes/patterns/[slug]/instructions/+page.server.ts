import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import { parsePatternInstructions } from '$lib/pattern-parser';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	const pattern = patterns[0];

	// Fetch all embeddings
	const embeddings = await query<{ chunk_type: string; chunk_index: number; description: string; metadata: Record<string, unknown> }>(
		`SELECT chunk_type, chunk_index, description, metadata
		 FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type IN ('instructions_text', 'instruction_illustration')
		 ORDER BY chunk_type, chunk_index`,
		[params.slug]
	);

	const instructionsText = embeddings.find((e) => e.chunk_type === 'instructions_text' && e.chunk_index === 0)?.description || '';
	const sizeChartText = embeddings.find((e) => e.chunk_type === 'instructions_text' && e.chunk_index === 1)?.description || '';

	if (!instructionsText) throw error(404, 'No instructions available');

	const parsed = parsePatternInstructions(instructionsText, sizeChartText);

	// Map illustration pages to determine which pages have diagrams
	const illustrationPages = embeddings
		.filter((e) => e.chunk_type === 'instruction_illustration')
		.map((e) => parseInt((e.metadata?.page as string) || '0'))
		.sort((a, b) => a - b);

	// Estimate which illustration pages correspond to which sewing steps
	// PDF structure: pages 1-N are overview (about, materials, cutting), rest are sewing steps
	// The sewing step illustrations typically start after the overview pages
	const overviewPageCount = illustrationPages.length > 0
		? Math.max(0, illustrationPages.length - parsed.sewingSteps.length)
		: 0;

	// Build pages array for the viewer
	const pages = [
		// Page 1: About + Difficulty
		{
			id: 'about',
			title: 'About',
			subtitle: parsed.difficulty || 'Pattern Overview',
			type: 'about' as const,
			illustrationPage: illustrationPages[0] || null
		},
		// Page 2: Materials
		...(parsed.materials.length > 0 ? [{
			id: 'materials',
			title: 'Materials',
			subtitle: `${parsed.materials.length} items needed`,
			type: 'materials' as const,
			illustrationPage: null as number | null
		}] : []),
		// Page 3: Fabric Suggestions
		...(parsed.fabricSuggestions.length > 0 ? [{
			id: 'fabrics',
			title: 'Fabrics',
			subtitle: `${parsed.fabricSuggestions.length} suggestions`,
			type: 'fabrics' as const,
			illustrationPage: null as number | null
		}] : []),
		// Page 4: Pattern Pieces
		...(parsed.patternPieces.length > 0 ? [{
			id: 'pieces',
			title: 'Pattern Pieces',
			subtitle: `${parsed.patternPieces.length} pieces to cut`,
			type: 'pieces' as const,
			illustrationPage: illustrationPages.find(p => p >= 3 && p <= overviewPageCount + 2) || null
		}] : []),
		// Page 5: Cutting Layout
		...(parsed.fabricUsage ? [{
			id: 'layout',
			title: 'Cutting Layout',
			subtitle: 'Fabric arrangement',
			type: 'layout' as const,
			illustrationPage: illustrationPages.find(p => p >= overviewPageCount - 1 && p <= overviewPageCount + 1) || null
		}] : []),
		// Sewing steps — each gets its own page with illustration
		...parsed.sewingSteps.map((step, i) => ({
			id: `step-${step.number}`,
			title: `Step ${step.number}`,
			subtitle: step.title || 'Sewing',
			type: 'step' as const,
			illustrationPage: illustrationPages[overviewPageCount + i] || illustrationPages[Math.min(overviewPageCount + i, illustrationPages.length - 1)] || null
		}))
	];

	return {
		pattern,
		parsed,
		sizeChartRaw: sizeChartText,
		pages,
		illustrationPages,
		totalPages: pages.length
	};
};
