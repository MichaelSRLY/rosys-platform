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
    # Scales ONLY the target size layer (cutting lines), NOT Layer 1 (labels,
    # test square, outlines). Page stays at standard size (A0/A4/US Letter).
    # The customer follows the scaled cutting line; Layer 1 outlines are just
    # reference borders for the standard size.
    if scale_w is not None and scale_h is not None and (abs(scale_w - 1) > 0.001 or abs(scale_h - 1) > 0.001):
        size_names_upper = {s.upper() for s in ALL_SIZES}

        for page in pdf.pages:
            page.contents_coalesce()
            raw = page['/Contents'].read_bytes()

            # Find which /MCn references are SIZE layers (not Layer 1/labels)
            props = page.get('/Resources', pikepdf.Dictionary()).get('/Properties', pikepdf.Dictionary())
            size_mc_refs = set()
            for mc_key in props.keys():
                mc_name = str(mc_key).lstrip('/')
                try:
                    ocg_name = str(props[mc_key].get('/Name', '')).upper()
                    if ocg_name in size_names_upper:
                        size_mc_refs.add(mc_name)
                except Exception:
                    pass

            if not size_mc_refs:
                # Fallback: scale everything if we can't identify OCG layers
                prefix = f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm\n'.encode('latin-1')
                suffix = b'\nQ\n'
                page['/Contents'] = pdf.make_stream(prefix + raw + suffix)
                continue

            # Parse content stream, insert scale only inside size BDC/EMC blocks
            content = raw.decode('latin-1')
            lines = content.split('\n')
            output = []
            bdc_stack = []  # True if this BDC level is a size layer

            for line in lines:
                s = line.strip()

                if s.endswith('BDC'):
                    is_size = any(f'/{mc} ' in s or f'/{mc} BDC' in s for mc in size_mc_refs)
                    bdc_stack.append(is_size)
                    output.append(line)
                    if is_size:
                        output.append(f'q {scale_w:.6f} 0 0 {scale_h:.6f} 0 0 cm')
                    continue

                if s == 'EMC':
                    if bdc_stack:
                        was_size = bdc_stack.pop()
                        if was_size:
                            output.append('Q')
                    output.append(line)
                    continue

                output.append(line)

            page['/Contents'] = pdf.make_stream('\n'.join(output).encode('latin-1'))
            print(f"  Scaled size layers only ({', '.join(sorted(size_mc_refs))}), Layer 1 untouched")

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
