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

		setTimeout(() => chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }), 50);

		try {
			const res = await fetch('/api/ai/pattern-help', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question,
					pattern_slug: pattern.pattern_slug,
					history: messages.slice(-6)
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
	<div class="shrink-0 glass border-b border-rosys-border/20 px-5 py-3.5"
		style="box-shadow: 0 1px 12px rgba(0,0,0,0.05);">
		<div class="flex items-center justify-between">
			<a href="/patterns/{pattern.pattern_slug}" class="rosys-back-link text-[13px]">
				<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
				{pattern.pattern_name}
			</a>
			<div class="flex items-center gap-2 rosys-tag" style="background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.02)); border-color: rgba(232,54,109,0.12);">
				<Sparkles class="w-3.5 h-3.5 text-rosys-500" strokeWidth={2} />
				<span class="text-[11px] font-semibold text-rosys-600">AI Pattern Helper</span>
			</div>
		</div>
	</div>

	<!-- Chat messages -->
	<div bind:this={chatContainer} class="flex-1 overflow-auto px-5 py-8 space-y-5">
		{#if messages.length === 0}
			<div class="max-w-lg mx-auto text-center pt-12">
				<!-- Large floating chat icon -->
				<div class="w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-6 float"
					style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-glow-rose), var(--shadow-brand-lg);">
					<MessageCircle class="w-8 h-8 text-white" strokeWidth={1.5} />
				</div>
				<h2 class="text-[22px] font-bold text-rosys-fg tracking-[-0.03em] mb-2.5">Ask anything about this pattern</h2>
				<p class="text-[15px] text-rosys-fg-muted leading-relaxed max-w-sm mx-auto mb-10">I have the full instructions, sizing charts, and pattern pieces loaded.</p>

				<!-- Suggestion pills with stagger-scale + hover rotation -->
				<div class="flex flex-wrap gap-2.5 justify-center">
					{#each suggestions as s, i}
						<button
							type="button"
							onclick={() => sendMessage(s)}
							class="stagger-scale rosys-btn-secondary text-[13px] hover:border-rosys-300 hover:text-rosys-600 hover:bg-rosys-50/50 transition-all duration-300"
							style="--i: {i}; transform-origin: center;"
							onmouseenter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) rotate(1deg)'; }}
							onmouseleave={(e) => { e.currentTarget.style.transform = ''; }}
						>{s}</button>
					{/each}
				</div>

				{#if tutorials.length > 0}
					<div class="mt-10 text-left">
						<h3 class="rosys-section-label mb-4">Video Tutorials</h3>
						<div class="space-y-1">
							{#each tutorials as tut}
								<a href={tut.url} target="_blank" rel="noopener" class="flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-warm-50 transition-all duration-200 group">
									<div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors duration-200">
										<Play class="w-4 h-4 text-red-500" strokeWidth={2} />
									</div>
									<span class="text-[13px] text-rosys-fg-muted font-medium group-hover:text-rosys-fg transition-colors duration-200">{tut.title}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="max-w-2xl mx-auto space-y-5">
				{#each messages as msg, i}
					{#if msg.role === 'user'}
						<!-- User message bubble -->
						<div class="flex justify-end" style="animation: slideUp 0.35s var(--ease-spring) both;">
							<div class="relative px-5 py-3.5 rounded-2xl rounded-br-sm max-w-[80%] text-[14px] leading-relaxed text-white"
								style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-brand);">
								{msg.content}
								<!-- CSS tail triangle -->
								<span class="absolute -right-1.5 bottom-2 w-0 h-0" style="border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 6px solid var(--color-rosys-600);"></span>
							</div>
						</div>
					{:else}
						<!-- Assistant message with Sparkles + left border -->
						<div class="flex justify-start" style="animation: slideUp 0.35s var(--ease-spring) both;">
							<div class="rosys-card px-5 py-4 rounded-2xl rounded-bl-sm max-w-[85%] text-[14px] text-rosys-fg-secondary leading-relaxed whitespace-pre-line"
								style="border-left: 3px solid var(--color-rosys-200); box-shadow: var(--shadow-md);">
								<span class="inline-flex items-start gap-2">
									<Sparkles class="w-4 h-4 text-rosys-400 shrink-0 mt-0.5" strokeWidth={2} />
									<span>{msg.content}</span>
								</span>
							</div>
						</div>
					{/if}
				{/each}

				<!-- Loading state with typing dots -->
				{#if loading}
					<div class="flex justify-start" style="animation: slideUp 0.3s var(--ease-spring) both;">
						<div class="rosys-card px-5 py-4 rounded-2xl rounded-bl-sm" style="border-left: 3px solid var(--color-rosys-200);">
							<div class="typing-dots">
								<span></span>
								<span></span>
								<span></span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Input bar -->
	<div class="shrink-0 glass border-t border-rosys-border/20 px-5 py-4"
		style="box-shadow: 0 -1px 12px rgba(0,0,0,0.04);">
		<form
			onsubmit={(e) => { e.preventDefault(); sendMessage(); }}
			class="max-w-2xl mx-auto flex gap-3"
		>
			<input
				type="text"
				bind:value={input}
				placeholder="Ask about this pattern..."
				disabled={loading}
				class="flex-1 rosys-input disabled:opacity-50"
			/>
			<button
				type="submit"
				disabled={!input.trim() || loading}
				class="rosys-btn-primary px-4 py-3 transition-all duration-200"
				style="transform-origin: center;"
				onmouseenter={(e) => { e.currentTarget.style.transform = 'rotate(12deg) scale(1.05)'; }}
				onmouseleave={(e) => { e.currentTarget.style.transform = ''; }}
			>
				<Send class="w-4 h-4" strokeWidth={1.5} />
			</button>
		</form>
	</div>
</div>
