-- Fix RLS policies to allow viewing exercises in shared workout templates
-- This allows users to see exercises from friends' shared templates without exposing all exercises

-- IMPORTANT: First, let's check what policies exist
-- Run this to see current policies:
-- SELECT * FROM pg_policies WHERE tablename IN ('exercises', 'workout_template_exercises');

-- Drop the old restrictive policy on exercises
DROP POLICY IF EXISTS "Users can view their own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can view their own exercises and shared template exercises" ON exercises;

-- Create new comprehensive policy that allows viewing own exercises AND exercises in shared templates from friends
CREATE POLICY "Users can view exercises - own and shared"
    ON exercises FOR SELECT
    USING (
        -- Users can see their own exercises
        auth.uid() = user_id
        OR
        -- Users can see exercises that are part of shared templates from accepted friends
        EXISTS (
            SELECT 1
            FROM workout_template_exercises wte
            JOIN workout_templates wt ON wt.id = wte.workout_template_id
            JOIN shared_workout_templates swt ON swt.workout_template_id = wt.id
            JOIN friendships f ON (
                (f.user_id = auth.uid() AND f.friend_id = wt.user_id AND f.status = 'accepted')
                OR
                (f.friend_id = auth.uid() AND f.user_id = wt.user_id AND f.status = 'accepted')
            )
            WHERE wte.exercise_id = exercises.id
            AND swt.is_public = true
        )
    );

-- Ensure workout_template_exercises policies are correct
-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their workout template exercises" ON workout_template_exercises;
DROP POLICY IF EXISTS "Users can view workout template exercises" ON workout_template_exercises;
DROP POLICY IF EXISTS "Users can create workout template exercises" ON workout_template_exercises;
DROP POLICY IF EXISTS "Users can update workout template exercises" ON workout_template_exercises;
DROP POLICY IF EXISTS "Users can delete workout template exercises" ON workout_template_exercises;
DROP POLICY IF EXISTS "Users can view template exercises for own and shared templates" ON workout_template_exercises;
DROP POLICY IF EXISTS "Users can update their workout template exercises" ON workout_template_exercises;
DROP POLICY IF EXISTS "Users can delete their workout template exercises" ON workout_template_exercises;

-- Recreate with proper access
-- SELECT: Users can view template exercises for their own templates OR for shared templates from friends
CREATE POLICY "Select own and shared template exercises"
    ON workout_template_exercises FOR SELECT
    USING (
        -- Own templates
        EXISTS (
            SELECT 1 FROM workout_templates
            WHERE workout_templates.id = workout_template_exercises.workout_template_id
            AND workout_templates.user_id = auth.uid()
        )
        OR
        -- Shared templates from friends
        EXISTS (
            SELECT 1
            FROM workout_templates wt
            JOIN shared_workout_templates swt ON swt.workout_template_id = wt.id
            JOIN friendships f ON (
                (f.user_id = auth.uid() AND f.friend_id = wt.user_id AND f.status = 'accepted')
                OR
                (f.friend_id = auth.uid() AND f.user_id = wt.user_id AND f.status = 'accepted')
            )
            WHERE wt.id = workout_template_exercises.workout_template_id
            AND swt.is_public = true
        )
    );

-- INSERT: Users can only insert into their own templates
CREATE POLICY "Insert own template exercises"
    ON workout_template_exercises FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workout_templates
            WHERE workout_templates.id = workout_template_exercises.workout_template_id
            AND workout_templates.user_id = auth.uid()
        )
    );

-- UPDATE: Users can only update their own template exercises
CREATE POLICY "Update own template exercises"
    ON workout_template_exercises FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workout_templates
            WHERE workout_templates.id = workout_template_exercises.workout_template_id
            AND workout_templates.user_id = auth.uid()
        )
    );

-- DELETE: Users can only delete their own template exercises
CREATE POLICY "Delete own template exercises"
    ON workout_template_exercises FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workout_templates
            WHERE workout_templates.id = workout_template_exercises.workout_template_id
            AND workout_templates.user_id = auth.uid()
        )
    );

-- Verify policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('exercises', 'workout_template_exercises')
ORDER BY tablename, policyname;
