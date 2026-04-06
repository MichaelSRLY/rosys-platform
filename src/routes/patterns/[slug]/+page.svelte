<script lang="ts">
	import { ArrowLeft, Download, FileText, Box, Scissors, Play, ExternalLink, BookOpen, Ruler, Calculator, Layers, MessageCircle } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, tutorials, description, downloads, imageUrl } = data;

	const icons: Record<string, typeof FileText> = {
		'Instructions PDF': FileText,
		'A0 Pattern Sheet': Box,
		'A4 Pattern': Box,
		'US Letter Pattern': Box,
		'DXF Pattern File': Scissors
	};
</script>

<svelte:head>
	<title>{pattern.pattern_name} — Rosys Patterns</title>
</svelte:head>

<div class="page-enter px-6 py-8 md:px-10 md:py-12 max-w-5xl mx-auto">
	<a href="/patterns" class="inline-flex items-center gap-1.5 text-rosys-fg-faint hover:text-rosys-fg text-[13px] font-medium mb-8 transition-colors">
		<ArrowLeft class="w-4 h-4" strokeWidth={1.5} />
		Patterns
	</a>

	<div class="grid md:grid-cols-[1fr_1.2fr] gap-8 md:gap-12">
		<!-- Image -->
		<div class="aspect-[3/4] bg-rosys-card rounded-3xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-rosys-border/50">
			{#if imageUrl}
				<img
					src={imageUrl}
					alt={pattern.pattern_name}
					class="w-full h-full object-cover"
				/>
			{:else}
				<div class="w-full h-full flex items-center justify-center bg-rosys-bg-alt">
					<Scissors class="w-16 h-16 text-rosys-fg/8" strokeWidth={1} />
				</div>
			{/if}
		</div>

		<!-- Details -->
		<div>
			<h1 class="font-[var(--font-logo)] italic text-rosys-fg text-[32px] font-light leading-tight tracking-tight mb-2">
				{pattern.pattern_name}
			</h1>

			{#if pattern.shopify_name && pattern.shopify_name !== pattern.pattern_name}
				<p class="text-rosys-fg-faint text-[13px] mb-4">{pattern.shopify_name}</p>
			{/if}

			{#if description}
				<p class="text-rosys-fg-muted text-[14px] leading-relaxed mb-8 max-w-lg">{description}</p>
			{/if}

			<!-- Quick Actions -->
			<div class="mb-8">
				<a
					href="/patterns/{pattern.pattern_slug}/instructions"
					class="flex items-center gap-4 p-4 bg-rosys-fg text-white rounded-xl hover:bg-rosys-fg/90 active:scale-[0.98] transition-all duration-150 group mb-4"
				>
					<div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
						<BookOpen class="w-5 h-5" strokeWidth={1.5} />
					</div>
					<div class="flex-1">
						<p class="text-[15px] font-semibold">Read Instructions</p>
						<p class="text-[12px] text-white/60">Interactive step-by-step guide</p>
					</div>
				</a>

				<a
					href="/patterns/{pattern.pattern_slug}/sizing"
					class="flex items-center gap-4 p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 group"
				>
					<div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
						<Ruler class="w-5 h-5" strokeWidth={1.5} />
					</div>
					<div class="flex-1">
						<p class="text-[15px] font-semibold">Find My Size</p>
						<p class="text-[12px] text-white/60">AI-powered size recommendation</p>
					</div>
				</a>

				<a
					href="/patterns/{pattern.pattern_slug}/fabric"
					class="flex items-center gap-4 p-4 bg-amber-500 text-white rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all duration-150 group"
				>
					<div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
						<Calculator class="w-5 h-5" strokeWidth={1.5} />
					</div>
					<div class="flex-1">
						<p class="text-[15px] font-semibold">Fabric Calculator</p>
						<p class="text-[12px] text-white/60">How much fabric do you need?</p>
					</div>
				</a>

				<div class="grid grid-cols-2 gap-3">
					<a
						href="/patterns/{pattern.pattern_slug}/pieces"
						class="flex items-center gap-3 p-3.5 bg-rosys-card border border-rosys-border/60 rounded-xl hover:border-rosys-fg/20 hover:shadow-sm transition-all group"
					>
						<Layers class="w-5 h-5 text-blue-500" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-rosys-fg">Pattern Pieces</p>
							<p class="text-[11px] text-rosys-fg-faint">Interactive viewer</p>
						</div>
					</a>
					<a
						href="/patterns/{pattern.pattern_slug}/help"
						class="flex items-center gap-3 p-3.5 bg-rosys-card border border-rosys-border/60 rounded-xl hover:border-violet-300 hover:shadow-sm transition-all group"
					>
						<MessageCircle class="w-5 h-5 text-violet-500" strokeWidth={1.5} />
						<div>
							<p class="text-[13px] font-medium text-rosys-fg">AI Helper</p>
							<p class="text-[11px] text-rosys-fg-faint">Ask anything</p>
						</div>
					</a>
				</div>
			</div>

			<!-- Downloads -->
			<div class="mb-8">
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Downloads</h2>
				<div class="space-y-2">
					{#each downloads as dl}
						{@const Icon = icons[dl.label] || FileText}
						{#if dl.href}
							<a
								href={dl.href}
								target="_blank"
								rel="noopener"
								class="flex items-center gap-4 p-4 bg-rosys-card rounded-xl border border-rosys-border/60 hover:border-rosys-fg/20 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 group"
							>
								<div class="w-9 h-9 rounded-lg bg-rosys-bg-alt flex items-center justify-center shrink-0 group-hover:bg-rosys-fg/[0.06] transition-colors">
									<Icon class="w-4 h-4 text-rosys-fg/50" strokeWidth={1.5} />
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-[14px] font-medium text-rosys-fg">{dl.label}</p>
									<p class="text-[12px] text-rosys-fg-faint">{dl.sub}</p>
								</div>
								<Download class="w-4 h-4 text-rosys-fg/20 group-hover:text-rosys-fg/50 transition-colors shrink-0" strokeWidth={1.5} />
							</a>
						{:else}
							<div class="flex items-center gap-4 p-4 bg-rosys-bg-alt/50 rounded-xl border border-rosys-border/30 opacity-50">
								<div class="w-9 h-9 rounded-lg bg-rosys-bg-alt flex items-center justify-center shrink-0">
									<Icon class="w-4 h-4 text-rosys-fg/30" strokeWidth={1.5} />
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-[14px] font-medium text-rosys-fg/50">{dl.label}</p>
									<p class="text-[12px] text-rosys-fg-faint">Not available</p>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Tutorials -->
			{#if tutorials.length > 0}
				<div>
					<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Video Tutorials</h2>
					<div class="space-y-2">
						{#each tutorials as tut}
							<a
								href={tut.url}
								target="_blank"
								rel="noopener"
								class="flex items-center gap-4 p-4 bg-rosys-card rounded-xl border border-rosys-border/60 hover:border-rosys-pink/30 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 group"
							>
								<div class="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
									<Play class="w-4 h-4 text-red-400" strokeWidth={2} />
								</div>
								<p class="flex-1 text-[14px] text-rosys-fg line-clamp-2 min-w-0">{tut.title}</p>
								<ExternalLink class="w-4 h-4 text-rosys-fg/20 group-hover:text-rosys-fg/50 transition-colors shrink-0" strokeWidth={1.5} />
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
