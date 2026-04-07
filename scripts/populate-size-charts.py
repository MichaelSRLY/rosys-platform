#!/usr/bin/env python3
"""
Populate cs_pattern_size_charts from cs_pattern_embeddings size_chart_text chunks.
Parses structured measurement data into typed rows for deterministic size matching.
"""

import subprocess, re, json, sys
from collections import defaultdict

db_url = subprocess.run(["pass", "rosyspatterns/railway-database-url"], capture_output=True, text=True).stdout.strip()

def psql(query, params=None):
    r = subprocess.run(["psql", db_url, "-t", "-A", "-c", query], capture_output=True, text=True)
    return r.stdout.strip(), r.returncode

def psql_json(query):
    r = subprocess.run(["psql", db_url, "-t", "-A", "-c",
        f"SELECT json_agg(t) FROM ({query}) t;"], capture_output=True, text=True)
    raw = r.stdout.strip()
    return json.loads(raw) if raw and raw != '' else []


# Standard size order for sorting
SIZE_ORDER = {'XXS': 0, 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, '2XL': 6, '3XL': 7, '4XL': 8, '5XL': 9}

# Measurement label normalization
LABEL_MAP = {
    'bust': 'bust_cm',
    'bust (cm)': 'bust_cm',
    'bust 1/2': 'bust_cm',  # half-bust, will double
    'waist': 'waist_cm',
    'waist (cm)': 'waist_cm',
    'hip': 'hip_cm',
    'hip (cm)': 'hip_cm',
    'hips': 'hip_cm',
    'hips (cm)': 'hip_cm',
    'shoulder to shoulder': 'shoulder_cm',
    'shoulder': 'shoulder_cm',
    'sleeve length': 'sleeve_length_cm',
    'full length': 'full_length_cm',
    'bottom sweep': 'bottom_sweep_cm',
    'bottom sweep 1/2': 'bottom_sweep_cm',  # half-sweep, will double
    'zipper length': 'zipper_length_cm',
}

HALF_LABELS = {'bust 1/2', 'bottom sweep 1/2'}

CORE_COLUMNS = {'bust_cm', 'waist_cm', 'hip_cm', 'shoulder_cm', 'sleeve_length_cm', 'full_length_cm', 'bottom_sweep_cm', 'zipper_length_cm'}


def parse_measurement_line(line, sizes):
    """Parse a measurement line into label + values aligned with sizes."""
    line = line.strip()
    if not line or re.match(r'^(Size|Measurement|$)', line, re.I):
        return None, None, False

    # Try CSV: "Bust,72,76,82,88,92,96,100"
    if ',' in line:
        parts = [p.strip() for p in line.split(',')]
        label = parts[0]
        vals = []
        for p in parts[1:]:
            m = re.match(r'^([\d.]+)', p)
            if m:
                vals.append(float(m.group(1)))
            else:
                vals.append(None)
        if vals:
            return label, vals, label.lower() in HALF_LABELS

    # Try space/tab separated
    parts = re.split(r'\s{2,}|\t+', line)
    if len(parts) >= 3:
        label = parts[0]
        vals = []
        for p in parts[1:]:
            m = re.match(r'^([\d.]+)', p.strip())
            if m:
                vals.append(float(m.group(1)))
            else:
                vals.append(None)
        if vals:
            return label, vals, label.lower() in HALF_LABELS

    # Try single-space separated for simple rows like "Bust 72 76 82 88 92 96 100"
    words = line.split()
    # Find where numbers start
    num_start = None
    for i, w in enumerate(words):
        if re.match(r'^\d+\.?\d*$', w) and i > 0:
            num_start = i
            break
    if num_start and num_start <= 4:
        label = ' '.join(words[:num_start])
        vals = []
        for w in words[num_start:]:
            m = re.match(r'^([\d.]+)', w)
            if m:
                vals.append(float(m.group(1)))
            else:
                vals.append(None)
        if vals:
            return label, vals, label.lower() in HALF_LABELS

    return None, None, False


def parse_size_chart(desc):
    """Parse a size chart description into structured measurements."""
    result = {
        'sizes': [],
        'body': {},
        'finished': {}
    }

    current_section = None
    lines = desc.split('\n')

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Detect section headers
        if re.match(r'^body\s*measurement', stripped, re.I):
            current_section = 'body'
            continue
        if re.match(r'^finished', stripped, re.I):
            current_section = 'finished'
            continue

        # Extract sizes from header line
        if re.match(r'^Size', stripped, re.I):
            sizes = re.findall(r'\b(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL)\b', stripped, re.I)
            if sizes:
                result['sizes'] = [s.upper() for s in sizes]
            continue

        # Parse measurement lines
        if current_section and result['sizes']:
            label, vals, is_half = parse_measurement_line(stripped, result['sizes'])
            if label and vals:
                # Double half-measurements
                if is_half:
                    vals = [v * 2 if v is not None else None for v in vals]
                    label = label.replace(' 1/2', '')

                # Normalize label
                norm_label = label.lower().strip()
                # Remove trailing (cm)
                norm_label = re.sub(r'\s*\(cm\)\s*$', '', norm_label).strip()

                column = LABEL_MAP.get(norm_label)

                if column:
                    result[current_section][column] = vals
                else:
                    # Store as extra measurement
                    result[current_section][f'extra:{norm_label}'] = vals

    return result


def insert_rows(pattern_slug, chart_type, sizes, measurements):
    """Insert measurement rows into cs_pattern_size_charts."""
    inserted = 0
    for i, size in enumerate(sizes):
        if size not in SIZE_ORDER:
            continue

        bust = measurements.get('bust_cm', [None] * len(sizes))
        waist = measurements.get('waist_cm', [None] * len(sizes))
        hip = measurements.get('hip_cm', [None] * len(sizes))
        shoulder = measurements.get('shoulder_cm', [None] * len(sizes))
        sleeve = measurements.get('sleeve_length_cm', [None] * len(sizes))
        length = measurements.get('full_length_cm', [None] * len(sizes))
        sweep = measurements.get('bottom_sweep_cm', [None] * len(sizes))
        zipper = measurements.get('zipper_length_cm', [None] * len(sizes))

        # Collect extra measurements
        extras = {}
        for key, vals in measurements.items():
            if key.startswith('extra:') and i < len(vals) and vals[i] is not None:
                extras[key.replace('extra:', '')] = vals[i]

        def val(arr, idx):
            return arr[idx] if idx < len(arr) and arr[idx] is not None else 'NULL'

        extras_json = json.dumps(extras).replace("'", "''") if extras else '{}'

        sql = f"""
            INSERT INTO cs_pattern_size_charts
                (pattern_slug, chart_type, size, bust_cm, waist_cm, hip_cm,
                 shoulder_cm, sleeve_length_cm, full_length_cm, bottom_sweep_cm,
                 zipper_length_cm, extra_measurements)
            VALUES
                ('{pattern_slug}', '{chart_type}', '{size}',
                 {val(bust, i)}, {val(waist, i)}, {val(hip, i)},
                 {val(shoulder, i)}, {val(sleeve, i)}, {val(length, i)},
                 {val(sweep, i)}, {val(zipper, i)}, '{extras_json}'::jsonb)
            ON CONFLICT (pattern_slug, chart_type, size) DO UPDATE SET
                bust_cm = EXCLUDED.bust_cm,
                waist_cm = EXCLUDED.waist_cm,
                hip_cm = EXCLUDED.hip_cm,
                shoulder_cm = EXCLUDED.shoulder_cm,
                sleeve_length_cm = EXCLUDED.sleeve_length_cm,
                full_length_cm = EXCLUDED.full_length_cm,
                bottom_sweep_cm = EXCLUDED.bottom_sweep_cm,
                zipper_length_cm = EXCLUDED.zipper_length_cm,
                extra_measurements = EXCLUDED.extra_measurements;
        """
        _, rc = psql(sql)
        if rc == 0:
            inserted += 1

    return inserted


def main():
    print("=" * 60)
    print("POPULATING cs_pattern_size_charts")
    print("=" * 60)

    # Fetch all size chart chunks
    chunks = psql_json("""
        SELECT pattern_slug, chunk_index, description
        FROM cs_pattern_embeddings
        WHERE chunk_type = 'size_chart_text'
        AND description NOT ILIKE '%no size chart%'
        AND description NOT ILIKE '%there is no%'
        AND LENGTH(description) > 50
        ORDER BY pattern_slug, chunk_index
    """)

    print(f"\nFetched {len(chunks)} chunks")

    # Group by pattern, keep best chunk per pattern
    by_pattern = defaultdict(list)
    for c in chunks:
        by_pattern[c['pattern_slug']].append(c)

    total_inserted = 0
    success = 0
    failed = []

    for slug, pattern_chunks in sorted(by_pattern.items()):
        # Try each chunk, use the one that parses best
        best_parsed = None
        best_score = 0

        for chunk in pattern_chunks:
            parsed = parse_size_chart(chunk['description'])
            score = len(parsed['sizes']) + len(parsed['body']) + len(parsed['finished'])
            if score > best_score:
                best_score = score
                best_parsed = parsed

        if not best_parsed or not best_parsed['sizes']:
            failed.append((slug, 'no sizes extracted'))
            continue

        rows = 0
        if best_parsed['body']:
            rows += insert_rows(slug, 'body', best_parsed['sizes'], best_parsed['body'])
        if best_parsed['finished']:
            rows += insert_rows(slug, 'finished', best_parsed['sizes'], best_parsed['finished'])

        if rows > 0:
            success += 1
            total_inserted += rows
            print(f"  {slug}: {rows} rows ({len(best_parsed['sizes'])} sizes, "
                  f"body={len(best_parsed['body'])} cols, finished={len(best_parsed['finished'])} cols)")
        else:
            failed.append((slug, 'no rows inserted'))

    # Also insert the standard body measurement table for patterns that only have finished
    # measurements in their chunks (their body measurements use the standard table)
    STANDARD_BODY = {
        'bust_cm': [72, 76, 82, 88, 92, 96, 100, 104, 108, 112],
        'waist_cm': [60, 64, 68, 72, 76, 80, 84, 88, 92, 96],
        'hip_cm': [80, 84, 88, 92, 96, 100, 104, 108, 112, 116],
    }
    STANDARD_SIZES_7 = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL']
    STANDARD_SIZES_10 = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

    # Check which patterns are missing body measurements
    missing_body = psql_json("""
        SELECT DISTINCT pattern_slug FROM cs_pattern_size_charts
        WHERE chart_type = 'finished'
        AND pattern_slug NOT IN (
            SELECT DISTINCT pattern_slug FROM cs_pattern_size_charts WHERE chart_type = 'body'
        )
    """)

    if missing_body:
        print(f"\n  Backfilling standard body table for {len(missing_body)} patterns...")
        for row in missing_body:
            slug = row['pattern_slug']
            # Check how many sizes this pattern has in finished
            finished_sizes = psql_json(f"SELECT DISTINCT size FROM cs_pattern_size_charts WHERE pattern_slug = '{slug}' AND chart_type = 'finished'")
            num_sizes = len(finished_sizes)
            sizes = STANDARD_SIZES_10 if num_sizes > 7 else STANDARD_SIZES_7
            body_data = {k: v[:len(sizes)] for k, v in STANDARD_BODY.items()}
            n = insert_rows(slug, 'body', sizes, body_data)
            total_inserted += n
            print(f"    {slug}: backfilled {n} body rows (standard table)")

    print(f"\n{'='*60}")
    print(f"COMPLETE: {success} patterns, {total_inserted} total rows")
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for slug, reason in failed:
            print(f"  {slug}: {reason}")

    # Final stats
    stats_raw, _ = psql("""
        SELECT chart_type, COUNT(*), COUNT(DISTINCT pattern_slug)
        FROM cs_pattern_size_charts
        GROUP BY chart_type
        ORDER BY chart_type;
    """)
    print(f"\nTable stats:")
    for line in stats_raw.split('\n'):
        if line:
            parts = line.split('|')
            print(f"  {parts[0]}: {parts[1]} rows across {parts[2]} patterns")


if __name__ == '__main__':
    main()
