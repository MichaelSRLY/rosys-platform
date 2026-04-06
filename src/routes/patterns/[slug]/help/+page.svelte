<script lang="ts">
	import { ArrowLeft, Send, Loader2, Sparkles, Play, MessageCircle } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, tutorials } = data;

	interface Message { role: 'user' | 'assistant'; content: string; }

	let messages = $state<Message[]>([]);
	let input = $state('');
	let loading = $state(false);
	let chatContainer: HTMLDivElement;

	const suggestions = [
		'What size should I choose?',
		'What fabric works best?',
		'How much fabric do I need?',
		'Can I adjust the length?',
		'What seam allowance is included?'
	];

	async function sendMessage(text?: string) {
		const question = text || input.trim();
		if (!question || loading) return;

		input = '';
		messages = [...messages, { role: 'user', content: question }];
		loading = true;

		// Scroll to bottom
		setTimeout(() => chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }), 50);

		try {
			const res = await fetch('/api/ai/pattern-help', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question,
					pattern_slug: pattern.pattern_slug,
					history: messages.slice(-6) // Last 6 messages for context
				})
			});

			if (!res.ok) throw new Error('Failed');
			const json = await res.json();
			messages = [...messages, { role: 'assistant', content: json.answer }];
		} catch {
			messages = [...messages, { role: 'assistant', content: 'Sorry, I had trouble answering. Please try again.' }];
		} finally {
			loading = false;
			setTimeout(() => chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }), 50);
		}
	}
</script>

<svelte:head>
	<title>Pattern Help — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter h-full flex flex-col">
	<!-- Header -->
	<div class="shrink-0 glass border-b border-rosys-border/30 px-5 py-3">
		<div class="flex items-center justify-between">
			<a href="/patterns/{pattern.pattern_slug}" class="flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[13px] font-medium transition-colors">
				<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
				{pattern.pattern_name}
			</a>
			<div class="flex items-center gap-1.5 text-rosys-fg-faint">
				<Sparkles class="w-3.5 h-3.5 text-violet-500" strokeWidth={2} />
				<span class="text-[12px] font-medium">AI Pattern Helper</span>
			</div>
		</div>
	</div>

	<!-- Chat messages -->
	<div bind:this={chatContainer} class="flex-1 overflow-auto px-5 py-6 space-y-4">
		{#if messages.length === 0}
			<!-- Empty state with suggestions -->
			<div class="max-w-lg mx-auto text-center pt-8">
				<div class="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-5">
					<MessageCircle class="w-7 h-7 text-violet-400" strokeWidth={1.5} />
				</div>
				<h2 class="text-[18px] font-semibold text-rosys-fg mb-2">Ask anything about this pattern</h2>
				<p class="text-[14px] text-rosys-fg-faint mb-8">I have the full instructions, sizing charts, and pattern pieces loaded.</p>

				<div class="flex flex-wrap gap-2 justify-center">
					{#each suggestions as s}
						<button
							type="button"
							onclick={() => sendMessage(s)}
							class="px-4 py-2 rounded-xl bg-rosys-card border border-rosys-border/50 text-[13px] text-rosys-fg-muted hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/50 transition-all"
						>{s}</button>
					{/each}
				</div>

				{#if tutorials.length > 0}
					<div class="mt-8 text-left">
						<h3 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.08em] mb-3">Video Tutorials</h3>
						{#each tutorials as tut}
							<a href={tut.url} target="_blank" rel="noopener" class="flex items-center gap-3 p-3 rounded-xl hover:bg-rosys-card transition-colors">
								<Play class="w-4 h-4 text-red-400 shrink-0" strokeWidth={2} />
								<span class="text-[13px] text-rosys-fg-muted">{tut.title}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<!-- Messages -->
			<div class="max-w-2xl mx-auto space-y-4">
				{#each messages as msg}
					{#if msg.role === 'user'}
						<div class="flex justify-end">
							<div class="bg-rosys-fg text-white px-4 py-3 rounded-2xl rounded-br-md max-w-[80%] text-[14px] leading-relaxed">
								{msg.content}
							</div>
						</div>
					{:else}
						<div class="flex justify-start">
							<div class="bg-rosys-card border border-rosys-border/50 px-4 py-3 rounded-2xl rounded-bl-md max-w-[85%] text-[14px] text-rosys-fg-secondary leading-relaxed shadow-sm whitespace-pre-line">
								{msg.content}
							</div>
						</div>
					{/if}
				{/each}

				{#if loading}
					<div class="flex justify-start">
						<div class="bg-rosys-card border border-rosys-border/50 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
							<Loader2 class="w-5 h-5 text-violet-400 animate-spin" strokeWidth={2} />
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="shrink-0 glass border-t border-rosys-border/30 px-5 py-3">
		<form
			onsubmit={(e) => { e.preventDefault(); sendMessage(); }}
			class="max-w-2xl mx-auto flex gap-2"
		>
			<input
				type="text"
				bind:value={input}
				placeholder="Ask about this pattern..."
				disabled={loading}
				class="flex-1 px-4 py-3 rounded-xl bg-rosys-bg border-none text-[14px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
			/>
			<button
				type="submit"
				disabled={!input.trim() || loading}
				class="px-4 py-3 rounded-xl bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.97] transition-all disabled:opacity-30"
			>
				<Send class="w-4 h-4" strokeWidth={1.5} />
			</button>
		</form>
	</div>
</div>
