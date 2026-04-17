# New Pattern Pipeline — What Must Happen When Adding a Pattern

This document describes **every processing step** required when a new sewing pattern is added to the Rosys Patterns platform. An automation agent building this pipeline must implement all steps in order.

## Overview

When Rosa creates a new pattern, she provides:
- **Multi-size A0 PDF** — all sizes (XXS–2XL) as OCG layers on a single A0 sheet
- **A4 tiled PDF** — same content tiled for home printers
- **US Letter tiled PDF** — same content tiled for US Letter paper
- **DXF file** — single-size (sample size, typically XS) CAD file from Optitex
- **Finished garment size chart** — measurements per size (bust, waist, hip, length, etc.)
- **Sewing instructions** — text + illustrations
- **Finished garment photos** — front/back images
- **(Optional)** YouTube tutorial link

## Step-by-Step Pipeline

### 1. Upload Pattern Files to Supabase Storage

**Bucket:** `pattern-files`  
**Structure:**
```
{pattern_slug}/
├── a0/a0.pdf              # Multi-size A0 PDF
├── a4/a4.pdf              # A4 tiled PDF
├── us_letter/us_letter.pdf # US Letter tiled PDF
├── dxf/{pattern_name}.dxf  # Single-size DXF (Optitex format)
└── finished_{name}_images/  # Product photos
```

**Pattern slug format:** `{number}_{name_in_snake_case}` (e.g., `131_emma_dress`)

### 2. Create Catalog Entry

**Table:** `cs_pattern_catalog` (Railway PostgreSQL)

```sql
INSERT INTO cs_pattern_catalog (pattern_slug, pattern_name, category, ...)
VALUES ('131_emma_dress', 'Emma Dress', 'dress', ...);
```

### 3. Populate Size Charts

**Table:** `cs_pattern_size_charts`  
**Script:** `scripts/populate-size-charts.py`  
**Source:** Rosa's size chart (xlsx or text from instructions)

Only `chart_type = 'finished'` is needed. Body chart is NOT used (was removed April 2026).

```sql
INSERT INTO cs_pattern_size_charts
  (pattern_slug, chart_type, size, bust_cm, waist_cm, hip_cm, shoulder_cm,
   sleeve_length_cm, full_length_cm, bottom_sweep_cm, zipper_length_cm, extra_measurements)
VALUES
  ('131_emma_dress', 'finished', 'XXS', 82, 68, 88, ...),
  ('131_emma_dress', 'finished', 'XS', 86, 72, 92, ...),
  -- ... one row per size
```

**Critical:** These measurements are the **finished garment dimensions** (what the garment measures when sewn), NOT body measurements. The system adds standard ease (bust +5cm, waist +4cm, hip +4cm) to customer body measurements before comparing against this chart.

### 4. Create Embeddings for Vector Store

**Table:** `cs_pattern_embeddings`  
**Chunk types to create:**

| chunk_type | Content | Source |
|---|---|---|
| `instructions_text` | Full sewing instructions | Instructions PDF/text |
| `product_identity` | Garment type description ("Sleeveless dress, square neck") | Manual or AI-generated |
| `dxf_pattern_piece` | DXF piece dimensions + metadata. **Must include `sample_size` in metadata JSON** | Parsed from DXF |
| `size_chart_text` | Raw size measurement table as text | Size chart |
| `size_chart_image` | Size chart as image (for visual RAG) | Screenshot |
| `finished_image` | Finished garment photos with `image_url` in metadata | Product photos |
| `instruction_illustration` | Sewing step illustrations | Instructions PDF |
| `youtube_tutorial` | Video tutorial link | YouTube URL |
| `a0_pattern_page` | A0 layout page thumbnail | A0 PDF page 1 |

**Critical metadata for `dxf_pattern_piece`:**
```json
{
  "sample_size": "XS",  // ← MUST be set correctly. This is the DXF's size.
  "piece_count": 6,
  "pieces": [...]
}
```

The `sample_size` field is read by `pattern-grading.server.ts` to determine the DXF baseline for scaling. If wrong, all custom-fit calculations are wrong.

### 5. Extract Grade Rules from Multi-Size PDF

**Table:** `cs_pattern_grade_rules`  
**Script:** `scripts/extract-grade-rules.py`

```bash
python3 scripts/extract-grade-rules.py {pattern_slug}
```

This script:
1. Downloads the A0 PDF from Supabase
2. Parses all OCG size layers (XXS–2XL)
3. Extracts per-vertex coordinates for each piece at each size
4. Computes per-vertex deltas between adjacent sizes
5. Validates by reconstructing each size from base + deltas
6. Stores the grade rules in `cs_pattern_grade_rules`

**What it produces:** A JSON blob with per-piece, per-vertex grade deltas that enable real digital grading beyond the standard size range. Without this, the pattern is limited to 4% uniform scaling.

**Expected output:** 0.0000pt reconstruction error for well-formed Optitex PDFs.

**Failure modes:**
- No A0 PDF → skip (pattern won't have grade rules, falls back to 4% cap)
- No OCG layers → skip (single-size PDF, no grading data)
- Piece count mismatch between sizes → skip (rare, ~5/130 patterns)
- These failures are non-blocking — the pattern still works with standard sizing

### 6. Generate Single-Size Cache (Optional, On-Demand)

**Script:** `scripts/extract-single-size.py`  
**Cache location:** `{slug}/single-size/{size}/{format}.pdf` in Supabase

When a customer first requests a specific size, the system extracts that size from the multi-size PDF and caches it. This is automatic and doesn't need to be done upfront.

## Processing Order

The steps MUST run in this order (dependencies):

```
1. Upload files to Supabase Storage
   ↓
2. Create catalog entry (needed by all DB references)
   ↓
3. Populate size charts (needed by grading engine + AI assistant)
   ↓
4. Create embeddings (needs files in storage + catalog entry)
   ↓
5. Extract grade rules (needs A0 PDF in storage)
```

Steps 3, 4, and 5 can run in parallel after step 2.

## Validation Checklist

After running the pipeline for a new pattern, verify:

- [ ] `cs_pattern_catalog` has an entry for the slug
- [ ] `cs_pattern_size_charts` has `finished` rows for all sizes (typically 7: XXS–2XL)
- [ ] `cs_pattern_embeddings` has at least `instructions_text`, `product_identity`, `dxf_pattern_piece`, and `size_chart_text` chunks
- [ ] `cs_pattern_embeddings` → `dxf_pattern_piece` metadata has correct `sample_size`
- [ ] `cs_pattern_grade_rules` has an entry (check `validation_max_error_pt = 0`)
- [ ] Supabase storage has files in `a0/`, `a4/`, `us_letter/`, `dxf/` folders
- [ ] The AI size assistant can find and discuss the pattern (test with a size query)

## Database Connection

**Railway PostgreSQL:** Credentials stored in `pass` at `rosyspatterns/railway-database-url`  
**Supabase:** Project ID at `supabase/rosys-app/project-id`, service key at `supabase/rosys-app/secret-key`

## File Locations

| File | Purpose |
|---|---|
| `scripts/extract-grade-rules.py` | Grade rule extraction |
| `scripts/populate-size-charts.py` | Size chart population |
| `scripts/grade-pattern.py` | DXF grading (CLI tool) |
| `scripts/extract-single-size.py` | Single-size PDF extraction |
| `scripts/scale-pattern.py` | PDF scaling (4% system) |
| `scripts/grade-pattern-pdf.py` | PDF grading with grade rules (new) |
| `src/lib/pattern-grading.server.ts` | Grading calculation engine |
| `src/lib/size-matching.server.ts` | Deterministic size matching |
| `src/lib/grade-rules.server.ts` | Grade rules loader + target computation |
| `src/lib/dxf-grader-rules.server.ts` | DXF grading with per-piece rules |
| `src/lib/dxf-grader.server.ts` | DXF uniform scaling (existing) |
| `src/lib/pattern-files.server.ts` | File download + generation orchestration |

## Key Constants

```
Standard ease (body → finished): bust +5cm, waist +4cm, hip +4cm
Standard sizes: XXS, XS, S, M, L, XL, 2XL (some patterns have 3XL–5XL)
Uniform scale cap: 4% (for patterns without grade rules)
Grade rule extrapolation: recommended max 3 size steps beyond largest standard
DXF sample size: typically XS (check metadata per pattern)
PDF coordinate system: points (1pt = 0.3528mm)
DXF coordinate system: millimeters
```
