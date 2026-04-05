# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rosys Patterns Platform v2 — a SvelteKit 5 app replacing the old React SPA. Full sewing pattern platform: customer pattern portal, magazine viewer, design voting, AI size assistant.

## Commands

```bash
npm run dev        # SvelteKit dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run check      # Svelte type checking
```

## Tech Stack

- **SvelteKit 5** with runes (`$state`, `$derived`, `$effect`)
- **Tailwind CSS 4** via `@tailwindcss/vite`
- **Supabase** — auth, PostgreSQL, storage (project: `lahzrlyhojyfadjasdrc`)
- **Railway PostgreSQL** — pattern catalog + embeddings
- **Vercel** — hosting with `@sveltejs/adapter-vercel`

## Architecture

- File-based routing in `src/routes/`
- SSR auth via `hooks.server.ts` — redirects unauthenticated users to `/login`
- Supabase client: `$lib/supabase.ts` (browser), `$lib/supabase.server.ts` (server)
- Shared components in `$lib/components/`
- Brand tokens defined as CSS custom properties in `src/app.css`

## Backend Infrastructure (shared with rosys-app v1)

- **Supabase tables:** profiles, comments, likes, sessions, page_views, downloads, interactions, voting_designs, user_votes, voting_periods, voting_rounds_archive, voting_results_archive
- **Supabase buckets:** pattern-files (130 patterns), voting-designs, voting-archive
- **Railway DB:** cs_pattern_catalog (130 patterns), cs_pattern_embeddings (1774 vectors)
- **Credentials:** stored in `pass` under `supabase/rosys-app/` and `rosyspatterns/`

## SebasWorld Context

Read `~/SebasWorld/rosys-patterns/context.md` for full project briefing.
Read `/Users/dr.contexter/Documents/MDs/rosys-support-infrastructure.md` for complete infrastructure reference.
