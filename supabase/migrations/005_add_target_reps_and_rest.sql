-- Migration: 005_add_target_reps_and_rest.sql
-- Description: Add target rep range and rest time fields to template and workout exercise records

-- Workout templates exercises: planned targets
ALTER TABLE workout_template_exercises
ADD COLUMN IF NOT EXISTS target_reps_min INTEGER,
ADD COLUMN IF NOT EXISTS target_reps_max INTEGER,
ADD COLUMN IF NOT EXISTS rest_seconds INTEGER;

-- Exercise logs: snapshot of targets at the time of workout start
ALTER TABLE exercise_logs
ADD COLUMN IF NOT EXISTS target_reps_min INTEGER,
ADD COLUMN IF NOT EXISTS target_reps_max INTEGER,
ADD COLUMN IF NOT EXISTS rest_seconds INTEGER;
