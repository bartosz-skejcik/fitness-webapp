export type WorkoutType = "upper" | "lower" | "legs" | "cardio";

export type TargetBodyPart =
    | "quads"
    | "hamstrings"
    | "glutes"
    | "chest"
    | "back"
    | "biceps"
    | "triceps"
    | "shoulders"
    | "calves"
    | "core"
    | "forearms"
    | "neck"
    | "adductors"
    | "abductors";

export interface Exercise {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    muscle_group?: WorkoutType;
    target_body_part?: TargetBodyPart | null;
    is_unilateral?: boolean;
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
    side?: "left" | "right" | null;
    created_at: string;
}

export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface Friendship {
    id: string;
    user_id: string;
    friend_id: string;
    status: FriendshipStatus;
    created_at: string;
    updated_at: string;
}

export interface UserProfile {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
}

export interface SharedWorkoutTemplate {
    id: string;
    workout_template_id: string;
    shared_by_user_id: string;
    is_public: boolean;
    created_at: string;
}

export interface SharedTemplateWithDetails {
    share_id: string;
    workout_template_id: string;
    shared_by_user_id: string;
    is_public: boolean;
    shared_at: string;
    template_name: string;
    workout_type: WorkoutType;
    template_description?: string;
    shared_by_name?: string;
    shared_by_email?: string;
    exercise_count: number;
}
