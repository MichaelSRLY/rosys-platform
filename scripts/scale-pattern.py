#!/usr/bin/env python3
"""
Scale pattern geometry in a PDF without distorting fixed elements.

Optitex PDFs use OCG layers with inline BDC/EMC markers:
  - MC0 = "Layer 1" (test square, labels, info box) - DO NOT SCALE
  - MC1-MC7 = size layers (XXS-2XL pattern lines) - SCALE THESE

This script reads the MC-to-OCG mapping from page resources, identifies
which MCs are size layers vs fixed content, and only wraps size-layer
BDC/EMC blocks in scale transforms.

Usage:
  python3 scripts/scale-pattern.py <input.pdf> <scale_w> <scale_h> <output.pdf>
"""

import argparse
import re
import sys
import pikepdf

SIZE_NAMES = {'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'}


def get_size_mc_names(page):
    """
    Read the Properties dict from page resources to find which MC names
    map to size layers (XXS, XS, S, M, L, XL, 2XL) vs fixed layers (Layer 1).
    Returns set of MC names that should be scaled.
    """
    resources = page.get('/Resources', pikepdf.Dictionary())
    props = resources.get('/Properties', pikepdf.Dictionary())

    scale_mcs = set()
    for mc_key, ocg_ref in props.items():
        layer_name = ''
        if hasattr(ocg_ref, 'get'):
            layer_name = str(ocg_ref.get('/Name', ''))
        if layer_name.upper() in SIZE_NAMES:
            # Strip leading / from key name (e.g. "/MC5" -> "MC5")
            scale_mcs.add(mc_key.lstrip('/'))

    return scale_mcs


def scale_size_blocks(raw_bytes, scale_w, scale_h, size_mcs):
    """
    Find BDC/EMC blocks for size layers and wrap them in scale transforms.
    Fixed-content blocks (Layer 1) are left untouched.
    """
    raw = raw_bytes.decode('latin-1')

    scale_cmd = f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n'
    restore_cmd = '\nQ\n'
    scaled_count = 0
    skipped_count = 0

    def wrap_if_size(match):
        nonlocal scaled_count, skipped_count
        mc_name = match.group(1)  # e.g. "MC5"
        bdc_full = match.group(0)[:match.end(1) - match.start(0)]
        # Reconstruct: everything before content, content, EMC
        prefix = match.group(0)[:match.start(2) - match.start(0)]
        content = match.group(2)
        suffix = 'EMC'

        if mc_name in size_mcs:
            scaled_count += 1
            return f'{prefix}{scale_cmd}{content}{restore_cmd}{suffix}'
        else:
            skipped_count += 1
            return match.group(0)  # unchanged

    # Match /OC /MCn BDC ... EMC blocks
    pattern = r'/OC\s+/(\S+)\s+BDC(.*?)EMC'
    result = re.sub(pattern, wrap_if_size, raw, flags=re.DOTALL)

    return result.encode('latin-1'), scaled_count, skipped_count


def scale_pattern(input_path, scale_w, scale_h, output_path):
    pdf = pikepdf.open(input_path)
    total_scaled = 0
    total_skipped = 0

    for i, page in enumerate(pdf.pages):
        contents = page.get('/Contents')
        if contents is None:
            continue

        # Collect content streams
        if isinstance(contents, pikepdf.Array):
            raw = b''
            for ref in contents:
                raw += ref.read_bytes() + b'\n'
        else:
            raw = contents.read_bytes()

        # Get MC -> layer mapping for this page
        size_mcs = get_size_mc_names(page)

        if size_mcs:
            # Selective scaling: only size-layer BDC blocks
            new_content, scaled, skipped = scale_size_blocks(
                raw, scale_w, scale_h, size_mcs
            )
            total_scaled += scaled
            total_skipped += skipped
        else:
            # No MC mapping found - skip scaling for this page
            new_content = raw

        page['/Contents'] = pdf.make_stream(new_content)

    pdf.save(output_path, linearize=True)
    pdf.close()

    return total_scaled, total_skipped


def main():
    parser = argparse.ArgumentParser(
        description='Scale pattern PDF geometry while preserving fixed elements'
    )
    parser.add_argument('input', help='Input PDF (single-size)')
    parser.add_argument('scale_w', type=float, help='Width scale factor')
    parser.add_argument('scale_h', type=float, help='Height scale factor')
    parser.add_argument('output', help='Output PDF path')
    args = parser.parse_args()

    if args.scale_w < 0.5 or args.scale_w > 1.5:
        print(f'ERROR: scale_w {args.scale_w} out of safe range [0.5, 1.5]')
        sys.exit(1)
    if args.scale_h < 0.5 or args.scale_h > 1.5:
        print(f'ERROR: scale_h {args.scale_h} out of safe range [0.5, 1.5]')
        sys.exit(1)

    print(f'Scaling {args.input}: W*{args.scale_w:.4f} H*{args.scale_h:.4f}')
    scaled, skipped = scale_pattern(
        args.input, args.scale_w, args.scale_h, args.output
    )
    print(f'Scaled {scaled} size blocks, kept {skipped} fixed blocks unchanged')
    print(f'Output: {args.output}')


if __name__ == '__main__':
    main()
