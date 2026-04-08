/**
 * Streaming Size Intelligence endpoint.
 *
 * Sends Server-Sent Events:
 *   1. "deterministic" — instant size match + body profile + chart data (JSON)
 *   2. "chunk"         — AI narrative tokens (text)
 *   3. "done"          — stream complete
 *   4. "error"         — on failure
 *
 * Accepts optional `preferences` for re-analysis after follow-up questions.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { query } from '$lib/db.server';
import { getPatternSizeChart, matchSize } from '$lib/size-matching.server';
import { predictBodyProfile } from '$lib/body-profile-predictor.server';

function sse(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const body = await request.json();
	const { pattern_slug, bust, waist, hip, height, source, preferences } = body;

	if (!pattern_slug || !bust || !waist || !hip) {
		throw error(400, 'pattern_slug, bust, waist, and hip are required');
	}

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				controller.enqueue(new TextEncoder().encode(sse(event, data)));
			};

			try {
				// ── 1. Deterministic match (instant) ──
				const chart = await getPatternSizeChart(pattern_slug);
				if (!chart) { send('error', { message: 'Pattern size chart not found' }); controller.close(); return; }

				const match = matchSize(bust, waist, hip, chart);

				// Body profile prediction
				let profile = null;
				if (height) {
					try { profile = predictBodyProfile(bust, waist, hip, height); } catch {}
				}

				// Pattern name + category
				const patternInfo = await query<{ pattern_name: string }>(
					`SELECT pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`, [pattern_slug]
				);

				// DXF piece info if available
				const dxfChunks = await query<{ description: string; metadata: string }>(
					`SELECT description, metadata::text FROM cs_pattern_embeddings
					 WHERE pattern_slug = $1 AND chunk_type = 'dxf_pattern_piece' LIMIT 1`,
					[pattern_slug]
				);

				send('deterministic', {
					recommended_size: match.recommended.size,
					score: match.recommended.score,
					between_sizes: match.betweenSizes,
					lower_size: match.lowerSize,
					upper_size: match.upperSize,
					fit: {
						bust: match.recommended.bust,
						waist: match.recommended.waist,
						hip: match.recommended.hip,
					},
					ease: match.recommended.ease,
					profile,
					pattern_name: patternInfo[0]?.pattern_name || pattern_slug,
					chart: {
						sizes: chart.sizes,
						body: chart.body.map(r => ({
							size: r.size,
							bust_cm: r.bust_cm ? Number(r.bust_cm) : null,
							waist_cm: r.waist_cm ? Number(r.waist_cm) : null,
							hip_cm: r.hip_cm ? Number(r.hip_cm) : null,
						})),
						finished: chart.finished.map(r => ({
							size: r.size,
							bust_cm: r.bust_cm ? Number(r.bust_cm) : null,
							waist_cm: r.waist_cm ? Number(r.waist_cm) : null,
							hip_cm: r.hip_cm ? Number(r.hip_cm) : null,
							full_length_cm: r.full_length_cm ? Number(r.full_length_cm) : null,
							sleeve_length_cm: r.sleeve_length_cm ? Number(r.sleeve_length_cm) : null,
						})),
					},
					has_dxf: dxfChunks.length > 0,
				});

				// ── 2. Stream AI narrative ──
				const prompt = buildPrompt(
					bust, waist, hip, height, match, chart,
					patternInfo[0]?.pattern_name || pattern_slug,
					source, profile, preferences
				);

				const apiKey = env.ANTHROPIC_API_KEY;
				if (!apiKey) {
					// No API key — send deterministic summary as fallback
					send('chunk', `## Recommended Size\nSize ${match.recommended.size}\n\n`);
					send('chunk', `## Why This Size\nBased on your measurements (bust ${bust}cm, waist ${waist}cm, hip ${hip}cm), size ${match.recommended.size} is the best fit for this pattern.\n\n`);
					if (match.betweenSizes) {
						send('chunk', `## Between Sizes?\nYou fall between ${match.lowerSize} and ${match.upperSize}. We recommend ${match.recommended.size} for the best balance of comfort and fit.\n\n`);
					}
					send('done', {});
					controller.close();
					return;
				}

				const systemPrompt = preferences
					? FOLLOWUP_SYSTEM_PROMPT
					: INITIAL_SYSTEM_PROMPT;

				const res = await fetch('https://api.anthropic.com/v1/messages', {
					method: 'POST',
					headers: {
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01',
						'content-type': 'application/json',
					},
					body: JSON.stringify({
						model: 'claude-sonnet-4-6',
						max_tokens: 1200,
						stream: true,
						system: systemPrompt,
						messages: [{ role: 'user', content: prompt }],
					}),
				});

				if (!res.ok) {
					const errText = await res.text().catch(() => '');
					send('error', { message: `AI error: ${res.status} ${errText.slice(0, 200)}` });
					controller.close();
					return;
				}

				// Parse SSE from Anthropic
				const reader = res.body!.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						if (!line.startsWith('data: ')) continue;
						const data = line.slice(6);
						if (data === '[DONE]') continue;

						try {
							const parsed = JSON.parse(data);
							if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
								send('chunk', parsed.delta.text);
							}
						} catch {}
					}
				}

				send('done', {});
			} catch (e: any) {
				send('error', { message: e?.message || 'Unknown error' });
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
		},
	});
};

// ─── System Prompts ───

const INITIAL_SYSTEM_PROMPT = `You are the Rosys Patterns sizing expert — warm, knowledgeable, and specific. You're advising a friend who sews.

Write your response using these EXACT markdown headers in this order:

## Recommended Size
State the size clearly (e.g., "Size M"). Be definitive.

## Why This Size
Explain your reasoning using the customer's specific measurements. Reference bust, waist, and hip values. Mention ease and how the garment is designed to fit.

## Fit by Measurement
For each measurement, give a brief assessment:
- **Bust**: [how it fits — snug, comfortable, roomy]
- **Waist**: [how it fits]
- **Hip**: [how it fits]

## Between Sizes?
If the customer falls between sizes, explain both options. If they clearly fit one size, say "You're solidly in this size."

## Adjustments to Consider
Suggest length or width adjustments based on their height and proportions. If none needed, say so briefly.

## Garment Notes
Pattern-specific tips about ease, fabric choice, or construction that affect fit.

Rules:
- Never use jargon (DXF, MLP, grading, ease calculation)
- Keep each section 2-3 sentences max
- Be warm and helpful, not clinical
- Reference specific numbers from their measurements`;

const FOLLOWUP_SYSTEM_PROMPT = `You are the Rosys Patterns sizing expert. The customer has already received an initial recommendation and has now provided fit preferences (e.g., wanting more room, preferring shorter length, using stretch fabric).

Re-analyze their size based on these preferences. Your response should:

## Updated Recommendation
State whether the size changes or stays the same. Be clear: "Still Size M" or "Now I'd suggest Size L."

## What Changed
Explain how their preferences affect the recommendation. Be specific about which preference caused what shift.

## Updated Fit
- **Bust**: [updated assessment]
- **Waist**: [updated assessment]
- **Hip**: [updated assessment]

## Adjustments
Any new length/width adjustments based on their preferences.

Rules:
- Be concise — they already got the full analysis
- Only mention what changed, don't repeat everything
- If nothing changes, say so confidently
- Never use jargon`;

// ─── Prompt Builder ───

function buildPrompt(
	bust: number, waist: number, hip: number, height: number | undefined,
	match: any, chart: any, patternName: string, source: string,
	profile: any, preferences?: any
): string {
	let prompt = `CUSTOMER: bust ${bust}cm, waist ${waist}cm, hip ${hip}cm${height ? `, height ${height}cm` : ''} (${source || 'tape measure'})

PATTERN: ${patternName}
DETERMINISTIC MATCH: ${match.recommended.size} (score ${match.recommended.score.toFixed(1)})
Between sizes: ${match.betweenSizes ? `yes (${match.lowerSize}/${match.upperSize})` : 'no'}

BODY SIZE CHART:
${chart.body.map((r: any) => `  ${r.size}: bust=${r.bust_cm} waist=${r.waist_cm} hip=${r.hip_cm}`).join('\n')}

FINISHED GARMENT:
${chart.finished.map((r: any) => `  ${r.size}: bust=${r.bust_cm} waist=${r.waist_cm} hip=${r.hip_cm} length=${r.full_length_cm}`).join('\n')}

${match.recommended.ease.bust_cm !== null ? `EASE AT ${match.recommended.size}: bust=${match.recommended.ease.bust_cm?.toFixed(0)}cm waist=${match.recommended.ease.waist_cm?.toFixed(0)}cm hip=${match.recommended.ease.hip_cm?.toFixed(0)}cm` : ''}`;

	if (profile) {
		prompt += `\n\nBODY PROFILE (MLP predicted from 59K subjects):
Shoulder: ${profile.shoulder_cm}cm, Arm length: ${profile.arm_length_cm}cm, Leg length: ${profile.leg_length_cm}cm${profile.weight_kg ? `, Est. weight: ${profile.weight_kg}kg` : ''}`;
	}

	if (preferences) {
		prompt += `\n\nCUSTOMER FIT PREFERENCES:`;
		if (preferences.fit_preference) prompt += `\n- Overall fit: ${preferences.fit_preference}`;
		if (preferences.bust_preference) prompt += `\n- Bust: wants ${preferences.bust_preference}`;
		if (preferences.waist_preference) prompt += `\n- Waist: wants ${preferences.waist_preference}`;
		if (preferences.hip_preference) prompt += `\n- Hip: wants ${preferences.hip_preference}`;
		if (preferences.length_preference) prompt += `\n- Length: prefers ${preferences.length_preference}`;
		if (preferences.fabric_stretch) prompt += `\n- Fabric: ${preferences.fabric_stretch}`;
		if (preferences.notes) prompt += `\n- Additional: ${preferences.notes}`;
		prompt += `\n\nRe-analyze based on these preferences. The initial recommendation was ${match.recommended.size}.`;
	} else {
		prompt += `\n\nGive your recommendation as a warm, personal narrative using the required markdown headers.`;
	}

	return prompt;
}
