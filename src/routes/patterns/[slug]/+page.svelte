<script lang="ts">
	import { ArrowLeft, Download, FileText, Box, Scissors, Play, ExternalLink } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, tutorials, description } = data;

	const STORAGE = 'https://lahzrlyhojyfadjasdrc.supabase.co/storage/v1/object/public/pattern-files';
	const base = `${STORAGE}/${pattern.pattern_slug}`;
	const clean = pattern.pattern_name.toLowerCase().replace(/\s+/g, '_');

	const downloads = [
		pattern.has_instructions && { label: 'Instructions PDF', sub: 'Step-by-step sewing guide', href: `${base}/instructions/instructions.pdf`, icon: FileText },
		pattern.has_a0 && { label: 'A0 Pattern Sheet', sub: 'Print at copy shop', href: `${base}/a0/a0.pdf`, icon: Box },
		{ label: 'A4 Pattern', sub: 'Home printer format', href: `${base}/a4/a4.pdf`, icon: Box },
		{ label: 'US Letter Pattern', sub: 'US paper size', href: `${base}/us_letter/us_letter.pdf`, icon: Box },
		pattern.has_dxf && { label: 'DXF Pattern File', sub: 'For projector cutting', href: `${base}/dxf/${pattern.pattern_name.replace(/_/g, ' ').toUpperCase()}.dxf`, icon: Scissors }
	].filter(Boolean) as Array<{ label: string; sub: string; href: string; icon: typeof FileText }>;
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
			{#if pattern.has_finished_images}
				<img
					src="{base}/finished_{clean}_images/finished_{clean}_front.webp"
					alt={pattern.pattern_name}
					class="w-full h-full object-cover"
					onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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

			<!-- Downloads -->
			<div class="mb-8">
				<h2 class="text-[11px] font-semibold text-rosys-fg-faint uppercase tracking-[0.1em] mb-3">Downloads</h2>
				<div class="space-y-2">
					{#each downloads as dl}
						<a
							href={dl.href}
							target="_blank"
							rel="noopener"
							class="flex items-center gap-4 p-4 bg-rosys-card rounded-xl border border-rosys-border/60 hover:border-rosys-fg/20 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 group"
						>
							<div class="w-9 h-9 rounded-lg bg-rosys-bg-alt flex items-center justify-center shrink-0 group-hover:bg-rosys-fg/[0.06] transition-colors">
								<dl.icon class="w-4 h-4 text-rosys-fg/50" strokeWidth={1.5} />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-[14px] font-medium text-rosys-fg">{dl.label}</p>
								<p class="text-[12px] text-rosys-fg-faint">{dl.sub}</p>
							</div>
							<Download class="w-4 h-4 text-rosys-fg/20 group-hover:text-rosys-fg/50 transition-colors shrink-0" strokeWidth={1.5} />
						</a>
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
