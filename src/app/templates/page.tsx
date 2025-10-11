"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WorkoutTemplate, WorkoutType } from "@/types/database";
import { ArrowLeft, Plus, Calendar, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

export default function TemplatesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            router.push("/login");
        }
    }, [user, router]);

    useEffect(() => {
        if (user) {
            fetchTemplates();
        }
    }, [user]);

    async function fetchTemplates() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("workout_templates")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    }

    async function deleteTemplate(id: string) {
        if (!confirm("Czy na pewno chcesz usunąć ten szablon?")) return;

        try {
            const { error } = await supabase
                .from("workout_templates")
                .delete()
                .eq("id", id);

            if (error) throw error;

            setTemplates(templates.filter((t) => t.id !== id));
        } catch (error) {
            console.error("Error deleting template:", error);
            alert("Błąd podczas usuwania szablonu");
        }
    }

    const workoutTypeColors: Record<WorkoutType, string> = {
        upper: "bg-blue-100 text-blue-800",
        lower: "bg-green-100 text-green-800",
        legs: "bg-purple-100 text-purple-800",
        cardio: "bg-red-100 text-red-800",
    };

    const workoutTypeLabels: Record<WorkoutType, string> = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <Calendar className="w-8 h-8 text-purple-600" />
                                <h1 className="text-xl font-bold text-gray-900">
                                    Szablony treningów
                                </h1>
                            </div>
                        </div>
                        <Link
                            href="/templates/new"
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">
                                Nowy szablon
                            </span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {templates.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-md font-semibold text-gray-900 mb-2">
                            Brak szablonów
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Utwórz swój pierwszy szablon treningu, aby łatwiej
                            organizować treningi
                        </p>
                        <Link
                            href="/templates/new"
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Stwórz szablon
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-all"
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-semibold text-md text-gray-900 flex-1">
                                            {template.name}
                                        </h3>
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${
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
                                        <p className="text-gray-600 text-sm mb-4">
                                            {template.description}
                                        </p>
                                    )}

                                    <p className="text-xs text-gray-500 mb-4">
                                        Utworzono:{" "}
                                        {new Date(
                                            template.created_at
                                        ).toLocaleDateString("pl-PL")}
                                    </p>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/templates/${template.id}`}
                                            className="flex-1 text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                        >
                                            Szczegóły
                                        </Link>
                                        <button
                                            onClick={() =>
                                                deleteTemplate(template.id)
                                            }
                                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
