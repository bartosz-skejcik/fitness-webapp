"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { WorkoutSession, WorkoutTemplate } from "@/types/database";
import {
    Dumbbell,
    Plus,
    TrendingUp,
    ClipboardList,
    Loader2,
    Play,
    History,
    Calendar,
    Target,
    Flame,
    Users,
    AlertTriangle,
    Award,
    Activity,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";
import UserMenu from "../../../components/user-menu";
import { useDashboardInsights } from "@/hooks/useDashboardInsights";

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalWorkouts: 0,
        weeklyWorkouts: 0,
        totalVolume: 0,
        currentStreak: 0,
    });
    const { insights } = useDashboardInsights();
    const supabase = createClient();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    async function fetchData() {
        try {
            const [
                templatesRes,
                recentSessionsRes,
                workoutStatsRes,
                streakRes,
            ] = await Promise.all([
                supabase
                    .from("workout_templates")
                    .select(
                        "id, user_id, name, workout_type, description, created_at, updated_at",
                    )
                    .eq("user_id", user?.id)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("workout_sessions")
                    .select(
                        "id, user_id, workout_template_id, name, workout_type, started_at, completed_at, notes, created_at",
                    )
                    .eq("user_id", user?.id)
                    .order("started_at", { ascending: false })
                    .limit(5),
                supabase
                    .from("user_workout_stats")
                    .select("total_workouts, weekly_workouts, total_volume")
                    .eq("user_id", user?.id)
                    .maybeSingle(),
                supabase.rpc("calculate_user_streak", {
                    p_user_id: user?.id,
                }),
            ]);

            if (templatesRes.error) throw templatesRes.error;
            if (recentSessionsRes.error) throw recentSessionsRes.error;
            if (workoutStatsRes.error) throw workoutStatsRes.error;
            if (streakRes.error) throw streakRes.error;

            setTemplates((templatesRes.data || []) as WorkoutTemplate[]);
            setRecentSessions(
                (recentSessionsRes.data || []) as WorkoutSession[],
            );

            setStats({
                totalWorkouts: Number(
                    workoutStatsRes.data?.total_workouts || 0,
                ),
                weeklyWorkouts: Number(
                    workoutStatsRes.data?.weekly_workouts || 0,
                ),
                totalVolume: Math.round(
                    Number(workoutStatsRes.data?.total_volume || 0),
                ),
                currentStreak: Number(streakRes.data || 0),
            });
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    const workoutTypeColors = {
        upper: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        lower: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
        legs: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        cardio: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    };

    const workoutTypeLabels = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

    return (
        <div className="min-h-screen bg-neutral-950">
            {/* Header */}
            <Header
                icon={<Dumbbell className="w-5 h-5 text-orange-500" />}
                title="FITNESS TRACKER"
                buttons={[<UserMenu key="user-menu" />]}
            />

            <main className="max-w-7xl mx-auto px-4 py-6 pb-24">
                {/* Body Part Insights */}
                {insights.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                            Analiza partii mięśniowych
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {insights.map((insight, idx) => {
                                const getInsightColor = () => {
                                    if (insight.severity === "positive") {
                                        return "from-green-500/20 to-green-600/10 border-green-500/30";
                                    }
                                    switch (insight.severity) {
                                        case "high":
                                            return "from-red-500/20 to-red-600/10 border-red-500/30";
                                        case "moderate":
                                            return "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30";
                                        default:
                                            return "from-blue-500/20 to-blue-600/10 border-blue-500/30";
                                    }
                                };

                                const getInsightIcon = () => {
                                    switch (insight.type) {
                                        case "imbalance":
                                            return (
                                                <AlertTriangle className="w-5 h-5" />
                                            );
                                        case "undertrained":
                                            return (
                                                <Activity className="w-5 h-5" />
                                            );
                                        case "pr":
                                            return (
                                                <Award className="w-5 h-5" />
                                            );
                                        case "performing":
                                            return (
                                                <TrendingUp className="w-5 h-5" />
                                            );
                                    }
                                };

                                const getInsightTextColor = () => {
                                    if (insight.severity === "positive") {
                                        return "text-green-400";
                                    }
                                    switch (insight.severity) {
                                        case "high":
                                            return "text-red-400";
                                        case "moderate":
                                            return "text-yellow-400";
                                        default:
                                            return "text-blue-400";
                                    }
                                };

                                return (
                                    <Link
                                        key={idx}
                                        href="/progress?tab=bodyparts"
                                        className={`bg-gradient-to-br ${getInsightColor()} border-2 rounded-lg p-4 hover:scale-[1.02] transition-transform`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div
                                                className={`p-2 bg-black/20 rounded-lg ${getInsightTextColor()}`}
                                            >
                                                {getInsightIcon()}
                                            </div>
                                            <span
                                                className={`text-xl font-bold ${getInsightTextColor()}`}
                                            >
                                                {insight.value}
                                            </span>
                                        </div>
                                        <h3
                                            className={`font-bold text-sm mb-1 ${getInsightTextColor()}`}
                                        >
                                            {insight.title}
                                        </h3>
                                        <p
                                            className={`text-xs opacity-90 ${getInsightTextColor()}`}
                                        >
                                            {insight.description}
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Stats Tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div
                        className="bg-gradient-to-br from-neutral-800/60 via-neutral-900/40 to-neutral-950/20 border border-neutral-800 rounded-lg p-4 shadow-sm"
                        style={{
                            boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 18px rgba(0,0,0,0.45)",
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-neutral-400">
                                Treningi
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.totalWorkouts}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            wszystkie
                        </p>
                    </div>

                    <div
                        className="bg-gradient-to-br from-neutral-800/60 via-neutral-900/40 to-neutral-950/20 border border-neutral-800 rounded-lg p-4 shadow-sm"
                        style={{
                            boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 18px rgba(0,0,0,0.45)",
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-neutral-400">
                                Ten tydzień
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.weeklyWorkouts}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            treningów
                        </p>
                    </div>

                    <div
                        className="bg-gradient-to-br from-neutral-800/60 via-neutral-900/40 to-neutral-950/20 border border-neutral-800 rounded-lg p-4 shadow-sm"
                        style={{
                            boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 18px rgba(0,0,0,0.45)",
                        }}
                    >
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
                        <p className="text-xs text-neutral-500 mt-1">
                            kg × reps
                        </p>
                    </div>

                    <div
                        className="bg-gradient-to-br from-neutral-800/60 via-neutral-900/40 to-neutral-950/20 border border-neutral-800 rounded-lg p-4 shadow-sm"
                        style={{
                            boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 18px rgba(0,0,0,0.45)",
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-neutral-400">
                                Seria
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.currentStreak}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            {stats.currentStreak === 1 ? "dzień" : "dni"}
                        </p>
                    </div>
                </div>

                {/* Recent Workouts */}
                <div>
                    <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-6">
                        Ostatnie treningi
                    </h2>

                    {recentSessions.length === 0 ? (
                        <div className="bg-neutral-900/50 rounded-lg p-6 text-center">
                            <History className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                            <p className="text-neutral-500 text-xs mb-3">
                                Brak treningów
                            </p>
                            <Link
                                href="/workout/new"
                                className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-xs"
                            >
                                <Play className="w-4 h-4" />
                                Rozpocznij
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentSessions.map((session) => (
                                <Link
                                    key={session.id}
                                    href={`/workout/${session.id}`}
                                    className="flex items-center justify-between p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg hover:bg-neutral-900 transition-colors"
                                >
                                    <div>
                                        <h3 className="font-semibold text-sm text-neutral-100">
                                            {session.name}
                                        </h3>
                                        <p className="text-xs text-neutral-500">
                                            {new Date(
                                                session.started_at,
                                            ).toLocaleDateString("pl-PL", {
                                                day: "numeric",
                                                month: "long",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs ${
                                                workoutTypeColors[
                                                    session.workout_type
                                                ]
                                            }`}
                                        >
                                            {
                                                workoutTypeLabels[
                                                    session.workout_type
                                                ]
                                            }
                                        </span>
                                        {session.completed_at && (
                                            <span className="text-orange-500 text-xs font-medium">
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Workout Templates */}
                <div className="my-3">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                            Szablony treningów
                        </h2>
                        <div className="flex gap-2">
                            <Link
                                href="/templates/shared"
                                className="flex items-center gap-2 bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors text-xs"
                            >
                                <Users className="w-4 h-4" />
                                Od znajomych
                            </Link>
                            <Link
                                href="/templates/new"
                                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors text-xs"
                            >
                                <Plus className="w-4 h-4" />
                                Nowy
                            </Link>
                        </div>
                    </div>

                    {templates.length === 0 ? (
                        <div className="bg-neutral-900/50 rounded-lg p-6 text-center">
                            <ClipboardList className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                            <p className="text-neutral-500 text-xs mb-3">
                                Brak szablonów treningów
                            </p>
                            <Link
                                href="/templates/new"
                                className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors text-xs"
                            >
                                <Plus className="w-4 h-4" />
                                Stwórz szablon
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {templates.map((template) => (
                                <Link
                                    key={template.id}
                                    href={`/templates/${template.id}`}
                                    className="bg-neutral-900/50 rounded-lg p-4 hover:bg-neutral-900 transition-all border border-neutral-800"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-semibold text-sm text-neutral-100">
                                            {template.name}
                                        </h3>
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs ${
                                                workoutTypeColors[
                                                    template.workout_type
                                                ]
                                            }`}
                                        >
                                            {
                                                workoutTypeLabels[
                                                    template.workout_type
                                                ]
                                            }
                                        </span>
                                    </div>
                                    {template.description && (
                                        <p className="text-neutral-500 text-xs line-clamp-2">
                                            {template.description}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-800 px-4 py-3">
                <div className="max-w-7xl mx-auto flex justify-around items-center gap-4">
                    <Link
                        href="/templates"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 text-blue-400 hover:bg-neutral-800 transition-colors"
                    >
                        <ClipboardList className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/workout/new"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                    >
                        <Play className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/progress"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 text-blue-400 hover:bg-neutral-800 transition-colors"
                    >
                        <TrendingUp className="w-6 h-6" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
