import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getPatternSizeChart, matchSize } from '$lib/size-matching.server';

interface MeasurementInput {
	bust: number;
	waist: number;
	hip: number;
	height?: number;
	pattern_slug?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body: MeasurementInput = await request.json();
	if (!body.bust || !body.waist || !body.hip) {
		throw error(400, 'bust, waist, and hip measurements required');
	}

	if (!body.pattern_slug) {
		throw error(400, 'pattern_slug is required');
	}

	// Step 1: Deterministic matching from structured data
	const chart = await getPatternSizeChart(body.pattern_slug);

	if (!chart || chart.body.length === 0) {
		// Fallback: no structured data, use old LLM-only approach
		return fallbackLLMRecommendation(body);
	}

	const result = matchSize(body.bust, body.waist, body.hip, chart);
	const rec = result.recommended;

	// Step 2: For clear matches, skip LLM entirely
	const isClearMatch = !result.betweenSizes && rec.score < 6;

	if (isClearMatch) {
		const recommendation = formatDeterministicResult(result, body);
		return json({ recommendation, structured: result });
	}

	// Step 3: For ambiguous matches, use LLM with pre-computed data
	const geminiKey = env.GEMINI_API_KEY;
	if (!geminiKey) {
		// No API key — return deterministic result anyway
		const recommendation = formatDeterministicResult(result, body);
		return json({ recommendation, structured: result });
	}

	const prompt = buildSmartPrompt(result, body);

	try {
		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
				})
			}
		);

		if (!res.ok) {
			const recommendation = formatDeterministicResult(result, body);
			return json({ recommendation, structured: result });
		}

		const data = await res.json();
		const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

		if (text) {
			return json({ recommendation: text, structured: result });
		}

		const recommendation = formatDeterministicResult(result, body);
		return json({ recommendation, structured: result });
	} catch {
		const recommendation = formatDeterministicResult(result, body);
		return json({ recommendation, structured: result });
	}
};

function formatDeterministicResult(result: ReturnType<typeof matchSize>, input: MeasurementInput): string {
	const rec = result.recommended;
	const lines: string[] = [];

	lines.push(`Based on your measurements (Bust: ${input.bust}cm, Waist: ${input.waist}cm, Hip: ${input.hip}cm), we recommend size ${rec.size}.`);

	if (result.betweenSizes && result.lowerSize && result.upperSize) {
		lines.push(`\nYou're between sizes ${result.lowerSize} and ${result.upperSize}.`);
		if (rec.ease.bust_cm !== null && rec.ease.bust_cm > 5) {
			lines.push(`This pattern has a relaxed fit (${rec.ease.bust_cm.toFixed(0)}cm ease at bust), so the smaller size should work well.`);
		} else if (rec.ease.bust_cm !== null && rec.ease.bust_cm <= 2) {
			lines.push(`This pattern has a close fit, so consider sizing up to ${result.upperSize} for comfort.`);
		}
	}

	// Fit details
	const fits: string[] = [];
	if (rec.bust) fits.push(`Bust: ${rec.bust.fit} (${rec.bust.diff_cm > 0 ? '+' : ''}${rec.bust.diff_cm.toFixed(1)}cm)`);
	if (rec.waist) fits.push(`Waist: ${rec.waist.fit} (${rec.waist.diff_cm > 0 ? '+' : ''}${rec.waist.diff_cm.toFixed(1)}cm)`);
	if (rec.hip) fits.push(`Hip: ${rec.hip.fit} (${rec.hip.diff_cm > 0 ? '+' : ''}${rec.hip.diff_cm.toFixed(1)}cm)`);
	if (fits.length > 0) {
		lines.push(`\nFit breakdown: ${fits.join(' | ')}`);
	}

	if (rec.ease.bust_cm !== null) {
		lines.push(`\nThis pattern adds ${rec.ease.bust_cm.toFixed(0)}cm ease at the bust for a ${rec.ease.bust_cm > 10 ? 'relaxed' : rec.ease.bust_cm > 4 ? 'comfortable' : 'close'} fit.`);
	}

	return lines.join('');
}

function buildSmartPrompt(result: ReturnType<typeof matchSize>, input: MeasurementInput): string {
	const rec = result.recommended;
	const top3 = result.allMatches.slice(0, 3);

	let prompt = `You are a sewing pattern size advisor. Give concise, warm advice (3-4 sentences max).

CUSTOMER: Bust ${input.bust}cm, Waist ${input.waist}cm, Hip ${input.hip}cm${input.height ? `, Height ${input.height}cm` : ''}

SIZE ANALYSIS (pre-computed):
Best match: ${rec.size} (score: ${rec.score.toFixed(1)})`;

	if (rec.bust) prompt += `\n  Bust: body chart ${rec.bust.chart_cm}cm, diff ${rec.bust.diff_cm > 0 ? '+' : ''}${rec.bust.diff_cm.toFixed(1)}cm (${rec.bust.fit})`;
	if (rec.waist) prompt += `\n  Waist: body chart ${rec.waist.chart_cm}cm, diff ${rec.waist.diff_cm > 0 ? '+' : ''}${rec.waist.diff_cm.toFixed(1)}cm (${rec.waist.fit})`;
	if (rec.hip) prompt += `\n  Hip: body chart ${rec.hip.chart_cm}cm, diff ${rec.hip.diff_cm > 0 ? '+' : ''}${rec.hip.diff_cm.toFixed(1)}cm (${rec.hip.fit})`;

	if (rec.ease.bust_cm !== null) prompt += `\n  Bust ease: ${rec.ease.bust_cm.toFixed(0)}cm`;

	if (result.betweenSizes) {
		prompt += `\n\nBETWEEN SIZES: ${result.lowerSize} and ${result.upperSize}`;
	}

	prompt += `\n\nOther close sizes:`;
	for (const m of top3.slice(1)) {
		prompt += `\n  ${m.size} (score: ${m.score.toFixed(1)})`;
	}

	prompt += `\n\nRecommend the best size. If between sizes, advise which direction based on the ease and fit type. Be specific about this pattern's fit characteristics. Format with short paragraphs, no bullet points.`;

	return prompt;
}

async function fallbackLLMRecommendation(body: MeasurementInput) {
	const geminiKey = env.GEMINI_API_KEY;
	if (!geminiKey) throw error(500, 'AI service not configured');

	const prompt = `You are a sewing pattern size assistant. The customer measures Bust: ${body.bust}cm, Waist: ${body.waist}cm, Hip: ${body.hip}cm${body.height ? `, Height: ${body.height}cm` : ''}. Give general sizing advice based on standard size charts (XXS: bust 72, XS: 76, S: 82, M: 88, L: 92, XL: 96, 2XL: 100). Be concise and warm.`;

	const res = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
			})
		}
	);

	if (!res.ok) throw error(502, 'AI service error');
	const data = await res.json();
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate recommendation.';
	return json({ recommendation: text });
}
