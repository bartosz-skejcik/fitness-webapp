import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SymmetryMetric {
    exerciseId: string;
    exerciseName: string;
    leftVolume: number;
    rightVolume: number;
    leftAvgWeight: number;
    rightAvgWeight: number;
    leftAvgReps: number;
    rightAvgReps: number;
    leftSetsCount: number;
    rightSetsCount: number;
    imbalancePercentage: number;
    strongerSide: "left" | "right" | "balanced";
    riskLevel: "low" | "moderate" | "high";
}

export interface SymmetrySummary {
    totalUnilateralExercises: number;
    exercisesWithImbalance: number;
    averageImbalance: number;
    worstImbalance: SymmetryMetric | null;
    metrics: SymmetryMetric[];
}

export function useSymmetryAnalysis(weekCount: number = 12) {
    const { user } = useAuth();
    const [summary, setSummary] = useState<SymmetrySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (user) {
            fetchSymmetryData();
        }
    }, [user, weekCount]);

    async function fetchSymmetryData() {
        setLoading(true);
        try {
            const weeksAgo = new Date();
            weeksAgo.setDate(weeksAgo.getDate() - weekCount * 7);

            // Get all completed workout sessions in the time range
            const { data: sessions, error: sessionsError } = await supabase
                .from("workout_sessions")
                .select("id")
                .eq("user_id", user?.id)
                .not("completed_at", "is", null)
                .gte("completed_at", weeksAgo.toISOString());

            if (sessionsError) throw sessionsError;

            if (!sessions || sessions.length === 0) {
                setSummary({
                    totalUnilateralExercises: 0,
                    exercisesWithImbalance: 0,
                    averageImbalance: 0,
                    worstImbalance: null,
                    metrics: [],
                });
                return;
            }

            const sessionIds = sessions.map((s) => s.id);

            // Get all exercise logs from these sessions with unilateral exercises
            const { data: exerciseLogs, error: logsError } = await supabase
                .from("exercise_logs")
                .select(
                    `
                    id,
                    exercise_id,
                    exercises!inner(
                        id,
                        name,
                        is_unilateral
                    )
                `
                )
                .in("workout_session_id", sessionIds)
                .eq("exercises.is_unilateral", true);

            if (logsError) throw logsError;

            if (!exerciseLogs || exerciseLogs.length === 0) {
                setSummary({
                    totalUnilateralExercises: 0,
                    exercisesWithImbalance: 0,
                    averageImbalance: 0,
                    worstImbalance: null,
                    metrics: [],
                });
                return;
            }

            const exerciseLogIds = exerciseLogs.map((log) => log.id);

            // Get all set logs for these exercises
            const { data: setLogs, error: setsError } = await supabase
                .from("set_logs")
                .select("*")
                .in("exercise_log_id", exerciseLogIds)
                .eq("completed", true)
                .not("side", "is", null);

            if (setsError) throw setsError;

            // Group set logs by exercise and calculate metrics
            const exerciseMetrics = new Map<
                string,
                {
                    exerciseId: string;
                    exerciseName: string;
                    leftSets: typeof setLogs;
                    rightSets: typeof setLogs;
                }
            >();

            exerciseLogs.forEach((log) => {
                if (!exerciseMetrics.has(log.exercise_id)) {
                    exerciseMetrics.set(log.exercise_id, {
                        exerciseId: log.exercise_id,
                        exerciseName: log.exercises[0].name,
                        leftSets: [],
                        rightSets: [],
                    });
                }
            });

            setLogs?.forEach((set) => {
                const log = exerciseLogs.find(
                    (l) => l.id === set.exercise_log_id
                );
                if (log) {
                    const metric = exerciseMetrics.get(log.exercise_id);
                    if (metric) {
                        if (set.side === "left") {
                            metric.leftSets.push(set);
                        } else if (set.side === "right") {
                            metric.rightSets.push(set);
                        }
                    }
                }
            });

            // Calculate symmetry metrics for each exercise
            const metrics: SymmetryMetric[] = [];

            exerciseMetrics.forEach((data) => {
                const leftSets = data.leftSets;
                const rightSets = data.rightSets;

                if (leftSets.length === 0 && rightSets.length === 0) return;

                const leftVolume = leftSets.reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                );
                const rightVolume = rightSets.reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                );

                const leftAvgWeight =
                    leftSets.length > 0
                        ? leftSets.reduce(
                              (sum, set) => sum + (set.weight || 0),
                              0
                          ) / leftSets.length
                        : 0;
                const rightAvgWeight =
                    rightSets.length > 0
                        ? rightSets.reduce(
                              (sum, set) => sum + (set.weight || 0),
                              0
                          ) / rightSets.length
                        : 0;

                const leftAvgReps =
                    leftSets.length > 0
                        ? leftSets.reduce((sum, set) => sum + set.reps, 0) /
                          leftSets.length
                        : 0;
                const rightAvgReps =
                    rightSets.length > 0
                        ? rightSets.reduce((sum, set) => sum + set.reps, 0) /
                          rightSets.length
                        : 0;

                const totalVolume = leftVolume + rightVolume;
                const imbalancePercentage =
                    totalVolume > 0
                        ? (Math.abs(leftVolume - rightVolume) /
                              (totalVolume / 2)) *
                          100
                        : 0;

                const strongerSide: "left" | "right" | "balanced" =
                    imbalancePercentage < 10
                        ? "balanced"
                        : leftVolume > rightVolume
                        ? "left"
                        : "right";

                const riskLevel: "low" | "moderate" | "high" =
                    imbalancePercentage < 15
                        ? "low"
                        : imbalancePercentage < 25
                        ? "moderate"
                        : "high";

                metrics.push({
                    exerciseId: data.exerciseId,
                    exerciseName: data.exerciseName,
                    leftVolume,
                    rightVolume,
                    leftAvgWeight,
                    rightAvgWeight,
                    leftAvgReps,
                    rightAvgReps,
                    leftSetsCount: leftSets.length,
                    rightSetsCount: rightSets.length,
                    imbalancePercentage,
                    strongerSide,
                    riskLevel,
                });
            });

            // Sort by imbalance percentage (worst first)
            metrics.sort(
                (a, b) => b.imbalancePercentage - a.imbalancePercentage
            );

            const exercisesWithImbalance = metrics.filter(
                (m) => m.imbalancePercentage >= 15
            ).length;

            const averageImbalance =
                metrics.length > 0
                    ? metrics.reduce(
                          (sum, m) => sum + m.imbalancePercentage,
                          0
                      ) / metrics.length
                    : 0;

            setSummary({
                totalUnilateralExercises: metrics.length,
                exercisesWithImbalance,
                averageImbalance,
                worstImbalance: metrics.length > 0 ? metrics[0] : null,
                metrics,
            });
        } catch (error) {
            console.error("Error fetching symmetry data:", error);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }

    return { summary, loading, refetch: fetchSymmetryData };
}
