-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for fitness tracking app

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Exercises table (exercises that can be reused across workouts)
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  muscle_group TEXT, -- upper, lower, legs, cardio
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workout templates table (e.g., "Upper Body Day", "Leg Day")
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  workout_type TEXT NOT NULL, -- upper, lower, legs, cardio
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workout template exercises (which exercises are in each template and how many sets)
CREATE TABLE workout_template_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  sets_count INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workout sessions (actual workout instances)
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exercise logs (exercises performed in a session)
CREATE TABLE exercise_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set logs (individual sets with reps, weight, RIR)
CREATE TABLE set_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_log_id UUID NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight DECIMAL(6, 2), -- weight in kg
  rir INTEGER, -- Reps In Reserve (0-10)
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_exercises_user_id ON exercises(user_id);
CREATE INDEX idx_workout_templates_user_id ON workout_templates(user_id);
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_started_at ON workout_sessions(started_at DESC);
CREATE INDEX idx_exercise_logs_workout_session_id ON exercise_logs(workout_session_id);
CREATE INDEX idx_set_logs_exercise_log_id ON set_logs(exercise_log_id);

-- Row Level Security (RLS) policies
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- Exercises policies
CREATE POLICY "Users can view their own exercises"
  ON exercises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exercises"
  ON exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercises"
  ON exercises FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercises"
  ON exercises FOR DELETE
  USING (auth.uid() = user_id);

-- Workout templates policies
CREATE POLICY "Users can view their own workout templates"
  ON workout_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workout templates"
  ON workout_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout templates"
  ON workout_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout templates"
  ON workout_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Workout template exercises policies
CREATE POLICY "Users can view their workout template exercises"
  ON workout_template_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = workout_template_exercises.workout_template_id
      AND workout_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create workout template exercises"
  ON workout_template_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = workout_template_exercises.workout_template_id
      AND workout_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workout template exercises"
  ON workout_template_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = workout_template_exercises.workout_template_id
      AND workout_templates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete workout template exercises"
  ON workout_template_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = workout_template_exercises.workout_template_id
      AND workout_templates.user_id = auth.uid()
    )
  );

-- Workout sessions policies
CREATE POLICY "Users can view their own workout sessions"
  ON workout_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workout sessions"
  ON workout_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout sessions"
  ON workout_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout sessions"
  ON workout_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Exercise logs policies
CREATE POLICY "Users can view their exercise logs"
  ON exercise_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = exercise_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create exercise logs"
  ON exercise_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = exercise_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update exercise logs"
  ON exercise_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = exercise_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete exercise logs"
  ON exercise_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = exercise_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- Set logs policies
CREATE POLICY "Users can view their set logs"
  ON set_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exercise_logs
      JOIN workout_sessions ON workout_sessions.id = exercise_logs.workout_session_id
      WHERE exercise_logs.id = set_logs.exercise_log_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create set logs"
  ON set_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exercise_logs
      JOIN workout_sessions ON workout_sessions.id = exercise_logs.workout_session_id
      WHERE exercise_logs.id = set_logs.exercise_log_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update set logs"
  ON set_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM exercise_logs
      JOIN workout_sessions ON workout_sessions.id = exercise_logs.workout_session_id
      WHERE exercise_logs.id = set_logs.exercise_log_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete set logs"
  ON set_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM exercise_logs
      JOIN workout_sessions ON workout_sessions.id = exercise_logs.workout_session_id
      WHERE exercise_logs.id = set_logs.exercise_log_id
      AND workout_sessions.user_id = auth.uid()
    )
  );
