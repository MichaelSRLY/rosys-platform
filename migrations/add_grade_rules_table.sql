-- Grade rules extracted from multi-size A0 PDFs.
-- Each row stores per-vertex coordinate deltas between adjacent sizes,
-- enabling real digital grading (per-point extrapolation) beyond standard size range.
-- Rollback: DROP TABLE cs_pattern_grade_rules;

CREATE TABLE IF NOT EXISTS cs_pattern_grade_rules (
  id SERIAL PRIMARY KEY,
  pattern_slug TEXT NOT NULL UNIQUE,
  sizes TEXT[] NOT NULL,                    -- e.g. {'XXS','XS','S','M','L','XL','2XL'}
  base_size TEXT NOT NULL,                  -- first size in the array (reference for reconstruction)
  piece_count INTEGER NOT NULL,
  grade_data JSONB NOT NULL,                -- full per-vertex grade rules (see extract-grade-rules.py)
  vertex_counts_consistent BOOLEAN NOT NULL, -- true if all pieces have same vertex count across all sizes
  validation_max_error_pt REAL,             -- worst reconstruction error in PDF points
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cs_pattern_grade_rules IS 'Per-vertex grade rules extracted from multi-size A0 PDFs for real digital grading';
