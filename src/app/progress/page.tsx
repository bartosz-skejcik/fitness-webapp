"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    ArrowLeft,
    TrendingUp,
    Calendar,
    Dumbbell,
    Loader2,
    Target,
    Zap,
    Trophy,
    Activity,
    Clock,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { subDays, subMonths, format, startOfDay } from "date-fns";
import { pl } from "date-fns/locale";

type TimePeriod = "2weeks" | "1month" | "3months" | "1year";

export default function ProgressPage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<TimePeriod>("1month");

    // Cache data for all periods
    const [cachedData, setCachedData] = useState<
        Record<
            TimePeriod,
            {
                workoutData: Array<{ date: string; treningi: number }>;
                volumeData: Array<{ date: string; objętość: number }>;
                stats: {
                    totalWorkouts: number;
                    totalSets: number;
                    totalVolume: number;
                    avgDuration: number;
                    bestVolume: number;
                    avgWeight: number;
                    totalReps: number;
                    longestWorkout: number;
                };
                comparisonStats: {
                    workoutChange: number;
                    volumeChange: number;
                    setsChange: number;
                    durationChange: number;
                };
            } | null
        >
    >({
        "2weeks": null,
        "1month": null,
        "3months": null,
        "1year": null,
    });

    useEffect(() => {
        if (!user) {
            router.push("/login");
        }
    }, [user, router]);

    useEffect(() => {
        if (user) {
            // Load current period first, then others in background
            loadAllPeriodsData();
        }
    }, [user]);

    const loadAllPeriodsData = async () => {
        setLoading(true);

        // Load current period first
        await fetchProgressDataForPeriod(period);
        setLoading(false);

        // Load other periods in background
        const otherPeriods: TimePeriod[] = [
            "2weeks",
            "1month",
            "3months",
            "1year",
        ];
        const periodsToLoad = otherPeriods.filter((p) => p !== period);

        // Load remaining periods sequentially in background
        for (const p of periodsToLoad) {
            await fetchProgressDataForPeriod(p);
        }
    };

    async function fetchProgressDataForPeriod(selectedPeriod: TimePeriod) {
        // Return cached data if available
        if (cachedData[selectedPeriod]) {
            return;
        }

        try {
            const now = new Date();
            let startDate: Date;
            let comparisonStartDate: Date;
            let comparisonEndDate: Date;

            switch (selectedPeriod) {
                case "2weeks":
                    startDate = subDays(now, 14);
                    comparisonStartDate = subDays(now, 28);
                    comparisonEndDate = subDays(now, 14);
                    break;
                case "1month":
                    startDate = subMonths(now, 1);
                    comparisonStartDate = subMonths(now, 2);
                    comparisonEndDate = subMonths(now, 1);
                    break;
                case "3months":
                    startDate = subMonths(now, 3);
                    comparisonStartDate = subMonths(now, 6);
                    comparisonEndDate = subMonths(now, 3);
                    break;
                case "1year":
                    startDate = subMonths(now, 12);
                    comparisonStartDate = subMonths(now, 24);
                    comparisonEndDate = subMonths(now, 12);
                    break;
            }

            // Fetch current period sessions
            const { data: sessions, error: sessionsError } = await supabase
                .from("workout_sessions")
                .select("*")
                .gte("started_at", startDate.toISOString())
                .order("started_at");

            if (sessionsError) throw sessionsError;

            // Fetch comparison period sessions
            const { data: comparisonSessions, error: compSessionsError } =
                await supabase
                    .from("workout_sessions")
                    .select("*")
                    .gte("started_at", comparisonStartDate.toISOString())
                    .lt("started_at", comparisonEndDate.toISOString());

            if (compSessionsError) throw compSessionsError;

            // Fetch all exercise logs for these sessions
            const sessionIds = (sessions || []).map((s) => s.id);

            if (sessionIds.length === 0) {
                setCachedData((prev) => ({
                    ...prev,
                    [selectedPeriod]: {
                        workoutData: [],
                        volumeData: [],
                        stats: {
                            totalWorkouts: 0,
                            totalSets: 0,
                            totalVolume: 0,
                            avgDuration: 0,
                            bestVolume: 0,
                            avgWeight: 0,
                            totalReps: 0,
                            longestWorkout: 0,
                        },
                        comparisonStats: {
                            workoutChange: 0,
                            volumeChange: 0,
                            setsChange: 0,
                            durationChange: 0,
                        },
                    },
                }));
                return;
            }

            const { data: exerciseLogs, error: logsError } = await supabase
                .from("exercise_logs")
                .select("*")
                .in("workout_session_id", sessionIds);

            if (logsError) throw logsError;

            const exerciseLogIds = (exerciseLogs || []).map((l) => l.id);

            // Fetch all sets
            const { data: sets, error: setsError } = await supabase
                .from("set_logs")
                .select("*")
                .in("exercise_log_id", exerciseLogIds)
                .eq("completed", true);

            if (setsError) throw setsError;

            // Calculate stats
            const totalSets = (sets || []).length;
            const totalVolume = (sets || []).reduce(
                (sum, set) => sum + set.reps * (set.weight || 0),
                0
            );
            const totalReps = (sets || []).reduce(
                (sum, set) => sum + set.reps,
                0
            );
            const avgWeight =
                totalSets > 0
                    ? (sets || []).reduce(
                          (sum, set) => sum + (set.weight || 0),
                          0
                      ) / totalSets
                    : 0;

            // Calculate average duration (only for completed workouts)
            const completedSessions = (sessions || []).filter(
                (s) => s.completed_at
            );
            const avgDuration =
                completedSessions.length > 0
                    ? completedSessions.reduce((sum, s) => {
                          const start = new Date(s.started_at).getTime();
                          const end = new Date(s.completed_at!).getTime();
                          return sum + (end - start);
                      }, 0) /
                      completedSessions.length /
                      1000 /
                      60 // Convert to minutes
                    : 0;

            // Find longest workout
            const longestWorkout =
                completedSessions.length > 0
                    ? Math.max(
                          ...completedSessions.map((s) => {
                              const start = new Date(s.started_at).getTime();
                              const end = new Date(s.completed_at!).getTime();
                              return (end - start) / 1000 / 60;
                          })
                      )
                    : 0;

            // Find best volume workout
            const volumeBySession: Record<string, number> = {};
            (sessions || []).forEach((session) => {
                const sessionLogs = (exerciseLogs || []).filter(
                    (l) => l.workout_session_id === session.id
                );
                const sessionLogIds = sessionLogs.map((l) => l.id);
                const sessionSets = (sets || []).filter((s) =>
                    sessionLogIds.includes(s.exercise_log_id)
                );
                const volume = sessionSets.reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                );
                volumeBySession[session.id] = volume;
            });
            const bestVolume =
                Object.keys(volumeBySession).length > 0
                    ? Math.max(...Object.values(volumeBySession))
                    : 0;

            const calculatedStats = {
                totalWorkouts: (sessions || []).length,
                totalSets,
                totalVolume: Math.round(totalVolume),
                avgDuration: Math.round(avgDuration),
                bestVolume: Math.round(bestVolume),
                avgWeight: Math.round(avgWeight * 10) / 10,
                totalReps,
                longestWorkout: Math.round(longestWorkout),
            };

            // Calculate comparison period stats
            const compSessionIds = (comparisonSessions || []).map((s) => s.id);
            let calculatedComparisonStats = {
                workoutChange: 0,
                volumeChange: 0,
                setsChange: 0,
                durationChange: 0,
            };

            if (compSessionIds.length > 0) {
                const { data: compExerciseLogs } = await supabase
                    .from("exercise_logs")
                    .select("*")
                    .in("workout_session_id", compSessionIds);

                const compExerciseLogIds = (compExerciseLogs || []).map(
                    (l) => l.id
                );

                const { data: compSets } = await supabase
                    .from("set_logs")
                    .select("*")
                    .in("exercise_log_id", compExerciseLogIds)
                    .eq("completed", true);

                const compTotalSets = (compSets || []).length;
                const compTotalVolume = (compSets || []).reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                );

                const compCompletedSessions = (comparisonSessions || []).filter(
                    (s) => s.completed_at
                );
                const compAvgDuration =
                    compCompletedSessions.length > 0
                        ? compCompletedSessions.reduce((sum, s) => {
                              const start = new Date(s.started_at).getTime();
                              const end = new Date(s.completed_at!).getTime();
                              return sum + (end - start);
                          }, 0) /
                          compCompletedSessions.length /
                          1000 /
                          60
                        : 0;

                // Calculate percentage changes
                const workoutChange =
                    comparisonSessions.length > 0
                        ? Math.round(
                              ((sessions.length - comparisonSessions.length) /
                                  comparisonSessions.length) *
                                  100
                          )
                        : 0;

                const volumeChange =
                    compTotalVolume > 0
                        ? Math.round(
                              ((totalVolume - compTotalVolume) /
                                  compTotalVolume) *
                                  100
                          )
                        : 0;

                const setsChange =
                    compTotalSets > 0
                        ? Math.round(
                              ((totalSets - compTotalSets) / compTotalSets) *
                                  100
                          )
                        : 0;

                const durationChange =
                    compAvgDuration > 0
                        ? Math.round(
                              ((avgDuration - compAvgDuration) /
                                  compAvgDuration) *
                                  100
                          )
                        : 0;

                calculatedComparisonStats = {
                    workoutChange,
                    volumeChange,
                    setsChange,
                    durationChange,
                };
            }

            // Prepare workout frequency data
            const workoutsByDate = (sessions || []).reduce((acc, session) => {
                const dateKey = format(
                    startOfDay(new Date(session.started_at)),
                    "yyyy-MM-dd"
                );
                acc[dateKey] = (acc[dateKey] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const workoutChartData = Object.entries(workoutsByDate).map(
                ([date, count]) => ({
                    date: format(new Date(date), "dd MMM", { locale: pl }),
                    treningi: count as number,
                })
            );

            // Prepare volume data by date
            const volumeByDate = (sessions || []).reduce((acc, session) => {
                const dateKey = format(
                    startOfDay(new Date(session.started_at)),
                    "yyyy-MM-dd"
                );

                // Get sets for this session
                const sessionLogs = (exerciseLogs || []).filter(
                    (l) => l.workout_session_id === session.id
                );
                const sessionLogIds = sessionLogs.map((l) => l.id);
                const sessionSets = (sets || []).filter((s) =>
                    sessionLogIds.includes(s.exercise_log_id)
                );

                const volume = sessionSets.reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                );

                acc[dateKey] = (acc[dateKey] || 0) + volume;
                return acc;
            }, {} as Record<string, number>);

            const volumeChartData = Object.entries(volumeByDate).map(
                ([date, volume]) => ({
                    date: format(new Date(date), "dd MMM", { locale: pl }),
                    objętość: Math.round(volume as number),
                })
            );

            // Cache all the data for this period
            setCachedData((prev) => ({
                ...prev,
                [selectedPeriod]: {
                    workoutData: workoutChartData,
                    volumeData: volumeChartData,
                    stats: calculatedStats,
                    comparisonStats: calculatedComparisonStats || {
                        workoutChange: 0,
                        volumeChange: 0,
                        setsChange: 0,
                        durationChange: 0,
                    },
                },
            }));
        } catch (error) {
            console.error("Error fetching progress data:", error);
        }
    }

    const periods = [
        { value: "2weeks" as TimePeriod, label: "2 tygodnie" },
        { value: "1month" as TimePeriod, label: "1 miesiąc" },
        { value: "3months" as TimePeriod, label: "3 miesiące" },
        { value: "1year" as TimePeriod, label: "1 rok" },
    ];

    // Get current period data from cache
    const currentData = useMemo(() => {
        return (
            cachedData[period] || {
                workoutData: [],
                volumeData: [],
                stats: {
                    totalWorkouts: 0,
                    totalSets: 0,
                    totalVolume: 0,
                    avgDuration: 0,
                    bestVolume: 0,
                    avgWeight: 0,
                    totalReps: 0,
                    longestWorkout: 0,
                },
                comparisonStats: {
                    workoutChange: 0,
                    volumeChange: 0,
                    setsChange: 0,
                    durationChange: 0,
                },
            }
        );
    }, [period, cachedData]);

    const { workoutData, volumeData, stats, comparisonStats } = currentData;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950">
            <Header
                icon={
                    <>
                        <Link
                            href="/dashboard"
                            className="text-neutral-400 hover:text-neutral-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                    </>
                }
                title="TWOJE POSTĘPY"
            />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Period Selector */}
                <div className="mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {periods.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                                    period === p.value
                                        ? "bg-orange-500 text-white"
                                        : "bg-neutral-900 text-neutral-300 hover:bg-neutral-950 border border-neutral-700"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-neutral-400">
                                Treningi
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.totalWorkouts}
                        </p>
                        {comparisonStats.workoutChange !== 0 && (
                            <p
                                className={`text-xs mt-1 ${
                                    comparisonStats.workoutChange > 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                }`}
                            >
                                {comparisonStats.workoutChange > 0 ? "↑" : "↓"}
                                {Math.abs(comparisonStats.workoutChange)}%
                            </p>
                        )}
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-neutral-400">
                                Serie
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.totalSets}
                        </p>
                        {comparisonStats.setsChange !== 0 && (
                            <p
                                className={`text-xs mt-1 ${
                                    comparisonStats.setsChange > 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                }`}
                            >
                                {comparisonStats.setsChange > 0 ? "↑" : "↓"}
                                {Math.abs(comparisonStats.setsChange)}%
                            </p>
                        )}
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Dumbbell className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-neutral-400">
                                Objętość
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.totalVolume > 1000
                                ? `${(stats.totalVolume / 1000).toFixed(1)}k`
                                : stats.totalVolume}
                        </p>
                        {comparisonStats.volumeChange !== 0 && (
                            <p
                                className={`text-xs mt-1 ${
                                    comparisonStats.volumeChange > 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                }`}
                            >
                                {comparisonStats.volumeChange > 0 ? "↑" : "↓"}
                                {Math.abs(comparisonStats.volumeChange)}%
                            </p>
                        )}
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-neutral-400">
                                Śr. czas
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.avgDuration}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">minut</p>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-neutral-400">
                                Najlepszy
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.bestVolume > 1000
                                ? `${(stats.bestVolume / 1000).toFixed(1)}k`
                                : stats.bestVolume}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            objętość
                        </p>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-neutral-400">
                                Śr. ciężar
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.avgWeight}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">kg</p>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-neutral-400">
                                Powtórzenia
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.totalReps > 1000
                                ? `${(stats.totalReps / 1000).toFixed(1)}k`
                                : stats.totalReps}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            wszystkie
                        </p>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-neutral-400">
                                Najdłuższy
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.longestWorkout}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">minut</p>
                    </div>
                </div>

                {/* Charts */}
                {workoutData.length > 0 ? (
                    <>
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4">
                            <h2 className="text-sm font-bold text-neutral-100 mb-4">
                                Częstotliwość treningów
                            </h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={workoutData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#404040"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#737373"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <YAxis
                                        stroke="#737373"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#171717",
                                            border: "1px solid #404040",
                                            borderRadius: "8px",
                                            color: "#f5f5f5",
                                        }}
                                    />
                                    <Bar
                                        dataKey="treningi"
                                        fill="#3b82f6"
                                        radius={[8, 8, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                            <h2 className="text-sm font-bold text-neutral-100 mb-4">
                                Objętość treningu (kg × powtórzenia)
                            </h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={volumeData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#404040"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#737373"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <YAxis
                                        stroke="#737373"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#171717",
                                            border: "1px solid #404040",
                                            borderRadius: "8px",
                                            color: "#f5f5f5",
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="objętość"
                                        stroke="#f97316"
                                        strokeWidth={3}
                                        dot={{ fill: "#f97316", r: 5 }}
                                        activeDot={{ r: 7 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                ) : (
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
                        <TrendingUp className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                        <h3 className="text-sm font-semibold text-neutral-100 mb-2">
                            Brak danych
                        </h3>
                        <p className="text-neutral-400 text-xs mb-4">
                            Nie masz jeszcze treningów w tym okresie czasu
                        </p>
                        <Link
                            href="/workout/new"
                            className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-xs"
                        >
                            Rozpocznij
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
