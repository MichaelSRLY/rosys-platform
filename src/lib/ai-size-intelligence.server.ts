/**
 * AI Size Intelligence Layer
 *
 * Takes ALL available data (measurements, size charts, DXF pieces, ease,
 * pattern type, MLP predictions) and uses an LLM to produce a comprehensive
 * structured recommendation.
 *
 * Supports: Anthropic API (Sonnet/Opus), Ollama (Gemma 4), or any OpenAI-compatible API.
 */

import { env } from '$env/dynamic/private';
import { query } from '$lib/db.server';
import { getPatternSizeChart, matchSize } from '$lib/size-matching.server';
import type { SizeIntelligenceInputType, SizeRecommendationType } from '$lib/ai-size-schema';
import { SizeRecommendation } from '$lib/ai-size-schema';

const SYSTEM_PROMPT = `You are the Rosys Patterns AI Size Intelligence system. You analyze body measurements against sewing pattern data to give the most accurate size recommendation possible.

You have access to:
- The customer's body measurements (from tape measure or AI photo estimation)
- The pattern's body measurement chart (which size corresponds to which body measurements)
- The pattern's finished garment measurements (actual garment dimensions including design ease)
- DXF pattern piece dimensions (the exact construction pieces)
- MLP-predicted additional body measurements

Your job:
1. Determine the best size based on ALL data, not just bust
2. Identify if the customer is between sizes and advise which direction
3. Calculate specific length and width adjustments based on their body proportions
4. Consider the garment type (fitted dress vs relaxed coat = different advice)
5. Provide warm, helpful advice a home sewer can act on

IMPORTANT:
- Ease = finished measurement - body measurement. Positive ease = room, negative = stretch-to-fit
- Heights are designed for ~168cm. Adjust lengths proportionally for taller/shorter
- Always recommend the size where the MOST IMPORTANT measurement for that garment type fits best
  (bust for tops/dresses, hip for skirts/pants, both for jumpsuits)
- If between sizes: fitted garments → size up, loose garments → size down

Return a JSON object matching the requested schema exactly.`;

interface AIProvider {
	call(prompt: string, input: SizeIntelligenceInputType): Promise<SizeRecommendationType>;
}

/** Anthropic API provider */
class AnthropicProvider implements AIProvider {
	async call(prompt: string, input: SizeIntelligenceInputType): Promise<SizeRecommendationType> {
		const apiKey = env.ANTHROPIC_API_KEY;
		if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-6',
				max_tokens: 2000,
				system: SYSTEM_PROMPT,
				messages: [{
					role: 'user',
					content: `${prompt}\n\nRespond with ONLY a valid JSON object matching the SizeRecommendation schema.`
				}],
			}),
		});

		if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
		const data = await res.json();
		const text = data.content?.[0]?.text || '';
		const jsonMatch = text.match(/\{[\s\S]+\}/);
		if (!jsonMatch) throw new Error('No JSON in response');
		return SizeRecommendation.parse(JSON.parse(jsonMatch[0]));
	}
}

/** Ollama provider (Gemma 4 or any local model) */
class OllamaProvider implements AIProvider {
	private model: string;
	private baseUrl: string;

	constructor(model = 'gemma4:e4b', baseUrl = 'http://localhost:11434') {
		this.model = model;
		this.baseUrl = baseUrl;
	}

	async call(prompt: string, input: SizeIntelligenceInputType): Promise<SizeRecommendationType> {
		const res = await fetch(`${this.baseUrl}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: this.model,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: `${prompt}\n\nRespond with ONLY a valid JSON object.` }
				],
				stream: false,
				format: 'json',
				options: { temperature: 0.1 },
			}),
		});

		if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
		const data = await res.json();
		const text = data.message?.content || '';
		return SizeRecommendation.parse(JSON.parse(text));
	}
}

/** Gemini provider (free, already used in the app) */
class GeminiProvider implements AIProvider {
	async call(prompt: string, input: SizeIntelligenceInputType): Promise<SizeRecommendationType> {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) throw new Error('GEMINI_API_KEY not set');

		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{
						parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}\n\nRespond with ONLY valid JSON.` }]
					}],
					generationConfig: {
						temperature: 0.1,
						maxOutputTokens: 2000,
						responseMimeType: 'application/json',
					},
				}),
			}
		);

		if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
		const data = await res.json();
		const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
		return SizeRecommendation.parse(JSON.parse(text));
	}
}

function getProvider(): AIProvider {
	// Priority: Anthropic → Ollama → Gemini
	if (env.ANTHROPIC_API_KEY) return new AnthropicProvider();
	if (env.OLLAMA_URL || env.OLLAMA_ENABLED) return new OllamaProvider(
		env.OLLAMA_MODEL || 'gemma4:e4b',
		env.OLLAMA_URL || 'http://localhost:11434'
	);
	return new GeminiProvider();
}

/**
 * Get an AI-powered size recommendation with full reasoning.
 */
export async function getAISizeRecommendation(
	patternSlug: string,
	measurements: { bust_cm: number; waist_cm: number; hip_cm: number; height_cm?: number; weight_kg?: number },
	source: 'tape_measure' | 'photo_model' | 'neckstimate' = 'tape_measure'
): Promise<SizeRecommendationType> {
	// 1. Get pattern data
	const chart = await getPatternSizeChart(patternSlug);
	if (!chart) throw new Error('Pattern size chart not found');

	// 2. Deterministic match first (fast, reliable)
	const deterministicMatch = matchSize(measurements.bust_cm, measurements.waist_cm, measurements.hip_cm, chart);

	// 3. Get DXF pieces if available
	const dxfChunks = await query<{ description: string; metadata: string }>(
		`SELECT description, metadata::text FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type = 'dxf_pattern_piece' LIMIT 1`,
		[patternSlug]
	);

	// 4. Get pattern name and info
	const patternInfo = await query<{ pattern_name: string; category: string }>(
		`SELECT pattern_name, category FROM cs_pattern_catalog WHERE pattern_slug = $1`,
		[patternSlug]
	);

	// 5. Build the AI input
	const input: SizeIntelligenceInputType = {
		measurements: {
			bust_cm: measurements.bust_cm,
			waist_cm: measurements.waist_cm,
			hip_cm: measurements.hip_cm,
			height_cm: measurements.height_cm,
			weight_kg: measurements.weight_kg,
			measurement_source: source,
		},
		pattern: {
			name: patternInfo[0]?.pattern_name || patternSlug,
			slug: patternSlug,
			category: patternInfo[0]?.category,
			sizes: chart.sizes,
			body_chart: chart.body.map(r => ({
				size: r.size,
				bust_cm: r.bust_cm ? Number(r.bust_cm) : null,
				waist_cm: r.waist_cm ? Number(r.waist_cm) : null,
				hip_cm: r.hip_cm ? Number(r.hip_cm) : null,
			})),
			finished_chart: chart.finished.map(r => ({
				size: r.size,
				bust_cm: r.bust_cm ? Number(r.bust_cm) : null,
				waist_cm: r.waist_cm ? Number(r.waist_cm) : null,
				hip_cm: r.hip_cm ? Number(r.hip_cm) : null,
				full_length_cm: r.full_length_cm ? Number(r.full_length_cm) : null,
				sleeve_length_cm: r.sleeve_length_cm ? Number(r.sleeve_length_cm) : null,
				bottom_sweep_cm: r.bottom_sweep_cm ? Number(r.bottom_sweep_cm) : null,
			})),
			ease: deterministicMatch.recommended.ease.bust_cm !== null ? {
				bust_cm: deterministicMatch.recommended.ease.bust_cm,
				waist_cm: deterministicMatch.recommended.ease.waist_cm,
				hip_cm: deterministicMatch.recommended.ease.hip_cm,
			} : undefined,
		},
	};

	// 6. Build prompt with all data
	const prompt = `CUSTOMER MEASUREMENTS:
Bust: ${measurements.bust_cm}cm, Waist: ${measurements.waist_cm}cm, Hip: ${measurements.hip_cm}cm${measurements.height_cm ? `, Height: ${measurements.height_cm}cm` : ''}
Source: ${source}${source === 'photo_model' ? ' (±3cm accuracy, verify key measurements)' : ''}

DETERMINISTIC ANALYSIS (pre-computed):
Best match: ${deterministicMatch.recommended.size} (score: ${deterministicMatch.recommended.score.toFixed(1)})
Between sizes: ${deterministicMatch.betweenSizes ? `yes (${deterministicMatch.lowerSize} / ${deterministicMatch.upperSize})` : 'no'}

PATTERN: ${input.pattern.name}
Category: ${input.pattern.category || 'dress/garment'}

BODY SIZE CHART:
${input.pattern.body_chart.map(r => `  ${r.size}: bust=${r.bust_cm} waist=${r.waist_cm} hip=${r.hip_cm}`).join('\n')}

FINISHED GARMENT MEASUREMENTS:
${input.pattern.finished_chart.map(r => `  ${r.size}: bust=${r.bust_cm} waist=${r.waist_cm} hip=${r.hip_cm} length=${r.full_length_cm}`).join('\n')}

${input.pattern.ease ? `EASE AT ${deterministicMatch.recommended.size}: bust=${input.pattern.ease.bust_cm?.toFixed(0)}cm waist=${input.pattern.ease.waist_cm?.toFixed(0)}cm hip=${input.pattern.ease.hip_cm?.toFixed(0)}cm` : ''}

Analyze all this data and return a SizeRecommendation JSON object with recommended_size, confidence, fit_analysis, between_sizes info, length_adjustments, width_adjustments, garment_notes, and customer_summary.`;

	// 7. Call AI
	const provider = getProvider();
	try {
		return await provider.call(prompt, input);
	} catch (e) {
		// Fallback: return deterministic result as structured output
		const rec = deterministicMatch.recommended;
		return {
			recommended_size: rec.size,
			confidence: deterministicMatch.betweenSizes ? 'medium' : 'high',
			fit_analysis: [rec.bust, rec.waist, rec.hip].filter(Boolean).map(f => ({
				measurement: f!.label.toLowerCase(),
				user_cm: f!.user_cm,
				chart_cm: f!.chart_cm,
				finished_cm: null,
				ease_cm: null,
				fit: f!.fit,
				concern: null,
			})),
			between_sizes: deterministicMatch.betweenSizes,
			size_down: deterministicMatch.lowerSize,
			size_up: deterministicMatch.upperSize,
			between_sizes_advice: deterministicMatch.betweenSizes ? 'Consider both sizes' : null,
			length_adjustments: [],
			width_adjustments: [],
			garment_notes: '',
			customer_summary: `Based on your measurements, we recommend size ${rec.size}.`,
		};
	}
}
