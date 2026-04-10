/**
 * Streaming Size Intelligence endpoint.
 *
 * Sends Server-Sent Events:
 *   1. "deterministic" — instant size match + body profile + chart data (JSON)
 *   2. "chunk"         — AI narrative tokens (text)
 *   3. "done"          — stream complete
 *   4. "error"         — on failure
 *
 * Accepts optional `preferences` + `previous_recommendation` for re-analysis.
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
	const { pattern_slug, bust, waist, hip, height, source, preferences, previous_recommendation } = body;

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

				// ── Gather ALL pattern context ──
				const patternInfo = await query<{ pattern_name: string }>(
					`SELECT pattern_name FROM cs_pattern_catalog WHERE pattern_slug = $1`, [pattern_slug]
				);

				// Product identity, instructions, DXF pieces, size chart text — everything
				const embeddings = await query<{ chunk_type: string; description: string; metadata: string }>(
					`SELECT chunk_type, description, metadata::text FROM cs_pattern_embeddings
					 WHERE pattern_slug = $1
					 AND chunk_type IN ('product_identity', 'instructions_text', 'dxf_pattern_piece', 'size_chart_text')
					 ORDER BY chunk_type, chunk_index`,
					[pattern_slug]
				);

				const patternContext: Record<string, string[]> = {};
				for (const e of embeddings) {
					if (!patternContext[e.chunk_type]) patternContext[e.chunk_type] = [];
					patternContext[e.chunk_type].push(e.description);
				}

				// Check DXF availability
				const hasDxf = embeddings.some(e => e.chunk_type === 'dxf_pattern_piece');

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
					has_dxf: hasDxf,
				});

				// ── 2. Stream AI narrative ──
				const prompt = buildPrompt(
					bust, waist, hip, height, match, chart,
					patternInfo[0]?.pattern_name || pattern_slug,
					source, profile, patternContext, preferences, previous_recommendation
				);

				const apiKey = env.ANTHROPIC_API_KEY;
				if (!apiKey) {
					send('chunk', `## Recommended Size\nSize ${match.recommended.size}\n\n`);
					send('chunk', `## Why This Size\nBased on your measurements (bust ${bust}cm, waist ${waist}cm, hip ${hip}cm), size ${match.recommended.size} is the best fit for this pattern.\n\n`);
					if (match.betweenSizes) {
						send('chunk', `## Between Sizes?\nYou fall between ${match.lowerSize} and ${match.upperSize}. We recommend ${match.recommended.size} for the best balance.\n\n`);
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
						max_tokens: 1500,
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

You have access to the FULL pattern data: what the garment looks like, how it's constructed, what fabrics work, the exact finished measurements, and the pattern pieces. Use ALL of this to give precise, garment-aware advice.

Write your response using these EXACT markdown headers in this order:

## Recommended Size
State the size clearly (e.g., "Size M"). Be definitive.

## Why This Size
Explain using the customer's measurements against the finished garment data. Mention ease — how much room the garment gives beyond their body. Reference the garment type (fitted dress vs loose coat = different logic).

## Fit by Measurement
- **Bust**: [finished measurement at this size vs their body — snug, comfortable, roomy, and why]
- **Waist**: [same]
- **Hip**: [same]

## Between Sizes?
If between sizes, explain both options and recommend one based on garment type and construction. If solidly in one size, say so.

## Adjustments to Consider
Based on their height vs the garment's full length. Also consider shoulder width if the garment has set-in sleeves, or bottom sweep for A-line silhouettes.

## Garment Notes
Fabric-specific advice (stretch vs woven affects size choice). Construction details that affect fit (darts, zipper, slit, lining). Anything the sewer should know.

Rules:
- Never use jargon (DXF, MLP, grading, ease calculation, embeddings)
- Keep each section 2-4 sentences max
- Be warm and helpful, not clinical
- Reference specific numbers from their measurements AND the garment data
- If body chart is empty but finished measurements exist, work with finished measurements (ease = finished - body)`;

const FOLLOWUP_SYSTEM_PROMPT = `You are the Rosys Patterns sizing expert. The customer already received a recommendation and has now provided fit preferences.

You have:
1. The customer's measurements
2. The full pattern data (construction, fabric, finished measurements)
3. The PREVIOUS recommendation the AI gave
4. The customer's new preferences

Re-analyze considering their preferences. Your response:

## Updated Recommendation
State clearly: "Still Size M" or "Now I'd suggest Size L."

## What Changed
Which preferences shifted the recommendation and why. Reference specific finished measurements.

## Updated Fit
- **Bust**: [updated]
- **Waist**: [updated]
- **Hip**: [updated]

## Adjustments
Any new adjustments based on preferences.

Rules:
- Be concise — they already got the full analysis
- Only mention what changed
- If nothing changes, say so confidently with reasoning
- Never use jargon`;

// ─── Prompt Builder ───

function buildPrompt(
	bust: number, waist: number, hip: number, height: number | undefined,
	match: any, chart: any, patternName: string, source: string,
	profile: any, patternContext: Record<string, string[]>,
	preferences?: any, previousRecommendation?: string
): string {
	// Check if body chart has data
	const hasBodyData = chart.body.some((r: any) => r.bust_cm !== null);

	let prompt = `CUSTOMER: bust ${bust}cm, waist ${waist}cm, hip ${hip}cm${height ? `, height ${height}cm` : ''} (${source || 'tape measure'})

PATTERN: ${patternName}
DETERMINISTIC MATCH: ${match.recommended.size} (score ${match.recommended.score.toFixed(1)})
Between sizes: ${match.betweenSizes ? `yes (${match.lowerSize}/${match.upperSize})` : 'no'}`;

	// Body chart (if available)
	if (hasBodyData) {
		prompt += `\n\nBODY SIZE CHART:
${chart.body.map((r: any) => `  ${r.size}: bust=${r.bust_cm} waist=${r.waist_cm} hip=${r.hip_cm}`).join('\n')}`;
	} else {
		prompt += `\n\nNOTE: This pattern has NO body size chart — only finished garment measurements. The customer's measurements must be compared directly to the finished garment (which INCLUDES ease).`;
	}

	// Finished chart (always available)
	prompt += `\n\nFINISHED GARMENT MEASUREMENTS:
${chart.finished.map((r: any) => {
		const parts = [`${r.size}: bust=${r.bust_cm} waist=${r.waist_cm} hip=${r.hip_cm}`];
		if (r.full_length_cm) parts.push(`length=${r.full_length_cm}`);
		if (r.sleeve_length_cm) parts.push(`sleeve=${r.sleeve_length_cm}`);
		if (r.bottom_sweep_cm) parts.push(`sweep=${r.bottom_sweep_cm}`);
		if (r.shoulder_cm) parts.push(`shoulder=${r.shoulder_cm}`);
		return '  ' + parts.join(' ');
	}).join('\n')}`;

	// Ease
	if (match.recommended.ease.bust_cm !== null) {
		prompt += `\n\nEASE AT ${match.recommended.size}: bust=${match.recommended.ease.bust_cm?.toFixed(0)}cm waist=${match.recommended.ease.waist_cm?.toFixed(0)}cm hip=${match.recommended.ease.hip_cm?.toFixed(0)}cm`;
	}

	// MLP body profile
	if (profile) {
		prompt += `\n\nPREDICTED BODY PROFILE (from 59K subjects):
Shoulder: ${profile.shoulder_cm}cm, Arm length: ${profile.arm_length_cm}cm, Leg length: ${profile.leg_length_cm}cm${profile.weight_kg ? `, Est. weight: ${profile.weight_kg}kg` : ''}`;
	}

	// ── FULL PATTERN CONTEXT ──

	// Product identity
	if (patternContext['product_identity']?.length > 0) {
		prompt += `\n\nGARMENT DESCRIPTION:\n${patternContext['product_identity'].join('\n')}`;
	}

	// Instructions — extract fabric suggestions + construction details (first chunk, trimmed)
	if (patternContext['instructions_text']?.length > 0) {
		const instructionText = patternContext['instructions_text'].join('\n');
		// Extract fabric suggestions section
		const fabricMatch = instructionText.match(/FABRIC SUGGESTIONS[\s\S]*?(?=MORE IDEAL|DIFFICULTY|SEAM ALLOWANCE|SEWING INSTRUCTIONS|$)/i);
		const moreMatch = instructionText.match(/MORE IDEAL FABRIC[\s\S]*?(?=DIFFICULTY|SEAM ALLOWANCE|SEWING INSTRUCTIONS|ORGANIZE|$)/i);
		const diffMatch = instructionText.match(/DIFFICULTY LEVEL[\s\S]*?(?=SEAM|FABRIC|$)/i);

		let construction = '';
		if (diffMatch) construction += diffMatch[0].trim() + '\n';
		if (fabricMatch) construction += fabricMatch[0].trim().substring(0, 500) + '\n';
		if (moreMatch) construction += moreMatch[0].trim().substring(0, 300) + '\n';

		if (construction) {
			prompt += `\n\nPATTERN CONSTRUCTION & FABRIC:\n${construction.trim()}`;
		}
	}

	// DXF piece dimensions
	if (patternContext['dxf_pattern_piece']?.length > 0) {
		prompt += `\n\nPATTERN PIECES (DXF):\n${patternContext['dxf_pattern_piece'].join('\n')}`;
	}

	// Extended size chart (has shoulder, sweep, zipper, slit data)
	if (patternContext['size_chart_text']?.length > 0) {
		const chartText = patternContext['size_chart_text'].join('\n');
		// Only include extra measurements not in the structured chart
		const extraLines = chartText.split('\n').filter(l =>
			/shoulder|sweep|zipper|slit|sleeve/i.test(l) && /\d/.test(l)
		);
		if (extraLines.length > 0) {
			prompt += `\n\nADDITIONAL GARMENT MEASUREMENTS:\n${extraLines.join('\n')}`;
		}
	}

	// ── PREFERENCES (follow-up) ──
	if (preferences) {
		prompt += `\n\nCUSTOMER FIT PREFERENCES:`;
		if (preferences.fit_preference) prompt += `\n- Overall fit: ${preferences.fit_preference}`;
		if (preferences.bust_preference) prompt += `\n- Bust: wants ${preferences.bust_preference}`;
		if (preferences.waist_preference) prompt += `\n- Waist: wants ${preferences.waist_preference}`;
		if (preferences.hip_preference) prompt += `\n- Hip: wants ${preferences.hip_preference}`;
		if (preferences.length_preference) prompt += `\n- Length: prefers ${preferences.length_preference}`;
		if (preferences.fabric_stretch) prompt += `\n- Fabric: ${preferences.fabric_stretch}`;
		if (preferences.notes) prompt += `\n- Additional: ${preferences.notes}`;

		if (previousRecommendation) {
			prompt += `\n\nPREVIOUS AI RECOMMENDATION:\n${previousRecommendation}`;
		}

		prompt += `\n\nRe-analyze based on these preferences. Consider whether the size should change.`;
	} else {
		prompt += `\n\nGive your recommendation as a warm, personal narrative using the required markdown headers.`;
	}

	return prompt;
}
