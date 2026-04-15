#!/usr/bin/env python3
"""
Scale pattern geometry in a PDF for custom-fit export.

Optitex PDFs use OCG layers with inline BDC/EMC markers:
  - MC0 = "Layer 1" (test square, labels, info box) - KEEP, DO NOT SCALE
  - MC1-MC7 = size layers (XXS-2XL pattern lines)

This script:
  1. Reads the MC-to-OCG mapping from page resources
  2. REMOVES all non-target size BDC/EMC blocks from the content stream
  3. Wraps the target size block in a scale transform
  4. Keeps Layer 1 (fixed elements) untouched

Usage:
  python3 scripts/scale-pattern.py <input.pdf> <scale_w> <scale_h> <target_size> <output.pdf>
"""

import argparse
import re
import sys
import pikepdf

SIZE_NAMES = {'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'}


def get_mc_layer_map(page):
    """
    Read the Properties dict from page resources.
    Returns dict: MC name -> layer name (e.g. {"MC0": "Layer 1", "MC5": "L"})
    """
    resources = page.get('/Resources', pikepdf.Dictionary())
    props = resources.get('/Properties', pikepdf.Dictionary())

    mc_map = {}
    for mc_key, ocg_ref in props.items():
        layer_name = ''
        if hasattr(ocg_ref, 'get'):
            layer_name = str(ocg_ref.get('/Name', ''))
        mc_map[mc_key.lstrip('/')] = layer_name

    return mc_map


def process_content(raw_bytes, scale_w, scale_h, target_size, mc_map):
    """
    Process the content stream:
    - Keep non-OCG content (outside BDC/EMC) unchanged
    - Keep Layer 1 BDC/EMC blocks unchanged
    - Scale target size BDC/EMC block
    - Remove all other size BDC/EMC blocks
    """
    raw = raw_bytes.decode('latin-1')

    scale_cmd = f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n'
    restore_cmd = '\nQ\n'
    kept = 0
    scaled = 0
    removed = 0

    def handle_block(match):
        nonlocal kept, scaled, removed
        mc_name = match.group(1)
        prefix = match.group(0)[:match.start(2) - match.start(0)]
        content = match.group(2)
        suffix = 'EMC'

        layer_name = mc_map.get(mc_name, '')

        if layer_name.upper() == target_size.upper():
            # Target size: wrap in scale transform
            scaled += 1
            return f'{prefix}{scale_cmd}{content}{restore_cmd}{suffix}'
        elif layer_name.upper() in SIZE_NAMES:
            # Other size: remove content but balance q/Q operators
            # Count q and Q in the removed content to maintain graphics state
            removed += 1
            q_count = len(re.findall(r'(?<!\w)q(?!\w)', content))
            Q_count = len(re.findall(r'(?<!\w)Q(?!\w)', content))
            # If content had more Q than q, we need to add q's to compensate
            # If content had more q than Q, we need to add Q's to compensate
            balance = ''
            if Q_count > q_count:
                balance = 'q\n' * (Q_count - q_count)
            elif q_count > Q_count:
                balance = 'Q\n' * (q_count - Q_count)
            return balance
        else:
            # Fixed content (Layer 1, etc.): keep unchanged
            kept += 1
            return match.group(0)

    pattern = r'/OC\s+/(\S+)\s+BDC(.*?)EMC'
    result = re.sub(pattern, handle_block, raw, flags=re.DOTALL)

    return result.encode('latin-1'), scaled, kept, removed


def scale_pattern(input_path, scale_w, scale_h, target_size, output_path):
    pdf = pikepdf.open(input_path)
    total_scaled = 0
    total_kept = 0
    total_removed = 0

    for page in pdf.pages:
        contents = page.get('/Contents')
        if contents is None:
            continue

        if isinstance(contents, pikepdf.Array):
            raw = b''
            for ref in contents:
                raw += ref.read_bytes() + b'\n'
        else:
            raw = contents.read_bytes()

        mc_map = get_mc_layer_map(page)

        if mc_map:
            new_content, s, k, r = process_content(
                raw, scale_w, scale_h, target_size, mc_map
            )
            total_scaled += s
            total_kept += k
            total_removed += r

            # Fix q/Q balance — removing BDC blocks can orphan operators
            text_check = new_content.decode('latin-1')
            q_count = len(re.findall(r'(?<!\w)q(?!\w)', text_check))
            Q_count = len(re.findall(r'(?<!\w)Q(?!\w)', text_check))
            if q_count > Q_count:
                new_content += ('Q\n' * (q_count - Q_count)).encode('latin-1')
            elif Q_count > q_count:
                new_content = ('q\n' * (Q_count - q_count)).encode('latin-1') + new_content
        else:
            new_content = raw

        page['/Contents'] = pdf.make_stream(new_content)

    pdf.save(output_path, linearize=True)
    pdf.close()

    return total_scaled, total_kept, total_removed


def main():
    parser = argparse.ArgumentParser(
        description='Scale custom-fit pattern PDF: keep target size + fixed elements only'
    )
    parser.add_argument('input', help='Input PDF')
    parser.add_argument('scale_w', type=float, help='Width scale factor')
    parser.add_argument('scale_h', type=float, help='Height scale factor')
    parser.add_argument('target_size', help='Target size to keep (e.g. L, M, XL)')
    parser.add_argument('output', help='Output PDF path')
    args = parser.parse_args()

    if args.scale_w < 0.5 or args.scale_w > 1.5:
        print(f'ERROR: scale_w {args.scale_w} out of safe range [0.5, 1.5]')
        sys.exit(1)
    if args.scale_h < 0.5 or args.scale_h > 1.5:
        print(f'ERROR: scale_h {args.scale_h} out of safe range [0.5, 1.5]')
        sys.exit(1)
    if args.target_size.upper() not in SIZE_NAMES:
        print(f'ERROR: unknown size {args.target_size}')
        sys.exit(1)

    print(f'Scaling {args.input}: size={args.target_size} W*{args.scale_w:.4f} H*{args.scale_h:.4f}')
    s, k, r = scale_pattern(
        args.input, args.scale_w, args.scale_h, args.target_size, args.output
    )
    print(f'Result: {s} blocks scaled, {k} fixed blocks kept, {r} other sizes removed')
    print(f'Output: {args.output}')


if __name__ == '__main__':
    main()
