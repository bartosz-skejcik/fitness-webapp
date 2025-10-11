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
    Calendar,
    LogOut,
    Loader2,
    Play,
    History,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";

export default function DashboardPage() {
    const { user, loading: authLoading, signOut } = useAuth();
    const router = useRouter();
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(true);
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

            // Fetch recent workout sessions
            const { data: sessionsData, error: sessionsError } = await supabase
                .from("workout_sessions")
                .select("*")
                .order("started_at", { ascending: false })
                .limit(5);

            if (sessionsError) throw sessionsError;
            setRecentSessions(sessionsData || []);
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
                buttons={[
                    <button
                        key="logout"
                        onClick={signOut}
                        className="flex items-center gap-2 text-neutral-400 hover:text-neutral-100 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">
                            Wyloguj
                        </span>
                    </button>,
                ]}
            />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    <Link
                        href="/workout/new"
                        className="bg-orange-500 text-white rounded-lg p-4 hover:bg-orange-600 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <Play className="w-5 h-5" />
                            <div>
                                <h3 className="font-semibold text-sm">
                                    Rozpocznij
                                </h3>
                                <p className="text-orange-100 text-xs">
                                    Nowa sesja
                                </p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/templates"
                        className="bg-neutral-900 border border-neutral-800 text-white rounded-lg p-4 hover:bg-neutral-800 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            <div>
                                <h3 className="font-semibold text-sm">
                                    Szablony
                                </h3>
                                <p className="text-neutral-400 text-xs">
                                    Zarządzaj szablonami
                                </p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/progress"
                        className="bg-neutral-900 border border-neutral-800 text-white rounded-lg p-4 hover:bg-neutral-800 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            <div>
                                <h3 className="font-semibold text-sm">
                                    Postępy
                                </h3>
                                <p className="text-neutral-400 text-xs">
                                    Statystyki
                                </p>
                            </div>
                        </div>
                    </Link>
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
                            <Calendar className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
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
        </div>
    );
}
