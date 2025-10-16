-- Migration: update copy_shared_workout_template function to preserve target_body_part
-- This migration replaces the function with a version that includes the target_body_part

CREATE OR REPLACE FUNCTION copy_shared_workout_template(
    p_source_template_id UUID,
    p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_template_id UUID;
    v_source_template RECORD;
    v_template_exercise RECORD;
    v_new_exercise_id UUID;
    v_existing_exercise RECORD;
    v_result JSON;
    v_exercises_copied INT := 0;
BEGIN
    -- Verify the source template is shared and user has access (friends)
    IF NOT EXISTS (
        SELECT 1
        FROM workout_templates wt
        JOIN shared_workout_templates swt ON swt.workout_template_id = wt.id
        JOIN friendships f ON (
            (f.user_id = p_user_id AND f.friend_id = wt.user_id AND f.status = 'accepted')
            OR
            (f.friend_id = p_user_id AND f.user_id = wt.user_id AND f.status = 'accepted')
        )
        WHERE wt.id = p_source_template_id
        AND swt.is_public = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Template not shared or not friends';
    END IF;

    -- Get source template details
    SELECT * INTO v_source_template
    FROM workout_templates
    WHERE id = p_source_template_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source template not found';
    END IF;

    -- Create new template for user
    INSERT INTO workout_templates (
        user_id,
        name,
        workout_type,
        description,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        v_source_template.name || ' (skopiowany)',
        v_source_template.workout_type,
        COALESCE(v_source_template.description, '') || E'\n\nSkopiowany od znajomego',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_template_id;

    -- Copy exercises and link them
    FOR v_template_exercise IN
        SELECT wte.*, e.*
        FROM workout_template_exercises wte
        JOIN exercises e ON e.id = wte.exercise_id
        WHERE wte.workout_template_id = p_source_template_id
        ORDER BY wte.order_index
    LOOP
        -- Check if user already has this exercise
        SELECT * INTO v_existing_exercise
        FROM exercises
        WHERE user_id = p_user_id
        AND name = v_template_exercise.name
        LIMIT 1;

        IF FOUND THEN
            -- Reuse existing exercise
            v_new_exercise_id := v_existing_exercise.id;
        ELSE
            -- Create new exercise (include target_body_part)
            INSERT INTO exercises (
                user_id,
                name,
                description,
                muscle_group,
                target_body_part,
                created_at,
                updated_at
            ) VALUES (
                p_user_id,
                v_template_exercise.name,
                v_template_exercise.description,
                v_template_exercise.muscle_group,
                v_template_exercise.target_body_part,
                NOW(),
                NOW()
            )
            RETURNING id INTO v_new_exercise_id;
        END IF;

        -- Link exercise to new template
        INSERT INTO workout_template_exercises (
            workout_template_id,
            exercise_id,
            order_index,
            sets_count,
            created_at
        ) VALUES (
            v_new_template_id,
            v_new_exercise_id,
            v_template_exercise.order_index,
            v_template_exercise.sets_count,
            NOW()
        );

        v_exercises_copied := v_exercises_copied + 1;
    END LOOP;

    -- Return result
    v_result := json_build_object(
        'success', true,
        'new_template_id', v_new_template_id,
        'exercises_copied', v_exercises_copied,
        'template_name', v_source_template.name || ' (skopiowany)'
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error copying template: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION copy_shared_workout_template(UUID, UUID) TO authenticated;
