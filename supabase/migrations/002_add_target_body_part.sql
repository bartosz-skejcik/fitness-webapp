-- Add target_body_part column to exercises
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS target_body_part TEXT;

-- No RLS changes required; column is nullable and optional
