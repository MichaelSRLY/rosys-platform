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

<div class="page-enter mesh-bg min-h-screen px-6 py-10 md:px-10 md:py-14 max-w-3xl mx-auto">
	<a href="/patterns/{pattern.pattern_slug}" class="rosys-back-link mb-10 inline-flex">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		{pattern.pattern_name}
	</a>

	<h1 class="text-rosys-fg text-[28px] md:text-[32px] font-bold tracking-[-0.04em] mb-3">Community</h1>

	<!-- Rating display card -->
	<div class="stagger-item mb-10" style="--i: 0;">
		<div class="rosys-card px-7 py-6 inline-flex items-center gap-5" style="box-shadow: var(--shadow-lg);">
			<span class="text-[40px] font-bold text-rosys-fg tabular-nums leading-none">{avgRating.toFixed(1)}</span>
			<div>
				<div class="flex gap-1">
					{#each [1,2,3,4,5] as s}
						<Star class="w-5 h-5 transition-all duration-200 {s <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-rosys-200'}" strokeWidth={1.5}
							style={s <= Math.round(avgRating) ? 'filter: drop-shadow(0 1px 3px rgba(245,158,11,0.3));' : ''} />
					{/each}
				</div>
				<span class="text-[13px] text-rosys-fg-faint mt-1.5 block font-medium">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
			</div>
		</div>
	</div>

	<!-- Review form -->
	{#if showForm}
		<div class="rosys-card p-8 mb-10" style="animation: slideDown 0.45s var(--ease-spring); box-shadow: var(--shadow-xl);">
			<h2 class="text-[16px] font-bold text-rosys-fg mb-6 tracking-[-0.02em]">{userReview ? 'Update your review' : 'Leave a review'}</h2>

			<!-- Star rating with hover scale and bounce -->
			<div class="flex gap-2 mb-7">
				{#each [1,2,3,4,5] as s}
					<button
						type="button"
						onmouseenter={() => (hoverRating = s)}
						onmouseleave={() => (hoverRating = 0)}
						onclick={() => (rating = s)}
						class="p-1 transition-all duration-200 cursor-pointer"
						style="transform: {s <= (hoverRating || rating) ? 'scale(1.15)' : 'scale(1)'}; transition: transform 0.2s var(--ease-bounce);"
					>
						<Star class="w-9 h-9 transition-colors duration-200 {s <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-rosys-200 hover:text-amber-200'}" strokeWidth={1.5}
							style={s <= (hoverRating || rating) ? 'filter: drop-shadow(0 2px 6px rgba(245,158,11,0.35));' : ''} />
					</button>
				{/each}
			</div>

			<!-- Fit chips -->
			<div class="mb-7">
				<label class="block text-[12px] font-semibold text-rosys-fg-muted mb-3 uppercase tracking-wider">How did it fit?</label>
				<div class="flex flex-wrap gap-2.5">
					{#each fitOptions as opt}
						{@const active = fitNotes === opt}
						<button
							type="button"
							class="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 cursor-pointer
								{active
								? 'text-white'
								: 'text-rosys-fg-muted hover:border-rosys-300 hover:text-rosys-600'}"
							style={active
								? 'background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: var(--shadow-brand); transform: translateY(-1px);'
								: 'background: var(--color-warm-50); border: 1px solid rgba(0,0,0,0.06);'}
							onclick={() => (fitNotes = fitNotes === opt ? '' : opt)}
						>{opt}</button>
					{/each}
				</div>
			</div>

			<div class="mb-7">
				<label for="review" class="block text-[12px] font-semibold text-rosys-fg-muted mb-2 uppercase tracking-wider">Your review <span class="text-rosys-fg-faint normal-case lowercase">(optional)</span></label>
				<textarea
					id="review"
					bind:value={reviewText}
					rows="3"
					placeholder="Share your experience with this pattern..."
					class="rosys-input resize-none"
					style="min-height: 100px;"
				></textarea>
			</div>

			<button
				type="button"
				disabled={!rating || submitting}
				onclick={submitReview}
				class="rosys-btn-primary shine-effect w-full py-3.5"
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
			class="text-[14px] text-rosys-500 hover:text-rosys-600 font-semibold mb-8 transition-all duration-200 hover:-translate-y-0.5"
			onclick={() => (showForm = true)}
		>Edit your review</button>
	{/if}

	<!-- Reviews list -->
	<div class="space-y-4">
		{#each reviews as review, i}
			<div class="stagger-item rosys-card p-6" style="--i: {i}; box-shadow: var(--shadow-md);">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3.5">
						<!-- Avatar with gradient ring -->
						<div class="relative">
							<div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
								style="background: linear-gradient(135deg, var(--color-rosys-500), var(--color-rosys-600)); box-shadow: 0 0 0 3px rgba(232,54,109,0.12), 0 2px 8px rgba(232,54,109,0.2);">
								<span class="text-[13px] font-bold text-white">{review.username[0]?.toUpperCase()}</span>
							</div>
						</div>
						<div>
							<p class="text-[14px] font-bold text-rosys-fg">{review.username}</p>
							<p class="text-[11px] text-rosys-fg-faint mt-0.5">{timeAgo(review.created_at)}</p>
						</div>
					</div>
					<div class="flex gap-0.5">
						{#each [1,2,3,4,5] as s}
							<Star class="w-4 h-4 {s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-rosys-200'}" strokeWidth={1.5} />
						{/each}
					</div>
				</div>
				{#if review.fit_notes}
					<span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-semibold mb-3
						{review.fit_notes === 'True to size' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
						 review.fit_notes.includes('small') || review.fit_notes === 'Size up' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
						 'bg-blue-50 text-blue-600 border border-blue-100'}"
						style="letter-spacing: 0.01em;"
					>{review.fit_notes}</span>
				{/if}
				{#if review.review_text}
					<p class="text-[14px] text-rosys-fg-secondary leading-[1.7]">{review.review_text}</p>
				{/if}
			</div>
		{/each}

		{#if reviews.length === 0}
			<div class="text-center py-20">
				<div class="w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-5 float"
					style="background: linear-gradient(135deg, rgba(232,54,109,0.06), rgba(232,54,109,0.02)); border: 1px solid rgba(232,54,109,0.08);">
					<Star class="w-7 h-7 text-rosys-300" strokeWidth={1.5} />
				</div>
				<p class="text-rosys-fg text-[16px] font-semibold mb-1.5">No reviews yet</p>
				<p class="text-rosys-fg-faint text-[14px]">Be the first to share your experience</p>
			</div>
		{/if}
	</div>
</div>
