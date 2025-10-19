import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { WorkoutType, TargetBodyPart } from "@/types/database";

export interface ExerciseRecord {
    exerciseId: string;
    exerciseName: string;
    maxWeight: number;
    maxReps: number;
    estimatedOneRM: number;
    lastPerformed: string;
    targetBodyPart?: TargetBodyPart | null;
}

export interface VolumeData {
    totalVolume: number;
    weeklyVolume: number;
    avgReps: number;
    avgSets: number;
}

export interface MostPerformedExercise {
    exerciseId: string;
    exerciseName: string;
    count: number;
    muscleGroup?: WorkoutType;
    targetBodyPart?: TargetBodyPart | null;
}

export interface MuscleGroupVolume {
    muscleGroup: string;
    volume: number;
    percentage: number;
}

export interface BodyPartVolume {
    bodyPart: TargetBodyPart;
    volume: number;
    percentage: number;
    exerciseCount: number;
    lastTrained: string | null;
}

export interface BodyPartPR {
    bodyPart: TargetBodyPart;
    exerciseId: string;
    exerciseName: string;
    maxWeight: number;
    maxReps: number;
    estimatedOneRM: number;
    lastPerformed: string;
}

export interface BodyPartFrequency {
    bodyPart: TargetBodyPart;
    timesThisWeek: number;
    timesThisMonth: number;
    daysSinceLastTrained: number | null;
}

export interface StrengthStats {
    personalRecords: ExerciseRecord[];
    volumeData: VolumeData;
    mostPerformedExercises: MostPerformedExercise[];
    muscleGroupBalance: MuscleGroupVolume[];
    bodyPartVolumes: BodyPartVolume[];
    bodyPartPRs: BodyPartPR[];
    bodyPartFrequency: BodyPartFrequency[];
}

export function useStrengthStats(userId: string | undefined) {
    const [stats, setStats] = useState<StrengthStats>({
        personalRecords: [],
        volumeData: {
            totalVolume: 0,
            weeklyVolume: 0,
            avgReps: 0,
            avgSets: 0,
        },
        mostPerformedExercises: [],
        muscleGroupBalance: [],
        bodyPartVolumes: [],
        bodyPartPRs: [],
        bodyPartFrequency: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        async function fetchStrengthStats() {
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
                        "id, exercise_id, exercises(name, muscle_group, target_body_part)"
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

                // Calculate stats
                const exerciseMap = new Map<
                    string,
                    {
                        exerciseId: string;
                        name: string;
                        muscleGroup?: WorkoutType;
                        targetBodyPart?: TargetBodyPart;
                        maxWeight: number;
                        maxReps: number;
                        estimatedOneRM: number;
                        lastPerformed: string;
                        count: number;
                        totalVolume: number;
                    }
                >();

                let totalVolume = 0;
                let weeklyVolume = 0;
                let totalReps = 0;
                let totalSetsCount = 0;

                const now = new Date();
                const weekAgo = new Date(
                    now.getTime() - 7 * 24 * 60 * 60 * 1000
                );

                // Process all sets
                (setLogs || []).forEach((set) => {
                    const log = exerciseLogs?.find(
                        (l) => l.id === set.exercise_log_id
                    );
                    if (!log?.exercises) return;

                    const exerciseId = log.exercise_id;
                    // Supabase returns nested data as an array with one item or single object
                    const exercise = Array.isArray(log.exercises)
                        ? log.exercises[0]
                        : log.exercises;
                    const exerciseName = exercise.name as string;
                    const muscleGroup = exercise.muscle_group as
                        | WorkoutType
                        | undefined;
                    const targetBodyPart = exercise.target_body_part as
                        | TargetBodyPart
                        | undefined;
                    const weight = set.weight || 0;
                    const reps = set.reps;
                    const volume = weight * reps;

                    totalVolume += volume;
                    totalReps += reps;
                    totalSetsCount++;

                    // Weekly volume
                    if (new Date(set.created_at) >= weekAgo) {
                        weeklyVolume += volume;
                    }

                    // Track exercise stats
                    if (!exerciseMap.has(exerciseId)) {
                        exerciseMap.set(exerciseId, {
                            exerciseId,
                            name: exerciseName,
                            muscleGroup,
                            targetBodyPart,
                            maxWeight: weight,
                            maxReps: reps,
                            estimatedOneRM: 0,
                            lastPerformed: set.created_at,
                            count: 0,
                            totalVolume: 0,
                        });
                    }

                    const exerciseData = exerciseMap.get(exerciseId)!;
                    exerciseData.count++;
                    exerciseData.totalVolume += volume;

                    // Update max weight
                    if (weight > exerciseData.maxWeight) {
                        exerciseData.maxWeight = weight;
                        exerciseData.maxReps = reps;
                    }

                    // Update last performed
                    if (
                        new Date(set.created_at) >
                        new Date(exerciseData.lastPerformed)
                    ) {
                        exerciseData.lastPerformed = set.created_at;
                    }
                });

                // Calculate 1RM estimates using Epley formula: weight * (1 + reps/30)
                const personalRecords: ExerciseRecord[] = [];
                Array.from(exerciseMap.entries()).forEach(
                    ([exerciseId, data]) => {
                        const oneRM = data.maxWeight * (1 + data.maxReps / 30);
                        data.estimatedOneRM = Math.round(oneRM);

                        personalRecords.push({
                            exerciseId,
                            exerciseName: data.name,
                            maxWeight: data.maxWeight,
                            maxReps: data.maxReps,
                            estimatedOneRM: data.estimatedOneRM,
                            lastPerformed: data.lastPerformed,
                        });
                    }
                );

                // Sort by estimated 1RM
                personalRecords.sort(
                    (a, b) => b.estimatedOneRM - a.estimatedOneRM
                );

                // Most performed exercises
                const mostPerformed = Array.from(exerciseMap.entries())
                    .map(([exerciseId, data]) => ({
                        exerciseId,
                        exerciseName: data.name,
                        count: data.count,
                        muscleGroup: data.muscleGroup,
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);

                // Muscle group balance
                const muscleGroupMap = new Map<string, number>();

                Array.from(exerciseMap.values()).forEach((data) => {
                    const group = data.muscleGroup || "other";
                    muscleGroupMap.set(
                        group,
                        (muscleGroupMap.get(group) || 0) + data.totalVolume
                    );
                });

                const muscleGroupBalance = Array.from(
                    muscleGroupMap.entries()
                ).map(([muscleGroup, volume]) => ({
                    muscleGroup,
                    volume,
                    percentage: (volume / totalVolume) * 100,
                }));

                // Body part volume tracking
                const bodyPartVolumeMap = new Map<
                    TargetBodyPart,
                    {
                        volume: number;
                        exerciseCount: number;
                        lastTrained: string | null;
                    }
                >();

                Array.from(exerciseMap.values()).forEach((data) => {
                    if (data.targetBodyPart) {
                        const existing = bodyPartVolumeMap.get(
                            data.targetBodyPart
                        ) || { volume: 0, exerciseCount: 0, lastTrained: null };
                        bodyPartVolumeMap.set(data.targetBodyPart, {
                            volume: existing.volume + data.totalVolume,
                            exerciseCount: existing.exerciseCount + 1,
                            lastTrained:
                                !existing.lastTrained ||
                                data.lastPerformed > existing.lastTrained
                                    ? data.lastPerformed
                                    : existing.lastTrained,
                        });
                    }
                });

                const bodyPartVolumes: BodyPartVolume[] = Array.from(
                    bodyPartVolumeMap.entries()
                )
                    .map(([bodyPart, data]) => ({
                        bodyPart,
                        volume: data.volume,
                        percentage: (data.volume / totalVolume) * 100,
                        exerciseCount: data.exerciseCount,
                        lastTrained: data.lastTrained,
                    }))
                    .sort((a, b) => b.volume - a.volume);

                // Body part PRs tracking
                const bodyPartPRMap = new Map<TargetBodyPart, BodyPartPR>();

                Array.from(exerciseMap.values()).forEach((data) => {
                    if (data.targetBodyPart && data.estimatedOneRM) {
                        const existing = bodyPartPRMap.get(data.targetBodyPart);
                        if (
                            !existing ||
                            data.estimatedOneRM > existing.estimatedOneRM
                        ) {
                            bodyPartPRMap.set(data.targetBodyPart, {
                                bodyPart: data.targetBodyPart,
                                exerciseId: data.exerciseId,
                                exerciseName: data.name,
                                maxWeight: data.maxWeight,
                                maxReps: data.maxReps,
                                estimatedOneRM: data.estimatedOneRM,
                                lastPerformed: data.lastPerformed,
                            });
                        }
                    }
                });

                const bodyPartPRs: BodyPartPR[] = Array.from(
                    bodyPartPRMap.values()
                );

                // Body part frequency tracking
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                const oneMonthAgo = new Date();
                oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

                const bodyPartFrequencyMap = new Map<
                    TargetBodyPart,
                    {
                        timesThisWeek: number;
                        timesThisMonth: number;
                        daysSinceLastTrained: number | null;
                    }
                >();

                Array.from(exerciseMap.values()).forEach((data) => {
                    if (data.targetBodyPart) {
                        const existing = bodyPartFrequencyMap.get(
                            data.targetBodyPart
                        ) || {
                            timesThisWeek: 0,
                            timesThisMonth: 0,
                            daysSinceLastTrained: null,
                        };

                        const lastTrainedDate = new Date(data.lastPerformed);
                        const daysSince = Math.floor(
                            (now.getTime() - lastTrainedDate.getTime()) /
                                (1000 * 60 * 60 * 24)
                        );

                        bodyPartFrequencyMap.set(data.targetBodyPart, {
                            timesThisWeek:
                                existing.timesThisWeek +
                                (lastTrainedDate >= oneWeekAgo
                                    ? data.count
                                    : 0),
                            timesThisMonth:
                                existing.timesThisMonth +
                                (lastTrainedDate >= oneMonthAgo
                                    ? data.count
                                    : 0),
                            daysSinceLastTrained:
                                existing.daysSinceLastTrained === null ||
                                daysSince < existing.daysSinceLastTrained
                                    ? daysSince
                                    : existing.daysSinceLastTrained,
                        });
                    }
                });

                const bodyPartFrequency: BodyPartFrequency[] = Array.from(
                    bodyPartFrequencyMap.entries()
                ).map(([bodyPart, data]) => ({
                    bodyPart,
                    timesThisWeek: data.timesThisWeek,
                    timesThisMonth: data.timesThisMonth,
                    daysSinceLastTrained: data.daysSinceLastTrained,
                }));

                setStats({
                    personalRecords,
                    volumeData: {
                        totalVolume: Math.round(totalVolume),
                        weeklyVolume: Math.round(weeklyVolume),
                        avgReps:
                            totalSetsCount > 0
                                ? Math.round(totalReps / totalSetsCount)
                                : 0,
                        avgSets:
                            exerciseLogs && exerciseLogs.length > 0
                                ? Math.round(
                                      totalSetsCount / exerciseLogs.length
                                  )
                                : 0,
                    },
                    mostPerformedExercises: mostPerformed,
                    muscleGroupBalance,
                    bodyPartVolumes,
                    bodyPartPRs,
                    bodyPartFrequency,
                });
            } catch (err) {
                console.error("Error fetching strength stats:", err);
                setError(
                    err instanceof Error ? err : new Error("Unknown error")
                );
            } finally {
                setLoading(false);
            }
        }

        fetchStrengthStats();
    }, [userId]);

    return { stats, loading, error };
}
