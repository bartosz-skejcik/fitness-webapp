-- Migration: Add policies to allow friends to view each other's workout data
-- This enables the friend comparison feature to work properly

-- ============================================================================
-- WORKOUT SESSIONS - Allow friends to view each other's sessions
-- ============================================================================

-- Add policy for friends to view workout sessions
CREATE POLICY "Users can view their friends' workout sessions"
    ON workout_sessions FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT CASE 
                WHEN user_id = auth.uid() THEN friend_id
                WHEN friend_id = auth.uid() THEN user_id
            END
            FROM friendships
            WHERE (user_id = auth.uid() OR friend_id = auth.uid())
            AND status = 'accepted'
        )
    );

-- ============================================================================
-- EXERCISE LOGS - Allow friends to view each other's exercise logs
-- ============================================================================

CREATE POLICY "Users can view their friends' exercise logs"
    ON exercise_logs FOR SELECT
    TO authenticated
    USING (
        -- User owns this exercise log directly
        EXISTS (
            SELECT 1 FROM workout_sessions
            WHERE workout_sessions.id = exercise_logs.workout_session_id
            AND workout_sessions.user_id = auth.uid()
        )
        OR
        -- User is friends with the owner of this exercise log
        EXISTS (
            SELECT 1 FROM workout_sessions ws
            JOIN friendships f ON (
                (f.user_id = auth.uid() AND f.friend_id = ws.user_id)
                OR
                (f.friend_id = auth.uid() AND f.user_id = ws.user_id)
            )
            WHERE ws.id = exercise_logs.workout_session_id
            AND f.status = 'accepted'
        )
    );

-- ============================================================================
-- SET LOGS - Allow friends to view each other's set logs
-- ============================================================================

CREATE POLICY "Users can view their friends' set logs"
    ON set_logs FOR SELECT
    TO authenticated
    USING (
        -- User owns this set log
        EXISTS (
            SELECT 1 FROM exercise_logs el
            JOIN workout_sessions ws ON ws.id = el.workout_session_id
            WHERE el.id = set_logs.exercise_log_id
            AND ws.user_id = auth.uid()
        )
        OR
        -- User is friends with the owner of this set log
        EXISTS (
            SELECT 1 FROM exercise_logs el
            JOIN workout_sessions ws ON ws.id = el.workout_session_id
            JOIN friendships f ON (
                (f.user_id = auth.uid() AND f.friend_id = ws.user_id)
                OR
                (f.friend_id = auth.uid() AND f.user_id = ws.user_id)
            )
            WHERE el.id = set_logs.exercise_log_id
            AND f.status = 'accepted'
        )
    );

-- ============================================================================
-- EXERCISES - Allow friends to view each other's custom exercises
-- ============================================================================

CREATE POLICY "Users can view their friends' exercises"
    ON exercises FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT CASE 
                WHEN user_id = auth.uid() THEN friend_id
                WHEN friend_id = auth.uid() THEN user_id
            END
            FROM friendships
            WHERE (user_id = auth.uid() OR friend_id = auth.uid())
            AND status = 'accepted'
        )
    );

-- ============================================================================
-- Note: We don't add friend access to workout_templates and 
-- workout_template_exercises as these are personal workout plans
-- and not needed for the comparison feature which only looks at
-- completed workout sessions
-- ============================================================================

-- ============================================================================
-- Verification queries (optional - run these to test)
-- ============================================================================

-- Check if policies were created successfully
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename IN ('workout_sessions', 'exercise_logs', 'set_logs', 'exercises')
-- ORDER BY tablename, policyname;
