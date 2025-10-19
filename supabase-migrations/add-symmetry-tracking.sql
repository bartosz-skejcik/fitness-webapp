-- Migration: add-symmetry-tracking.sql
-- Description: Add fields to track unilateral exercises and left/right symmetry

-- Add is_unilateral flag to exercises table
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS is_unilateral BOOLEAN DEFAULT FALSE;

-- Add side tracking to set_logs for unilateral exercises
-- Values: 'left', 'right', or NULL for bilateral exercises
ALTER TABLE set_logs
ADD COLUMN IF NOT EXISTS side TEXT CHECK (side IN ('left', 'right'));

-- Create index for querying unilateral exercises
CREATE INDEX IF NOT EXISTS idx_exercises_is_unilateral ON exercises(is_unilateral) WHERE is_unilateral = TRUE;

-- Create index for querying set logs by side
CREATE INDEX IF NOT EXISTS idx_set_logs_side ON set_logs(side) WHERE side IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN exercises.is_unilateral IS 'Whether this exercise is performed one side at a time (e.g., single-leg press, dumbbell row)';
COMMENT ON COLUMN set_logs.side IS 'Which side was used for unilateral exercises: left or right';
