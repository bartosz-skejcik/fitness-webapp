-- Create shared_workout_templates table
-- This table tracks which workout templates are shared by users with their friends
CREATE TABLE IF NOT EXISTS shared_workout_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false, -- If true, visible to all friends. If false, can be used for future selective sharing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workout_template_id) -- Each template can only be shared once
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shared_workout_templates_shared_by ON shared_workout_templates(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_workout_templates_template_id ON shared_workout_templates(workout_template_id);

-- Enable RLS
ALTER TABLE shared_workout_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_workout_templates

-- Users can view shared templates from their friends
CREATE POLICY "Users can view shared templates from friends"
    ON shared_workout_templates FOR SELECT
    USING (
        is_public = true AND (
            -- User can see their own shared templates
            auth.uid() = shared_by_user_id
            OR
            -- User can see templates shared by their friends
            EXISTS (
                SELECT 1 FROM friendships
                WHERE friendships.status = 'accepted'
                AND (
                    (friendships.user_id = auth.uid() AND friendships.friend_id = shared_by_user_id)
                    OR
                    (friendships.friend_id = auth.uid() AND friendships.user_id = shared_by_user_id)
                )
            )
        )
    );

-- Users can share their own workout templates
CREATE POLICY "Users can share their own templates"
    ON shared_workout_templates FOR INSERT
    WITH CHECK (
        auth.uid() = shared_by_user_id
        AND
        -- Ensure user owns the template they're sharing
        EXISTS (
            SELECT 1 FROM workout_templates
            WHERE workout_templates.id = workout_template_id
            AND workout_templates.user_id = auth.uid()
        )
    );

-- Users can unshare (delete) their own shared templates
CREATE POLICY "Users can unshare their own templates"
    ON shared_workout_templates FOR DELETE
    USING (auth.uid() = shared_by_user_id);

-- Users can update their own shared templates (e.g., toggle is_public)
CREATE POLICY "Users can update their own shared templates"
    ON shared_workout_templates FOR UPDATE
    USING (auth.uid() = shared_by_user_id);

-- Create a view to easily get shared templates with details
CREATE OR REPLACE VIEW shared_templates_with_details AS
SELECT
    swt.id as share_id,
    swt.workout_template_id,
    swt.shared_by_user_id,
    swt.is_public,
    swt.created_at as shared_at,
    wt.name as template_name,
    wt.workout_type,
    wt.description as template_description,
    up.full_name as shared_by_name,
    up.email as shared_by_email,
    (SELECT COUNT(*) FROM workout_template_exercises WHERE workout_template_id = wt.id) as exercise_count
FROM shared_workout_templates swt
JOIN workout_templates wt ON wt.id = swt.workout_template_id
LEFT JOIN user_profiles up ON up.id = swt.shared_by_user_id
WHERE swt.is_public = true;
