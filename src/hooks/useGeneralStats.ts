import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { WorkoutSession } from "@/types/database";

export interface GeneralStats {
    totalWorkouts: number;
    totalWorkoutTime: {
        thisWeek: number;
        thisMonth: number;
        allTime: number;
    };
    totalExercises: number;
    averageWorkoutDuration: number;
    mostFrequentDays: Array<{ day: string; count: number }>;
    mostFrequentTimes: Array<{ hour: string; count: number }>;
    bestStreak: number;
    currentStreak: number;
}

export function useGeneralStats(userId: string | undefined) {
    const [stats, setStats] = useState<GeneralStats>({
        totalWorkouts: 0,
        totalWorkoutTime: {
            thisWeek: 0,
            thisMonth: 0,
            allTime: 0,
        },
        totalExercises: 0,
        averageWorkoutDuration: 0,
        mostFrequentDays: [],
        mostFrequentTimes: [],
        bestStreak: 0,
        currentStreak: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const supabase = createClient();
        if (!userId) {
            setLoading(false);
            return;
        }

        async function fetchGeneralStats() {
            try {
                setLoading(true);
                setError(null);

                // Fetch all workout sessions
                const { data: sessions, error: sessionsError } = await supabase
                    .from("workout_sessions")
                    .select("*")
                    .eq("user_id", userId)
                    .order("started_at", { ascending: false });

                if (sessionsError) throw sessionsError;

                const completedSessions = (sessions || []).filter(
                    (s) => s.completed_at
                ) as WorkoutSession[];

                // Calculate workout durations
                const now = new Date();
                const weekAgo = new Date(
                    now.getTime() - 7 * 24 * 60 * 60 * 1000
                );
                const monthAgo = new Date(
                    now.getTime() - 30 * 24 * 60 * 60 * 1000
                );

                let totalTimeAllTime = 0;
                let totalTimeWeek = 0;
                let totalTimeMonth = 0;

                completedSessions.forEach((session) => {
                    const started = new Date(session.started_at);
                    const completed = new Date(session.completed_at!);
                    const duration = completed.getTime() - started.getTime();

                    totalTimeAllTime += duration;

                    if (started >= weekAgo) {
                        totalTimeWeek += duration;
                    }
                    if (started >= monthAgo) {
                        totalTimeMonth += duration;
                    }
                });

                // Calculate average duration in minutes
                const avgDuration =
                    completedSessions.length > 0
                        ? totalTimeAllTime /
                          completedSessions.length /
                          1000 /
                          60
                        : 0;

                // Fetch total exercises performed
                const sessionIds = completedSessions.map((s) => s.id);
                let totalExercises = 0;

                if (sessionIds.length > 0) {
                    const { data: exerciseLogs } = await supabase
                        .from("exercise_logs")
                        .select("id")
                        .in("workout_session_id", sessionIds);

                    totalExercises = exerciseLogs?.length || 0;
                }

                // Most frequent days of week
                const dayCount: Record<string, number> = {};
                const daysOfWeek = [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                ];

                completedSessions.forEach((session) => {
                    const day =
                        daysOfWeek[new Date(session.started_at).getDay()];
                    dayCount[day] = (dayCount[day] || 0) + 1;
                });

                const mostFrequentDays = Object.entries(dayCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([day, count]) => ({ day, count }));

                // Most frequent times (hour of day)
                const hourCount: Record<number, number> = {};

                completedSessions.forEach((session) => {
                    const hour = new Date(session.started_at).getHours();
                    hourCount[hour] = (hourCount[hour] || 0) + 1;
                });

                const mostFrequentTimes = Object.entries(hourCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([hour, count]) => ({
                        hour: `${hour.toString().padStart(2, "0")}:00`,
                        count,
                    }));

                // Calculate streaks
                const sortedSessions = [...completedSessions].sort(
                    (a, b) =>
                        new Date(b.started_at).getTime() -
                        new Date(a.started_at).getTime()
                );

                // Current streak
                let currentStreak = 0;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                for (let i = 0; i < sortedSessions.length; i++) {
                    const sessionDate = new Date(sortedSessions[i].started_at);
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

                // Best streak
                let bestStreak = 0;
                let tempStreak = 0;
                let lastDate: Date | null = null;

                sortedSessions.forEach((session) => {
                    const sessionDate = new Date(session.started_at);
                    sessionDate.setHours(0, 0, 0, 0);

                    if (lastDate === null) {
                        tempStreak = 1;
                    } else {
                        const daysDiff = Math.floor(
                            (lastDate.getTime() - sessionDate.getTime()) /
                                (1000 * 60 * 60 * 24)
                        );

                        if (daysDiff === 1) {
                            tempStreak++;
                        } else {
                            bestStreak = Math.max(bestStreak, tempStreak);
                            tempStreak = 1;
                        }
                    }

                    lastDate = sessionDate;
                });
                bestStreak = Math.max(bestStreak, tempStreak);

                setStats({
                    totalWorkouts: completedSessions.length,
                    totalWorkoutTime: {
                        thisWeek: Math.round(totalTimeWeek / 1000 / 60),
                        thisMonth: Math.round(totalTimeMonth / 1000 / 60),
                        allTime: Math.round(totalTimeAllTime / 1000 / 60),
                    },
                    totalExercises,
                    averageWorkoutDuration: Math.round(avgDuration),
                    mostFrequentDays,
                    mostFrequentTimes,
                    bestStreak,
                    currentStreak,
                });
            } catch (err) {
                console.error("Error fetching general stats:", err);
                setError(
                    err instanceof Error ? err : new Error("Unknown error")
                );
            } finally {
                setLoading(false);
            }
        }

        fetchGeneralStats();
    }, [userId]);

    return { stats, loading, error };
}
