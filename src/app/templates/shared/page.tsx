"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SharedTemplateWithDetails, WorkoutType } from "@/types/database";
import {
    ArrowLeft,
    Copy,
    Loader2,
    Users,
    CheckCircle2,
    Info,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../../components/header";

export default function SharedTemplatesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [sharedTemplates, setSharedTemplates] = useState<
        SharedTemplateWithDetails[]
    >([]);
    const [copying, setCopying] = useState<string | null>(null);
    const [copiedTemplates, setCopiedTemplates] = useState<Set<string>>(
        new Set()
    );

    useEffect(() => {
        async function fetchSharedTemplates() {
            try {
                setLoading(true);

                // Fetch shared templates from the view
                const { data, error } = await supabase
                    .from("shared_templates_with_details")
                    .select("*")
                    .neq("shared_by_user_id", user?.id) // Don't show user's own shared templates
                    .order("shared_at", { ascending: false });

                if (error) throw error;
                setSharedTemplates(data || []);
            } catch (error) {
                console.error("Error fetching shared templates:", error);
            } finally {
                setLoading(false);
            }
        }

        if (!user) {
            router.push("/login");
        } else {
            fetchSharedTemplates();
        }
    }, [user, router, supabase]);

    async function copyTemplate(sharedTemplate: SharedTemplateWithDetails) {
        if (!user) return;

        setCopying(sharedTemplate.workout_template_id);

        try {
            console.log(
                "Starting template copy for:",
                sharedTemplate.template_name
            );
            console.log("Using database function to copy template...");

            // Use the database function to copy the template
            // This bypasses RLS issues by running server-side with elevated privileges
            const { data, error } = await supabase.rpc(
                "copy_shared_workout_template",
                {
                    p_source_template_id: sharedTemplate.workout_template_id,
                    p_user_id: user.id,
                }
            );

            if (error) {
                console.error("Error calling copy function:", error);
                throw error;
            }

            console.log("Copy function result:", data);

            if (data && data.success) {
                console.log(
                    `Successfully copied template: ${data.template_name}`
                );
                console.log(`New template ID: ${data.new_template_id}`);
                console.log(`Exercises copied: ${data.exercises_copied}`);

                // Mark as copied
                setCopiedTemplates(
                    (prev) =>
                        new Set([...prev, sharedTemplate.workout_template_id])
                );

                // Show success and redirect
                setTimeout(() => {
                    router.push(`/templates/${data.new_template_id}`);
                }, 1000);
            } else {
                throw new Error("Copy function returned unsuccessful result");
            }
        } catch (error) {
            console.error("Error copying template:", error);
            const errorMessage =
                error instanceof Error ? error.message : "Nieznany błąd";

            if (errorMessage.includes("Access denied")) {
                alert(
                    "Nie masz dostępu do tego treningu. Sprawdź czy jesteście znajomymi."
                );
            } else if (errorMessage.includes("not found")) {
                alert("Nie znaleziono szablonu treningu.");
            } else {
                alert(`Błąd podczas kopiowania treningu: ${errorMessage}`);
            }
        } finally {
            setCopying(null);
        }
    }

    const workoutTypeLabels: Record<WorkoutType, string> = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

    const workoutTypeColors: Record<WorkoutType, string> = {
        upper: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        lower: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
        legs: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        cardio: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    };

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
                            href="/templates"
                            className="text-neutral-400 hover:text-neutral-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <Users className="w-5 h-5 text-orange-500" />
                    </>
                }
                title="UDOSTĘPNIONE TRENINGI"
            />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Info Banner */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-blue-300 font-medium mb-1">
                            Treningi od znajomych
                        </p>
                        <p className="text-xs text-blue-400/80">
                            Tutaj znajdziesz treningi udostępnione przez Twoich
                            znajomych. Możesz je skopiować do swoich szablonów i
                            dostosować według potrzeb.
                        </p>
                    </div>
                </div>

                {/* Shared Templates List */}
                {sharedTemplates.length === 0 ? (
                    <div className="bg-neutral-900/50 rounded-lg p-8 text-center">
                        <Users className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                        <p className="text-neutral-400 text-sm mb-2">
                            Brak udostępnionych treningów
                        </p>
                        <p className="text-neutral-500 text-xs">
                            Twoi znajomi jeszcze nie udostępnili żadnych
                            treningów
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sharedTemplates.map((template) => {
                            const isCopied = copiedTemplates.has(
                                template.workout_template_id
                            );
                            const isCopying =
                                copying === template.workout_template_id;

                            return (
                                <div
                                    key={template.share_id}
                                    className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 transition-colors"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-neutral-100 text-sm mb-1">
                                                {template.template_name}
                                            </h3>
                                            <p className="text-xs text-neutral-500">
                                                od{" "}
                                                {template.shared_by_name ||
                                                    template.shared_by_email}
                                            </p>
                                        </div>
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

                                    {/* Description */}
                                    {template.template_description && (
                                        <p className="text-xs text-neutral-400 mb-3 line-clamp-2">
                                            {template.template_description}
                                        </p>
                                    )}

                                    {/* Exercise Count */}
                                    <div className="text-xs text-neutral-500 mb-3">
                                        {template.exercise_count}{" "}
                                        {template.exercise_count === 1
                                            ? "ćwiczenie"
                                            : template.exercise_count < 5
                                            ? "ćwiczenia"
                                            : "ćwiczeń"}
                                    </div>

                                    {/* Copy Button */}
                                    <button
                                        onClick={() => copyTemplate(template)}
                                        disabled={isCopying || isCopied}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                                            isCopied
                                                ? "bg-green-500/20 text-green-400 cursor-default"
                                                : "bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                                        }`}
                                    >
                                        {isCopying ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Kopiowanie...
                                            </>
                                        ) : isCopied ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                Skopiowano
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Skopiuj trening
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
