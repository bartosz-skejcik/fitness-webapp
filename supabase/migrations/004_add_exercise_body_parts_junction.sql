-- Migration: 004_add_exercise_body_parts_junction.sql
-- Description: Create junction table for many-to-many relationship between exercises and body parts

-- Create the junction table for exercise body parts
CREATE TABLE exercise_body_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  body_part TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false, -- flag to indicate primary target muscle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(exercise_id, body_part)
);

-- Create indexes for better query performance
CREATE INDEX idx_exercise_body_parts_exercise_id ON exercise_body_parts(exercise_id);
CREATE INDEX idx_exercise_body_parts_body_part ON exercise_body_parts(body_part);

-- Enable Row Level Security
ALTER TABLE exercise_body_parts ENABLE ROW LEVEL SECURITY;

-- RLS policies for exercise_body_parts
CREATE POLICY "Users can view body parts of their exercises"
  ON exercise_body_parts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exercises
      WHERE exercises.id = exercise_body_parts.exercise_id
      AND exercises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add body parts to their exercises"
  ON exercise_body_parts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exercises
      WHERE exercises.id = exercise_body_parts.exercise_id
      AND exercises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update body parts of their exercises"
  ON exercise_body_parts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM exercises
      WHERE exercises.id = exercise_body_parts.exercise_id
      AND exercises.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete body parts from their exercises"
  ON exercise_body_parts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM exercises
      WHERE exercises.id = exercise_body_parts.exercise_id
      AND exercises.user_id = auth.uid()
    )
  );

-- Migrate existing data from exercises.target_body_part to exercise_body_parts
-- Only migrate non-null values
INSERT INTO exercise_body_parts (exercise_id, body_part, is_primary)
SELECT id, target_body_part, true
FROM exercises
WHERE target_body_part IS NOT NULL;

-- Optional: Add a comment to the old column indicating it's deprecated
COMMENT ON COLUMN exercises.target_body_part IS 'Deprecated: Use exercise_body_parts table instead. Kept for backward compatibility.';
