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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        );
    }

    const workoutTypeColors = {
        upper: "bg-blue-100 text-blue-800",
        lower: "bg-green-100 text-green-800",
        legs: "bg-purple-100 text-purple-800",
        cardio: "bg-red-100 text-red-800",
    };

    const workoutTypeLabels = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <Header
                icon={<Dumbbell className="w-8 h-8 text-blue-600" />}
                title="Fitness Tracker"
                buttons={[
                    <button
                        onClick={signOut}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="hidden sm:inline">Wyloguj</span>
                    </button>,
                ]}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Link
                        href="/workout/new"
                        className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-lg">
                                <Play className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-md">
                                    Rozpocznij trening
                                </h3>
                                <p className="text-blue-100 text-sm">
                                    Nowa sesja treningowa
                                </p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/templates"
                        className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-lg">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-md">
                                    Szablony treningów
                                </h3>
                                <p className="text-purple-100 text-sm">
                                    Zarządzaj szablonami
                                </p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/progress"
                        className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-lg">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-md">
                                    Postępy
                                </h3>
                                <p className="text-green-100 text-sm">
                                    Statystyki i wykresy
                                </p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Workout Templates */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-md font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-gray-600" />
                            Twoje szablony treningów
                        </h2>
                        <Link
                            href="/templates/new"
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Nowy szablon
                        </Link>
                    </div>

                    {templates.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 mb-4">
                                Nie masz jeszcze żadnych szablonów treningów
                            </p>
                            <Link
                                href="/templates/new"
                                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                Stwórz pierwszy szablon
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {templates.map((template) => (
                                <Link
                                    key={template.id}
                                    href={`/templates/${template.id}`}
                                    className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-blue-300"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-semibold text-md text-gray-900">
                                            {template.name}
                                        </h3>
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${
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
                                        <p className="text-gray-600 text-sm">
                                            {template.description}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Workouts */}
                <div>
                    <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <History className="w-6 h-6 text-gray-600" />
                        Ostatnie treningi
                    </h2>

                    {recentSessions.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                            <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 mb-4">
                                Nie masz jeszcze żadnych treningów
                            </p>
                            <Link
                                href="/workout/new"
                                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Play className="w-5 h-5" />
                                Rozpocznij pierwszy trening
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            {recentSessions.map((session) => (
                                <Link
                                    key={session.id}
                                    href={`/workout/${session.id}`}
                                    className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                                >
                                    <div>
                                        <h3 className="font-semibold text-gray-900">
                                            {session.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {new Date(
                                                session.started_at
                                            ).toLocaleDateString("pl-PL", {
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${
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
                                            <span className="text-green-600 text-sm font-medium">
                                                ✓ Ukończono
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
