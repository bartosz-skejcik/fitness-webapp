import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TargetBodyPart } from "@/types/database";

export interface BodyPartImbalance {
    muscleGroup: string; // e.g., "chest vs back", "quads vs hamstrings"
    part1: TargetBodyPart;
    part2: TargetBodyPart;
    volume1: number;
    volume2: number;
    difference: number; // percentage difference
    isImbalanced: boolean; // true if > 20% difference
}

export interface UndertrainedBodyPart {
    bodyPart: TargetBodyPart;
    daysSinceLastTrained: number;
    severity: "warning" | "critical"; // warning: >14 days, critical: >30 days
    timesThisMonth: number;
}

export interface VolumeDistribution {
    bodyPart: TargetBodyPart;
    volume: number;
    percentage: number;
}

export interface WeeklyBodyPartVolume {
    weekStart: string; // ISO date string
    bodyPart: TargetBodyPart;
    volume: number;
}

export interface BodyPartProgressHistory {
    bodyPart: TargetBodyPart;
    weeklyData: Array<{ week: string; volume: number }>;
}

export interface BodyPartAnalysisData {
    imbalances: BodyPartImbalance[];
    undertrainedParts: UndertrainedBodyPart[];
    volumeDistribution: VolumeDistribution[];
    recommendations: string[];
    progressHistory: BodyPartProgressHistory[];
}

function getPolishBodyPartName(bodyPart: TargetBodyPart): string {
    const labels: Record<TargetBodyPart, string> = {
        quads: "Czworogłowe ud",
        hamstrings: "Dwugłowe ud",
        glutes: "Pośladki",
        chest: "Klatka",
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

export function useBodyPartAnalysis(userId: string | undefined) {
    const [data, setData] = useState<BodyPartAnalysisData>({
        imbalances: [],
        undertrainedParts: [],
        volumeDistribution: [],
        recommendations: [],
        progressHistory: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        async function fetchBodyPartAnalysis() {
            const supabase = createClient();

            try {
                setLoading(true);
                setError(null);

                // Fetch all workout sessions
                const { data: sessions, error: sessionsError } = await supabase
                    .from("workout_sessions")
                    .select("id, started_at")
                    .eq("user_id", userId)
                    .not("completed_at", "is", null);

                if (sessionsError) throw sessionsError;

                const sessionIds = (sessions || []).map((s) => s.id);

                if (sessionIds.length === 0) {
                    setLoading(false);
                    return;
                }

                // Fetch exercise logs with exercise details
                const { data: exerciseLogs, error: logsError } = await supabase
                    .from("exercise_logs")
                    .select(
                        "id, exercise_id, exercises(name, target_body_part)"
                    )
                    .in("workout_session_id", sessionIds);

                if (logsError) throw logsError;

                const exerciseLogIds = (exerciseLogs || []).map((l) => l.id);

                if (exerciseLogIds.length === 0) {
                    setLoading(false);
                    return;
                }

                // Fetch all set logs
                const { data: setLogs, error: setsError } = await supabase
                    .from("set_logs")
                    .select("exercise_log_id, reps, weight, created_at")
                    .in("exercise_log_id", exerciseLogIds)
                    .eq("completed", true);

                if (setsError) throw setsError;

                // Calculate volume and frequency per body part
                const bodyPartMap = new Map<
                    TargetBodyPart,
                    {
                        volume: number;
                        lastTrained: string | null;
                        timesThisMonth: number;
                    }
                >();

                const now = new Date();
                const oneMonthAgo = new Date();
                oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

                let totalVolume = 0;

                (setLogs || []).forEach((set) => {
                    const log = exerciseLogs?.find(
                        (l) => l.id === set.exercise_log_id
                    );
                    if (!log?.exercises) return;

                    const exercise = Array.isArray(log.exercises)
                        ? log.exercises[0]
                        : log.exercises;
                    const targetBodyPart = exercise.target_body_part as
                        | TargetBodyPart
                        | undefined;

                    if (!targetBodyPart) return;

                    const weight = set.weight || 0;
                    const reps = set.reps;
                    const volume = weight * reps;
                    const setDate = new Date(set.created_at);

                    totalVolume += volume;

                    const existing = bodyPartMap.get(targetBodyPart) || {
                        volume: 0,
                        lastTrained: null,
                        timesThisMonth: 0,
                    };

                    bodyPartMap.set(targetBodyPart, {
                        volume: existing.volume + volume,
                        lastTrained:
                            !existing.lastTrained ||
                            set.created_at > existing.lastTrained
                                ? set.created_at
                                : existing.lastTrained,
                        timesThisMonth:
                            existing.timesThisMonth +
                            (setDate >= oneMonthAgo ? 1 : 0),
                    });
                });

                // Calculate volume distribution
                const volumeDistribution: VolumeDistribution[] = Array.from(
                    bodyPartMap.entries()
                ).map(([bodyPart, data]) => ({
                    bodyPart,
                    volume: data.volume,
                    percentage: (data.volume / totalVolume) * 100,
                }));

                // Detect imbalances
                const opposingMuscles: [
                    TargetBodyPart,
                    TargetBodyPart,
                    string
                ][] = [
                    ["chest", "back", "Klatka vs Plecy"],
                    ["quads", "hamstrings", "Czworogłowe ud vs Dwugłowe ud"],
                    ["biceps", "triceps", "Biceps vs Triceps"],
                    [
                        "abductors",
                        "adductors",
                        "Odwodziciele vs Przywodziciele",
                    ],
                ];

                const imbalances: BodyPartImbalance[] = [];

                opposingMuscles.forEach(([part1, part2, label]) => {
                    const data1 = bodyPartMap.get(part1);
                    const data2 = bodyPartMap.get(part2);

                    if (data1 && data2) {
                        const volume1 = data1.volume;
                        const volume2 = data2.volume;
                        const difference =
                            Math.abs(volume1 - volume2) /
                            Math.max(volume1, volume2);

                        imbalances.push({
                            muscleGroup: label,
                            part1,
                            part2,
                            volume1,
                            volume2,
                            difference: difference * 100,
                            isImbalanced: difference > 0.2,
                        });
                    }
                });

                // Detect undertrained body parts
                const undertrainedParts: UndertrainedBodyPart[] = [];

                bodyPartMap.forEach((data, bodyPart) => {
                    if (data.lastTrained) {
                        const daysSince = Math.floor(
                            (now.getTime() -
                                new Date(data.lastTrained).getTime()) /
                                (1000 * 60 * 60 * 24)
                        );

                        if (daysSince > 14) {
                            undertrainedParts.push({
                                bodyPart,
                                daysSinceLastTrained: daysSince,
                                severity:
                                    daysSince > 30 ? "critical" : "warning",
                                timesThisMonth: data.timesThisMonth,
                            });
                        }
                    }
                });

                // Generate recommendations
                const recommendations: string[] = [];

                // Imbalance recommendations
                const criticalImbalances = imbalances.filter(
                    (i) => i.isImbalanced && i.difference > 30
                );
                if (criticalImbalances.length > 0) {
                    criticalImbalances.forEach((imb) => {
                        const weaker =
                            imb.volume1 < imb.volume2 ? imb.part1 : imb.part2;
                        recommendations.push(
                            `Zwiększ trening ${getPolishBodyPartName(
                                weaker
                            )} - wykryto znaczną dysbalans (${imb.difference.toFixed(
                                0
                            )}%)`
                        );
                    });
                }

                // Undertrained recommendations
                const criticalUndertrained = undertrainedParts.filter(
                    (u) => u.severity === "critical"
                );
                if (criticalUndertrained.length > 0) {
                    criticalUndertrained.forEach((part) => {
                        recommendations.push(
                            `${getPolishBodyPartName(
                                part.bodyPart
                            )} - brak treningu od ${
                                part.daysSinceLastTrained
                            } dni`
                        );
                    });
                }

                // Volume distribution recommendations
                const lowVolumeParts = volumeDistribution.filter(
                    (v) => v.percentage < 3 && v.volume > 0
                );
                if (lowVolumeParts.length > 0) {
                    recommendations.push(
                        `Rozważ zwiększenie objętości dla: ${lowVolumeParts
                            .map((p) => getPolishBodyPartName(p.bodyPart))
                            .join(", ")}`
                    );
                }

                // Positive feedback
                if (imbalances.every((i) => !i.isImbalanced)) {
                    recommendations.push(
                        "Świetna praca! Twój trening jest dobrze zbalansowany"
                    );
                }

                if (undertrainedParts.length === 0) {
                    recommendations.push(
                        "Doskonała częstotliwość treningu - wszystkie partie trenowane regularnie"
                    );
                }

                // Calculate 12-week progress history per body part
                const progressHistory: BodyPartProgressHistory[] = [];
                const twelveWeeksAgo = new Date();
                twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks

                // Group sets by week and body part
                const weeklyVolumeMap = new Map<
                    string,
                    Map<TargetBodyPart, number>
                >();

                (setLogs || []).forEach((set) => {
                    const log = exerciseLogs?.find(
                        (l) => l.id === set.exercise_log_id
                    );
                    if (!log?.exercises) return;

                    const exercise = Array.isArray(log.exercises)
                        ? log.exercises[0]
                        : log.exercises;
                    const targetBodyPart = exercise.target_body_part as
                        | TargetBodyPart
                        | undefined;

                    if (!targetBodyPart) return;

                    const setDate = new Date(set.created_at);
                    if (setDate < twelveWeeksAgo) return;

                    // Get start of week (Monday)
                    const weekStart = new Date(setDate);
                    const day = weekStart.getDay();
                    const diff =
                        weekStart.getDate() - day + (day === 0 ? -6 : 1);
                    weekStart.setDate(diff);
                    weekStart.setHours(0, 0, 0, 0);

                    const weekKey = weekStart.toISOString().split("T")[0];
                    const volume = (set.weight || 0) * set.reps;

                    if (!weeklyVolumeMap.has(weekKey)) {
                        weeklyVolumeMap.set(weekKey, new Map());
                    }

                    const weekData = weeklyVolumeMap.get(weekKey)!;
                    weekData.set(
                        targetBodyPart,
                        (weekData.get(targetBodyPart) || 0) + volume
                    );
                });

                // Convert to progress history format
                const bodyPartsWithData = new Set<TargetBodyPart>();
                weeklyVolumeMap.forEach((bodyParts) => {
                    bodyParts.forEach((_, bodyPart) => {
                        bodyPartsWithData.add(bodyPart);
                    });
                });

                bodyPartsWithData.forEach((bodyPart) => {
                    const weeklyData: Array<{ week: string; volume: number }> =
                        [];

                    // Generate all weeks in the last 12 weeks
                    for (let i = 11; i >= 0; i--) {
                        const weekDate = new Date();
                        weekDate.setDate(weekDate.getDate() - i * 7);
                        const day = weekDate.getDay();
                        const diff =
                            weekDate.getDate() - day + (day === 0 ? -6 : 1);
                        weekDate.setDate(diff);
                        weekDate.setHours(0, 0, 0, 0);

                        const weekKey = weekDate.toISOString().split("T")[0];
                        const volume =
                            weeklyVolumeMap.get(weekKey)?.get(bodyPart) || 0;

                        weeklyData.push({
                            week: weekKey,
                            volume: Math.round(volume),
                        });
                    }

                    progressHistory.push({
                        bodyPart,
                        weeklyData,
                    });
                });

                setData({
                    imbalances,
                    undertrainedParts,
                    volumeDistribution: volumeDistribution.sort(
                        (a, b) => b.volume - a.volume
                    ),
                    recommendations,
                    progressHistory,
                });
            } catch (err) {
                console.error("Error fetching body part analysis:", err);
                setError(
                    err instanceof Error ? err : new Error("Unknown error")
                );
            } finally {
                setLoading(false);
            }
        }

        fetchBodyPartAnalysis();
    }, [userId]);

    return { data, loading, error };
}
