<script lang="ts">
	import { ArrowLeft, Star, Send, Loader2 } from 'lucide-svelte';
	import { createClient } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	const { pattern, reviews, userReview, avgRating, reviewCount } = data;
	const supabase = createClient();

	let rating = $state(userReview?.rating || 0);
	let hoverRating = $state(0);
	let fitNotes = $state(userReview?.fit_notes || '');
	let reviewText = $state(userReview?.review_text || '');
	let submitting = $state(false);
	let showForm = $state(!userReview);

	const fitOptions = ['Runs small', 'True to size', 'Runs large', 'Size up', 'Size down'];

	async function submitReview() {
		if (!rating) return;
		submitting = true;

		const session = data.session;
		if (!session?.user) return;

		if (userReview) {
			await supabase.from('pattern_reviews').update({
				rating,
				fit_notes: fitNotes || null,
				review_text: reviewText || null
			}).eq('id', userReview.id);
		} else {
			await supabase.from('pattern_reviews').insert({
				user_id: session.user.id,
				pattern_slug: pattern.pattern_slug,
				rating,
				fit_notes: fitNotes || null,
				review_text: reviewText || null
			});
		}

		submitting = false;
		showForm = false;
		invalidateAll();
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const days = Math.floor(diff / 86400000);
		if (days < 1) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 30) return `${days}d ago`;
		if (days < 365) return `${Math.floor(days / 30)}mo ago`;
		return `${Math.floor(days / 365)}y ago`;
	}
</script>

<svelte:head>
	<title>Community — {pattern.pattern_name}</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-3xl mx-auto">
	<a href="/patterns/{pattern.pattern_slug}" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-600 text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<h1 class="text-rosys-fg text-[22px] md:text-[26px] font-bold tracking-[-0.03em] mb-2">Community</h1>

	<!-- Stats -->
	<div class="flex items-center gap-4 mb-8">
		<div class="flex items-center gap-1">
			{#each [1,2,3,4,5] as s}
				<Star class="w-5 h-5 {s <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-rosys-200'}" strokeWidth={1.5} />
			{/each}
		</div>
		<span class="text-[15px] font-semibold text-rosys-fg">{avgRating.toFixed(1)}</span>
		<span class="text-[13px] text-rosys-fg-faint">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
	</div>

	<!-- Review form -->
	{#if showForm}
		<div class="rosys-card p-6 mb-8">
			<h2 class="text-[14px] font-semibold text-rosys-fg mb-4">{userReview ? 'Update your review' : 'Leave a review'}</h2>

			<div class="flex gap-1 mb-4">
				{#each [1,2,3,4,5] as s}
					<button
						type="button"
						onmouseenter={() => (hoverRating = s)}
						onmouseleave={() => (hoverRating = 0)}
						onclick={() => (rating = s)}
						class="p-0.5 transition-transform hover:scale-110"
					>
						<Star class="w-7 h-7 {s <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-rosys-200'}" strokeWidth={1.5} />
					</button>
				{/each}
			</div>

			<div class="mb-4">
				<label class="block text-[12px] font-medium text-rosys-fg-muted mb-2">How did it fit?</label>
				<div class="flex flex-wrap gap-2">
					{#each fitOptions as opt}
						<button
							type="button"
							class="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
								{fitNotes === opt ? 'bg-rosys-500 text-white' : 'bg-warm-50 text-rosys-fg-muted hover:bg-warm-100'}"
							onclick={() => (fitNotes = fitNotes === opt ? '' : opt)}
						>{opt}</button>
					{/each}
				</div>
			</div>

			<div class="mb-4">
				<label for="review" class="block text-[12px] font-medium text-rosys-fg-muted mb-1.5">Your review <span class="text-rosys-fg-faint">(optional)</span></label>
				<textarea
					id="review"
					bind:value={reviewText}
					rows="3"
					placeholder="Share your experience with this pattern..."
					class="w-full px-4 py-3 rounded-xl bg-warm-50 border border-rosys-border/50 text-[14px] text-rosys-fg placeholder-rosys-fg-faint/40 focus:outline-none focus:ring-2 focus:ring-rosys-400/20 resize-none"
				></textarea>
			</div>

			<button
				type="button"
				disabled={!rating || submitting}
				onclick={submitReview}
				class="rosys-btn-primary"
			>
				{#if submitting}
					<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
				{:else}
					<Send class="w-4 h-4" strokeWidth={1.5} />
				{/if}
				{userReview ? 'Update Review' : 'Submit Review'}
			</button>
		</div>
	{:else if userReview}
		<button
			type="button"
			class="text-[13px] text-rosys-500 hover:text-rosys-600 font-medium mb-6 transition-colors"
			onclick={() => (showForm = true)}
		>Edit your review</button>
	{/if}

	<!-- Reviews list -->
	<div class="space-y-4">
		{#each reviews as review}
			<div class="rosys-card p-5">
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-full bg-rosys-50 flex items-center justify-center">
							<span class="text-[12px] font-semibold text-rosys-600">{review.username[0]?.toUpperCase()}</span>
						</div>
						<div>
							<p class="text-[13px] font-semibold text-rosys-fg">{review.username}</p>
							<p class="text-[11px] text-rosys-fg-faint">{timeAgo(review.created_at)}</p>
						</div>
					</div>
					<div class="flex gap-0.5">
						{#each [1,2,3,4,5] as s}
							<Star class="w-3.5 h-3.5 {s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-rosys-200'}" strokeWidth={1.5} />
						{/each}
					</div>
				</div>
				{#if review.fit_notes}
					<span class="inline-block px-2.5 py-1 rounded-md bg-warm-100 text-[11px] font-medium text-rosys-fg-muted mb-2">{review.fit_notes}</span>
				{/if}
				{#if review.review_text}
					<p class="text-[14px] text-rosys-fg-secondary leading-relaxed">{review.review_text}</p>
				{/if}
			</div>
		{/each}

		{#if reviews.length === 0}
			<div class="text-center py-12">
				<Star class="w-10 h-10 text-rosys-200 mx-auto mb-3" strokeWidth={1.5} />
				<p class="text-rosys-fg-faint text-[13px]">No reviews yet — be the first!</p>
			</div>
		{/if}
	</div>
</div>
