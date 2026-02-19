"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BodyPartGoal, TargetBodyPart } from "@/types/database";

interface GoalProgress {
    goal: BodyPartGoal;
    currentValue: number;
    progress: number; // percentage
    isAchieved: boolean;
}

interface GoalProgressRow {
    goal_id: string;
    current_value: number | null;
    target_value: number | null;
    progress_percentage: number | null;
}

export function useBodyPartGoals() {
    const [goals, setGoals] = useState<BodyPartGoal[]>([]);
    const [goalsWithProgress, setGoalsWithProgress] = useState<GoalProgress[]>(
        [],
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGoals();
    }, []);

    const fetchGoals = async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("body_part_goals")
                .select(
                    "id, user_id, body_part, goal_type, target_value, target_exercises, timeframe, created_at, updated_at, is_active",
                )
                .eq("user_id", user.id)
                .eq("is_active", true)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const typedGoals = data as BodyPartGoal[];
            setGoals(typedGoals);

            if (typedGoals.length === 0) {
                setGoalsWithProgress([]);
                return;
            }

            const { data: rpcProgressData, error: rpcProgressError } =
                await supabase.rpc("calculate_all_goal_progress", {
                    p_user_id: user.id,
                });

            const progressByGoalId = new Map<string, GoalProgressRow>();
            if (!rpcProgressError) {
                (rpcProgressData as GoalProgressRow[] | null)?.forEach(
                    (row) => {
                        progressByGoalId.set(row.goal_id, row);
                    },
                );
            }

            const specificExerciseGoals = typedGoals.filter(
                (goal) => goal.goal_type === "specific_exercises",
            );

            const specificExerciseCounts = new Map<string, number>();

            if (specificExerciseGoals.length > 0) {
                const now = new Date();
                const monthlyStart = new Date(now);
                monthlyStart.setDate(now.getDate() - 30);

                const { data: sessions } = await supabase
                    .from("workout_sessions")
                    .select("id, started_at")
                    .eq("user_id", user.id)
                    .gte("started_at", monthlyStart.toISOString())
                    .not("completed_at", "is", null);

                const validSessions = sessions || [];
                const sessionIds = validSessions.map((s) => s.id);

                if (sessionIds.length > 0) {
                    const { data: exercises } = await supabase
                        .from("exercises")
                        .select("id, name")
                        .eq("user_id", user.id);

                    const exerciseIdsByName = new Map<string, string[]>();
                    (exercises || []).forEach((exercise) => {
                        const ids = exerciseIdsByName.get(exercise.name) || [];
                        ids.push(exercise.id);
                        exerciseIdsByName.set(exercise.name, ids);
                    });

                    const { data: exerciseLogs } = await supabase
                        .from("exercise_logs")
                        .select("workout_session_id, exercise_id")
                        .in("workout_session_id", sessionIds);

                    const logsData = exerciseLogs || [];
                    const sessionDateById = new Map(
                        validSessions.map((session) => [
                            session.id,
                            session.started_at,
                        ]),
                    );

                    specificExerciseGoals.forEach((goal) => {
                        const startDate = new Date(now);
                        startDate.setDate(
                            now.getDate() -
                                (goal.timeframe === "weekly" ? 7 : 30),
                        );

                        const targetExercises = goal.target_exercises || [];
                        const targetExerciseIds = new Set<string>();
                        targetExercises.forEach((exerciseName) => {
                            const ids =
                                exerciseIdsByName.get(exerciseName) || [];
                            ids.forEach((id) => targetExerciseIds.add(id));
                        });

                        const completedExercises = new Set(
                            logsData
                                .filter((log) => {
                                    const startedAt = sessionDateById.get(
                                        log.workout_session_id,
                                    );
                                    if (!startedAt) return false;
                                    return (
                                        new Date(startedAt) >= startDate &&
                                        targetExerciseIds.has(log.exercise_id)
                                    );
                                })
                                .map((log) => log.exercise_id),
                        );

                        specificExerciseCounts.set(
                            goal.id,
                            completedExercises.size,
                        );
                    });
                }
            }

            const progress = typedGoals.map((goal) => {
                if (goal.goal_type === "specific_exercises") {
                    const completedCount =
                        specificExerciseCounts.get(goal.id) || 0;
                    const targetExercises = goal.target_exercises || [];
                    const progressValue =
                        targetExercises.length > 0
                            ? (completedCount / targetExercises.length) * 100
                            : 0;

                    return {
                        goal,
                        currentValue: completedCount,
                        progress: Math.min(progressValue, 100),
                        isAchieved: completedCount >= targetExercises.length,
                    };
                }

                const row = progressByGoalId.get(goal.id);
                const currentValue = Number(row?.current_value || 0);
                const progressValue = Number(row?.progress_percentage || 0);
                const targetValue = Number(
                    row?.target_value ?? goal.target_value ?? 0,
                );

                return {
                    goal,
                    currentValue,
                    progress: Math.min(progressValue, 100),
                    isAchieved: targetValue > 0 && currentValue >= targetValue,
                };
            });

            setGoalsWithProgress(progress);
        } catch (error) {
            console.error("Error fetching goals:", error);
        } finally {
            setLoading(false);
        }
    };

    const createGoal = async (
        bodyPart: TargetBodyPart,
        goalType: "volume" | "frequency" | "specific_exercises",
        targetValue: number | undefined,
        targetExercises: string[] | undefined,
        timeframe: "weekly" | "monthly",
    ) => {
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { error } = await supabase.from("body_part_goals").insert({
                user_id: user.id,
                body_part: bodyPart,
                goal_type: goalType,
                target_value: targetValue,
                target_exercises: targetExercises,
                timeframe,
                is_active: true,
            });

            if (error) throw error;

            await fetchGoals();
        } catch (error) {
            console.error("Error creating goal:", error);
            throw error;
        }
    };

    const updateGoal = async (
        goalId: string,
        updates: {
            target_value?: number;
            target_exercises?: string[];
            timeframe?: "weekly" | "monthly";
            is_active?: boolean;
        },
    ) => {
        try {
            const supabase = createClient();

            const { error } = await supabase
                .from("body_part_goals")
                .update(updates)
                .eq("id", goalId);

            if (error) throw error;

            await fetchGoals();
        } catch (error) {
            console.error("Error updating goal:", error);
            throw error;
        }
    };

    const deleteGoal = async (goalId: string) => {
        try {
            const supabase = createClient();

            const { error } = await supabase
                .from("body_part_goals")
                .delete()
                .eq("id", goalId);

            if (error) throw error;

            await fetchGoals();
        } catch (error) {
            console.error("Error deleting goal:", error);
            throw error;
        }
    };

    return {
        goals,
        goalsWithProgress,
        loading,
        createGoal,
        updateGoal,
        deleteGoal,
        refreshGoals: fetchGoals,
    };
}
