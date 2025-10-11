"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WorkoutTemplate, WorkoutType } from "@/types/database";
import { ArrowLeft, Plus, Calendar, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";

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
        upper: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        lower: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
        legs: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        cardio: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    };

    const workoutTypeLabels: Record<WorkoutType, string> = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950">
            <Header
                title="SZABLONY TRENINGÓW"
                icon={
                    <>
                        <Link
                            href="/dashboard"
                            className="text-neutral-400 hover:text-neutral-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <Calendar className="w-5 h-5 text-orange-500" />
                    </>
                }
                buttons={[
                    <Link
                        href="/templates/new"
                        className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors text-xs"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nowy</span>
                    </Link>,
                ]}
            />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {templates.length === 0 ? (
                    <div className="bg-neutral-900/50 rounded-lg p-12 text-center">
                        <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                        <h3 className="text-sm font-semibold text-neutral-100 mb-2">
                            Brak szablonów
                        </h3>
                        <p className="text-neutral-500 text-xs mb-4">
                            Utwórz swój pierwszy szablon treningu
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
                            <div
                                key={template.id}
                                className="bg-neutral-900/50 rounded-lg border border-neutral-800 hover:bg-neutral-900 transition-all"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-semibold text-sm text-neutral-100 flex-1">
                                            {template.name}
                                        </h3>
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs ml-2 ${
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
                                        <p className="text-neutral-500 text-xs mb-3 line-clamp-2">
                                            {template.description}
                                        </p>
                                    )}

                                    <p className="text-xs text-neutral-600 mb-3">
                                        {new Date(
                                            template.created_at
                                        ).toLocaleDateString("pl-PL")}
                                    </p>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/templates/${template.id}`}
                                            className="flex-1 text-center bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors text-xs font-medium"
                                        >
                                            Szczegóły
                                        </Link>
                                        <button
                                            onClick={() =>
                                                deleteTemplate(template.id)
                                            }
                                            className="px-3 py-1.5 bg-neutral-800 text-red-400 rounded-lg hover:bg-neutral-700 transition-colors"
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
