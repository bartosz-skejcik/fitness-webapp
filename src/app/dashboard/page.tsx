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
    Trophy,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";
import UserMenu from "../../../components/user-menu";

export default function DashboardPage() {
    const { user, loading: authLoading, signOut } = useAuth();
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
            // Fetch workout templates
            const { data: templatesData, error: templatesError } =
                await supabase
                    .from("workout_templates")
                    .select("*")
                    .order("created_at", { ascending: false });

            if (templatesError) throw templatesError;
            setTemplates(templatesData || []);

            // Fetch all workout sessions
            const { data: allSessions, error: allSessionsError } =
                await supabase
                    .from("workout_sessions")
                    .select("*")
                    .order("started_at", { ascending: false });

            if (allSessionsError) throw allSessionsError;

            // Fetch recent workout sessions for display
            const recentSessionsData = (allSessions || []).slice(0, 5);
            setRecentSessions(recentSessionsData);

            // Calculate stats
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const weeklyWorkouts = (allSessions || []).filter(
                (s) => new Date(s.started_at) >= weekAgo
            ).length;

            // Calculate current streak
            let streak = 0;
            const sortedSessions = (allSessions || []).sort(
                (a, b) =>
                    new Date(b.started_at).getTime() -
                    new Date(a.started_at).getTime()
            );

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let i = 0; i < sortedSessions.length; i++) {
                const sessionDate = new Date(sortedSessions[i].started_at);
                sessionDate.setHours(0, 0, 0, 0);

                const daysDiff = Math.floor(
                    (today.getTime() - sessionDate.getTime()) /
                        (1000 * 60 * 60 * 24)
                );

                if (daysDiff === streak || (streak === 0 && daysDiff <= 1)) {
                    streak++;
                } else {
                    break;
                }
            }

            // Fetch exercise logs and sets for volume calculation
            const sessionIds = (allSessions || []).map((s) => s.id);

            if (sessionIds.length > 0) {
                const { data: exerciseLogs } = await supabase
                    .from("exercise_logs")
                    .select("id")
                    .in("workout_session_id", sessionIds);

                const exerciseLogIds = (exerciseLogs || []).map((l) => l.id);

                if (exerciseLogIds.length > 0) {
                    const { data: sets } = await supabase
                        .from("set_logs")
                        .select("reps, weight")
                        .in("exercise_log_id", exerciseLogIds)
                        .eq("completed", true);

                    const totalVolume = (sets || []).reduce(
                        (sum, set) => sum + set.reps * (set.weight || 0),
                        0
                    );

                    setStats({
                        totalWorkouts: (allSessions || []).length,
                        weeklyWorkouts,
                        totalVolume: Math.round(totalVolume),
                        currentStreak: streak,
                    });
                } else {
                    setStats({
                        totalWorkouts: (allSessions || []).length,
                        weeklyWorkouts,
                        totalVolume: 0,
                        currentStreak: streak,
                    });
                }
            }
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
                {/* Stats Tiles */}
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
                        <p className="text-xs text-neutral-500 mt-1">
                            wszystkie
                        </p>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
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
                        <p className="text-xs text-neutral-500 mt-1">
                            kg × reps
                        </p>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
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
                                                session.started_at
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
                        <Link
                            href="/templates/new"
                            className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors text-xs"
                        >
                            <Plus className="w-4 h-4" />
                            Nowy
                        </Link>
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
