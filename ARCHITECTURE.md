# Rosys Platform — Complete Architecture

> Last updated: April 2026. This document describes every system, service, database, model, and data flow in the platform. Written for agent handoff — read this before touching any code.

## Quick Reference

| Item | Value |
|---|---|
| **Repo** | `MichaelSRLY/rosys-platform` |
| **Framework** | SvelteKit 5 (runes: `$state`, `$derived`, `$effect`) |
| **Styling** | Tailwind CSS 4 via `@tailwindcss/vite` (config in `src/app.css` `@theme`) |
| **Hosting** | Vercel — `platform-rosys.vercel.app` |
| **Supabase** | Project `lahzrlyhojyfadjasdrc` — auth, profiles, storage |
| **Railway PG** | Pattern catalog, size charts, embeddings |
| **AI Primary** | Anthropic Claude Sonnet 4.6 |
| **AI Fallback** | Ollama Gemma 4 E4B → Google Gemini 3 Flash Preview |
| **Credentials** | `pass supabase/rosys-app/*` |

---

## 1. Project Structure

```
src/
├── app.css                          # Brand tokens (@theme), global styles, component classes
├── hooks.server.ts                  # SSR auth — redirects unauthenticated users to /login
├── lib/
│   ├── supabase.ts                  # Browser Supabase client
│   ├── supabase.server.ts           # Server Supabase client (SSR)
│   ├── db.server.ts                 # Railway PostgreSQL connection (pg pool, max 5)
│   ├── storage.server.ts            # Supabase Storage operations (signed URLs)
│   ├── patterns.server.ts           # Pattern catalog queries
│   ├── shopify.server.ts            # Shopify order matching
│   │
│   ├── # ─── SIZING SYSTEM ───
│   ├── size-matching.server.ts      # Deterministic size scoring algorithm
│   ├── ai-size-intelligence.server.ts  # Multi-provider AI recommendation engine
│   ├── ai-size-schema.ts            # Zod schemas for AI input/output
│   ├── body-profile-predictor.server.ts  # MLP neural net (59K subjects)
│   ├── body-measurement.ts          # MediaPipe photo estimation (client-side)
│   ├── pattern-grading.server.ts    # Custom-fit scale factor calculations
│   ├── pattern-files.server.ts      # PDF/DXF scaling + single-size extraction
│   ├── dxf-grader.server.ts         # DXF parsing, scaling, validation (±1mm)
│   ├── neckstimate.ts               # Neck → body measurement estimation
│   ├── mlp-weights.json             # 25MB trained model weights
│   │
│   └── components/
│       ├── layout/Nav.svelte        # Sidebar + mobile tab bar
│       ├── sizing/BodySilhouette.svelte  # (deprecated, no longer used)
│       ├── magazine/                # Magazine viewer components
│       ├── patterns/                # Pattern display components
│       └── ui/                      # UI primitives
│
├── routes/
│   ├── login/                       # Auth (Supabase email/password)
│   ├── magazine/                    # Digital magazine viewer
│   ├── patterns/                    # Pattern catalog + individual pages
│   │   └── [slug]/
│   │       ├── +page.svelte         # Pattern detail page
│   │       ├── sizing/              # ★ SIZE INTELLIGENCE PAGE
│   │       │   ├── +page.server.ts  # Loads chart + saved profile
│   │       │   └── +page.svelte     # Full multi-flow sizing UI
│   │       ├── custom-fit/          # Standalone custom-fit page
│   │       ├── pieces/              # DXF piece viewer
│   │       ├── fabric/              # Fabric recommendations
│   │       ├── instructions/        # Sewing instructions viewer
│   │       └── community/           # Pattern community
│   ├── sizing/                      # Pattern picker → /patterns/[slug]/sizing
│   ├── voting/                      # Design voting system
│   ├── profile/
│   │   └── measurements/
│   │       ├── +page.svelte         # Measurement profile management
│   │       └── photo/+page.svelte   # MediaPipe photo estimation
│   ├── admin/                       # Admin dashboard
│   └── api/
│       ├── ai/
│       │   ├── size-intelligence/
│       │   │   ├── +server.ts       # Non-streaming JSON recommendation
│       │   │   └── stream/+server.ts  # ★ SSE streaming recommendation
│       │   ├── body-profile/+server.ts  # MLP prediction endpoint
│       │   ├── size-recommendation/+server.ts  # Legacy endpoint
│       │   └── pattern-help/+server.ts  # Pattern Q&A assistant
│       └── patterns/
│           ├── single-size/+server.ts   # PDF color extraction (pikepdf)
│           └── generate-custom/+server.ts  # Custom-fit PDF/DXF generation
│
└── scripts/
    ├── extract-single-size.py       # pikepdf CMYK color filtering
    ├── grade-pattern.py             # CLI DXF grading tool
    ├── measure-from-photo.py        # CLI photo measurement tool
    └── train-body-measurement.py    # MLP training script (PyTorch)
```

---

## 2. Databases

### Supabase PostgreSQL (`lahzrlyhojyfadjasdrc.supabase.co`)

User-facing data. Connected via `@supabase/ssr` + `@supabase/supabase-js`.

| Table | Purpose |
|---|---|
| `profiles` | User profiles (linked to auth.users) |
| `measurement_profiles` | Saved body measurements (bust, waist, hip, height, shoulder, arm, inseam, source) |
| `comments` | Magazine page comments |
| `likes` | Magazine page likes |
| `sessions` | User session tracking |
| `page_views` | Analytics |
| `downloads` | Download tracking |
| `interactions` | General interaction tracking |
| `voting_designs` / `user_votes` / `voting_periods` | Design voting system |

### Railway PostgreSQL (`caboose.proxy.rlwy.net:39397`)

Pattern catalog data. Connected via `pg` (node-postgres).

| Table | Purpose |
|---|---|
| `cs_pattern_catalog` | 130 patterns — pattern_slug, pattern_name |
| `cs_pattern_size_charts` | Body + finished measurements per size per pattern (bust, waist, hip, shoulder, sleeve, length, sweep, zipper, extras) |
| `cs_pattern_embeddings` | Multi-modal chunks — instructions_text, product_identity, dxf_pattern_piece, size_chart_text, size_chart_image, finished_image, instruction_illustration, youtube_tutorial, a0_pattern_page |

### Supabase Storage (`pattern-files` bucket)

Pattern file storage. Admin access via `SUPABASE_SERVICE_KEY`.

```
{pattern_slug}/
├── a0/{a0}.pdf              # A0 format (print shop)
├── a4/{a4}.pdf              # A4 tiled (home printer)
├── us_letter/{letter}.pdf   # US Letter tiled
├── dxf/{pattern}.dxf        # DXF cutting file (Optitex format)
├── single-size/{size}/{format}.pdf  # Cached extracted single-size PDFs
├── finished_{name}_images/  # Finished garment photos (front/back)
└── thumbnail/               # Pattern thumbnails
```

---

## 3. Sizing System — Complete Data Flow

```
Customer enters bust/waist/hip/height
        │
        ├──[saved?]── measurement_profiles (Supabase) ──[auto-fill form]
        │
        ▼
   "Analyze my fit" clicked
        │
        ├── POST /api/ai/size-intelligence/stream
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ STREAMING ENDPOINT (SSE)                                │
   │                                                         │
   │ 1. DETERMINISTIC MATCH (instant)                        │
   │    └── size-matching.server.ts                           │
   │        ├── Queries cs_pattern_size_charts                │
   │        ├── If body chart empty → uses finished chart     │
   │        ├── Score = bustDiff×1.5 + waistDiff×1.0          │
   │        │         + hipDiff×1.2                           │
   │        ├── Penalizes negative ease (×2.5) on finished    │
   │        ├── Between sizes if top 2 differ by < 4          │
   │        └── Returns: size, score, fit tags, ease          │
   │                                                         │
   │ 2. MLP BODY PROFILE (instant)                           │
   │    └── body-profile-predictor.server.ts                  │
   │        ├── Input: [height, bust, waist, hip]             │
   │        ├── 4-layer MLP (4→512→1024→512→256→10)           │
   │        ├── GELU activation + BatchNorm                   │
   │        ├── Weights: mlp-weights.json (25MB, 59K trained) │
   │        └── Output: shoulder, arm, leg, neck, weight, etc │
   │                                                         │
   │ 3. PATTERN CONTEXT (from embeddings)                    │
   │    ├── Product identity (garment type, description)      │
   │    ├── Fabric suggestions + difficulty from instructions  │
   │    ├── DXF piece dimensions (mm)                         │
   │    ├── Extended size chart (shoulder, sweep, slit, zip)   │
   │    └── Finished garment images (if URL accessible)       │
   │                                                         │
   │    → event: deterministic {size, fit, ease, profile,     │
   │                            chart data, has_dxf}          │
   │                                                         │
   │ 4. AI NARRATIVE (streamed, 3-8 seconds)                 │
   │    └── Anthropic Claude Sonnet 4.6                       │
   │        ├── System prompt: sizing expert persona           │
   │        ├── Full pattern data in prompt                    │
   │        ├── Images via vision API (verified first)         │
   │        ├── Fallback: Ollama → Gemini if no API key       │
   │        └── Structured sections: Why, Fit, Between,       │
   │            Adjustments, Garment Notes                     │
   │                                                         │
   │    → event: chunk (text tokens, streamed silently)       │
   │    → event: done                                         │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   RESULTS (visual components, not raw text)
        │
        ├── Size badge (from AI text, overrides deterministic)
        ├── Fit cards (bust/waist/hip with progress bars)
        ├── Narrative cards (parsed by ## headers into sections)
        ├── Expandable: finished measurements table
        ├── Expandable: body profile (MLP predictions)
        ├── Expandable: body size chart
        │
        ├──[optional]── Fine-tune preferences
        │   ├── Overall fit / per-area / length / fabric
        │   ├── Sends preferences + previous_recommendation
        │   ├── AI re-analyzes with FOLLOWUP_SYSTEM_PROMPT
        │   ├── Blur overlay + modal during processing
        │   └── Scrolls to top with updated results
        │
        ├── Lock size → Downloads
        │   ├── Single-size PDF (A0/A4/Letter)
        │   │   └── Python pikepdf color extraction
        │   │       7 CMYK colors → keeps only target + black + gray
        │   │
        │   └── Custom-fit pattern (Beta)
        │       ├── pattern-grading.server.ts → scale factors
        │       ├── Extracts single-size PDF first (color filter)
        │       ├── Scales with pdf-lib page.scaleContent()
        │       └── Downloads: A0 / A4 / US Letter
        │
        └── Measurements auto-saved to Supabase
```

---

## 4. Deterministic Size Matching

**File:** `src/lib/size-matching.server.ts`

```typescript
// Input
matchSize(bust: number, waist: number, hip: number, chart: PatternSizeChart)

// Scoring
score = bustDiff × 1.5 + waistDiff × 1.0 + hipDiff × 1.2  // lower = better

// Body chart empty? (common — many patterns only have finished measurements)
// → Match against finished chart instead
// → Penalize negative ease: bustDiff × 2.5 (can't wear dress smaller than body)

// Between sizes
if (scores[0] - scores[1] < 4) → betweenSizes = true

// Fit categories
tight:       diff < -2cm
exact:       -2 to +2cm
comfortable: +2 to +6cm
loose:       > +6cm

// Ease
ease = finished_measurement - body_measurement  // per size
// When no body chart: ease = finished_measurement - customer_body
```

---

## 5. MLP Body Profile Model

**File:** `src/lib/body-profile-predictor.server.ts`  
**Weights:** `src/lib/mlp-weights.json` (25MB)  
**Training:** `scripts/train-body-measurement.py` (PyTorch)

```
Input:  [height_cm, bust_cm, waist_cm, hip_cm]

Layer 0:  Linear(4, 512)    → GELU → BatchNorm(512)
Layer 4:  Linear(512, 1024)  → GELU → BatchNorm(1024)
Layer 8:  Linear(1024, 512)  → GELU → BatchNorm(512)
Layer 12: Linear(512, 256)   → GELU
Layer 14: Linear(256, 10)    → denormalize (output × std + mean)

Output: [bust, waist, hip, height, weight, arm_length,
         shoulder, neck, leg_length, arm_circ]
```

- Pure TypeScript inference — no Python/PyTorch at runtime
- PyTorch weight layout: `[out_features, in_features]`
- Trained on 59K subjects (NHANES + BodyM + Kaggle + synthetic)
- Weight/neck outputs validated (rejected if unrealistic)

---

## 6. AI Provider Chain

**File:** `src/lib/ai-size-intelligence.server.ts`

| Priority | Provider | Model | Env var |
|---|---|---|---|
| 1 | Anthropic | claude-sonnet-4-6 | `ANTHROPIC_API_KEY` |
| 2 | Ollama | gemma4:e4b (local) | `OLLAMA_URL`, `OLLAMA_MODEL` |
| 3 | Google | gemini-3-flash-preview | `GEMINI_API_KEY` |

The streaming endpoint (`stream/+server.ts`) always uses Anthropic directly (not the provider chain) because it needs SSE streaming. The provider chain is used by the non-streaming endpoint.

**Vision:** Finished garment images are sent via Anthropic's image content blocks (URL source). URLs are verified with HEAD requests first; if broken, the call retries without images.

---

## 7. Single-Size PDF Extraction

**File:** `scripts/extract-single-size.py`  
**Dependency:** pikepdf  
**Endpoint:** `GET /api/patterns/single-size?slug=X&size=M&format=a0`

Each of the 130 patterns uses the same 7 CMYK colors from Optitex:

| Size | Color | CMYK |
|---|---|---|
| XXS | Orange | (0.017, 0.441, 0.946, 0.000) |
| XS | Cyan | (0.572, 0.000, 0.115, 0.000) |
| S | Red | (0.000, 1.000, 1.000, 0.000) |
| M | Green | (0.813, 0.020, 0.980, 0.000) |
| L | Purple | (0.508, 0.805, 0.000, 0.000) |
| XL | Tan/Brown | (0.154, 0.328, 0.643, 0.001) |
| 2XL | Blue | (0.922, 0.892, 0.000, 0.000) |

The script parses PDF content streams, matches CMYK values (±0.02 tolerance), and removes all color commands for non-target sizes. Keeps: target size color + black (text, notches) + gray (seam allowance).

Cached in Supabase Storage at `{slug}/single-size/{size}/{format}.pdf`.

---

## 8. Custom-Fit Pattern Generation

**Files:** `pattern-grading.server.ts`, `pattern-files.server.ts`, `dxf-grader.server.ts`  
**Endpoint:** `POST /api/patterns/generate-custom`

1. `calculateGrading()` → finds closest standard size, computes scale factors
   - `scale_width = custom_bust_finished / sample_bust_finished`
   - `scale_height = custom_length / sample_length` (or `√scale_width`)
   - Confidence: high (<15%), medium (15-25%), low (>25%)

2. For PDFs: extracts single-size PDF first (color filter), then scales with `pdf-lib`
   - `page.scaleContent(scaleW, scaleH)` — scales all vector content
   - `page.setSize(newW, newH)` — adjusts page dimensions

3. For DXF: scales geometry coordinates around each block's center
   - Handles VERTEX, LINE, POINT, TEXT entities
   - Validation: re-parses output, checks every piece within ±1mm

---

## 9. Photo Body Estimation

**File:** `src/lib/body-measurement.ts` (client-side)  
**Page:** `/profile/measurements/photo`

- MediaPipe Pose Landmarker Heavy (5MB, GPU delegate)
- 33 pose landmarks from front-facing photo
- Height calibration: pixel-to-cm from nose-to-ankle distance
- Circumference: elliptical approximation `C = π√(2(a² + b²))`
- Depth ratio: 0.65 (default female), adjustable with side photo
- Accuracy: ±3-5cm

---

## 10. Environment Variables

```
RAILWAY_DATABASE_URL       # PostgreSQL connection string
ANTHROPIC_API_KEY          # Claude Sonnet 4.6
GEMINI_API_KEY             # Gemini 3 Flash (fallback)
OLLAMA_ENABLED             # true/false
OLLAMA_URL                 # http://localhost:11434
OLLAMA_MODEL               # gemma4:e4b
SUPABASE_SERVICE_KEY       # Admin access to storage
PUBLIC_SUPABASE_URL        # https://lahzrlyhojyfadjasdrc.supabase.co
PUBLIC_SUPABASE_ANON_KEY   # Browser auth
SHOPIFY_ACCESS_TOKEN       # Order matching for purchased patterns
```

---

## 11. Brand Design System

Defined in `src/app.css` using `@theme` directive:

```css
--color-rosys-500: #e8366d    /* Primary pink */
--color-rosys-fg: #1a1a1a     /* Text */
--color-rosys-fg-muted: #666  /* Secondary text */
--color-rosys-fg-faint: #999  /* Tertiary text */
--color-rosys-bg: warm-50     /* Page background */
--color-rosys-border: warm-200 /* Borders */
--color-rosys-card: #ffffff   /* Card background */
```

Component patterns:
- Cards: `rounded-2xl border-rosys-border/40 shadow-sm`
- Buttons: `bg-gradient-to-r from-rosys-500 to-rosys-600 rounded-2xl`
- Section labels: `text-[11px] font-semibold uppercase tracking-[0.1em] text-rosys-fg-faint`
- Glass: `backdrop-filter: saturate(180%) blur(20px)`
- Page transitions: `animation: fadeUp 0.3s ease-out`

---

## 12. Deployment

```bash
# Build and deploy
vercel build --prod
vercel deploy --prebuilt --prod --yes

# Or push to main (auto-deploy via GitHub integration)
git push origin main
```

The project uses `@sveltejs/adapter-vercel`. Python scripts (pikepdf) need Python 3 available on the build machine — Vercel's Node.js functions can call them via `child_process.exec`.

---

## 13. Reference Project (rosys-app)

The original React SPA lives at `/Users/dr.contexter/projects/rosys-app` (repo: `MichaelSRLY/rosys-app`). We are migrating features from it to this SvelteKit platform. When building new features, check rosys-app first — it may already have the logic, database queries, or UI patterns you need.

| Aspect | rosys-app (React SPA) | rosys-platform (SvelteKit) |
|---|---|---|
| **Path** | `/Users/dr.contexter/projects/rosys-app` | `/Users/dr.contexter/projects/rosys-platform` |
| **Framework** | React 18 + Vite + Zustand | SvelteKit 5 + Tailwind 4 |
| **Deploy** | `rosyspatterns.vercel.app` | `platform-rosys.vercel.app` |
| **Store** | `src/store.ts` (Zustand) | SvelteKit server loaders + `$state` |
| **AI** | OpenAI GPT-4o (client-side, `dangerouslyAllowBrowser`) | Anthropic/Ollama/Gemini (server-side, streaming SSE) |
| **Auth** | Supabase (same project `lahzrlyhojyfadjasdrc`) | Supabase (same project) |

**What to look at in rosys-app:**
- `src/components/Magazine.tsx` (~4k lines) — magazine viewer, comments, likes, downloads, Instagram previews
- `src/components/Login.tsx` — registration flow with community key `Community2025`
- `src/store.ts` — Zustand store with all Supabase queries (comments, likes, sessions, page_views, downloads, interactions, voting)
- `src/components/SizeAssistant.tsx` — old sizing UI (OpenAI-based, do NOT use — the platform version is far superior)
- `src/lib/tracking.ts` — analytics tracking helpers

**Shared infrastructure (same Supabase project):**
Both apps read/write the same Supabase tables (profiles, comments, likes, sessions, etc.) and the same Supabase Storage buckets. Database schema changes affect both apps.

**rosys-app CLAUDE.md:** `/Users/dr.contexter/projects/rosys-app/CLAUDE.md` has deployment instructions and patterns for the React SPA.

---

## 14. Key Gotchas

1. **Body chart can be empty** — many patterns only have finished measurements. The size matcher detects this and switches to finished-chart matching with negative-ease penalty.

2. **AI overrides deterministic** — the size badge shows whichever size the AI recommends (extracted from streamed text), not the deterministic match. This is intentional — the AI sees more context.

3. **Finished images may 404** — some image URLs in `cs_pattern_embeddings` are stale. The streaming endpoint verifies URLs with HEAD requests and retries without images if they fail.

4. **MLP weights are 25MB** — loaded once, cached in memory. First request may be slow.

5. **pikepdf needs Python 3** — the single-size extraction script runs via `child_process`. On Vercel, this may not be available. The custom-fit flow checks the Supabase cache first (populated by the regular single-size download endpoint).

6. **`measurement_profiles` is in Supabase** (same project as auth), not Railway. The sizing page auto-saves measurements on analysis, auto-loads on next visit.

7. **Follow-up re-analysis sends `previous_recommendation`** — the full text of the first AI response, so the second call has context. Without this, the AI can't say "what changed."
