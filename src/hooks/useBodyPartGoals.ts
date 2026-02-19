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

            if (validSessions.length === 0) {
                setGoalsWithProgress(
                    typedGoals.map((goal) => ({
                        goal,
                        currentValue: 0,
                        progress: 0,
                        isAchieved: false,
                    })),
                );
                return;
            }

            const sessionIds = validSessions.map((s) => s.id);

            const { data: exercises } = await supabase
                .from("exercises")
                .select("id, name, target_body_part")
                .eq("user_id", user.id);

            const exercisesData = exercises || [];
            const exerciseById = new Map(
                exercisesData.map((exercise) => [exercise.id, exercise]),
            );
            const exerciseIdsByName = new Map<string, string[]>();

            exercisesData.forEach((exercise) => {
                const ids = exerciseIdsByName.get(exercise.name) || [];
                ids.push(exercise.id);
                exerciseIdsByName.set(exercise.name, ids);
            });

            const { data: exerciseLogs } = await supabase
                .from("exercise_logs")
                .select("id, workout_session_id, exercise_id")
                .in("workout_session_id", sessionIds);

            const logsData = exerciseLogs || [];
            const logIds = logsData.map((log) => log.id);

            const setLogs =
                logIds.length > 0
                    ? (
                          await supabase
                              .from("set_logs")
                              .select("exercise_log_id, weight, reps")
                              .in("exercise_log_id", logIds)
                              .eq("completed", true)
                      ).data
                    : [];

            const setsByLogId = new Map<
                string,
                Array<{
                    exercise_log_id: string;
                    weight: number | null;
                    reps: number;
                }>
            >();

            (setLogs || []).forEach((set) => {
                const existing = setsByLogId.get(set.exercise_log_id) || [];
                existing.push(set);
                setsByLogId.set(set.exercise_log_id, existing);
            });

            const sessionDateById = new Map(
                validSessions.map((session) => [
                    session.id,
                    session.started_at,
                ]),
            );

            const progress = typedGoals.map((goal) => {
                const startDate = new Date(now);
                startDate.setDate(
                    now.getDate() - (goal.timeframe === "weekly" ? 7 : 30),
                );

                const logsInTimeframe = logsData.filter((log) => {
                    const startedAt = sessionDateById.get(
                        log.workout_session_id,
                    );
                    if (!startedAt) return false;
                    return new Date(startedAt) >= startDate;
                });

                if (goal.goal_type === "volume") {
                    const matchingLogIds = logsInTimeframe
                        .filter((log) => {
                            const exercise = exerciseById.get(log.exercise_id);
                            return (
                                exercise?.target_body_part === goal.body_part
                            );
                        })
                        .map((log) => log.id);

                    const totalVolume = matchingLogIds.reduce((sum, logId) => {
                        const sets = setsByLogId.get(logId) || [];
                        return (
                            sum +
                            sets.reduce(
                                (setSum, set) =>
                                    setSum +
                                    (set.weight || 0) * (set.reps || 0),
                                0,
                            )
                        );
                    }, 0);

                    const targetValue = goal.target_value || 0;
                    const progressValue =
                        targetValue > 0 ? (totalVolume / targetValue) * 100 : 0;

                    return {
                        goal,
                        currentValue: totalVolume,
                        progress: Math.min(progressValue, 100),
                        isAchieved: totalVolume >= targetValue,
                    };
                }

                if (goal.goal_type === "frequency") {
                    const uniqueSessions = new Set(
                        logsInTimeframe
                            .filter((log) => {
                                const exercise = exerciseById.get(
                                    log.exercise_id,
                                );
                                return (
                                    exercise?.target_body_part ===
                                    goal.body_part
                                );
                            })
                            .map((log) => log.workout_session_id),
                    );

                    const frequency = uniqueSessions.size;
                    const targetValue = goal.target_value || 0;
                    const progressValue =
                        targetValue > 0 ? (frequency / targetValue) * 100 : 0;

                    return {
                        goal,
                        currentValue: frequency,
                        progress: Math.min(progressValue, 100),
                        isAchieved: frequency >= targetValue,
                    };
                }

                const targetExercises = goal.target_exercises || [];
                if (targetExercises.length === 0) {
                    return {
                        goal,
                        currentValue: 0,
                        progress: 0,
                        isAchieved: false,
                    };
                }

                const targetExerciseIds = new Set<string>();
                targetExercises.forEach((exerciseName) => {
                    const ids = exerciseIdsByName.get(exerciseName) || [];
                    ids.forEach((id) => targetExerciseIds.add(id));
                });

                const completedExercises = new Set(
                    logsInTimeframe
                        .filter((log) => targetExerciseIds.has(log.exercise_id))
                        .map((log) => log.exercise_id),
                );

                const completedCount = completedExercises.size;
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
