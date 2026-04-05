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

<div class="page-enter max-w-[480px] mx-auto pb-8">
	<!-- Header -->
	<div class="sticky top-0 z-20 glass border-b border-white/30 px-5 py-3">
		<div class="flex items-center gap-3">
			<img src="/logowhite.png" alt="Rosys" class="w-7 h-7" />
			<h1 class="font-[var(--font-display)] italic text-rosys-fg text-[16px] tracking-wide font-medium">
				{data.edition.title} Edition
			</h1>
		</div>
	</div>

	<!-- Pages feed -->
	<div class="space-y-4 px-3 pt-4">
		{#each data.pages as page (page.index)}
			<div class="bg-rosys-card rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-rosys-border/40">
				<!-- Page image -->
				<button
					type="button"
					class="w-full cursor-pointer relative group"
					onclick={() => (fullPageView = page.index)}
				>
					<img
						src={page.src}
						alt="Page {page.index + 1}"
						class="w-full h-auto"
						loading={page.index < 3 ? 'eager' : 'lazy'}
					/>
					<div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
						<div class="opacity-0 group-hover:opacity-100 transition-opacity">
							<ZoomIn class="w-8 h-8 text-white drop-shadow-lg" strokeWidth={1.5} />
						</div>
					</div>
				</button>

				<!-- Interactions bar -->
				<div class="px-4 py-3 flex items-center gap-5">
					<button
						type="button"
						onclick={() => toggleLike(page.index)}
						class="flex items-center gap-1.5 transition-colors {isLiked(page.index) ? 'text-rosys-pink' : 'text-rosys-fg-faint hover:text-rosys-pink'}"
					>
						<Heart class="w-[22px] h-[22px]" strokeWidth={1.5} fill={isLiked(page.index) ? 'currentColor' : 'none'} />
						{#if likeCount(page.index) > 0}
							<span class="text-[13px] font-medium">{likeCount(page.index)}</span>
						{/if}
					</button>

					<button
						type="button"
						onclick={() => (activeComments = activeComments === page.index ? null : page.index)}
						class="flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg transition-colors"
					>
						<MessageCircle class="w-[22px] h-[22px]" strokeWidth={1.5} />
						{#if commentCount(page.index) > 0}
							<span class="text-[13px] font-medium">{commentCount(page.index)}</span>
						{/if}
					</button>

					<span class="ml-auto text-[12px] text-rosys-fg-faint/60">Page {page.index + 1}</span>
				</div>

				<!-- Comments section (inline) -->
				{#if activeComments === page.index}
					<div class="border-t border-rosys-border/50 px-4 py-3 space-y-3">
						{#each data.commentsByPage[page.index] || [] as comment}
							<div class="flex gap-2.5">
								<div class="w-7 h-7 rounded-full bg-rosys-bg-alt flex items-center justify-center shrink-0 mt-0.5">
									<span class="text-[11px] font-semibold text-rosys-fg/60">{comment.username[0]?.toUpperCase()}</span>
								</div>
								<div class="min-w-0">
									<div class="flex items-baseline gap-2">
										<span class="text-[13px] font-semibold text-rosys-fg">{comment.username}</span>
										<span class="text-[11px] text-rosys-fg-faint/60">{timeAgo(comment.created_at)}</span>
									</div>
									<p class="text-[13px] text-rosys-fg-muted leading-relaxed">{comment.content}</p>
								</div>
							</div>
						{/each}

						{#if (data.commentsByPage[page.index] || []).length === 0}
							<p class="text-[13px] text-rosys-fg-faint text-center py-2">No comments yet</p>
						{/if}

						<!-- Add comment -->
						<form
							onsubmit={(e) => { e.preventDefault(); addComment(page.index); }}
							class="flex gap-2 pt-1"
						>
							<input
								type="text"
								bind:value={newComment}
								placeholder="Add a comment..."
								class="flex-1 px-3 py-2 rounded-xl bg-rosys-bg border-none text-[13px] text-rosys-fg placeholder-rosys-fg-faint/50 focus:outline-none focus:ring-2 focus:ring-rosys-fg/15"
							/>
							<button
								type="submit"
								disabled={!newComment.trim() || commentLoading}
								class="p-2 rounded-xl bg-rosys-fg text-white disabled:opacity-30 hover:bg-rosys-fg/90 transition-all active:scale-95"
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
		class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
		role="dialog"
	>
		<button
			type="button"
			class="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
			onclick={() => (fullPageView = null)}
		>
			<X class="w-6 h-6" strokeWidth={1.5} />
		</button>

		<!-- Swipe through pages -->
		<div class="w-full h-full overflow-auto flex items-start justify-center p-4">
			<img
				src={data.pages[fullPageView].src}
				alt="Page {fullPageView + 1}"
				class="max-w-full max-h-full object-contain rounded-lg"
			/>
		</div>

		<!-- Prev / Next -->
		{#if fullPageView > 0}
			<button
				type="button"
				class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
				onclick={() => (fullPageView = (fullPageView ?? 1) - 1)}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7"/></svg>
			</button>
		{/if}
		{#if fullPageView < data.pages.length - 1}
			<button
				type="button"
				class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
				onclick={() => (fullPageView = (fullPageView ?? 0) + 1)}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"/></svg>
			</button>
		{/if}

		<!-- Page indicator -->
		<div class="absolute bottom-6 left-1/2 -translate-x-1/2 glass px-4 py-1.5 rounded-full">
			<span class="text-white text-[13px] font-medium">{(fullPageView ?? 0) + 1} / {data.pages.length}</span>
		</div>
	</div>
{/if}
