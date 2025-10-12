-- Migration: Fix exercises RLS to ensure users only see their own exercises
-- This prevents exercises from being shared between users

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can insert their own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can update their own exercises" ON exercises;
DROP POLICY IF EXISTS "Users can delete their own exercises" ON exercises;

-- Enable RLS on exercises table (if not already enabled)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own exercises
CREATE POLICY "Users can view their own exercises"
    ON exercises FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Users can insert their own exercises
CREATE POLICY "Users can insert their own exercises"
    ON exercises FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own exercises
CREATE POLICY "Users can update their own exercises"
    ON exercises FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Users can delete their own exercises
CREATE POLICY "Users can delete their own exercises"
    ON exercises FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
