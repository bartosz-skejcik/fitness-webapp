"use client";

import { useState, useEffect } from "react";
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
    Legend,
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
    const [workoutData, setWorkoutData] = useState<any[]>([]);
    const [volumeData, setVolumeData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalWorkouts: 0,
        totalSets: 0,
        totalVolume: 0,
        avgDuration: 0,
    });

    useEffect(() => {
        if (!user) {
            router.push("/login");
        }
    }, [user, router]);

    useEffect(() => {
        if (user) {
            fetchProgressData();
        }
    }, [user, period]);

    async function fetchProgressData() {
        setLoading(true);
        try {
            const now = new Date();
            let startDate: Date;

            switch (period) {
                case "2weeks":
                    startDate = subDays(now, 14);
                    break;
                case "1month":
                    startDate = subMonths(now, 1);
                    break;
                case "3months":
                    startDate = subMonths(now, 3);
                    break;
                case "1year":
                    startDate = subMonths(now, 12);
                    break;
            }

            // Fetch workout sessions
            const { data: sessions, error: sessionsError } = await supabase
                .from("workout_sessions")
                .select("*")
                .gte("started_at", startDate.toISOString())
                .order("started_at");

            if (sessionsError) throw sessionsError;

            // Fetch all exercise logs for these sessions
            const sessionIds = (sessions || []).map((s) => s.id);

            if (sessionIds.length === 0) {
                setStats({
                    totalWorkouts: 0,
                    totalSets: 0,
                    totalVolume: 0,
                    avgDuration: 0,
                });
                setWorkoutData([]);
                setVolumeData([]);
                setLoading(false);
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

            setStats({
                totalWorkouts: (sessions || []).length,
                totalSets,
                totalVolume: Math.round(totalVolume),
                avgDuration: Math.round(avgDuration),
            });

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
                    treningi: count,
                })
            );

            setWorkoutData(workoutChartData);

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

            setVolumeData(volumeChartData);
        } catch (error) {
            console.error("Error fetching progress data:", error);
        } finally {
            setLoading(false);
        }
    }

    const periods = [
        { value: "2weeks" as TimePeriod, label: "2 tygodnie" },
        { value: "1month" as TimePeriod, label: "1 miesiąc" },
        { value: "3months" as TimePeriod, label: "3 miesiące" },
        { value: "1year" as TimePeriod, label: "1 rok" },
    ];

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
                    <div className="bg-blue-500 border border-blue-400 rounded-lg p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 opacity-80" />
                            <span className="text-xs opacity-80">Treningi</span>
                        </div>
                        <p className="text-xl font-bold">
                            {stats.totalWorkouts}
                        </p>
                    </div>

                    <div className="bg-blue-500 border border-blue-400 rounded-lg p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 opacity-80" />
                            <span className="text-xs opacity-80">Serie</span>
                        </div>
                        <p className="text-xl font-bold">{stats.totalSets}</p>
                    </div>

                    <div className="bg-orange-500 border border-orange-400 rounded-lg p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Dumbbell className="w-4 h-4 opacity-80" />
                            <span className="text-xs opacity-80">Objętość</span>
                        </div>
                        <p className="text-xl font-bold">{stats.totalVolume}</p>
                        <p className="text-xs opacity-80 mt-1">
                            kg × powtórzenia
                        </p>
                    </div>

                    <div className="bg-orange-500 border border-orange-400 rounded-lg p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 opacity-80" />
                            <span className="text-xs opacity-80">Śr. czas</span>
                        </div>
                        <p className="text-xl font-bold">{stats.avgDuration}</p>
                        <p className="text-xs opacity-80 mt-1">minut</p>
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
