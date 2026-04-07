#!/usr/bin/env python3
"""
Extract a single size from a multi-size Rosys Patterns PDF.

All 130 patterns use the same 7 CMYK colors from Optitex.
This script removes the 6 unwanted size lines, keeping only:
- The target size's color
- Black (shared: text, grainlines, notches, logos)
- Gray (shared: seam allowance outlines)

Usage:
  python3 scripts/extract-single-size.py <input.pdf> <size> [output.pdf]
  python3 scripts/extract-single-size.py /tmp/lena_a0.pdf M /tmp/lena_M_only.pdf

Sizes: XXS, XS, S, M, L, XL, 2XL
For 10-size patterns (XXS-5XL), sizes 3XL/4XL/5XL map to extended colors.
"""

import argparse
import sys
import pikepdf
from pikepdf import Operator, Array

# ─── Validated CMYK → Size mapping ───
# Determined by bounding-box analysis: smallest curves = XXS, largest = 2XL
SIZE_COLORS = {
    'XXS': (0.017, 0.441, 0.946, 0.000),   # Orange
    'XS':  (0.572, 0.000, 0.115, 0.000),   # Cyan
    'S':   (0.000, 1.000, 1.000, 0.000),   # Red
    'M':   (0.813, 0.020, 0.980, 0.000),   # Green
    'L':   (0.508, 0.805, 0.000, 0.000),   # Purple
    'XL':  (0.154, 0.328, 0.643, 0.001),   # Tan/Brown
    '2XL': (0.922, 0.892, 0.000, 0.000),   # Blue
}

# Colors to always keep (shared elements)
SHARED_COLORS = {
    'black': (0.000, 0.000, 0.000, 1.000),  # Text, grainlines, notches
    'gray':  (0.563, 0.476, 0.472, 0.135),  # Seam allowance
}

TOLERANCE = 0.02  # Color matching tolerance


def colors_match(a, b):
    """Check if two CMYK tuples match within tolerance."""
    if len(a) != 4 or len(b) != 4:
        return False
    return all(abs(float(a[i]) - b[i]) < TOLERANCE for i in range(4))


def is_keep_color(cmyk, target_size):
    """Should we keep drawing operations with this stroke color?"""
    target_cmyk = SIZE_COLORS.get(target_size)
    if not target_cmyk:
        return True  # Unknown size, keep everything

    # Keep target size color
    if colors_match(cmyk, target_cmyk):
        return True

    # Keep shared colors
    for shared in SHARED_COLORS.values():
        if colors_match(cmyk, shared):
            return True

    # Check if this is a size color we should remove
    for size, color in SIZE_COLORS.items():
        if size != target_size and colors_match(cmyk, color):
            return False  # This is another size — remove it

    # Unknown color — keep it (might be special markings)
    return True


def extract_single_size(input_path, target_size, output_path):
    """Extract single size from multi-size PDF."""
    pdf = pikepdf.open(input_path)

    total_removed = 0
    total_kept = 0

    for page_num, page in enumerate(pdf.pages):
        content_stream = pikepdf.parse_content_stream(page)

        new_stream = []
        current_stroke = None
        pending_ops = []  # Operations between color set and path paint
        in_path = False
        path_ops = []

        for operands, operator in content_stream:
            op = str(operator)

            # Track stroke color
            if op == 'K':
                cmyk = tuple(round(float(o), 3) for o in operands[:4])
                current_stroke = cmyk
                # Only emit color-set if it's a color we're keeping
                if is_keep_color(cmyk, target_size):
                    new_stream.append((operands, operator))
                continue

            # Graphics state save/restore — always keep
            if op in ('q', 'Q', 'cm', 'w', 'J', 'j', 'M', 'd', 'gs', 'ri', 'i'):
                new_stream.append((operands, operator))
                continue

            # Non-stroke color operations — always keep
            if op in ('k', 'cs', 'CS', 'sc', 'SC', 'scn', 'SCN'):
                new_stream.append((operands, operator))
                continue

            # Text operations — always keep (text is always black)
            if op in ('BT', 'ET', 'Tf', 'Td', 'TD', 'Tm', 'T*',
                       'Tj', 'TJ', "'", '"', 'Tc', 'Tw', 'Tz', 'TL', 'Tr', 'Ts'):
                new_stream.append((operands, operator))
                continue

            # Path construction — accumulate
            if op in ('m', 'l', 'c', 'v', 'y', 'h', 're'):
                path_ops.append((operands, operator))
                in_path = True
                continue

            # Path painting — decide whether to keep or remove
            if op in ('S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'n'):
                if current_stroke and not is_keep_color(current_stroke, target_size):
                    # Remove this path — it belongs to a different size
                    total_removed += len(path_ops) + 1
                    path_ops = []
                    in_path = False
                    continue
                else:
                    # Keep this path
                    total_kept += len(path_ops) + 1
                    new_stream.extend(path_ops)
                    new_stream.append((operands, operator))
                    path_ops = []
                    in_path = False
                    continue

            # Image and other operations — always keep
            new_stream.append((operands, operator))

        # Flush any remaining path ops
        if path_ops:
            new_stream.extend(path_ops)

        # Replace page content stream
        page.Contents = pdf.make_stream(pikepdf.unparse_content_stream(new_stream))

    pdf.save(output_path)
    pdf.close()

    return total_kept, total_removed


def main():
    parser = argparse.ArgumentParser(description='Extract single size from multi-size sewing pattern PDF')
    parser.add_argument('input', help='Input multi-size PDF')
    parser.add_argument('size', help='Target size (XXS, XS, S, M, L, XL, 2XL)')
    parser.add_argument('output', nargs='?', help='Output PDF path')
    args = parser.parse_args()

    size = args.size.upper()
    if size not in SIZE_COLORS:
        print(f"ERROR: Unknown size '{size}'. Valid: {', '.join(SIZE_COLORS.keys())}")
        sys.exit(1)

    output = args.output or args.input.replace('.pdf', f'_{size}.pdf')

    print(f"Extracting size {size} from {args.input}")
    kept, removed = extract_single_size(args.input, size, output)
    print(f"Done: kept {kept} ops, removed {removed} ops")
    print(f"Output: {output}")


if __name__ == '__main__':
    main()
