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
	const patterns = await query<PatternBasic>(
		`SELECT pattern_slug, pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[params.slug]
	);
	if (patterns.length === 0) throw error(404, 'Pattern not found');

	const instructions = await query<InstructionChunk>(
		`SELECT chunk_index, description
		 FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'instructions_text'
		 ORDER BY chunk_index`,
		[params.slug]
	);

	if (instructions.length === 0) throw error(404, 'No instructions available for this pattern');

	const mainText = instructions[0]?.description || '';
	const sizeChart = instructions.find((c) => c.description.includes('SIZE CHART'))?.description || null;

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

function joinWrappedLines(text: string): string {
	const lines = text.split('\n');
	const joined: string[] = [];

	const isHeaderLike = (s: string) => {
		const t = s.trim();
		if (!t) return false;
		if (t === t.toUpperCase() && t.length < 80 && t.length > 2) return true;
		if (/^\d+\./.test(t)) return true;
		return false;
	};

	const looksLikeContinuation = (prev: string, cur: string) => {
		if (!prev || !cur) return false;
		if (isHeaderLike(prev)) return false;
		if (isHeaderLike(cur)) return false;
		if (/^\d+\./.test(cur)) return false;
		if (cur.startsWith('- ') || cur.startsWith('• ') || cur.startsWith('* ')) return false;
		if (/^(Size|Bust|Waist|Hip|Chest|Shoulder)/i.test(cur)) return false;
		if (cur === cur.toUpperCase() && cur.length > 3) return false;
		if (/^(NOTE|TIP|IMPORTANT|WARNING)\s*:/i.test(cur)) return false;
		if (/^(YOU WILL NEED|PRINTING|ASSEMBLING)/i.test(cur)) return false;
		if (/^\d+\s+\d+/.test(cur.trim())) return false;

		const prevEndsClean = /[.!?:;]$/.test(prev.trim());
		if (prevEndsClean) return false;

		const startsLower = /^[a-z]/.test(cur.trim());
		if (startsLower) return true;

		return false;
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			joined.push('');
			continue;
		}

		const last = joined.length > 0 ? joined[joined.length - 1] : '';
		if (last && looksLikeContinuation(last, trimmed)) {
			joined[joined.length - 1] = last + ' ' + trimmed;
		} else {
			joined.push(trimmed);
		}
	}

	return joined.join('\n');
}

function parseInstructionSections(text: string): Section[] {
	const processedText = joinWrappedLines(text);
	const sections: Section[] = [];
	const lines = processedText.split('\n');
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

	if (currentTitle || currentContent.length > 0) {
		sections.push({
			title: currentTitle || 'Introduction',
			content: currentContent.join('\n').trim(),
			type: currentType
		});
	}

	return sections;
}
