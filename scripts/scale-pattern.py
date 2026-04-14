#!/usr/bin/env python3
"""
Scale pattern geometry in a PDF without distorting fixed elements.

Only scales content inside OCG-marked sections (BDC/EMC blocks) which
contain the pattern lines. Everything outside OCG blocks (test square,
text labels, info box) stays at original size and position.

Usage:
  python3 scripts/scale-pattern.py <input.pdf> <scale_w> <scale_h> <output.pdf>

Example:
  python3 scripts/scale-pattern.py input.pdf 1.05 1.02 output.pdf
"""

import argparse
import re
import sys
import pikepdf


def scale_ocg_blocks(raw_bytes, scale_w, scale_h):
    """
    Find all OCG-marked sections (BDC...EMC) in the content stream
    and wrap each one in a scale transform. Non-OCG content is untouched.

    OCG sections look like:
      /OC /LayerName BDC
        ... drawing commands (pattern lines) ...
      EMC

    After transformation:
      /OC /LayerName BDC
        q <scale_w> 0 0 <scale_h> 0 0 cm
        ... drawing commands (pattern lines) ...
        Q
      EMC
    """
    raw = raw_bytes.decode('latin-1')

    # Match /OC /<name> BDC ... EMC blocks
    # Use non-greedy match to handle multiple blocks per page
    pattern = r'(/OC\s+/\S+\s+BDC)(.*?)(EMC)'

    scale_cmd = f'\nq {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n'
    restore_cmd = '\nQ\n'

    def wrap_block(match):
        bdc = match.group(1)
        content = match.group(2)
        emc = match.group(3)
        return f'{bdc}{scale_cmd}{content}{restore_cmd}{emc}'

    result, count = re.subn(pattern, wrap_block, raw, flags=re.DOTALL)

    return result.encode('latin-1'), count


def scale_full_content(raw_bytes, scale_w, scale_h):
    """
    Fallback: if no OCG blocks found, wrap entire content in scale transform.
    This is less precise but still works for PDFs without OCG markers.
    """
    raw = raw_bytes.decode('latin-1')
    scaled = f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n{raw}\nQ\n'
    return scaled.encode('latin-1')


def scale_pattern(input_path, scale_w, scale_h, output_path):
    pdf = pikepdf.open(input_path)
    total_blocks = 0

    for page in pdf.pages:
        # Collect all content streams into one byte string
        contents = page.get('/Contents')
        if contents is None:
            continue

        if isinstance(contents, pikepdf.Array):
            raw = b''
            for ref in contents:
                raw += ref.read_bytes() + b'\n'
        else:
            raw = contents.read_bytes()

        # Try selective OCG scaling first
        new_content, count = scale_ocg_blocks(raw, scale_w, scale_h)
        total_blocks += count

        if count == 0:
            # No OCG blocks found - fall back to full content scaling
            new_content = scale_full_content(raw, scale_w, scale_h)

        # Replace content stream
        page['/Contents'] = pdf.make_stream(new_content)

    pdf.save(output_path, linearize=True)
    pdf.close()

    return total_blocks


def main():
    parser = argparse.ArgumentParser(
        description='Scale pattern PDF geometry while preserving fixed elements'
    )
    parser.add_argument('input', help='Input PDF (single-size)')
    parser.add_argument('scale_w', type=float, help='Width scale factor (e.g. 1.05)')
    parser.add_argument('scale_h', type=float, help='Height scale factor (e.g. 1.02)')
    parser.add_argument('output', help='Output PDF path')
    args = parser.parse_args()

    if args.scale_w < 0.5 or args.scale_w > 1.5:
        print(f'ERROR: scale_w {args.scale_w} out of safe range [0.5, 1.5]')
        sys.exit(1)
    if args.scale_h < 0.5 or args.scale_h > 1.5:
        print(f'ERROR: scale_h {args.scale_h} out of safe range [0.5, 1.5]')
        sys.exit(1)

    print(f'Scaling {args.input}: W*{args.scale_w:.4f} H*{args.scale_h:.4f}')
    blocks = scale_pattern(args.input, args.scale_w, args.scale_h, args.output)

    if blocks > 0:
        print(f'Scaled {blocks} OCG blocks (pattern geometry only)')
    else:
        print('No OCG blocks found, used full-content scaling fallback')
    print(f'Output: {args.output}')


if __name__ == '__main__':
    main()
