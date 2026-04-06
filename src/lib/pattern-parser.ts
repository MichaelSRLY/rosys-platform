/**
 * Parse structured sections from pattern instruction text.
 * The instruction text follows a consistent format across all 130 patterns.
 */

export interface PatternData {
	about: string;
	difficulty: string;
	seamAllowance: string;
	materials: MaterialItem[];
	fabricSuggestions: string[];
	patternPieces: PieceInfo[];
	sizeChart: SizeChart | null;
	finishedMeasurements: SizeChart | null;
	fabricUsage: string;
	sewingSteps: SewingStep[];
	printingNotes: string;
}

export interface MaterialItem {
	item: string;
	quantity: string;
}

export interface PieceInfo {
	number: number;
	name: string;
	cutInstructions: string;
}

export interface SizeChart {
	sizes: string[];
	measurements: { label: string; values: string[] }[];
}

export interface SewingStep {
	number: number;
	title: string;
	content: string;
}

export function parsePatternInstructions(text: string, sizeChartText?: string): PatternData {
	const data: PatternData = {
		about: '',
		difficulty: '',
		seamAllowance: '',
		materials: [],
		fabricSuggestions: [],
		patternPieces: [],
		sizeChart: null,
		finishedMeasurements: null,
		fabricUsage: '',
		sewingSteps: [],
		printingNotes: ''
	};

	// Extract ABOUT
	const aboutMatch = text.match(/ABOUT\s*\n([\s\S]*?)(?=\nDIFFICULTY|\nSEAM|\nYOU WILL|\nFABRIC)/i);
	if (aboutMatch) data.about = aboutMatch[1].trim();

	// Extract DIFFICULTY
	const diffMatch = text.match(/DIFFICULTY\s*(?:LEVEL)?\s*\n\s*(.+)/i);
	if (diffMatch) data.difficulty = diffMatch[1].trim();

	// Extract SEAM ALLOWANCE
	const seamMatch = text.match(/SEAM ALLOWANCE\s*\n([\s\S]*?)(?=\nYOU WILL|\nFABRIC|\nPRINTING|\nPATTERN)/i);
	if (seamMatch) data.seamAllowance = seamMatch[1].trim();

	// Extract YOU WILL NEED / materials
	const matMatch = text.match(/YOU WILL NEED[:\s]*\n([\s\S]*?)(?=\nFABRIC SUGGEST|\nPRINTING|\nFABRIC USAGE|\nPATTERN PIECES|\nSIZE CHART)/i);
	if (matMatch) {
		const lines = matMatch[1].trim().split('\n').filter((l) => l.trim());
		data.materials = lines.map((line) => {
			const parts = line.trim().match(/^(.+?)\s*[-–:]\s*(.+)$/);
			if (parts) return { item: parts[1].trim(), quantity: parts[2].trim() };
			return { item: line.trim(), quantity: '' };
		});
	}

	// Extract FABRIC SUGGESTIONS
	const fabMatch = text.match(/FABRIC SUGGEST\w*\s*\n([\s\S]*?)(?=\nPRINTING|\nFABRIC USAGE|\nPATTERN PIECES|\nYOU WILL|\nSEAM)/i);
	if (fabMatch) {
		data.fabricSuggestions = fabMatch[1]
			.trim()
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 10 && !l.startsWith('Here are'));
	}

	// Extract PATTERN PIECES
	const piecesMatch = text.match(/PATTERN PIECES\s*\n([\s\S]*?)(?=\nSIZE CHART|\nSEWING|\nSTEP|\n[A-Z]{4,})/i);
	if (piecesMatch) {
		const lines = piecesMatch[1].trim().split('\n');
		for (const line of lines) {
			const m = line.match(/(\d+)\.\s*(.+?)\s*[-–]\s*(cut.+)/i);
			if (m) {
				data.patternPieces.push({
					number: parseInt(m[1]),
					name: m[2].trim(),
					cutInstructions: m[3].trim()
				});
			}
		}
	}

	// Extract FABRIC USAGE
	const usageMatch = text.match(/FABRIC USAGE\s*\n([\s\S]*?)(?=\nPATTERN PIECES|\nSIZE CHART|\nSEWING|\nSTEP)/i);
	if (usageMatch) data.fabricUsage = usageMatch[1].trim();

	// Extract PRINTING notes
	const printMatch = text.match(/PRINTING\s*(?:&\s*)?(?:ASSEMBLING)?\s*\n([\s\S]*?)(?=\nFABRIC USAGE|\nPATTERN PIECES|\nNOTE)/i);
	if (printMatch) data.printingNotes = printMatch[1].trim();

	// Parse SIZE CHART (from separate chunk if available, or from main text)
	const chartText = sizeChartText || text;
	data.sizeChart = parseSizeTable(chartText, 'SIZE CHART');
	data.finishedMeasurements = parseSizeTable(chartText, 'FINISHED');

	// Extract sewing steps
	const stepsMatch = text.match(/(?:SEWING INSTRUCTIONS|STEP\s*1)\s*\n([\s\S]*?)$/i);
	if (stepsMatch) {
		const stepBlocks = stepsMatch[1].split(/\n(?=STEP\s+\d)/i);
		for (const block of stepBlocks) {
			const headerMatch = block.match(/STEP\s+(\d+)\s*[-–:]?\s*(.*)/i);
			if (headerMatch) {
				data.sewingSteps.push({
					number: parseInt(headerMatch[1]),
					title: headerMatch[2]?.trim() || `Step ${headerMatch[1]}`,
					content: block.replace(/STEP\s+\d+.*\n?/i, '').trim()
				});
			}
		}
	}

	return data;
}

function parseSizeTable(text: string, sectionKeyword: string): SizeChart | null {
	const sectionMatch = text.match(new RegExp(`${sectionKeyword}[\\s\\S]*?\\n(Size[\\s\\S]*?)(?=\\n\\n[A-Z]|$)`, 'i'));
	if (!sectionMatch) return null;

	const lines = sectionMatch[1].trim().split('\n').filter((l) => l.trim());
	if (lines.length < 2) return null;

	// First line should have sizes: Size XXS XS S M L XL 2XL
	const headerParts = lines[0].trim().split(/\s{2,}|\t+/);
	if (headerParts.length < 3) {
		// Try space-separated: "Size XXS XS S M L XL 2XL"
		const words = lines[0].trim().split(/\s+/);
		if (words[0]?.toLowerCase() === 'size' && words.length >= 3) {
			const sizes = words.slice(1);
			const measurements: { label: string; values: string[] }[] = [];
			for (let i = 1; i < lines.length; i++) {
				const parts = lines[i].trim().split(/\s+/);
				if (parts.length >= 2) {
					// Label might be multi-word like "Bottom Sweep 1/2"
					const numericStart = parts.findIndex((p, idx) => idx > 0 && /^\d/.test(p));
					if (numericStart > 0) {
						measurements.push({
							label: parts.slice(0, numericStart).join(' '),
							values: parts.slice(numericStart)
						});
					}
				}
			}
			if (measurements.length > 0) return { sizes, measurements };
		}
	}

	return null;
}
