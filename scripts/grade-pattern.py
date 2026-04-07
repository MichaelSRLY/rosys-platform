#!/usr/bin/env python3
"""
Grade a sewing pattern DXF by applying proportional scaling.

Usage:
  python3 scripts/grade-pattern.py <pattern_slug> --bust 88 --waist 72 --hip 92 [--output custom.dxf]
  python3 scripts/grade-pattern.py 3_lena_dress --bust 96 --waist 80 --hip 100

The script:
1. Downloads the DXF from Supabase storage
2. Queries size chart data from Railway DB
3. Calculates scale factors (custom vs sample size)
4. Scales all POLYLINE geometry in each block (piece)
5. Updates TEXT labels with new dimensions
6. Writes a new DXF file
"""

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import urllib.request

import ezdxf
from ezdxf.math import Vec3


def get_secret(name):
    return subprocess.run(["pass", name], capture_output=True, text=True).stdout.strip()


PROJECT_ID = get_secret("supabase/rosys-app/project-id")
SERVICE_KEY = get_secret("supabase/rosys-app/secret-key")
DB_URL = get_secret("rosyspatterns/railway-database-url")
SUPABASE_URL = f"https://{PROJECT_ID}.supabase.co"


def psql_json(query):
    r = subprocess.run(
        ["psql", DB_URL, "-t", "-A", "-c", f"SELECT json_agg(t) FROM ({query}) t;"],
        capture_output=True, text=True
    )
    raw = r.stdout.strip()
    return json.loads(raw) if raw and raw != "" else []


def supabase_list(prefix, limit=50):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/list/pattern-files",
        data=json.dumps({"prefix": prefix, "limit": limit}).encode(),
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req).read())


def supabase_download(path, dest):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/pattern-files/{urllib.request.quote(path, safe='/')}",
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    )
    with urllib.request.urlopen(req) as resp, open(dest, 'wb') as f:
        f.write(resp.read())


def find_dxf_file(slug):
    """Find and download the DXF file for a pattern."""
    # Try dxf/ subfolder
    for prefix in [f"{slug}/dxf/", f"{slug}/dxf /"]:
        try:
            files = supabase_list(prefix)
            dxf_files = [f for f in files if f.get("name", "").endswith(".dxf")]
            if dxf_files:
                return f"{prefix}{dxf_files[0]['name']}"
        except Exception:
            continue
    return None


def get_grading_params(slug, bust, waist, hip):
    """Calculate grading parameters from database."""
    # Get DXF metadata
    dxf_meta = psql_json(f"""
        SELECT metadata::text FROM cs_pattern_embeddings
        WHERE pattern_slug = '{slug}' AND chunk_type = 'dxf_pattern_piece'
        LIMIT 1
    """)
    if not dxf_meta:
        print(f"ERROR: No DXF data for {slug}")
        return None

    meta = json.loads(dxf_meta[0]["metadata"])
    sample_size = meta.get("sample_size", "XS")

    # Get body measurements to find closest size
    body_rows = psql_json(f"""
        SELECT size, bust_cm, waist_cm, hip_cm FROM cs_pattern_size_charts
        WHERE pattern_slug = '{slug}' AND chart_type = 'body'
        ORDER BY CASE size WHEN 'XXS' THEN 0 WHEN 'XS' THEN 1 WHEN 'S' THEN 2
          WHEN 'M' THEN 3 WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN '2XL' THEN 6 END
    """)

    # Get finished measurements
    finished_rows = psql_json(f"""
        SELECT size, bust_cm, waist_cm, hip_cm, full_length_cm FROM cs_pattern_size_charts
        WHERE pattern_slug = '{slug}' AND chart_type = 'finished'
        ORDER BY CASE size WHEN 'XXS' THEN 0 WHEN 'XS' THEN 1 WHEN 'S' THEN 2
          WHEN 'M' THEN 3 WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN '2XL' THEN 6 END
    """)

    if not body_rows or not finished_rows:
        print(f"ERROR: No size chart data for {slug}")
        return None

    # Find closest standard size
    best_size = body_rows[0]["size"]
    best_score = float('inf')
    for row in body_rows:
        b = float(row["bust_cm"]) if row["bust_cm"] else 0
        w = float(row["waist_cm"]) if row["waist_cm"] else 0
        h = float(row["hip_cm"]) if row["hip_cm"] else 0
        score = abs(b - bust) * 1.5 + abs(w - waist) + abs(h - hip) * 1.2
        if score < best_score:
            best_score = score
            best_size = row["size"]

    # Get ease from target size
    target_body = next((r for r in body_rows if r["size"] == best_size), None)
    target_fin = next((r for r in finished_rows if r["size"] == best_size), None)
    sample_fin = next((r for r in finished_rows if r["size"] == sample_size), None)

    if not sample_fin:
        # Fallback: use first available finished row
        sample_fin = finished_rows[0]
        sample_size = sample_fin["size"]

    bust_ease = (float(target_fin["bust_cm"]) - float(target_body["bust_cm"])) if target_fin and target_body and target_fin.get("bust_cm") and target_body.get("bust_cm") else 4
    waist_ease = (float(target_fin["waist_cm"]) - float(target_body["waist_cm"])) if target_fin and target_body and target_fin.get("waist_cm") and target_body.get("waist_cm") else 4
    hip_ease = (float(target_fin["hip_cm"]) - float(target_body["hip_cm"])) if target_fin and target_body and target_fin.get("hip_cm") and target_body.get("hip_cm") else 4

    # Custom finished = user measurements + ease
    custom_bust = bust + bust_ease
    custom_waist = waist + waist_ease
    custom_hip = hip + hip_ease

    # Scale factors relative to sample DXF
    sample_bust = float(sample_fin["bust_cm"]) if sample_fin.get("bust_cm") else custom_bust
    sample_length = float(sample_fin["full_length_cm"]) if sample_fin.get("full_length_cm") else None

    scale_w = custom_bust / sample_bust if sample_bust else 1.0
    scale_h = math.sqrt(scale_w)  # gentle proportional scaling for height

    return {
        "sample_size": sample_size,
        "target_size": best_size,
        "scale_w": scale_w,
        "scale_h": scale_h,
        "custom_bust": custom_bust,
        "custom_waist": custom_waist,
        "custom_hip": custom_hip,
        "sample_bust": sample_bust,
        "bust_ease": bust_ease,
    }


def scale_block(block, scale_w, scale_h, center_x, center_y):
    """Scale all geometry in a block around its center."""
    for entity in block:
        etype = entity.dxftype()

        if etype == "POLYLINE":
            for vertex in entity.vertices:
                loc = vertex.dxf.location
                new_x = center_x + (loc.x - center_x) * scale_w
                new_y = center_y + (loc.y - center_y) * scale_h
                vertex.dxf.location = Vec3(new_x, new_y, loc.z)

        elif etype == "LINE":
            start = entity.dxf.start
            end = entity.dxf.end
            entity.dxf.start = Vec3(
                center_x + (start.x - center_x) * scale_w,
                center_y + (start.y - center_y) * scale_h,
                start.z
            )
            entity.dxf.end = Vec3(
                center_x + (end.x - center_x) * scale_w,
                center_y + (end.y - center_y) * scale_h,
                end.z
            )

        elif etype == "POINT":
            loc = entity.dxf.location
            entity.dxf.location = Vec3(
                center_x + (loc.x - center_x) * scale_w,
                center_y + (loc.y - center_y) * scale_h,
                loc.z
            )

        elif etype == "TEXT":
            ins = entity.dxf.insert
            entity.dxf.insert = Vec3(
                center_x + (ins.x - center_x) * scale_w,
                center_y + (ins.y - center_y) * scale_h,
                ins.z
            )

        elif etype == "ATTDEF":
            ins = entity.dxf.insert
            entity.dxf.insert = Vec3(
                center_x + (ins.x - center_x) * scale_w,
                center_y + (ins.y - center_y) * scale_h,
                ins.z
            )


def get_block_center(block):
    """Get the center of all geometry in a block."""
    all_x, all_y = [], []
    for entity in block:
        if entity.dxftype() == "POLYLINE":
            for v in entity.vertices:
                all_x.append(v.dxf.location.x)
                all_y.append(v.dxf.location.y)
    if not all_x:
        return 0, 0
    return (min(all_x) + max(all_x)) / 2, (min(all_y) + max(all_y)) / 2


def get_block_bbox(block):
    """Get bounding box of polylines in a block."""
    all_x, all_y = [], []
    for entity in block:
        if entity.dxftype() == "POLYLINE" and entity.dxf.layer in ("1", "14"):
            for v in entity.vertices:
                all_x.append(v.dxf.location.x)
                all_y.append(v.dxf.location.y)
    if not all_x:
        return None
    return min(all_x), min(all_y), max(all_x), max(all_y)


def update_size_labels(block, params, new_cut_w, new_cut_h):
    """Update text labels in the block with new size info."""
    for entity in block:
        if entity.dxftype() != "TEXT":
            continue
        text = entity.dxf.text
        if text.startswith("Size:"):
            entity.dxf.text = f"Size: CUSTOM ({params['target_size']})"


def main():
    parser = argparse.ArgumentParser(description="Grade a sewing pattern DXF")
    parser.add_argument("slug", help="Pattern slug (e.g., 3_lena_dress)")
    parser.add_argument("--bust", type=float, required=True, help="Bust measurement in cm")
    parser.add_argument("--waist", type=float, required=True, help="Waist measurement in cm")
    parser.add_argument("--hip", type=float, required=True, help="Hip measurement in cm")
    parser.add_argument("--output", "-o", help="Output DXF file path")
    args = parser.parse_args()

    slug = args.slug
    print(f"\n{'='*60}")
    print(f"GRADING: {slug}")
    print(f"Target: bust={args.bust}cm, waist={args.waist}cm, hip={args.hip}cm")
    print(f"{'='*60}")

    # 1. Calculate grading parameters
    params = get_grading_params(slug, args.bust, args.waist, args.hip)
    if not params:
        sys.exit(1)

    print(f"\nSample size: {params['sample_size']}")
    print(f"Closest standard size: {params['target_size']}")
    print(f"Sample bust (finished): {params['sample_bust']:.1f}cm")
    print(f"Custom bust (finished): {params['custom_bust']:.1f}cm (body {args.bust} + ease {params['bust_ease']:.1f})")
    print(f"Scale factors: width={params['scale_w']:.4f}, height={params['scale_h']:.4f}")

    # 2. Download DXF from Supabase
    dxf_path = find_dxf_file(slug)
    if not dxf_path:
        # Try local file
        local_dxf = f"/Users/dr.contexter/projects/rosys-context/dxf_files/"
        candidates = [f for f in os.listdir(local_dxf) if slug.split("_", 1)[1].upper().replace("_", " ") in f.upper()]
        if not candidates:
            # Broader search
            name_parts = slug.split("_")[1:]
            search = " ".join(p.upper() for p in name_parts)
            candidates = [f for f in os.listdir(local_dxf) if search in f.upper()]
        if candidates:
            local_file = os.path.join(local_dxf, candidates[0])
            print(f"\nUsing local DXF: {local_file}")
        else:
            print(f"ERROR: Cannot find DXF for {slug}")
            sys.exit(1)
    else:
        local_file = tempfile.mktemp(suffix=".dxf")
        print(f"\nDownloading: {dxf_path}")
        supabase_download(dxf_path, local_file)

    # 3. Load and grade the DXF
    doc = ezdxf.readfile(local_file)

    scale_w = params["scale_w"]
    scale_h = params["scale_h"]

    print(f"\nGrading {len([b for b in doc.blocks if not b.name.startswith('*')])} blocks...")

    for block in doc.blocks:
        if block.name.startswith("*"):
            continue

        # Get piece info
        piece_name = ""
        for e in block:
            if e.dxftype() == "TEXT" and "Piece Name:" in e.dxf.text:
                piece_name = e.dxf.text.replace("Piece Name:", "").strip()
                break

        bbox = get_block_bbox(block)
        if not bbox:
            continue

        cx, cy = get_block_center(block)
        old_w = bbox[2] - bbox[0]
        old_h = bbox[3] - bbox[1]

        # Apply scaling
        scale_block(block, scale_w, scale_h, cx, cy)

        # Get new bbox
        new_bbox = get_block_bbox(block)
        new_w = new_bbox[2] - new_bbox[0] if new_bbox else old_w
        new_h = new_bbox[3] - new_bbox[1] if new_bbox else old_h

        # Update labels
        update_size_labels(block, params, new_w, new_h)

        print(f"  Block '{block.name}' ({piece_name}): "
              f"{old_w:.0f}x{old_h:.0f} -> {new_w:.0f}x{new_h:.0f}mm "
              f"(Δw={new_w-old_w:+.1f}, Δh={new_h-old_h:+.1f})")

    # 4. Also scale INSERT positions in modelspace
    msp = doc.modelspace()
    for entity in msp:
        if entity.dxftype() == "INSERT":
            ins = entity.dxf.insert
            # Keep inserts at original positions — blocks are scaled internally
            pass

    # 5. Save
    output_path = args.output or f"{slug}_custom_bust{int(args.bust)}.dxf"
    doc.saveas(output_path)

    print(f"\n{'='*60}")
    print(f"SAVED: {output_path}")
    print(f"Custom fit: bust={params['custom_bust']:.1f}cm, "
          f"waist={params['custom_waist']:.1f}cm, "
          f"hip={params['custom_hip']:.1f}cm")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
