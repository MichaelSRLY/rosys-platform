import { query } from '$lib/db.server';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface InstructionChunk {
	chunk_index: number;
	description: string;
}

interface PatternBasic {
	pattern_slug: string;
	pattern_name: string;
}

export const load: PageServerLoad = async ({ params }) => {
	// Verify pattern exists
	const patterns = await query<PatternBasic>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	// Fetch all instruction text chunks
	const instructions = await query<InstructionChunk>(
		`SELECT chunk_index, description
		 FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'instructions_text'
		 ORDER BY chunk_index`,
		[params.slug]
	);

	if (instructions.length === 0) throw error(404, 'No instructions available for this pattern');

	// Parse the main instruction text into sections
	const mainText = instructions[0]?.description || '';
	const sizeChart = instructions.find((c) => c.description.includes('SIZE CHART'))?.description || null;

	// Split main instructions into sections by common headers
	const sections = parseInstructionSections(mainText);

	return {
		pattern: patterns[0],
		sections,
		sizeChart,
		rawChunks: instructions
	};
};

interface Section {
	title: string;
	content: string;
	type: 'intro' | 'materials' | 'step' | 'info';
}

function parseInstructionSections(text: string): Section[] {
	const sections: Section[] = [];
	const lines = text.split('\n');
	let currentTitle = '';
	let currentContent: string[] = [];
	let currentType: Section['type'] = 'intro';

	const sectionHeaders = [
		'ABOUT', 'FABRIC REQUIREMENTS', 'FABRIC SUGGESTION', 'NOTIONS',
		'PATTERN PIECES', 'CUTTING LAYOUT', 'SEAM ALLOWANCE',
		'SEWING INSTRUCTIONS', 'STEP', 'FINISHING', 'NOTES',
		'MATERIALS', 'PREPARATION', 'ASSEMBLY', 'HEMMING'
	];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (currentContent.length > 0) currentContent.push('');
			continue;
		}

		const isHeader = sectionHeaders.some((h) => trimmed.toUpperCase().startsWith(h)) && trimmed.length < 80;

		if (isHeader) {
			// Save previous section
			if (currentTitle || currentContent.length > 0) {
				sections.push({
					title: currentTitle || 'Introduction',
					content: currentContent.join('\n').trim(),
					type: currentType
				});
			}
			currentTitle = trimmed;
			currentContent = [];
			currentType = trimmed.toUpperCase().startsWith('STEP') ? 'step'
				: ['FABRIC', 'NOTIONS', 'MATERIALS'].some((k) => trimmed.toUpperCase().includes(k)) ? 'materials'
				: 'info';
		} else {
			currentContent.push(trimmed);
		}
	}

	// Save last section
	if (currentTitle || currentContent.length > 0) {
		sections.push({
			title: currentTitle || 'Introduction',
			content: currentContent.join('\n').trim(),
			type: currentType
		});
	}

	return sections;
}
