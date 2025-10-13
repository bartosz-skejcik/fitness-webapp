import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Badge {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    progress?: number;
    target?: number;
}

export interface PersonalRecord {
    exerciseName: string;
    weight: number;
    reps: number;
    date: string;
}

export interface TopImprovement {
    exerciseName: string;
    improvement: number;
    from: number;
    to: number;
}

export interface GoalsStats {
    badges: Badge[];
    recentPRs: PersonalRecord[];
    topImprovements: TopImprovement[];
}

export function useGoalsStats(userId: string | undefined) {
    const [stats, setStats] = useState<GoalsStats>({
        badges: [],
        recentPRs: [],
        topImprovements: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        async function fetchGoalsStats() {
            const supabase = createClient();

            try {
                setLoading(true);
                setError(null);

                // Fetch all workout sessions
                const { data: sessions, error: sessionsError } = await supabase
                    .from("workout_sessions")
                    .select("id, started_at")
                    .eq("user_id", userId)
                    .not("completed_at", "is", null)
                    .order("started_at", { ascending: false });

                if (sessionsError) throw sessionsError;

                const sessionIds = (sessions || []).map((s) => s.id);
                const totalWorkouts = sessions?.length || 0;

                // Fetch exercise logs
                const { data: exerciseLogs } = await supabase
                    .from("exercise_logs")
                    .select("id, exercise_id, exercises(name)")
                    .in("workout_session_id", sessionIds);

                const exerciseLogIds = (exerciseLogs || []).map((l) => l.id);

                // Fetch set logs
                let setLogs: Array<{
                    exercise_log_id: string;
                    reps: number;
                    weight: number | null;
                    created_at: string;
                }> = [];

                if (exerciseLogIds.length > 0) {
                    const { data: sets } = await supabase
                        .from("set_logs")
                        .select("exercise_log_id, reps, weight, created_at")
                        .in("exercise_log_id", exerciseLogIds)
                        .eq("completed", true);

                    setLogs = sets || [];
                }

                // Calculate total volume
                const totalVolume = setLogs.reduce(
                    (sum, set) => sum + (set.weight || 0) * set.reps,
                    0
                );

                // Calculate current streak
                let currentStreak = 0;
                const sortedSessions = [...(sessions || [])].sort(
                    (a, b) =>
                        new Date(b.started_at).getTime() -
                        new Date(a.started_at).getTime()
                );

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                for (let i = 0; i < sortedSessions.length; i++) {
                    const sessionDate = new Date(
                        sortedSessions[i].started_at
                    );
                    sessionDate.setHours(0, 0, 0, 0);

                    const daysDiff = Math.floor(
                        (today.getTime() - sessionDate.getTime()) /
                            (1000 * 60 * 60 * 24)
                    );

                    if (
                        daysDiff === currentStreak ||
                        (currentStreak === 0 && daysDiff <= 1)
                    ) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }

                // Define badges with progress
                const badges: Badge[] = [
                    {
                        id: "first-workout",
                        title: "Pierwszy Trening",
                        description: "Ukończ swój pierwszy trening",
                        icon: "🎯",
                        unlocked: totalWorkouts >= 1,
                        progress: Math.min(totalWorkouts, 1),
                        target: 1,
                    },
                    {
                        id: "10-workouts",
                        title: "Wytrwały",
                        description: "Ukończ 10 treningów",
                        icon: "💪",
                        unlocked: totalWorkouts >= 10,
                        progress: Math.min(totalWorkouts, 10),
                        target: 10,
                    },
                    {
                        id: "50-workouts",
                        title: "Doświadczony",
                        description: "Ukończ 50 treningów",
                        icon: "🏆",
                        unlocked: totalWorkouts >= 50,
                        progress: Math.min(totalWorkouts, 50),
                        target: 50,
                    },
                    {
                        id: "100-workouts",
                        title: "Legenda",
                        description: "Ukończ 100 treningów",
                        icon: "👑",
                        unlocked: totalWorkouts >= 100,
                        progress: Math.min(totalWorkouts, 100),
                        target: 100,
                    },
                    {
                        id: "7-day-streak",
                        title: "Tygodniowa Seria",
                        description: "Trenuj 7 dni z rzędu",
                        icon: "🔥",
                        unlocked: currentStreak >= 7,
                        progress: Math.min(currentStreak, 7),
                        target: 7,
                    },
                    {
                        id: "30-day-streak",
                        title: "Miesiąc Mocy",
                        description: "Trenuj 30 dni z rzędu",
                        icon: "⚡",
                        unlocked: currentStreak >= 30,
                        progress: Math.min(currentStreak, 30),
                        target: 30,
                    },
                    {
                        id: "volume-10k",
                        title: "Dźwigacz",
                        description: "Podnieś łącznie 10,000kg",
                        icon: "🏋️",
                        unlocked: totalVolume >= 10000,
                        progress: Math.min(totalVolume, 10000),
                        target: 10000,
                    },
                    {
                        id: "volume-100k",
                        title: "Atlas",
                        description: "Podnieś łącznie 100,000kg",
                        icon: "🦾",
                        unlocked: totalVolume >= 100000,
                        progress: Math.min(totalVolume, 100000),
                        target: 100000,
                    },
                ];

                // Find recent PRs (last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const exerciseMaxMap = new Map<
                    string,
                    { weight: number; reps: number; date: string; name: string }
                >();

                setLogs.forEach((set) => {
                    const log = exerciseLogs?.find(
                        (l) => l.id === set.exercise_log_id
                    );
                    if (!log?.exercises) return;

                    const exercise = Array.isArray(log.exercises)
                        ? log.exercises[0]
                        : log.exercises;
                    const exerciseName = exercise?.name as string;
                    const exerciseId = log.exercise_id;
                    const weight = set.weight || 0;

                    if (new Date(set.created_at) < thirtyDaysAgo) return;

                    const current = exerciseMaxMap.get(exerciseId);
                    if (!current || weight > current.weight) {
                        exerciseMaxMap.set(exerciseId, {
                            weight,
                            reps: set.reps,
                            date: set.created_at,
                            name: exerciseName,
                        });
                    }
                });

                const recentPRs: PersonalRecord[] = Array.from(
                    exerciseMaxMap.values()
                )
                    .sort(
                        (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime()
                    )
                    .slice(0, 5)
                    .map((pr) => ({
                        exerciseName: pr.name,
                        weight: pr.weight,
                        reps: pr.reps,
                        date: pr.date,
                    }));

                // Calculate top improvements this month
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 30);

                const exerciseProgressMap = new Map<
                    string,
                    {
                        name: string;
                        oldMax: number;
                        newMax: number;
                    }
                >();

                setLogs.forEach((set) => {
                    const log = exerciseLogs?.find(
                        (l) => l.id === set.exercise_log_id
                    );
                    if (!log?.exercises) return;

                    const exercise = Array.isArray(log.exercises)
                        ? log.exercises[0]
                        : log.exercises;
                    const exerciseName = exercise?.name as string;
                    const exerciseId = log.exercise_id;
                    const weight = set.weight || 0;
                    const setDate = new Date(set.created_at);

                    if (!exerciseProgressMap.has(exerciseId)) {
                        exerciseProgressMap.set(exerciseId, {
                            name: exerciseName,
                            oldMax: weight,
                            newMax: weight,
                        });
                    }

                    const progress = exerciseProgressMap.get(exerciseId)!;

                    if (setDate < monthAgo) {
                        progress.oldMax = Math.max(progress.oldMax, weight);
                    } else {
                        progress.newMax = Math.max(progress.newMax, weight);
                    }
                });

                const topImprovements: TopImprovement[] = Array.from(
                    exerciseProgressMap.values()
                )
                    .filter((p) => p.newMax > p.oldMax)
                    .map((p) => ({
                        exerciseName: p.name,
                        improvement: ((p.newMax - p.oldMax) / p.oldMax) * 100,
                        from: p.oldMax,
                        to: p.newMax,
                    }))
                    .sort((a, b) => b.improvement - a.improvement)
                    .slice(0, 3);

                setStats({
                    badges,
                    recentPRs,
                    topImprovements,
                });
            } catch (err) {
                console.error("Error fetching goals stats:", err);
                setError(
                    err instanceof Error ? err : new Error("Unknown error")
                );
            } finally {
                setLoading(false);
            }
        }

        fetchGoalsStats();
    }, [userId]);

    return { stats, loading, error };
}
