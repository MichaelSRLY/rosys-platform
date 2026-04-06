import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import { parsePatternInstructions } from '$lib/pattern-parser';
import { signPatternUrls } from '$lib/storage.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const patterns = await query<{ pattern_slug: string; pattern_name: string }>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');
	const pattern = patterns[0];

	// Fetch embeddings
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

	// Get admin config for step illustrations + layout
	const { data: adminConfig } = await locals.supabase
		.from('pattern_admin')
		.select('steps_config')
		.eq('pattern_slug', params.slug)
		.single();

	interface StepConfig {
		step: number;
		layout: 'text-left' | 'text-right' | 'image-top' | 'text-only';
		illustrations: string[];
	}
	const stepsConfig: StepConfig[] = adminConfig?.steps_config || [];
	const stepConfigMap = new Map(stepsConfig.map((s) => [s.step, s]));

	// Sign all admin-uploaded illustration URLs
	const allIllustrationPaths = stepsConfig.flatMap((s) => s.illustrations).filter(Boolean);
	const signedUrls = allIllustrationPaths.length > 0 ? await signPatternUrls(allIllustrationPaths) : {};

	// PDF page illustrations as fallback
	const illustrationPages = embeddings
		.filter((e) => e.chunk_type === 'instruction_illustration')
		.map((e) => parseInt((e.metadata?.page as string) || '0'))
		.sort((a, b) => a - b);

	const overviewPageCount = Math.max(0, illustrationPages.length - parsed.sewingSteps.length);

	// Build pages — use admin illustrations when available, fall back to PDF pages
	const pages = [
		{
			id: 'about',
			title: 'About',
			subtitle: parsed.difficulty || 'Pattern Overview',
			type: 'about' as const,
			layout: 'text-left' as const,
			illustrations: [] as string[],
			pdfPage: illustrationPages[0] || null
		},
		...(parsed.materials.length > 0 ? [{
			id: 'materials',
			title: 'Materials',
			subtitle: `${parsed.materials.length} items needed`,
			type: 'materials' as const,
			layout: 'text-left' as const,
			illustrations: [] as string[],
			pdfPage: null as number | null
		}] : []),
		...(parsed.fabricSuggestions.length > 0 ? [{
			id: 'fabrics',
			title: 'Fabrics',
			subtitle: `${parsed.fabricSuggestions.length} suggestions`,
			type: 'fabrics' as const,
			layout: 'text-left' as const,
			illustrations: [] as string[],
			pdfPage: null as number | null
		}] : []),
		...(parsed.patternPieces.length > 0 ? [{
			id: 'pieces',
			title: 'Pattern Pieces',
			subtitle: `${parsed.patternPieces.length} pieces to cut`,
			type: 'pieces' as const,
			layout: 'text-left' as const,
			illustrations: [] as string[],
			pdfPage: null as number | null
		}] : []),
		...(parsed.fabricUsage ? [{
			id: 'layout',
			title: 'Cutting Layout',
			subtitle: 'Fabric arrangement',
			type: 'layout' as const,
			layout: 'text-left' as const,
			illustrations: [] as string[],
			pdfPage: illustrationPages.find(p => p >= overviewPageCount - 1 && p <= overviewPageCount + 1) || null
		}] : []),
		// Sewing steps — use admin config when available
		...parsed.sewingSteps.map((step, i) => {
			const cfg = stepConfigMap.get(step.number);
			const adminIllustrations = (cfg?.illustrations || [])
				.filter(Boolean)
				.map((path) => signedUrls[path] || '')
				.filter(Boolean);

			return {
				id: `step-${step.number}`,
				title: `Step ${step.number}`,
				subtitle: step.title || 'Sewing',
				type: 'step' as const,
				layout: cfg?.layout || 'text-left' as const,
				illustrations: adminIllustrations,
				pdfPage: adminIllustrations.length > 0 ? null : (
					illustrationPages[overviewPageCount + i] ||
					illustrationPages[Math.min(overviewPageCount + i, illustrationPages.length - 1)] ||
					null
				)
			};
		})
	];

	return {
		pattern,
		parsed,
		sizeChartRaw: sizeChartText,
		pages,
		totalPages: pages.length
	};
};
