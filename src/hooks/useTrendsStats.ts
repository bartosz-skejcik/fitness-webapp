import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface WeeklyData {
    weekStart: string;
    workouts: number;
    volume: number;
    improvement: number;
}

export interface ExerciseProgress {
    exerciseId: string;
    exerciseName: string;
    dataPoints: Array<{
        date: string;
        maxWeight: number;
    }>;
}

export interface HeatmapDay {
    date: string;
    count: number;
}

export interface TrendsStats {
    weeklyProgress: WeeklyData[];
    topExerciseProgress: ExerciseProgress[];
    workoutHeatmap: HeatmapDay[];
    bestDay: string;
    bestTime: string;
}

export function useTrendsStats(userId: string | undefined) {
    const [stats, setStats] = useState<TrendsStats>({
        weeklyProgress: [],
        topExerciseProgress: [],
        workoutHeatmap: [],
        bestDay: "",
        bestTime: "",
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        async function fetchTrendsStats() {
            const supabase = createClient();

            try {
                setLoading(true);
                setError(null);

                // Fetch workout sessions from the last 12 weeks
                const twelveWeeksAgo = new Date();
                twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);

                const { data: sessions, error: sessionsError } = await supabase
                    .from("workout_sessions")
                    .select("id, started_at")
                    .eq("user_id", userId)
                    .not("completed_at", "is", null)
                    .gte("started_at", twelveWeeksAgo.toISOString())
                    .order("started_at", { ascending: true });

                if (sessionsError) throw sessionsError;

                if (!sessions || sessions.length === 0) {
                    setLoading(false);
                    return;
                }

                // Fetch exercise logs and sets for volume calculation
                const sessionIds = sessions.map((s) => s.id);

                const { data: exerciseLogs } = await supabase
                    .from("exercise_logs")
                    .select(
                        "id, exercise_id, workout_session_id, exercises(name)"
                    )
                    .in("workout_session_id", sessionIds);

                const exerciseLogIds = (exerciseLogs || []).map((l) => l.id);

                interface SetLog {
                    exercise_log_id: string;
                    reps: number;
                    weight: number | null;
                    created_at: string;
                }

                let setLogs: SetLog[] = [];
                if (exerciseLogIds.length > 0) {
                    const { data: sets } = await supabase
                        .from("set_logs")
                        .select("exercise_log_id, reps, weight, created_at")
                        .in("exercise_log_id", exerciseLogIds)
                        .eq("completed", true);

                    setLogs = sets || [];
                }

                // Calculate weekly progress
                const weeklyMap = new Map<
                    string,
                    { workouts: number; volume: number }
                >();

                sessions.forEach((session) => {
                    const date = new Date(session.started_at);
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    const weekKey = weekStart.toISOString().split("T")[0];

                    if (!weeklyMap.has(weekKey)) {
                        weeklyMap.set(weekKey, { workouts: 0, volume: 0 });
                    }
                    const weekData = weeklyMap.get(weekKey)!;
                    weekData.workouts++;

                    // Calculate volume for this session
                    const sessionLogs = (exerciseLogs || []).filter(
                        (log) => log.workout_session_id === session.id
                    );
                    const logIds = sessionLogs.map((l) => l.id);

                    setLogs
                        .filter((set) => logIds.includes(set.exercise_log_id))
                        .forEach((set) => {
                            weekData.volume += (set.weight || 0) * set.reps;
                        });
                });

                // Convert to array and calculate improvements
                const weeklyProgress: WeeklyData[] = Array.from(
                    weeklyMap.entries()
                )
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([weekStart, data], index, arr) => {
                        let improvement = 0;
                        if (index > 0) {
                            const prevVolume = arr[index - 1][1].volume;
                            if (prevVolume > 0) {
                                improvement =
                                    ((data.volume - prevVolume) / prevVolume) *
                                    100;
                            }
                        }
                        return {
                            weekStart,
                            workouts: data.workouts,
                            volume: Math.round(data.volume),
                            improvement: Math.round(improvement),
                        };
                    });

                // Top exercise progress (top 3 exercises by frequency)
                const exerciseFrequency = new Map<string, number>();
                (exerciseLogs || []).forEach((log) => {
                    exerciseFrequency.set(
                        log.exercise_id,
                        (exerciseFrequency.get(log.exercise_id) || 0) + 1
                    );
                });

                const topExercises = Array.from(exerciseFrequency.entries())
                    .sort((a, b) => b[1] - a[1])
                    // Removed .slice(0, 3) to get all exercises
                    .map(([id]) => id);

                const topExerciseProgress: ExerciseProgress[] = topExercises
                    .map((exerciseId) => {
                        const logs = (exerciseLogs || []).filter(
                            (log) => log.exercise_id === exerciseId
                        );
                        const exercise = logs[0]?.exercises as
                            | { name: string }
                            | { name: string }[]
                            | undefined;
                        const exerciseName = Array.isArray(exercise)
                            ? exercise[0]?.name
                            : exercise?.name;

                        if (!exerciseName) return null;

                        const dataPoints: Array<{
                            date: string;
                            maxWeight: number;
                        }> = [];

                        logs.forEach((log) => {
                            const logSets = setLogs.filter(
                                (set) => set.exercise_log_id === log.id
                            );
                            const maxWeight = Math.max(
                                ...logSets.map((set) => set.weight || 0)
                            );

                            if (maxWeight > 0) {
                                const session = sessions.find(
                                    (s) => s.id === log.workout_session_id
                                );
                                if (session) {
                                    dataPoints.push({
                                        date: session.started_at,
                                        maxWeight,
                                    });
                                }
                            }
                        });

                        return {
                            exerciseId,
                            exerciseName,
                            dataPoints: dataPoints.sort(
                                (a, b) =>
                                    new Date(a.date).getTime() -
                                    new Date(b.date).getTime()
                            ),
                        };
                    })
                    .filter((p): p is ExerciseProgress => p !== null);

                // Workout heatmap (last 90 days)
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

                const heatmapMap = new Map<string, number>();
                sessions
                    .filter((s) => new Date(s.started_at) >= ninetyDaysAgo)
                    .forEach((session) => {
                        const date = new Date(session.started_at)
                            .toISOString()
                            .split("T")[0];
                        heatmapMap.set(date, (heatmapMap.get(date) || 0) + 1);
                    });

                const workoutHeatmap: HeatmapDay[] = Array.from(
                    heatmapMap.entries()
                ).map(([date, count]) => ({ date, count }));

                // Best day and time
                const dayCount = new Map<number, number>();
                const hourCount = new Map<number, number>();

                sessions.forEach((session) => {
                    const date = new Date(session.started_at);
                    const day = date.getDay();
                    const hour = date.getHours();

                    dayCount.set(day, (dayCount.get(day) || 0) + 1);
                    hourCount.set(hour, (hourCount.get(hour) || 0) + 1);
                });

                const daysOfWeek = [
                    "Niedziela",
                    "Poniedziałek",
                    "Wtorek",
                    "Środa",
                    "Czwartek",
                    "Piątek",
                    "Sobota",
                ];

                const bestDayNum =
                    Array.from(dayCount.entries()).sort(
                        (a, b) => b[1] - a[1]
                    )[0]?.[0] ?? 0;
                const bestDay = daysOfWeek[bestDayNum];

                const bestHour =
                    Array.from(hourCount.entries()).sort(
                        (a, b) => b[1] - a[1]
                    )[0]?.[0] ?? 0;
                const bestTime = `${bestHour.toString().padStart(2, "0")}:00`;

                setStats({
                    weeklyProgress,
                    topExerciseProgress,
                    workoutHeatmap,
                    bestDay,
                    bestTime,
                });
            } catch (err) {
                console.error("Error fetching trends stats:", err);
                setError(
                    err instanceof Error ? err : new Error("Unknown error")
                );
            } finally {
                setLoading(false);
            }
        }

        fetchTrendsStats();
    }, [userId]);

    return { stats, loading, error };
}
