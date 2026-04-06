import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { query } from '$lib/db.server';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Not authenticated');

	const { question, pattern_slug, history } = await request.json();
	if (!question || !pattern_slug) throw error(400, 'question and pattern_slug required');

	// Fetch pattern context: instructions, product identity, DXF pieces
	const chunks = await query<{ chunk_type: string; description: string }>(
		`SELECT chunk_type, description FROM cs_pattern_embeddings
		 WHERE pattern_slug = $1 AND chunk_type IN ('instructions_text', 'product_identity', 'dxf_pattern_piece', 'youtube_tutorial')
		 ORDER BY chunk_type, chunk_index`,
		[pattern_slug]
	);

	const context = chunks
		.map((c) => `[${c.chunk_type}]\n${c.description}`)
		.join('\n\n')
		.slice(0, 12000); // Keep under Gemini context limit

	// Build conversation
	const messages = [
		{
			role: 'user',
			parts: [{ text: `You are a helpful sewing pattern assistant for Rosys Patterns. You help sewists with questions about their patterns — sizing, construction techniques, fabric choices, and troubleshooting.

PATTERN CONTEXT:
${context}

Be concise, warm, and practical. If you reference a sewing step, mention the step number. If the question is about sizing, reference the size chart. If you don't know something, say so — don't guess.

Previous conversation:
${(history || []).map((m: any) => `${m.role}: ${m.content}`).join('\n')}

User question: ${question}` }]
		}
	];

	const geminiKey = env.GEMINI_API_KEY;
	if (!geminiKey) throw error(500, 'AI service not configured');

	try {
		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: messages,
					generationConfig: { temperature: 0.4, maxOutputTokens: 1000 }
				})
			}
		);

		if (!res.ok) throw error(502, 'AI service error');

		const data = await res.json();
		const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate an answer.';

		return json({ answer });
	} catch (e) {
		if ((e as any)?.status) throw e;
		throw error(502, 'AI service unavailable');
	}
};
