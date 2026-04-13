#!/usr/bin/env python3
"""
Scale pattern geometry in a PDF without distorting the test square.

Wraps the entire content stream in a scale transform, then appends
a fresh 2x2cm test square and label OUTSIDE the transform so they
remain at true print size.

Usage:
  python3 scripts/scale-pattern.py <input.pdf> <scale_w> <scale_h> <output.pdf>

Example:
  python3 scripts/scale-pattern.py input.pdf 1.05 1.02 output.pdf
"""

import argparse
import sys
import pikepdf

# 2cm in PDF points (1cm = 28.3465 pt)
CM2 = 56.693


def scale_pattern(input_path, scale_w, scale_h, output_path):
    pdf = pikepdf.open(input_path)

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

        # Get page dimensions for test square positioning
        media = page['/MediaBox']
        page_w = float(media[2])
        page_h = float(media[3])

        # Wrap original content in a scale transform
        # q = save graphics state
        # cm = concat transformation matrix (scale_w 0 0 scale_h 0 0 = scale from origin)
        # Q = restore graphics state
        scaled_content = (
            f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n'.encode('latin-1')
            + raw
            + b'\nQ\n'
        )

        # Append a fresh 2x2cm test square at bottom-left, outside the transform
        # This is drawn at true scale - not affected by the pattern scaling
        margin = 15  # points from page edge
        sq = CM2     # 2cm = 56.693 pt

        test_square = f"""
q
% White background to cover scaled test square
1 1 1 rg
{margin - 3:.2f} {margin - 3:.2f} {sq + 6:.2f} {sq + 6:.2f} re f

% Black border - test square outline
0 0 0 RG 0 0 0 rg
0.75 w
{margin:.2f} {margin:.2f} {sq:.2f} {sq:.2f} re S

% Crosshair lines
{margin:.2f} {margin + sq/2:.2f} m {margin + sq:.2f} {margin + sq/2:.2f} l S
{margin + sq/2:.2f} {margin:.2f} m {margin + sq/2:.2f} {margin + sq:.2f} l S

% Label: "2 x 2 cm"
BT
/Helvetica 6 Tf
{margin + 2:.2f} {margin + sq + 4:.2f} Td
(2 x 2 cm) Tj
ET
Q
""".encode('latin-1')

        # Ensure Helvetica is in the page's font resources
        resources = page.get('/Resources', pikepdf.Dictionary())
        fonts = resources.get('/Font', pikepdf.Dictionary())

        # Check if Helvetica is already registered
        has_helvetica = False
        for fname, fobj in fonts.items():
            if hasattr(fobj, 'get') and str(fobj.get('/BaseFont', '')) == '/Helvetica':
                has_helvetica = True
                break

        if not has_helvetica:
            # Add Helvetica as a font resource
            helv = pikepdf.Dictionary({
                '/Type': pikepdf.Name('/Font'),
                '/Subtype': pikepdf.Name('/Type1'),
                '/BaseFont': pikepdf.Name('/Helvetica'),
            })
            fonts['/Helvetica'] = pdf.make_indirect(helv)
            resources['/Font'] = fonts
            page['/Resources'] = resources

        # Replace content stream with scaled content + test square
        new_content = scaled_content + test_square
        page['/Contents'] = pdf.make_stream(new_content)

    pdf.save(output_path, linearize=True)
    pdf.close()

    return True


def main():
    parser = argparse.ArgumentParser(
        description='Scale pattern PDF geometry while preserving test square'
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

    print(f'Scaling {args.input}: W×{args.scale_w:.4f} H×{args.scale_h:.4f}')
    scale_pattern(args.input, args.scale_w, args.scale_h, args.output)
    print(f'Output: {args.output}')


if __name__ == '__main__':
    main()
