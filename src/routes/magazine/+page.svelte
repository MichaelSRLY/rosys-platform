<script lang="ts">
	import { Heart, MessageCircle, Send, X, ZoomIn } from 'lucide-svelte';
	import { createClient } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	const supabase = createClient();

	let activeComments = $state<number | null>(null);
	let fullPageView = $state<number | null>(null);
	let newComment = $state('');
	let commentLoading = $state(false);

	function likeCount(pageIndex: number): number {
		return data.likesByPage[pageIndex] || 0;
	}

	function commentCount(pageIndex: number): number {
		return (data.commentsByPage[pageIndex] || []).length;
	}

	function isLiked(pageIndex: number): boolean {
		return !!data.userLikes[pageIndex];
	}

	async function toggleLike(pageIndex: number) {
		const session = data.session;
		if (!session?.user) return;

		const existingLikeId = data.userLikes[pageIndex];
		if (existingLikeId) {
			await supabase.from('likes').delete().eq('id', existingLikeId);
		} else {
			await supabase.from('likes').insert({
				user_id: session.user.id,
				page_index: pageIndex,
				created_at: new Date().toISOString()
			});
		}
		invalidateAll();
	}

	async function addComment(pageIndex: number) {
		const session = data.session;
		if (!session?.user || !newComment.trim()) return;

		commentLoading = true;
		await supabase.from('comments').insert({
			user_id: session.user.id,
			page_index: pageIndex,
			content: newComment.trim(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});
		newComment = '';
		commentLoading = false;
		invalidateAll();
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h`;
		const days = Math.floor(hrs / 24);
		return `${days}d`;
	}
</script>

<svelte:head>
	<title>Magazine — Rosys Patterns</title>
</svelte:head>

<div class="page-enter max-w-[480px] mx-auto pb-10">
	<!-- Sticky header -->
	<div class="sticky top-0 z-20 glass border-b border-rosys-border/20 px-5 py-3.5"
		style="box-shadow: 0 1px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02);">
		<div class="flex items-center gap-3">
			<div class="w-8 h-8 rounded-xl flex items-center justify-center"
				style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-brand);">
				<img src="/logowhite.png" alt="Rosys" class="w-4.5 h-4.5 brightness-0 invert" />
			</div>
			<h1 class="text-rosys-fg text-[16px] tracking-[-0.02em] font-bold">
				{data.edition.title} Edition
			</h1>
		</div>
	</div>

	<!-- Pages feed -->
	<div class="space-y-5 px-3 pt-5">
		{#each data.pages as page, index (page.index)}
			<div
				class="rosys-card overflow-hidden rounded-2xl {index < 8 ? 'stagger-item' : ''}"
				style="{index < 8 ? `--i: ${index}` : ''}; box-shadow: var(--shadow-md);"
			>
				<!-- Page image -->
				<button
					type="button"
					class="w-full cursor-pointer relative group overflow-hidden"
					onclick={() => (fullPageView = page.index)}
				>
					<img
						src={page.src}
						alt="Page {page.index + 1}"
						class="w-full h-auto transition-transform duration-700 group-hover:scale-[1.02]"
						loading={page.index < 3 ? 'eager' : 'lazy'}
					/>
					<div class="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-400 flex items-center justify-center">
						<div class="w-12 h-12 rounded-full glass flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300" style="animation: scaleIn 0.3s var(--ease-spring) both; box-shadow: var(--shadow-lg);">
							<ZoomIn class="w-5 h-5 text-white" strokeWidth={1.5} />
						</div>
					</div>
				</button>

				<!-- Interactions bar -->
				<div class="px-4 py-3.5 flex items-center gap-6">
					<button
						type="button"
						onclick={() => toggleLike(page.index)}
						class="flex items-center gap-2 transition-all duration-200 {isLiked(page.index) ? 'text-rosys-500' : 'text-rosys-fg-faint hover:text-rosys-500'}"
					>
						<span class={isLiked(page.index) ? 'heart-burst' : ''} style={isLiked(page.index) ? 'filter: drop-shadow(0 0 6px rgba(232,54,109,0.4));' : ''}>
							<Heart class="w-[22px] h-[22px]" strokeWidth={1.5} fill={isLiked(page.index) ? 'currentColor' : 'none'} />
						</span>
						{#if likeCount(page.index) > 0}
							<span class="text-[13px] font-semibold tabular-nums">{likeCount(page.index)}</span>
						{/if}
					</button>

					<button
						type="button"
						onclick={() => (activeComments = activeComments === page.index ? null : page.index)}
						class="flex items-center gap-2 text-rosys-fg-faint hover:text-rosys-fg transition-colors duration-200"
					>
						<MessageCircle class="w-[22px] h-[22px]" strokeWidth={1.5} />
						{#if commentCount(page.index) > 0}
							<span class="text-[13px] font-semibold tabular-nums">{commentCount(page.index)}</span>
						{/if}
					</button>

					<span class="ml-auto text-[12px] text-rosys-fg-faint/50 font-medium">Page {page.index + 1}</span>
				</div>

				<!-- Comments section (inline) -->
				{#if activeComments === page.index}
					<div
						class="border-t border-rosys-border/30 px-4 py-4 space-y-4"
						style="animation: slideDown 0.35s var(--ease-spring) both;"
					>
						{#each data.commentsByPage[page.index] || [] as comment}
							<div class="flex gap-3">
								<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
									style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: 0 2px 8px rgba(232,54,109,0.2);">
									<span class="text-[11px] font-bold text-white">{comment.username[0]?.toUpperCase()}</span>
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-baseline gap-2">
										<span class="text-[13px] font-bold text-rosys-fg">{comment.username}</span>
										<span class="text-[11px] text-rosys-fg-faint/50">{timeAgo(comment.created_at)}</span>
									</div>
									<div class="mt-1 pl-3 border-l-[2px] border-rosys-100">
										<p class="text-[13px] text-rosys-fg-muted leading-relaxed">{comment.content}</p>
									</div>
								</div>
							</div>
						{/each}

						{#if (data.commentsByPage[page.index] || []).length === 0}
							<p class="text-[13px] text-rosys-fg-faint/60 text-center py-4 italic">Be the first to leave a comment</p>
						{/if}

						<!-- Add comment -->
						<form
							onsubmit={(e) => { e.preventDefault(); addComment(page.index); }}
							class="flex gap-2.5 pt-1"
						>
							<input
								type="text"
								bind:value={newComment}
								placeholder="Add a comment..."
								class="rosys-input !py-2.5 !px-3.5 !text-[13px] flex-1"
							/>
							<button
								type="submit"
								disabled={!newComment.trim() || commentLoading}
								class="rosys-btn-primary px-3.5 py-2.5"
							>
								<Send class="w-4 h-4" strokeWidth={1.5} />
							</button>
						</form>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<!-- Full page overlay -->
{#if fullPageView !== null}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		role="dialog"
		style="animation: fadeIn 0.3s ease-out both;"
	>
		<!-- Blurred backdrop -->
		<div class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>

		<button
			type="button"
			class="absolute top-5 right-5 p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 z-10 transition-all duration-200"
			onclick={() => (fullPageView = null)}
		>
			<X class="w-6 h-6" strokeWidth={1.5} />
		</button>

		<div
			class="relative w-full h-full overflow-auto flex items-start justify-center p-6"
			style="animation: scaleIn 0.4s var(--ease-spring) both;"
		>
			<img
				src={data.pages[fullPageView].src}
				alt="Page {fullPageView + 1}"
				class="max-w-full max-h-full object-contain rounded-xl"
				style="box-shadow: 0 32px 80px rgba(0,0,0,0.5);"
			/>
		</div>

		<!-- Navigation arrows in glass circles -->
		{#if fullPageView > 0}
			<button
				type="button"
				class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
				style="box-shadow: var(--shadow-lg);"
				onclick={() => (fullPageView = (fullPageView ?? 1) - 1)}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7"/></svg>
			</button>
		{/if}
		{#if fullPageView < data.pages.length - 1}
			<button
				type="button"
				class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
				style="box-shadow: var(--shadow-lg);"
				onclick={() => (fullPageView = (fullPageView ?? 0) + 1)}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
			</button>
		{/if}

		<!-- Page counter pill -->
		<div class="absolute bottom-8 left-1/2 -translate-x-1/2 glass px-5 py-2 rounded-full" style="box-shadow: var(--shadow-lg);">
			<span class="text-white text-[13px] font-semibold tabular-nums">{(fullPageView ?? 0) + 1} / {data.pages.length}</span>
		</div>
	</div>
{/if}
