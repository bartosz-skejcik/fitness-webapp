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
        []
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
                .select("*")
                .eq("user_id", user.id)
                .eq("is_active", true)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const typedGoals = data as BodyPartGoal[];
            setGoals(typedGoals);

            // Calculate progress for each goal
            const progress = await Promise.all(
                typedGoals.map((goal) => calculateGoalProgress(goal))
            );

            setGoalsWithProgress(progress);
        } catch (error) {
            console.error("Error fetching goals:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateGoalProgress = async (
        goal: BodyPartGoal
    ): Promise<GoalProgress> => {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return {
                goal,
                currentValue: 0,
                progress: 0,
                isAchieved: false,
            };
        }

        const now = new Date();
        let startDate: Date;

        if (goal.timeframe === "weekly") {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
        } else {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 30);
        }

        if (goal.goal_type === "volume") {
            // Calculate total volume for the body part
            const { data: sessions } = await supabase
                .from("workout_sessions")
                .select("id")
                .eq("user_id", user.id)
                .gte("started_at", startDate.toISOString())
                .not("completed_at", "is", null);

            if (!sessions || sessions.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const sessionIds = sessions.map((s) => s.id);

            const { data: exercises } = await supabase
                .from("exercises")
                .select("id")
                .eq("target_body_part", goal.body_part);

            if (!exercises || exercises.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const exerciseIds = exercises.map((e) => e.id);

            const { data: exerciseLogs } = await supabase
                .from("exercise_logs")
                .select("id")
                .in("workout_session_id", sessionIds)
                .in("exercise_id", exerciseIds);

            if (!exerciseLogs || exerciseLogs.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const exerciseLogIds = exerciseLogs.map((e) => e.id);

            const { data: sets } = await supabase
                .from("set_logs")
                .select("weight, reps")
                .in("exercise_log_id", exerciseLogIds);

            const totalVolume = (sets || []).reduce((sum, set) => {
                if (set.weight && set.reps) {
                    return sum + set.weight * set.reps;
                }
                return sum;
            }, 0);

            const targetValue = goal.target_value || 0;
            const progress =
                targetValue > 0 ? (totalVolume / targetValue) * 100 : 0;

            return {
                goal,
                currentValue: totalVolume,
                progress: Math.min(progress, 100),
                isAchieved: totalVolume >= targetValue,
            };
        } else if (goal.goal_type === "frequency") {
            // Calculate training frequency for the body part
            const { data: sessions } = await supabase
                .from("workout_sessions")
                .select("id, started_at")
                .eq("user_id", user.id)
                .gte("started_at", startDate.toISOString())
                .not("completed_at", "is", null);

            if (!sessions || sessions.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const sessionIds = sessions.map((s) => s.id);

            const { data: exercises } = await supabase
                .from("exercises")
                .select("id")
                .eq("target_body_part", goal.body_part);

            if (!exercises || exercises.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const exerciseIds = exercises.map((e) => e.id);

            const { data: exerciseLogs } = await supabase
                .from("exercise_logs")
                .select("workout_session_id")
                .in("workout_session_id", sessionIds)
                .in("exercise_id", exerciseIds);

            // Count unique sessions where this body part was trained
            const uniqueSessions = new Set(
                (exerciseLogs || []).map((log) => log.workout_session_id)
            );

            const frequency = uniqueSessions.size;
            const targetValue = goal.target_value || 0;
            const progress =
                targetValue > 0 ? (frequency / targetValue) * 100 : 0;

            return {
                goal,
                currentValue: frequency,
                progress: Math.min(progress, 100),
                isAchieved: frequency >= targetValue,
            };
        } else if (goal.goal_type === "specific_exercises") {
            // Check if target exercises were performed
            const { data: sessions } = await supabase
                .from("workout_sessions")
                .select("id")
                .eq("user_id", user.id)
                .gte("started_at", startDate.toISOString())
                .not("completed_at", "is", null);

            if (!sessions || sessions.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const sessionIds = sessions.map((s) => s.id);
            const targetExercises = goal.target_exercises || [];

            if (targetExercises.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const { data: exercises } = await supabase
                .from("exercises")
                .select("id, name")
                .in("name", targetExercises);

            if (!exercises || exercises.length === 0) {
                return {
                    goal,
                    currentValue: 0,
                    progress: 0,
                    isAchieved: false,
                };
            }

            const exerciseIds = exercises.map((e) => e.id);

            const { data: exerciseLogs } = await supabase
                .from("exercise_logs")
                .select("exercise_id")
                .in("workout_session_id", sessionIds)
                .in("exercise_id", exerciseIds);

            // Count unique exercises performed
            const uniqueExercises = new Set(
                (exerciseLogs || []).map((log) => log.exercise_id)
            );

            const completedCount = uniqueExercises.size;
            const progress = (completedCount / targetExercises.length) * 100;

            return {
                goal,
                currentValue: completedCount,
                progress: Math.min(progress, 100),
                isAchieved: completedCount >= targetExercises.length,
            };
        }

        return {
            goal,
            currentValue: 0,
            progress: 0,
            isAchieved: false,
        };
    };

    const createGoal = async (
        bodyPart: TargetBodyPart,
        goalType: "volume" | "frequency" | "specific_exercises",
        targetValue: number | undefined,
        targetExercises: string[] | undefined,
        timeframe: "weekly" | "monthly"
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
        }
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
