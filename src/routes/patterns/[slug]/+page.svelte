<script lang="ts">
	import { ArrowLeft, Download, FileText, Box, Image, Play, Scissors } from 'lucide-svelte';

	let { data } = $props();
	const { pattern, tutorials, description } = data;

	const STORAGE_BASE = 'https://lahzrlyhojyfadjasdrc.supabase.co/storage/v1/object/public/pattern-files';
	const base = `${STORAGE_BASE}/${pattern.pattern_slug}`;

	const cleanName = pattern.pattern_name.toLowerCase().replace(/\s+/g, '_');

	const downloads = [
		pattern.has_instructions && { label: 'Instructions', href: `${base}/instructions/instructions.pdf`, icon: FileText },
		pattern.has_a0 && { label: 'A0 Pattern', href: `${base}/a0/a0.pdf`, icon: Box },
		{ label: 'A4 Pattern', href: `${base}/a4/a4.pdf`, icon: Box },
		{ label: 'US Letter', href: `${base}/us_letter/us_letter.pdf`, icon: Box },
		pattern.has_dxf && { label: 'DXF File', href: `${base}/dxf/${pattern.pattern_name.toUpperCase().replace(/_/g, ' ')}.dxf`, icon: Scissors }
	].filter(Boolean) as Array<{ label: string; href: string; icon: typeof FileText }>;
</script>

<svelte:head>
	<title>{pattern.pattern_name} — Rosys Patterns</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
	<!-- Back -->
	<a href="/patterns" class="inline-flex items-center gap-2 text-rosys-brown/60 hover:text-rosys-brown mb-6 text-sm">
		<ArrowLeft class="w-4 h-4" />
		Back to patterns
	</a>

	<div class="grid md:grid-cols-2 gap-8">
		<!-- Image -->
		<div class="aspect-[3/4] bg-white rounded-2xl overflow-hidden shadow-sm border border-rosys-brown/10">
			{#if pattern.has_finished_images}
				<img
					src="{base}/finished_{cleanName}_images/finished_{cleanName}_front.webp"
					alt={pattern.pattern_name}
					class="w-full h-full object-cover"
					onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
				/>
			{:else}
				<div class="w-full h-full flex items-center justify-center bg-rosys-cream">
					<Scissors class="w-20 h-20 text-rosys-brown/15" />
				</div>
			{/if}
		</div>

		<!-- Details -->
		<div>
			<h1 class="text-3xl font-serif italic text-rosys-brown mb-4">{pattern.pattern_name}</h1>

			{#if description}
				<p class="text-rosys-brown/70 text-sm leading-relaxed mb-6">{description}</p>
			{/if}

			<!-- Downloads -->
			<div class="space-y-3 mb-8">
				<h2 class="text-sm font-semibold text-rosys-brown uppercase tracking-wider">Downloads</h2>
				{#each downloads as dl}
					<a
						href={dl.href}
						target="_blank"
						rel="noopener"
						class="flex items-center gap-3 p-4 bg-white rounded-xl border border-rosys-brown/10 hover:border-rosys-brown/30 hover:shadow-sm transition-all group"
					>
						<dl.icon class="w-5 h-5 text-rosys-brown/50 group-hover:text-rosys-brown" />
						<span class="flex-1 text-sm font-medium text-rosys-brown">{dl.label}</span>
						<Download class="w-4 h-4 text-rosys-brown/30 group-hover:text-rosys-brown" />
					</a>
				{/each}
			</div>

			<!-- Tutorials -->
			{#if tutorials.length > 0}
				<div class="space-y-3">
					<h2 class="text-sm font-semibold text-rosys-brown uppercase tracking-wider">Video Tutorials</h2>
					{#each tutorials as tutorial}
						<a
							href={tutorial.url}
							target="_blank"
							rel="noopener"
							class="flex items-center gap-3 p-4 bg-white rounded-xl border border-rosys-brown/10 hover:border-rosys-pink/30 hover:shadow-sm transition-all group"
						>
							<Play class="w-5 h-5 text-rosys-pink/60 group-hover:text-rosys-pink" />
							<span class="flex-1 text-sm text-rosys-brown line-clamp-2">{tutorial.title}</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
