"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TargetBodyPart } from "@/types/database";

interface BodyPartInsight {
    type: "imbalance" | "undertrained" | "pr" | "performing";
    bodyPart: TargetBodyPart;
    title: string;
    description: string;
    value: string;
    severity: "low" | "moderate" | "high" | "positive";
}

export function useDashboardInsights() {
    const [insights, setInsights] = useState<BodyPartInsight[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInsights();
    }, []);

    const fetchInsights = async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            const allInsights: BodyPartInsight[] = [];

            // Get data from last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: sessions } = await supabase
                .from("workout_sessions")
                .select("id, started_at")
                .eq("user_id", user.id)
                .gte("started_at", thirtyDaysAgo.toISOString())
                .not("completed_at", "is", null);

            if (!sessions || sessions.length === 0) {
                setLoading(false);
                return;
            }

            const sessionIds = sessions.map((s) => s.id);

            const { data: exercises } = await supabase
                .from("exercises")
                .select("*")
                .eq("user_id", user.id);

            const { data: exerciseLogs } = await supabase
                .from("exercise_logs")
                .select("*")
                .in("workout_session_id", sessionIds);

            if (!exerciseLogs || exerciseLogs.length === 0) {
                setLoading(false);
                return;
            }

            const exerciseLogIds = exerciseLogs.map((e) => e.id);

            const { data: setLogs } = await supabase
                .from("set_logs")
                .select("*")
                .in("exercise_log_id", exerciseLogIds);

            // Calculate body part volumes
            const bodyPartVolumes = new Map<TargetBodyPart, number>();
            const bodyPartLastTrained = new Map<TargetBodyPart, Date>();
            const bodyPartPRs = new Map<
                TargetBodyPart,
                { weight: number; exercise: string }
            >();

            exerciseLogs.forEach((log) => {
                const exercise = exercises?.find(
                    (e) => e.id === log.exercise_id
                );
                if (!exercise || !exercise.target_body_part) return;

                const bodyPart = exercise.target_body_part;
                const session = sessions.find(
                    (s) => s.id === log.workout_session_id
                );

                if (session) {
                    const sessionDate = new Date(session.started_at);
                    const lastTrained = bodyPartLastTrained.get(bodyPart);

                    if (!lastTrained || sessionDate > lastTrained) {
                        bodyPartLastTrained.set(bodyPart, sessionDate);
                    }
                }

                const logSets =
                    setLogs?.filter((s) => s.exercise_log_id === log.id) || [];

                logSets.forEach((set) => {
                    if (set.weight && set.reps) {
                        const volume = set.weight * set.reps;
                        bodyPartVolumes.set(
                            bodyPart,
                            (bodyPartVolumes.get(bodyPart) || 0) + volume
                        );

                        // Track PRs
                        const currentPR = bodyPartPRs.get(bodyPart);
                        if (!currentPR || set.weight > currentPR.weight) {
                            bodyPartPRs.set(bodyPart, {
                                weight: set.weight,
                                exercise: exercise.name,
                            });
                        }
                    }
                });
            });

            // 1. Find biggest imbalance
            const imbalancePairs: Array<[TargetBodyPart, TargetBodyPart]> = [
                ["chest", "back"],
                ["quads", "hamstrings"],
                ["biceps", "triceps"],
                ["adductors", "abductors"],
            ];

            let biggestImbalance: BodyPartInsight | null = null;
            let maxImbalanceRatio = 0;

            imbalancePairs.forEach(([part1, part2]) => {
                const vol1 = bodyPartVolumes.get(part1) || 0;
                const vol2 = bodyPartVolumes.get(part2) || 0;

                if (vol1 > 0 && vol2 > 0) {
                    const ratio = vol1 > vol2 ? vol1 / vol2 : vol2 / vol1;
                    const stronger = vol1 > vol2 ? part1 : part2;
                    const weaker = vol1 > vol2 ? part2 : part1;

                    if (ratio > maxImbalanceRatio && ratio > 1.25) {
                        maxImbalanceRatio = ratio;
                        const percentage = ((ratio - 1) * 100).toFixed(0);

                        biggestImbalance = {
                            type: "imbalance",
                            bodyPart: weaker,
                            title: "Dysproporcja wykryta",
                            description: `${getBodyPartLabel(
                                stronger
                            )} jest o ${percentage}% silniejszy`,
                            value: `${percentage}%`,
                            severity:
                                ratio > 1.5
                                    ? "high"
                                    : ratio > 1.35
                                    ? "moderate"
                                    : "low",
                        };
                    }
                }
            });

            if (biggestImbalance) {
                allInsights.push(biggestImbalance);
            }

            // 2. Find most undertrained body part
            const now = new Date();
            let mostUndertrained: BodyPartInsight | null = null;
            let maxDaysSinceTraining = 0;

            bodyPartLastTrained.forEach((lastDate, bodyPart) => {
                const daysSince = Math.floor(
                    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                if (daysSince > maxDaysSinceTraining && daysSince > 7) {
                    maxDaysSinceTraining = daysSince;

                    mostUndertrained = {
                        type: "undertrained",
                        bodyPart,
                        title: "Zaniedbana partia",
                        description: `Ostatni trening: ${daysSince} dni temu`,
                        value: `${daysSince}d`,
                        severity:
                            daysSince > 30
                                ? "high"
                                : daysSince > 14
                                ? "moderate"
                                : "low",
                    };
                }
            });

            if (mostUndertrained) {
                allInsights.push(mostUndertrained);
            }

            // 3. Recent PR
            if (bodyPartPRs.size > 0) {
                const sortedPRs = Array.from(bodyPartPRs.entries()).sort(
                    (a, b) => b[1].weight - a[1].weight
                );

                const [bodyPart, prData] = sortedPRs[0];

                allInsights.push({
                    type: "pr",
                    bodyPart,
                    title: "Najlepszy wynik",
                    description: prData.exercise,
                    value: `${prData.weight}kg`,
                    severity: "positive",
                });
            }

            // 4. Best performing body part (highest volume)
            if (bodyPartVolumes.size > 0) {
                const sortedVolumes = Array.from(
                    bodyPartVolumes.entries()
                ).sort((a, b) => b[1] - a[1]);

                const [bodyPart, volume] = sortedVolumes[0];

                allInsights.push({
                    type: "performing",
                    bodyPart,
                    title: "Najczęściej trenowana",
                    description: "Najwyższa objętość w ostatnim miesiącu",
                    value: `${(volume / 1000).toFixed(1)}k kg`,
                    severity: "positive",
                });
            }

            setInsights(allInsights);
        } catch (error) {
            console.error("Error fetching insights:", error);
        } finally {
            setLoading(false);
        }
    };

    return { insights, loading };
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
