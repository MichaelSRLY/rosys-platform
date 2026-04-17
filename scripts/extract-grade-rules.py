#!/usr/bin/env python3
"""
Extract per-vertex grade rules from multi-size A0 PDFs.

For each pattern, parses all size layers from the A0 PDF, extracts piece
coordinates at each size, and computes per-vertex deltas between adjacent sizes.
These grade rules enable real digital grading — extrapolating beyond the
standard size range with geometrically correct piece shapes.

Usage:
  # Single pattern
  python3 scripts/extract-grade-rules.py 3_lena_dress

  # All patterns
  python3 scripts/extract-grade-rules.py --all

  # Dry run (no DB write)
  python3 scripts/extract-grade-rules.py 3_lena_dress --dry-run

  # Verbose (show per-piece details)
  python3 scripts/extract-grade-rules.py 3_lena_dress --verbose
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

import pikepdf

# ─── Credentials ───

def get_secret(name):
    return subprocess.run(["pass", name], capture_output=True, text=True).stdout.strip()

PROJECT_ID = get_secret("supabase/rosys-app/project-id")
SERVICE_KEY = get_secret("supabase/rosys-app/secret-key")
DB_URL = get_secret("rosyspatterns/railway-database-url")
SUPABASE_URL = f"https://{PROJECT_ID}.supabase.co"

# ─── Supabase helpers ───

def supabase_list(prefix, limit=50):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/list/pattern-files",
        data=json.dumps({"prefix": prefix, "limit": limit}).encode(),
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
                 "Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req).read())

def supabase_download(path, dest):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/pattern-files/{urllib.request.quote(path, safe='/')}",
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    )
    with urllib.request.urlopen(req) as resp, open(dest, 'wb') as f:
        f.write(resp.read())

def psql_json(query):
    r = subprocess.run(
        ["psql", DB_URL, "-t", "-A", "-c", f"SELECT json_agg(t) FROM ({query}) t;"],
        capture_output=True, text=True
    )
    raw = r.stdout.strip()
    return json.loads(raw) if raw and raw != "" else []

def psql_exec(query):
    r = subprocess.run(
        ["psql", DB_URL, "-c", query],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print(f"  DB ERROR: {r.stderr.strip()}")
    return r.returncode == 0

# ─── PDF parsing ───

ALL_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
SIZE_NAMES = {s.upper() for s in ALL_SIZES}
SIZE_ORDER = {s: i for i, s in enumerate(ALL_SIZES)}

PIECE_RE = re.compile(r'^q\s+1\s+0\s+0\s+1\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+cm$')
MOVE_RE = re.compile(r'([\d.eE+-]+)\s+([\d.eE+-]+)\s+m')
LINE_RE = re.compile(r'([\d.eE+-]+)\s+([\d.eE+-]+)\s+l')
CURVE_RE = re.compile(r'([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+c')


def get_mc_to_size_map(page):
    """Map /MCn references to size names."""
    props = page.get('/Resources', pikepdf.Dictionary()).get('/Properties', pikepdf.Dictionary())
    mc_map = {}
    for mc_key in props.keys():
        mc_name = str(mc_key).lstrip('/')
        try:
            ocg_name = str(props[mc_key].get('/Name', ''))
            if ocg_name.upper() in SIZE_NAMES:
                mc_map[mc_name] = ocg_name.upper()
        except Exception:
            pass
    return mc_map


def extract_path_coords(piece_lines):
    """Extract ordered (x, y) coordinates from piece path data.

    Returns list of (x, y, op_type) tuples where op_type is 'm', 'l', or 'c'.
    For curves, returns all 3 point pairs (cp1, cp2, endpoint).
    """
    coords = []
    for pl in piece_lines:
        s = pl.strip()
        # Parse each line — operators appear one per line in Optitex PDFs
        cm = CURVE_RE.match(s)
        if cm:
            coords.append((float(cm.group(1)), float(cm.group(2)), 'c1'))
            coords.append((float(cm.group(3)), float(cm.group(4)), 'c2'))
            coords.append((float(cm.group(5)), float(cm.group(6)), 'c3'))
            continue
        mm = MOVE_RE.match(s)
        if mm:
            coords.append((float(mm.group(1)), float(mm.group(2)), 'm'))
            continue
        lm = LINE_RE.match(s)
        if lm:
            coords.append((float(lm.group(1)), float(lm.group(2)), 'l'))
            continue
    return coords


def extract_pieces_from_page(lines, target_mc):
    """Extract piece geometry for a specific MC reference from one page's content stream.

    Returns list of {'anchor': (x,y), 'coords': [(x,y,op), ...]} in source order.
    """
    pieces = []
    in_target = False
    in_piece = False
    q_depth = 0
    piece_lines = []
    anchor = (0.0, 0.0)

    for line in lines:
        s = line.strip()

        # Detect BDC for this specific MC reference
        if f'/{target_mc} BDC' in s or (s.endswith('BDC') and f'/{target_mc} ' in s):
            in_target = True
            continue

        if s == 'EMC' and in_target:
            if in_piece:
                coords = extract_path_coords(piece_lines)
                pieces.append({'anchor': anchor, 'coords': coords})
                in_piece = False
            in_target = False
            continue

        if in_target and not in_piece:
            m = PIECE_RE.match(s)
            if m:
                anchor = (float(m.group(1)), float(m.group(2)))
                in_piece = True
                q_depth = 1
                piece_lines = []
                continue

        if in_target and in_piece:
            if s.startswith('q'):
                q_depth += 1
            elif s == 'Q':
                q_depth -= 1
                if q_depth == 0:
                    coords = extract_path_coords(piece_lines)
                    pieces.append({'anchor': anchor, 'coords': coords})
                    in_piece = False
                    continue
            piece_lines.append(line)

    return pieces


def extract_all_sizes(pdf_path):
    """Extract piece geometry for every size layer across ALL pages of a multi-size PDF.

    Pieces are concatenated in page order — page 0 pieces first, then page 1, etc.
    Each piece is tagged with its source page number.

    For single-page PDFs this produces the same output as the original implementation
    (minus the new 'page' key on each piece, which is always 0).

    Returns: {size_name: [{'anchor': (x,y), 'coords': [...], 'page': int}, ...]}
    """
    pdf = pikepdf.open(pdf_path)
    size_data = {}  # {size: [pieces]}

    for page_num, page in enumerate(pdf.pages):
        mc_map = get_mc_to_size_map(page)
        if not mc_map:
            continue

        # Get content stream for this page
        page.contents_coalesce()
        raw = page['/Contents'].read_bytes()
        lines = raw.decode('latin-1').split('\n')

        for target_mc, size_name in mc_map.items():
            pieces_on_page = extract_pieces_from_page(lines, target_mc)

            # Tag each piece with source page
            for p in pieces_on_page:
                p['page'] = page_num

            if size_name not in size_data:
                size_data[size_name] = []
            size_data[size_name].extend(pieces_on_page)

    pdf.close()
    return size_data


def compute_grade_rules(size_data, verbose=False):
    """Compute per-vertex grade deltas from size data.

    Returns: (grade_rules_dict, validation_max_error, all_consistent)
    """
    # Sort sizes by standard order
    sizes = sorted(size_data.keys(), key=lambda s: SIZE_ORDER.get(s, 99))

    if len(sizes) < 2:
        return None, None, False

    base_size = sizes[0]
    base_pieces = size_data[base_size]
    piece_count = len(base_pieces)

    # Verify all sizes have same piece count
    for size in sizes:
        if len(size_data[size]) != piece_count:
            print(f"  WARNING: {size} has {len(size_data[size])} pieces, expected {piece_count}")
            return None, None, False

    all_consistent = True
    max_error = 0.0
    pieces_rules = []

    for pi in range(piece_count):
        base_piece = size_data[base_size][pi]
        base_anchor = list(base_piece['anchor'])
        base_coords = [(c[0], c[1]) for c in base_piece['coords']]
        base_ops = [c[2] for c in base_piece['coords']]
        base_count = len(base_coords)

        # Check vertex count consistency across all sizes
        consistent = True
        for size in sizes:
            sc = len(size_data[size][pi]['coords'])
            if sc != base_count:
                consistent = False
                all_consistent = False
                if verbose:
                    print(f"  Piece {pi}: vertex count mismatch — {base_size}={base_count}, {size}={sc}")

        # Compute anchor deltas and coord deltas for each size step
        anchor_deltas = []
        coord_deltas = []

        for si in range(len(sizes) - 1):
            s1, s2 = sizes[si], sizes[si + 1]
            p1 = size_data[s1][pi]
            p2 = size_data[s2][pi]

            # Anchor delta
            adx = p2['anchor'][0] - p1['anchor'][0]
            ady = p2['anchor'][1] - p1['anchor'][1]
            anchor_deltas.append([round(adx, 4), round(ady, 4)])

            # Coordinate deltas — only if counts match
            c1 = [(c[0], c[1]) for c in p1['coords']]
            c2 = [(c[0], c[1]) for c in p2['coords']]

            if len(c1) == len(c2):
                deltas = []
                for k in range(len(c1)):
                    dx = c2[k][0] - c1[k][0]
                    dy = c2[k][1] - c1[k][1]
                    deltas.append([round(dx, 4), round(dy, 4)])
                coord_deltas.append(deltas)
            else:
                # For mismatched counts, store None — will use proportional scaling for this step
                coord_deltas.append(None)

        # Validation: reconstruct each size from base + accumulated deltas
        for si in range(1, len(sizes)):
            target = sizes[si]
            target_piece = size_data[target][pi]
            target_coords = [(c[0], c[1]) for c in target_piece['coords']]

            # Reconstruct from base
            reconstructed_anchor = [base_anchor[0], base_anchor[1]]
            for step in range(si):
                reconstructed_anchor[0] += anchor_deltas[step][0]
                reconstructed_anchor[1] += anchor_deltas[step][1]

            # Check anchor error
            actual_anchor = target_piece['anchor']
            anchor_err = math.sqrt(
                (reconstructed_anchor[0] - actual_anchor[0])**2 +
                (reconstructed_anchor[1] - actual_anchor[1])**2
            )
            max_error = max(max_error, anchor_err)

            # Check coordinate reconstruction (only for consistent pieces)
            if consistent and all(d is not None for d in coord_deltas[:si]):
                reconstructed = list(base_coords)
                for step in range(si):
                    for k in range(len(reconstructed)):
                        reconstructed[k] = (
                            reconstructed[k][0] + coord_deltas[step][k][0],
                            reconstructed[k][1] + coord_deltas[step][k][1]
                        )

                for k in range(min(len(reconstructed), len(target_coords))):
                    err = math.sqrt(
                        (reconstructed[k][0] - target_coords[k][0])**2 +
                        (reconstructed[k][1] - target_coords[k][1])**2
                    )
                    max_error = max(max_error, err)

        piece_rule = {
            'index': pi,
            'page': base_piece.get('page', 0),
            'vertex_count': base_count,
            'consistent': consistent,
            'base_anchor': [round(base_anchor[0], 4), round(base_anchor[1], 4)],
            'anchor_deltas': anchor_deltas,
            'base_coords': [[round(c[0], 4), round(c[1], 4)] for c in base_coords],
            'base_ops': base_ops,
            'coord_deltas': coord_deltas,
        }

        # For inconsistent pieces, also store per-size coordinate snapshots
        if not consistent:
            per_size_coords = {}
            for size in sizes:
                sc = size_data[size][pi]['coords']
                per_size_coords[size] = [[round(c[0], 4), round(c[1], 4)] for c in sc]
            piece_rule['per_size_coords'] = per_size_coords

        pieces_rules.append(piece_rule)

        if verbose:
            avg_adx = sum(d[0] for d in anchor_deltas) / len(anchor_deltas) if anchor_deltas else 0
            avg_ady = sum(d[1] for d in anchor_deltas) / len(anchor_deltas) if anchor_deltas else 0
            tag = '✓' if consistent else f'✗ variable'
            print(f"  Piece {pi}: {base_count} coords, avg anchor Δ=({avg_adx:+.2f}, {avg_ady:+.2f}) {tag}")

    grade_rules = {
        'sizes': sizes,
        'base_size': base_size,
        'piece_count': piece_count,
        'pieces': pieces_rules,
    }

    return grade_rules, round(max_error, 4), all_consistent


def find_a0_pdf(slug):
    """Find A0 PDF path in Supabase storage."""
    for prefix in [f"{slug}/a0", f"{slug}/a0 "]:
        try:
            files = supabase_list(prefix)
            pdf_files = [f for f in files if f.get("name", "").endswith(".pdf")]
            if pdf_files:
                return f"{prefix}/{pdf_files[0]['name']}"
        except Exception:
            continue
    return None


def process_pattern(slug, dry_run=False, verbose=False):
    """Extract grade rules for a single pattern and store in DB."""
    print(f"\n{'─'*60}")
    print(f"Processing: {slug}")

    # 1. Find and download A0 PDF
    a0_path = find_a0_pdf(slug)
    if not a0_path:
        print(f"  SKIP: No A0 PDF found")
        return 'no_pdf'

    tmp = tempfile.mktemp(suffix='.pdf')
    try:
        print(f"  Downloading: {a0_path}")
        supabase_download(a0_path, tmp)

        # 2. Extract all size layers
        print(f"  Parsing size layers...")
        size_data = extract_all_sizes(tmp)

        if not size_data:
            print(f"  SKIP: No size layers found in PDF")
            return 'no_layers'

        sizes = sorted(size_data.keys(), key=lambda s: SIZE_ORDER.get(s, 99))
        piece_counts = {s: len(size_data[s]) for s in sizes}
        print(f"  Found {len(sizes)} sizes: {', '.join(sizes)}")
        print(f"  Pieces per size: {piece_counts}")

        # 3. Compute grade rules
        print(f"  Computing grade rules...")
        grade_rules, max_error, all_consistent = compute_grade_rules(size_data, verbose=verbose)

        if grade_rules is None:
            print(f"  SKIP: Could not compute grade rules")
            return 'compute_fail'

        consistency_tag = '✓ all consistent' if all_consistent else '⚠ some pieces have variable vertex counts'
        print(f"  {consistency_tag}")
        print(f"  Validation max error: {max_error:.4f} pt ({max_error * 0.3528:.4f} mm)")

        if max_error > 0.5:
            print(f"  WARNING: Reconstruction error exceeds 0.5pt threshold!")

        # 4. Store in database
        if dry_run:
            print(f"  DRY RUN: Would store {len(grade_rules['pieces'])} piece rules")
            # Print summary
            data_size = len(json.dumps(grade_rules))
            print(f"  Data size: {data_size:,} bytes")
            return 'dry_run_ok'

        sizes_sql = "ARRAY[" + ",".join(f"'{s}'" for s in sizes) + "]"
        grade_json = json.dumps(grade_rules).replace("'", "''")

        ok = psql_exec(f"""
            INSERT INTO cs_pattern_grade_rules
                (pattern_slug, sizes, base_size, piece_count, grade_data,
                 vertex_counts_consistent, validation_max_error_pt)
            VALUES
                ('{slug}', {sizes_sql}, '{sizes[0]}', {len(grade_rules['pieces'])},
                 '{grade_json}'::jsonb, {str(all_consistent).lower()}, {max_error})
            ON CONFLICT (pattern_slug) DO UPDATE SET
                sizes = EXCLUDED.sizes,
                base_size = EXCLUDED.base_size,
                piece_count = EXCLUDED.piece_count,
                grade_data = EXCLUDED.grade_data,
                vertex_counts_consistent = EXCLUDED.vertex_counts_consistent,
                validation_max_error_pt = EXCLUDED.validation_max_error_pt,
                created_at = NOW()
        """)

        if ok:
            print(f"  ✓ Stored in database")
            return 'ok'
        else:
            return 'db_error'

    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def get_all_pattern_slugs():
    """Get all pattern slugs from the catalog."""
    rows = psql_json("SELECT pattern_slug FROM cs_pattern_catalog ORDER BY pattern_slug")
    return [r['pattern_slug'] for r in rows] if rows else []


def main():
    parser = argparse.ArgumentParser(description="Extract grade rules from multi-size A0 PDFs")
    parser.add_argument("slug", nargs='?', help="Pattern slug (e.g., 3_lena_dress)")
    parser.add_argument("--all", action="store_true", help="Process all patterns")
    parser.add_argument("--dry-run", action="store_true", help="Parse but don't write to DB")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show per-piece details")
    args = parser.parse_args()

    if not args.slug and not args.all:
        parser.error("Provide a pattern slug or use --all")

    if args.all:
        slugs = get_all_pattern_slugs()
        print(f"Processing {len(slugs)} patterns...")
    else:
        slugs = [args.slug]

    results = {'ok': 0, 'no_pdf': 0, 'no_layers': 0, 'compute_fail': 0,
               'db_error': 0, 'dry_run_ok': 0, 'error': 0}

    for slug in slugs:
        try:
            result = process_pattern(slug, dry_run=args.dry_run, verbose=args.verbose)
            results[result] = results.get(result, 0) + 1
        except Exception as e:
            print(f"  ERROR: {e}")
            results['error'] += 1

    print(f"\n{'='*60}")
    print(f"RESULTS:")
    for k, v in results.items():
        if v > 0:
            print(f"  {k}: {v}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
