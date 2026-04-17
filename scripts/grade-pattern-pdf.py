#!/usr/bin/env python3
"""
Grade a sewing pattern PDF using per-vertex grade rules.

Unlike uniform scaling (scale-pattern.py which modifies the q cm transform),
this script modifies the actual m/l/c path coordinates inside each piece.
Each vertex moves independently according to Rosa's original grading — producing
geometrically correct patterns for any custom size.

Works on all formats: A0 (single page), A4, US Letter (multi-page tiled).

Usage:
  # From grade rules JSON (offline)
  python3 scripts/grade-pattern-pdf.py input.pdf --rules rules.json --steps 1.5 --size 2XL -o output.pdf

  # From database (online)
  python3 scripts/grade-pattern-pdf.py input.pdf --slug 3_lena_dress --bust 130 --waist 107 --hip 125 -o output.pdf

  # Server mode: called by pattern-files.server.ts
  python3 scripts/grade-pattern-pdf.py input.pdf --rules-json '<json>' --steps 1.7 --size 2XL -o output.pdf
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys

import pikepdf

ALL_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
SIZE_NAMES = {s.upper() for s in ALL_SIZES}
SIZE_ORDER = {s: i for i, s in enumerate(ALL_SIZES)}

PIECE_RE = re.compile(r'^q\s+1\s+0\s+0\s+1\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+cm$')
MOVE_RE = re.compile(r'^([\d.eE+-]+)\s+([\d.eE+-]+)\s+m$')
LINE_RE = re.compile(r'^([\d.eE+-]+)\s+([\d.eE+-]+)\s+l$')
CURVE_RE = re.compile(r'^([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+c$')


def compute_target_from_rules(grade_data, steps_beyond, per_piece_steps=None):
    """Compute target piece coordinates by extrapolating grade rules.

    If per_piece_steps is provided (list of floats, one per piece), each piece
    uses its own step count. This enables selective adjustment — bodice pieces
    get bust-driven steps, skirt pieces get hip-driven steps.

    Returns list of {'anchor': (x,y), 'coords': [(x,y), ...]} per piece.
    """
    sizes = grade_data['sizes']
    num_steps = len(sizes) - 1
    avg_window = min(3, num_steps)
    start_step = num_steps - avg_window

    targets = []

    for pi, piece in enumerate(grade_data['pieces']):
        # Reconstruct largest size anchor
        anchor = list(piece['base_anchor'])
        for s in range(num_steps):
            anchor[0] += piece['anchor_deltas'][s][0]
            anchor[1] += piece['anchor_deltas'][s][1]

        # Reconstruct largest size coordinates
        if piece['consistent'] and all(d is not None for d in piece['coord_deltas']):
            coords = [list(c) for c in piece['base_coords']]
            for s in range(num_steps):
                deltas = piece['coord_deltas'][s]
                for k in range(len(coords)):
                    coords[k][0] += deltas[k][0]
                    coords[k][1] += deltas[k][1]
        elif piece.get('per_size_coords') and sizes[-1] in piece['per_size_coords']:
            coords = [list(c) for c in piece['per_size_coords'][sizes[-1]]]
        else:
            coords = [list(c) for c in piece['base_coords']]

        # Average delta from last few steps
        avg_anchor_d = [0.0, 0.0]
        for s in range(start_step, num_steps):
            avg_anchor_d[0] += piece['anchor_deltas'][s][0]
            avg_anchor_d[1] += piece['anchor_deltas'][s][1]
        avg_anchor_d[0] /= avg_window
        avg_anchor_d[1] /= avg_window

        # Per-piece step count (blended) or global fallback
        piece_steps = per_piece_steps[pi] if per_piece_steps and pi < len(per_piece_steps) else steps_beyond

        # Extrapolate anchor
        target_anchor = (
            anchor[0] + avg_anchor_d[0] * piece_steps,
            anchor[1] + avg_anchor_d[1] * piece_steps
        )

        # Extrapolate coordinates
        if piece['consistent'] and all(d is not None for d in piece['coord_deltas']):
            avg_deltas = [[0.0, 0.0] for _ in coords]
            for s in range(start_step, num_steps):
                deltas = piece['coord_deltas'][s]
                for k in range(len(avg_deltas)):
                    avg_deltas[k][0] += deltas[k][0]
                    avg_deltas[k][1] += deltas[k][1]
            for k in range(len(avg_deltas)):
                avg_deltas[k][0] /= avg_window
                avg_deltas[k][1] /= avg_window

            target_coords = [
                (coords[k][0] + avg_deltas[k][0] * piece_steps,
                 coords[k][1] + avg_deltas[k][1] * piece_steps)
                for k in range(len(coords))
            ]
        else:
            # Uniform scale fallback for inconsistent pieces
            xs = [c[0] for c in coords]
            ys = [c[1] for c in coords]
            if xs:
                bw = max(xs) - min(xs)
                scale = 1 + (abs(avg_anchor_d[0]) * piece_steps / bw) if bw > 0 else 1
                cx = (min(xs) + max(xs)) / 2
                cy = (min(ys) + max(ys)) / 2
                target_coords = [
                    (cx + (c[0] - cx) * scale, cy + (c[1] - cy) * scale)
                    for c in coords
                ]
            else:
                target_coords = [(c[0], c[1]) for c in coords]

        targets.append({
            'anchor': target_anchor,
            'coords': target_coords,
            'ops': piece.get('base_ops', [])
        })

    return targets


def toggle_ocg_layers(pdf, target_size):
    """Toggle OCG layers: keep target size + non-size layers ON, others OFF."""
    oc_props = pdf.Root.get('/OCProperties')
    if not oc_props:
        return

    ocgs = list(oc_props['/OCGs'])
    keep_on, turn_off = [], []

    for ocg in ocgs:
        name = str(ocg.get('/Name', ''))
        if name.upper() in SIZE_NAMES and name.upper() != target_size.upper():
            turn_off.append(ocg)
        else:
            keep_on.append(ocg)

    d = oc_props.get('/D', pikepdf.Dictionary())
    d['/ON'] = pikepdf.Array(keep_on)
    d['/OFF'] = pikepdf.Array(turn_off)
    d['/BaseState'] = pikepdf.Name('/OFF')
    d['/Name'] = pikepdf.String(f'Graded from {target_size}')
    d['/AS'] = pikepdf.Array([
        pikepdf.Dictionary({'/Event': pikepdf.Name(e), '/OCGs': pikepdf.Array(keep_on),
                            '/Category': pikepdf.Array([pikepdf.Name(e)])})
        for e in ['/View', '/Print', '/Export']
    ])
    d['/Locked'] = pikepdf.Array(turn_off)
    d['/ListMode'] = pikepdf.Name('/VisiblePages')
    oc_props['/D'] = d
    pdf.Root['/OCProperties'] = oc_props

    for ocg in turn_off:
        ocg['/Usage'] = pikepdf.Dictionary({
            '/Print': pikepdf.Dictionary({'/PrintState': pikepdf.Name('/OFF')}),
            '/View': pikepdf.Dictionary({'/ViewState': pikepdf.Name('/OFF')}),
            '/Export': pikepdf.Dictionary({'/ExportState': pikepdf.Name('/OFF')}),
        })
    for ocg in keep_on:
        ocg['/Usage'] = pikepdf.Dictionary({
            '/Print': pikepdf.Dictionary({'/PrintState': pikepdf.Name('/ON')}),
            '/View': pikepdf.Dictionary({'/ViewState': pikepdf.Name('/ON')}),
            '/Export': pikepdf.Dictionary({'/ExportState': pikepdf.Name('/ON')}),
        })


def grade_page(page, target_size, targets, verbose=False, page_num=0, debug=False, piece_idx_start=0):
    """Apply per-vertex grade rules to a single PDF page.

    Modifies actual m/l/c coordinates inside the target size layer,
    and updates piece anchor transforms. Layer 1 is untouched.

    piece_idx_start — starting index into the global targets list. Pieces on this
    page consume targets[piece_idx_start:]. Returns (graded_count, next_piece_idx)
    so the caller can advance across pages.
    """
    page.contents_coalesce()
    raw = page['/Contents'].read_bytes()
    content = raw.decode('latin-1')
    lines = content.split('\n')
    if debug:
        print(f"\n[DEBUG page {page_num}] {len(lines)} content lines, targets[{piece_idx_start}:{len(targets)}] available")

    # Find MC references
    props = page.get('/Resources', pikepdf.Dictionary()).get('/Properties', pikepdf.Dictionary())
    size_mc_refs = set()
    target_mc = None
    for mc_key in props.keys():
        mc_name = str(mc_key).lstrip('/')
        try:
            ocg_name = str(props[mc_key].get('/Name', '')).upper()
            if ocg_name in SIZE_NAMES:
                size_mc_refs.add(mc_name)
            if ocg_name == target_size.upper():
                target_mc = mc_name
        except Exception:
            pass

    if not target_mc:
        if verbose:
            print(f"  Page: no target MC for {target_size}, skipping")
        return 0

    # Single pass: rewrite coordinates inside the target size layer
    output = []
    bdc_stack = []
    in_target = False
    in_piece = False
    q_depth = 0
    piece_idx = piece_idx_start
    coord_idx = 0
    graded_pieces = 0
    # Debug counters
    dbg_target_bdc_enters = 0
    dbg_piece_ops_counter = {'m': 0, 'l': 0, 'c': 0}
    dbg_current_piece_target_count = 0

    for line in lines:
        s = line.strip()

        # Track BDC/EMC for size layers
        if s.endswith('BDC'):
            is_target = f'/{target_mc} ' in s or f'/{target_mc} BDC' in s
            is_size = any(f'/{mc} ' in s or f'/{mc} BDC' in s for mc in size_mc_refs)
            bdc_stack.append({'is_target': is_target, 'is_size': is_size})
            if is_target:
                in_target = True
                dbg_target_bdc_enters += 1
                if debug:
                    print(f"[DEBUG page {page_num}] target BDC enter #{dbg_target_bdc_enters} — piece_idx continues at {piece_idx}")
            output.append(line)
            continue

        if s == 'EMC':
            if bdc_stack:
                top = bdc_stack.pop()
                if top['is_target']:
                    in_target = False
                    if in_piece:
                        in_piece = False
            output.append(line)
            continue

        # Inside target size layer — rewrite coordinates
        if in_target and not in_piece:
            m = PIECE_RE.match(s)
            if m and piece_idx < len(targets):
                # Replace anchor with target anchor
                target = targets[piece_idx]
                ax, ay = target['anchor']
                src_ax, src_ay = float(m.group(1)), float(m.group(2))
                output.append(f'q 1 0 0 1 {ax:.4f} {ay:.4f} cm')
                in_piece = True
                q_depth = 1
                coord_idx = 0
                graded_pieces += 1
                dbg_piece_ops_counter = {'m': 0, 'l': 0, 'c': 0}
                dbg_current_piece_target_count = len(target.get('coords', []))
                if debug:
                    print(f"[DEBUG page {page_num}] ENTER piece_idx={piece_idx}  src_anchor=({src_ax:.2f},{src_ay:.2f})  tgt_anchor=({ax:.2f},{ay:.2f})  target_coords={dbg_current_piece_target_count}")
                continue

        if in_target and in_piece:
            if s.startswith('q') or s == 'q':
                q_depth += 1
                output.append(line)
                continue
            elif s == 'Q':
                q_depth -= 1
                if q_depth == 0:
                    in_piece = False
                    if debug:
                        ops = dbg_piece_ops_counter
                        total_consumed = ops['m'] + ops['l'] + ops['c'] * 3
                        overflow = coord_idx > dbg_current_piece_target_count
                        marker = "  ⚠ OVERFLOW" if overflow else ""
                        print(f"[DEBUG page {page_num}] CLOSE piece_idx={piece_idx}  ops(m={ops['m']},l={ops['l']},c={ops['c']})  coord_idx_end={coord_idx}/{dbg_current_piece_target_count}{marker}")
                    piece_idx += 1
                    output.append(line)
                    continue
                output.append(line)
                continue

            target = targets[piece_idx] if piece_idx < len(targets) else None
            target_coords = target['coords'] if target else []

            # Try to match and replace coordinate operators
            cm = CURVE_RE.match(s)
            if cm and coord_idx + 2 < len(target_coords):
                # Bezier curve: 3 coordinate pairs (cp1, cp2, endpoint)
                c1 = target_coords[coord_idx]
                c2 = target_coords[coord_idx + 1]
                c3 = target_coords[coord_idx + 2]
                output.append(f'{c1[0]:.4f} {c1[1]:.4f} {c2[0]:.4f} {c2[1]:.4f} {c3[0]:.4f} {c3[1]:.4f} c')
                coord_idx += 3
                dbg_piece_ops_counter['c'] += 1
                continue

            mm = MOVE_RE.match(s)
            if mm and coord_idx < len(target_coords):
                c = target_coords[coord_idx]
                output.append(f'{c[0]:.4f} {c[1]:.4f} m')
                coord_idx += 1
                dbg_piece_ops_counter['m'] += 1
                continue

            lm = LINE_RE.match(s)
            if lm and coord_idx < len(target_coords):
                c = target_coords[coord_idx]
                output.append(f'{c[0]:.4f} {c[1]:.4f} l')
                coord_idx += 1
                dbg_piece_ops_counter['l'] += 1
                continue

            # Non-coordinate line (stroke, fill, color, etc.) — pass through
            output.append(line)
            continue

        # Not in target size layer — pass through unchanged
        # (other size layers, Layer 1, etc.)
        output.append(line)

    pdf_obj = page.get('/Contents')
    parent_pdf = pdf_obj._pdf if hasattr(pdf_obj, '_pdf') else page._pdf if hasattr(page, '_pdf') else None
    if parent_pdf:
        page['/Contents'] = parent_pdf.make_stream('\n'.join(output).encode('latin-1'))
    else:
        # Fallback: overwrite the stream data directly
        page['/Contents'].write('\n'.join(output).encode('latin-1'))

    if verbose:
        print(f"  Page: graded {graded_pieces} pieces")

    return graded_pieces, piece_idx


def main():
    parser = argparse.ArgumentParser(description="Grade a sewing pattern PDF using per-vertex grade rules")
    parser.add_argument("input", help="Input multi-size PDF")
    parser.add_argument("--rules", help="Grade rules JSON file")
    parser.add_argument("--rules-json", help="Grade rules JSON string (for server mode)")
    parser.add_argument("--slug", help="Pattern slug (loads rules from DB)")
    parser.add_argument("--steps", type=float, help="Grade steps beyond largest size")
    parser.add_argument("--bust", type=float, help="Customer bust (cm)")
    parser.add_argument("--waist", type=float, help="Customer waist (cm)")
    parser.add_argument("--hip", type=float, help="Customer hip (cm)")
    parser.add_argument("--size", required=True, help="Base size (largest standard, e.g. 2XL)")
    parser.add_argument("--piece-steps", help="JSON array of per-piece step counts (overrides --steps per piece)")
    parser.add_argument("--output", "-o", required=True, help="Output PDF path")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--debug", action="store_true", help="Print per-piece diagnostics (piece_idx reset, target coord counts, overflow)")
    args = parser.parse_args()

    # Load grade rules
    if args.rules_json:
        grade_data = json.loads(args.rules_json)
    elif args.rules:
        with open(args.rules) as f:
            grade_data = json.load(f)
    elif args.slug:
        # Load from database
        def get_secret(name):
            return subprocess.run(["pass", name], capture_output=True, text=True).stdout.strip()
        db_url = get_secret("rosyspatterns/railway-database-url")
        r = subprocess.run(
            ["psql", db_url, "-t", "-A", "-c",
             f"SELECT grade_data::text FROM cs_pattern_grade_rules WHERE pattern_slug = '{args.slug}'"],
            capture_output=True, text=True
        )
        raw = r.stdout.strip()
        if not raw:
            print(f"ERROR: No grade rules for {args.slug}")
            sys.exit(1)
        grade_data = json.loads(raw)
    else:
        parser.error("Provide --rules, --rules-json, or --slug")

    # Determine steps
    steps_beyond = args.steps
    if steps_beyond is None:
        if args.bust and args.waist and args.hip:
            # Compute from measurements (simplified — full version in TypeScript)
            print("WARNING: Computing steps from measurements is approximate. Use --steps for precision.")
            steps_beyond = 1.5  # placeholder
        else:
            parser.error("Provide --steps or --bust/--waist/--hip")

    print(f"Grading: {args.input}")
    print(f"Base size: {args.size}, steps beyond: {steps_beyond}")

    # Per-piece step counts (from TypeScript blending) or None (use global)
    per_piece_steps = json.loads(args.piece_steps) if args.piece_steps else None

    # Compute target coordinates
    targets = compute_target_from_rules(grade_data, steps_beyond, per_piece_steps)
    print(f"Computed targets for {len(targets)} pieces" +
          (f" (per-piece steps: {[round(s,1) for s in per_piece_steps[:5]]}{'...' if len(per_piece_steps)>5 else ''})" if per_piece_steps else ""))

    # Open PDF
    pdf = pikepdf.open(args.input)

    # Toggle OCG layers
    toggle_ocg_layers(pdf, args.size)

    # Grade each page — piece_idx advances globally across pages
    total_graded = 0
    piece_idx = 0
    for i, page in enumerate(pdf.pages):
        graded, piece_idx = grade_page(page, args.size, targets, verbose=args.verbose,
                                       page_num=i, debug=args.debug, piece_idx_start=piece_idx)
        total_graded += graded
        if args.verbose and graded > 0:
            print(f"  Page {i}: {graded} pieces graded")

    print(f"Total: {total_graded} pieces graded across {len(pdf.pages)} pages")

    # Save
    pdf.save(args.output, linearize=True)
    pdf.close()
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
