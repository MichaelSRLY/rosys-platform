#!/usr/bin/env python3
"""
Scale custom-fit pattern PDF: isolate target size + apply scale transform.

Uses the same approach as extract-single-size.py (OCG metadata only)
to hide non-target sizes, then prepends a page-level scale transform
using contents_add(). Never modifies existing content streams.

Usage:
  python3 scripts/scale-pattern.py <input.pdf> <scale_w> <scale_h> <target_size> <output.pdf>
"""

import argparse
import sys
import pikepdf

SIZE_NAMES = {'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'}
ALL_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']


def scale_pattern(input_path, scale_w, scale_h, target_size, output_path):
    pdf = pikepdf.open(input_path)

    # --- Step 1: Toggle OCG layers (same as extract-single-size.py) ---
    oc_props = pdf.Root.get('/OCProperties')
    if oc_props:
        ocgs = list(oc_props['/OCGs'])

        keep_on = []
        turn_off = []

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
        d['/Name'] = pikepdf.String(f'Custom fit from {target_size}')

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

        d['/Locked'] = pikepdf.Array(turn_off)
        d['/ListMode'] = pikepdf.Name('/VisiblePages')
        oc_props['/D'] = d
        pdf.Root['/OCProperties'] = oc_props

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

        layers_on = len(keep_on)
        layers_off = len(turn_off)
    else:
        layers_on = 0
        layers_off = 0

    # --- Step 2: Apply scale transform + expand page ---
    # Scales from origin and expands MediaBox to fit the larger content.
    if abs(scale_w - 1) > 0.001 or abs(scale_h - 1) > 0.001:
        for page in pdf.pages:
            page.contents_coalesce()
            raw = page['/Contents'].read_bytes()

            prefix = f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n'.encode('latin-1')
            suffix = b'\nQ\n'
            page['/Contents'] = pdf.make_stream(prefix + raw + suffix)

            # Expand page to fit scaled content
            mbox = page.get('/MediaBox', [0, 0, 2383.937, 3370.394])
            x0, y0, x1, y1 = float(mbox[0]), float(mbox[1]), float(mbox[2]), float(mbox[3])
            new_w = (x1 - x0) * scale_w
            new_h = (y1 - y0) * scale_h
            page['/MediaBox'] = pikepdf.Array([x0, y0, x0 + new_w, y0 + new_h])
            if '/CropBox' in page:
                page['/CropBox'] = pikepdf.Array([x0, y0, x0 + new_w, y0 + new_h])
            print(f"  Scale {scale_w:.4f}x{scale_h:.4f}, page {x1-x0:.0f}x{y1-y0:.0f} -> {new_w:.0f}x{new_h:.0f}pt")

    pdf.save(output_path, linearize=True)
    pdf.close()

    return layers_on, layers_off


def main():
    parser = argparse.ArgumentParser(
        description='Scale custom-fit pattern: isolate size + apply transform'
    )
    parser.add_argument('input', help='Input PDF')
    parser.add_argument('scale_w', type=float, help='Width scale factor')
    parser.add_argument('scale_h', type=float, help='Height scale factor')
    parser.add_argument('target_size', help='Target size (e.g. L, M, XL)')
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

    print(f'Scaling: size={args.target_size} W*{args.scale_w:.4f} H*{args.scale_h:.4f}')
    on, off = scale_pattern(
        args.input, args.scale_w, args.scale_h, args.target_size, args.output
    )
    print(f'Layers: {on} ON, {off} OFF')
    print(f'Output: {args.output}')


if __name__ == '__main__':
    main()
