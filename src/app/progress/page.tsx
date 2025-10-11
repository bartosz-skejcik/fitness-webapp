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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-8 h-8 text-green-600" />
                            <h1 className="text-xl font-bold text-gray-900">
                                Twoje postępy
                            </h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Period Selector */}
                <div className="mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {periods.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                                    period === p.value
                                        ? "bg-blue-600 text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-6 h-6 opacity-80" />
                            <span className="text-sm opacity-80">Treningi</span>
                        </div>
                        <p className="text-4xl font-bold">
                            {stats.totalWorkouts}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <Target className="w-6 h-6 opacity-80" />
                            <span className="text-sm opacity-80">Serie</span>
                        </div>
                        <p className="text-4xl font-bold">{stats.totalSets}</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <Dumbbell className="w-6 h-6 opacity-80" />
                            <span className="text-sm opacity-80">Objętość</span>
                        </div>
                        <p className="text-2xl font-bold">
                            {stats.totalVolume}
                        </p>
                        <p className="text-xs opacity-80 mt-1">
                            kg × powtórzenia
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <Zap className="w-6 h-6 opacity-80" />
                            <span className="text-sm opacity-80">Śr. czas</span>
                        </div>
                        <p className="text-2xl font-bold">
                            {stats.avgDuration}
                        </p>
                        <p className="text-xs opacity-80 mt-1">minut</p>
                    </div>
                </div>

                {/* Charts */}
                {workoutData.length > 0 ? (
                    <>
                        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                            <h2 className="text-md font-bold text-gray-900 mb-6">
                                Częstotliwość treningów
                            </h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={workoutData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#e5e7eb"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#6b7280"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <YAxis
                                        stroke="#6b7280"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#fff",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
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

                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-md font-bold text-gray-900 mb-6">
                                Objętość treningu (kg × powtórzenia)
                            </h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={volumeData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#e5e7eb"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#6b7280"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <YAxis
                                        stroke="#6b7280"
                                        style={{ fontSize: "12px" }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#fff",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="objętość"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        dot={{ fill: "#10b981", r: 5 }}
                                        activeDot={{ r: 7 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-md font-semibold text-gray-900 mb-2">
                            Brak danych
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Nie masz jeszcze treningów w tym okresie czasu
                        </p>
                        <Link
                            href="/workout/new"
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Rozpocznij trening
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
