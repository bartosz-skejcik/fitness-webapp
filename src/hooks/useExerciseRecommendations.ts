"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TargetBodyPart, Exercise } from "@/types/database";

interface ExerciseRecommendation {
    bodyPart: TargetBodyPart;
    bodyPartLabel: string;
    reason: string;
    priority: "high" | "moderate" | "low";
    exercises: Exercise[];
    daysSinceLastTraining: number;
    volumeDeficit: number; // Compared to average
}

export function useExerciseRecommendations() {
    const [recommendations, setRecommendations] = useState<
        ExerciseRecommendation[]
    >([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecommendations();
    }, []);

    const fetchRecommendations = async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            // Get last 30 days of training data
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: sessions } = await supabase
                .from("workout_sessions")
                .select("id, started_at")
                .eq("user_id", user.id)
                .gte("started_at", thirtyDaysAgo.toISOString())
                .not("completed_at", "is", null);

            // Fetch all user exercises
            const { data: allExercises } = await supabase
                .from("exercises")
                .select("*")
                .eq("user_id", user.id);

            if (
                !allExercises ||
                allExercises.length === 0 ||
                !sessions ||
                sessions.length === 0
            ) {
                setLoading(false);
                return;
            }

            const sessionIds = sessions.map((s) => s.id);

            const { data: exerciseLogs } = await supabase
                .from("exercise_logs")
                .select("*")
                .in("workout_session_id", sessionIds);

            const { data: setLogs } = await supabase
                .from("set_logs")
                .select("*")
                .in(
                    "exercise_log_id",
                    (exerciseLogs || []).map((e) => e.id)
                );

            // Calculate metrics per body part
            const bodyPartMetrics = new Map<
                TargetBodyPart,
                {
                    volume: number;
                    lastTrained: Date | null;
                    exerciseCount: number;
                }
            >();

            const now = new Date();

            allExercises.forEach((exercise) => {
                if (!exercise.target_body_part) return;

                const bodyPart = exercise.target_body_part;

                if (!bodyPartMetrics.has(bodyPart)) {
                    bodyPartMetrics.set(bodyPart, {
                        volume: 0,
                        lastTrained: null,
                        exerciseCount: 0,
                    });
                }

                const metrics = bodyPartMetrics.get(bodyPart)!;

                // Find logs for this exercise
                const exerciseLogsForThis = (exerciseLogs || []).filter(
                    (log) => log.exercise_id === exercise.id
                );

                if (exerciseLogsForThis.length > 0) {
                    metrics.exerciseCount++;

                    // Find last trained date
                    exerciseLogsForThis.forEach((log) => {
                        const session = sessions.find(
                            (s) => s.id === log.workout_session_id
                        );
                        if (session) {
                            const sessionDate = new Date(session.started_at);
                            if (
                                !metrics.lastTrained ||
                                sessionDate > metrics.lastTrained
                            ) {
                                metrics.lastTrained = sessionDate;
                            }
                        }

                        // Calculate volume
                        const sets = (setLogs || []).filter(
                            (set) => set.exercise_log_id === log.id
                        );
                        sets.forEach((set) => {
                            if (set.weight && set.reps) {
                                metrics.volume += set.weight * set.reps;
                            }
                        });
                    });
                }
            });

            // Calculate average volume across all body parts
            const volumes = Array.from(bodyPartMetrics.values()).map(
                (m) => m.volume
            );
            const avgVolume =
                volumes.length > 0
                    ? volumes.reduce((sum, v) => sum + v, 0) / volumes.length
                    : 0;

            // Generate recommendations
            const recs: ExerciseRecommendation[] = [];

            bodyPartMetrics.forEach((metrics, bodyPart) => {
                const daysSinceTraining = metrics.lastTrained
                    ? Math.floor(
                          (now.getTime() - metrics.lastTrained.getTime()) /
                              (1000 * 60 * 60 * 24)
                      )
                    : 999;

                const volumeDeficit =
                    avgVolume > 0
                        ? ((avgVolume - metrics.volume) / avgVolume) * 100
                        : 0;

                // Only recommend if undertrained or low volume
                if (daysSinceTraining > 7 || volumeDeficit > 20) {
                    const bodyPartExercises = allExercises.filter(
                        (ex) => ex.target_body_part === bodyPart
                    );

                    let priority: "high" | "moderate" | "low" = "low";
                    let reason = "";

                    if (daysSinceTraining > 21) {
                        priority = "high";
                        reason = `Nie trenowane od ${daysSinceTraining} dni`;
                    } else if (daysSinceTraining > 14) {
                        priority = "moderate";
                        reason = `Ostatni trening ${daysSinceTraining} dni temu`;
                    } else if (volumeDeficit > 40) {
                        priority = "high";
                        reason = `Objętość o ${volumeDeficit.toFixed(
                            0
                        )}% niższa od średniej`;
                    } else if (volumeDeficit > 20) {
                        priority = "moderate";
                        reason = `Niska objętość treningowa`;
                    } else {
                        reason = `Ostatni trening ${daysSinceTraining} dni temu`;
                    }

                    if (bodyPartExercises.length > 0) {
                        recs.push({
                            bodyPart,
                            bodyPartLabel: getBodyPartLabel(bodyPart),
                            reason,
                            priority,
                            exercises: bodyPartExercises,
                            daysSinceLastTraining: daysSinceTraining,
                            volumeDeficit,
                        });
                    }
                }
            });

            // Sort by priority: high -> moderate -> low, then by days since training
            recs.sort((a, b) => {
                const priorityOrder = { high: 0, moderate: 1, low: 2 };
                const priorityDiff =
                    priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return b.daysSinceLastTraining - a.daysSinceLastTraining;
            });

            setRecommendations(recs.slice(0, 5)); // Top 5 recommendations
        } catch (error) {
            console.error("Error fetching recommendations:", error);
        } finally {
            setLoading(false);
        }
    };

    return {
        recommendations,
        loading,
        refreshRecommendations: fetchRecommendations,
    };
}

function getBodyPartLabel(bodyPart: TargetBodyPart): string {
    const labels: Record<TargetBodyPart, string> = {
        quads: "Czworogłowe ud",
        hamstrings: "Dwugłowe ud",
        glutes: "Pośladki",
        chest: "Klatka piersiowa",
        back: "Plecy",
        biceps: "Biceps",
        triceps: "Triceps",
        shoulders: "Barki",
        calves: "Łydki",
        core: "Brzuch",
        forearms: "Przedramiona",
        neck: "Kark",
        adductors: "Przywodziciele",
        abductors: "Odwodziciele",
    };
    return labels[bodyPart] || bodyPart;
}
