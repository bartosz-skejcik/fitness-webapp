export type WorkoutType = "upper" | "lower" | "legs" | "cardio";

export interface Exercise {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    muscle_group?: WorkoutType;
    created_at: string;
    updated_at: string;
}

export interface WorkoutTemplate {
    id: string;
    user_id: string;
    name: string;
    workout_type: WorkoutType;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface WorkoutTemplateExercise {
    id: string;
    workout_template_id: string;
    exercise_id: string;
    order_index: number;
    sets_count: number;
    created_at: string;
    exercise?: Exercise;
}

export interface WorkoutSession {
    id: string;
    user_id: string;
    workout_template_id?: string;
    name: string;
    workout_type: WorkoutType;
    started_at: string;
    completed_at?: string;
    notes?: string;
    created_at: string;
}

export interface ExerciseLog {
    id: string;
    workout_session_id: string;
    exercise_id: string;
    order_index: number;
    notes?: string;
    created_at: string;
    exercise?: Exercise;
}

export interface SetLog {
    id: string;
    exercise_log_id: string;
    set_number: number;
    reps: number;
    weight?: number;
    rir?: number;
    completed: boolean;
    created_at: string;
}
