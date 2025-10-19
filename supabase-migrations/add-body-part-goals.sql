-- Create body_part_goals table
CREATE TABLE IF NOT EXISTS body_part_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body_part TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('volume', 'frequency', 'specific_exercises')),
    target_value NUMERIC,
    target_exercises TEXT[], -- Array of exercise names for specific_exercises goal type
    timeframe TEXT NOT NULL CHECK (timeframe IN ('weekly', 'monthly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE (user_id, body_part, goal_type, timeframe)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_body_part_goals_user_id ON body_part_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_body_part_goals_body_part ON body_part_goals(body_part);
CREATE INDEX IF NOT EXISTS idx_body_part_goals_active ON body_part_goals(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE body_part_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own goals"
    ON body_part_goals
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
    ON body_part_goals
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
    ON body_part_goals
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
    ON body_part_goals
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_body_part_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_body_part_goals_updated_at
    BEFORE UPDATE ON body_part_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_body_part_goals_updated_at();
