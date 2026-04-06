import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { query } from '$lib/db.server';

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

	// Fetch pattern-specific context if a pattern is specified
	let patternContext = '';
	if (body.pattern_slug) {
		const chunks = await query<{ description: string }>(
			`SELECT description FROM cs_pattern_embeddings
			 WHERE pattern_slug = $1 AND chunk_type IN ('instructions_text', 'dxf_pattern_piece', 'product_identity')
			 ORDER BY chunk_type, chunk_index`,
			[body.pattern_slug]
		);

		if (chunks.length > 0) {
			patternContext = chunks.map((c) => c.description).join('\n\n');
		}
	}

	const prompt = `You are a sewing pattern size assistant for Rosys Patterns.
A customer needs a size recommendation based on their body measurements.

CUSTOMER MEASUREMENTS:
- Bust: ${body.bust} cm
- Waist: ${body.waist} cm
- Hip: ${body.hip} cm
${body.height ? `- Height: ${body.height} cm` : ''}

${patternContext ? `PATTERN INFORMATION:\n${patternContext.slice(0, 6000)}` : 'No specific pattern selected — give general sizing advice.'}

Based on the size chart and measurements, recommend:
1. The best size (e.g., S, M, L)
2. How the garment will fit (snug, comfortable, relaxed)
3. If between sizes, which to choose and why
4. Any adjustments they might consider (e.g., lengthen if tall)

Be concise, warm, and helpful. Format with short paragraphs.`;

	const geminiKey = env.GEMINI_API_KEY;
	if (!geminiKey) throw error(500, 'AI service not configured');

	try {
		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
				})
			}
		);

		if (!res.ok) {
			const errText = await res.text();
			console.error('Gemini error:', errText);
			throw error(502, 'AI service error');
		}

		const data = await res.json();
		const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate recommendation.';

		return json({ recommendation: text });
	} catch (e) {
		if ((e as any)?.status) throw e;
		console.error('AI error:', e);
		throw error(502, 'AI service unavailable');
	}
};
