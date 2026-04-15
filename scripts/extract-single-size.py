#!/usr/bin/env python3
"""
Extract a single size from a multi-size Rosys Patterns PDF.

Uses PDF Optional Content Groups (OCG) — each size is its own layer.
Toggles unwanted size layers OFF via OCG metadata. Zero content stream
modification — produces a PDF identical to the original except only
the target size is visible. Opens perfectly in Adobe Acrobat, Chrome, Preview.

Usage:
  python3 scripts/extract-single-size.py <input.pdf> <size> [output.pdf]

Sizes: XXS, XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL
"""

import argparse
import sys
import pikepdf

ALL_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']


def extract_single_size(input_path, target_size, output_path, scale_w=None, scale_h=None):
    pdf = pikepdf.open(input_path)

    oc_props = pdf.Root.get('/OCProperties')
    if not oc_props:
        print("WARNING: No OCG layers found, returning full PDF")
        pdf.save(output_path, linearize=True)
        pdf.close()
        return 0, 0

    ocgs = list(oc_props['/OCGs'])
    size_names = [s.upper() for s in ALL_SIZES]

    keep_on = []
    turn_off = []

    for ocg in ocgs:
        name = str(ocg.get('/Name', ''))
        if name.upper() in size_names and name.upper() != target_size.upper():
            turn_off.append(ocg)
        else:
            keep_on.append(ocg)

    # Set default viewing configuration
    d = oc_props.get('/D', pikepdf.Dictionary())
    d['/ON'] = pikepdf.Array(keep_on)
    d['/OFF'] = pikepdf.Array(turn_off)
    d['/BaseState'] = pikepdf.Name('/OFF')
    d['/Name'] = pikepdf.String(f'Size {target_size} only')

    # Set print/view/export states
    d['/AS'] = pikepdf.Array([
        pikepdf.Dictionary({
            '/Event': pikepdf.Name('/View'),
            '/OCGs': pikepdf.Array(keep_on),
            '/Category': pikepdf.Array([pikepdf.Name('/View')])
        }),
        pikepdf.Dictionary({
            '/Event': pikepdf.Name('/Print'),
            '/OCGs': pikepdf.Array(keep_on),
            '/Category': pikepdf.Array([pikepdf.Name('/Print')])
        }),
        pikepdf.Dictionary({
            '/Event': pikepdf.Name('/Export'),
            '/OCGs': pikepdf.Array(keep_on),
            '/Category': pikepdf.Array([pikepdf.Name('/Export')])
        })
    ])

    # Lock hidden layers, hide from layers panel
    d['/Locked'] = pikepdf.Array(turn_off)
    d['/ListMode'] = pikepdf.Name('/VisiblePages')

    oc_props['/D'] = d
    pdf.Root['/OCProperties'] = oc_props

    # Set individual OCG usage states
    for ocg in turn_off:
        ocg['/Usage'] = pikepdf.Dictionary({
            '/Print': pikepdf.Dictionary({'/PrintState': pikepdf.Name('/OFF')}),
            '/View': pikepdf.Dictionary({'/ViewState': pikepdf.Name('/OFF')}),
            '/Export': pikepdf.Dictionary({'/ExportState': pikepdf.Name('/OFF')})
        })

    for ocg in keep_on:
        ocg['/Usage'] = pikepdf.Dictionary({
            '/Print': pikepdf.Dictionary({'/PrintState': pikepdf.Name('/ON')}),
            '/View': pikepdf.Dictionary({'/ViewState': pikepdf.Name('/ON')}),
            '/Export': pikepdf.Dictionary({'/ExportState': pikepdf.Name('/ON')})
        })

    # Optional: apply scale transform for custom-fit
    # Scales from origin and EXPANDS the page (MediaBox) to fit the larger content.
    # Pattern pieces fill the full page, so any scale > 1 needs more paper.
    # Plotters handle non-standard sizes; tiled formats (A4/US Letter) get
    # slightly larger tiles that printers can "fit to page" if needed.
    if scale_w is not None and scale_h is not None and (abs(scale_w - 1) > 0.001 or abs(scale_h - 1) > 0.001):
        for page in pdf.pages:
            page.contents_coalesce()
            raw = page['/Contents'].read_bytes()

            # Scale content from origin
            prefix = f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n'.encode('latin-1')
            suffix = b'\nQ\n'
            page['/Contents'] = pdf.make_stream(prefix + raw + suffix)

            # Expand page dimensions to fit scaled content
            mbox = page.get('/MediaBox', [0, 0, 2383.937, 3370.394])
            x0, y0, x1, y1 = float(mbox[0]), float(mbox[1]), float(mbox[2]), float(mbox[3])
            new_w = (x1 - x0) * scale_w
            new_h = (y1 - y0) * scale_h
            page['/MediaBox'] = pikepdf.Array([x0, y0, x0 + new_w, y0 + new_h])
            # Update CropBox too if it exists
            if '/CropBox' in page:
                page['/CropBox'] = pikepdf.Array([x0, y0, x0 + new_w, y0 + new_h])
            print(f"  Scale {scale_w:.4f}x{scale_h:.4f}, page {x1-x0:.0f}x{y1-y0:.0f} -> {new_w:.0f}x{new_h:.0f}pt")

    pdf.save(output_path, linearize=True)
    pdf.close()

    return len(keep_on), len(turn_off)


def main():
    parser = argparse.ArgumentParser(description='Extract single size from multi-size sewing pattern PDF')
    parser.add_argument('input', help='Input multi-size PDF')
    parser.add_argument('size', help='Target size (XXS, XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL)')
    parser.add_argument('output', nargs='?', help='Output PDF path')
    parser.add_argument('--scale-w', type=float, default=None, help='Width scale factor for custom-fit')
    parser.add_argument('--scale-h', type=float, default=None, help='Height scale factor for custom-fit')
    args = parser.parse_args()

    size = args.size.upper()
    if size not in ALL_SIZES:
        valid = ', '.join(ALL_SIZES)
        print(f"ERROR: Unknown size '{size}'. Valid: {valid}")
        sys.exit(1)

    output = args.output or args.input.replace('.pdf', f'_{size}.pdf')

    print(f"Extracting size {size} from {args.input}")
    if args.scale_w and args.scale_h:
        print(f"Custom-fit scaling: W*{args.scale_w:.4f} H*{args.scale_h:.4f}")
    on, off = extract_single_size(args.input, size, output, args.scale_w, args.scale_h)
    print(f"Done: {on} layers ON, {off} layers OFF")
    print(f"Output: {output}")


if __name__ == '__main__':
    main()
