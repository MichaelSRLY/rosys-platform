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


def extract_single_size(input_path, target_size, output_path):
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

    pdf.save(output_path, linearize=True)
    pdf.close()

    return len(keep_on), len(turn_off)


def main():
    parser = argparse.ArgumentParser(description='Extract single size from multi-size sewing pattern PDF')
    parser.add_argument('input', help='Input multi-size PDF')
    parser.add_argument('size', help='Target size (XXS, XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL)')
    parser.add_argument('output', nargs='?', help='Output PDF path')
    args = parser.parse_args()

    size = args.size.upper()
    if size not in ALL_SIZES:
        valid = ', '.join(ALL_SIZES)
        print(f"ERROR: Unknown size '{size}'. Valid: {valid}")
        sys.exit(1)

    output = args.output or args.input.replace('.pdf', f'_{size}.pdf')

    print(f"Extracting size {size} from {args.input}")
    on, off = extract_single_size(args.input, size, output)
    print(f"Done: {on} layers ON, {off} layers OFF")
    print(f"Output: {output}")


if __name__ == '__main__':
    main()
