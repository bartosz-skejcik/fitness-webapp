"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WorkoutTemplate, WorkoutType, Exercise } from "@/types/database";
import {
    Play,
    ArrowLeft,
    Plus,
    Lightbulb,
    Loader2,
    ClipboardList,
    Dumbbell,
    X,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../../components/header";
import { useExerciseRecommendations } from "@/hooks/useExerciseRecommendations";

export default function NewWorkoutPage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
        null
    );
    const [customName, setCustomName] = useState("");
    const [workoutType, setWorkoutType] = useState<WorkoutType>("upper");
    const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
    const [starting, setStarting] = useState(false);
    const { recommendations } = useExerciseRecommendations();

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    async function fetchData() {
        setLoading(true);
        try {
            const [templatesRes, exercisesRes] = await Promise.all([
                supabase
                    .from("workout_templates")
                    .select("*")
                    .order("created_at", { ascending: false }),
                supabase.from("exercises").select("*").order("name"),
            ]);

            if (templatesRes.error) throw templatesRes.error;
            if (exercisesRes.error) throw exercisesRes.error;

            setTemplates(templatesRes.data || []);
            setExercises(exercisesRes.data || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }

    async function selectTemplate(templateId: string) {
        setSelectedTemplate(templateId);
        const template = templates.find((t) => t.id === templateId);
        if (template) {
            setWorkoutType(template.workout_type);
            setCustomName(template.name);

            // Fetch template exercises
            const { data, error } = await supabase
                .from("workout_template_exercises")
                .select("exercise_id")
                .eq("workout_template_id", templateId)
                .order("order_index");

            if (!error && data) {
                setSelectedExercises(data.map((e) => e.exercise_id));
            }
        }
    }

    async function startWorkout() {
        if (!user || (!selectedTemplate && selectedExercises.length === 0)) {
            alert("Wybierz szablon lub dodaj ćwiczenia");
            return;
        }

        setStarting(true);
        try {
            // Create workout session
            const { data: session, error: sessionError } = await supabase
                .from("workout_sessions")
                .insert({
                    user_id: user.id,
                    workout_template_id: selectedTemplate,
                    name:
                        customName ||
                        `Trening ${new Date().toLocaleDateString("pl-PL")}`,
                    workout_type: workoutType,
                    started_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // Get exercises with their set counts
            let exercisesWithSets: Array<{
                exercise_id: string;
                sets_count: number;
                order_index: number;
            }> = [];

            if (selectedTemplate) {
                const { data, error } = await supabase
                    .from("workout_template_exercises")
                    .select("exercise_id, sets_count, order_index")
                    .eq("workout_template_id", selectedTemplate)
                    .order("order_index");

                if (error) throw error;
                exercisesWithSets = data || [];
            } else {
                exercisesWithSets = selectedExercises.map((id, idx) => ({
                    exercise_id: id,
                    sets_count: 3,
                    order_index: idx,
                }));
            }

            // Create exercise logs
            const exerciseLogsToInsert = exercisesWithSets.map((ex) => ({
                workout_session_id: session.id,
                exercise_id: ex.exercise_id,
                order_index: ex.order_index,
            }));

            const { data: exerciseLogs, error: logsError } = await supabase
                .from("exercise_logs")
                .insert(exerciseLogsToInsert)
                .select();

            if (logsError) throw logsError;

            // Create set logs for each exercise
            const setLogsToInsert = exerciseLogs.flatMap((log, idx) => {
                const setsCount = exercisesWithSets[idx].sets_count;
                return Array.from({ length: setsCount }, (_, setIdx) => ({
                    exercise_log_id: log.id,
                    set_number: setIdx + 1,
                    reps: 0,
                    weight: 0,
                    rir: 0,
                    completed: false,
                }));
            });

            const { error: setLogsError } = await supabase
                .from("set_logs")
                .insert(setLogsToInsert);

            if (setLogsError) throw setLogsError;

            // Navigate to workout session
            router.push(`/workout/${session.id}`);
        } catch (error) {
            console.error("Error starting workout:", error);
            alert("Błąd podczas rozpoczynania treningu");
        } finally {
            setStarting(false);
        }
    }

    const workoutTypeLabels = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

    const workoutTypeColors = {
        upper: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        lower: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        legs: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        cardio: "bg-green-500/10 text-green-400 border-green-500/20",
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950">
            <Header
                icon={
                    <Link
                        href="/dashboard"
                        className="text-neutral-400 hover:text-neutral-100"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                }
                title="NOWY TRENING"
            />

            <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
                {/* Exercise Recommendations */}
                {recommendations.length > 0 && (
                    <div className="py-5 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-5 h-5 text-neutral-200" />
                            <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
                                Rekomendacje ćwiczeń
                            </h2>
                        </div>
                        <p className="text-sm text-neutral-200/80 mb-4">
                            Na podstawie analizy Twoich treningów, zalecamy
                            skupić się na tych partiach:
                        </p>
                        <div className="space-y-3">
                            {recommendations.map((rec, idx) => (
                                <div
                                    key={idx}
                                    className={`bg-gradient-to-br from-neutral-800/60 via-neutral-900/40 to-neutral-950/20 border rounded-lg p-4 shadow-sm ${
                                        rec.priority === "high"
                                            ? "border-red-500/30"
                                            : rec.priority === "moderate"
                                            ? "border-yellow-500/30"
                                            : "border-blue-500/30"
                                    }`}
                                    style={{
                                        boxShadow:
                                            "inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 20px rgba(0,0,0,0.45)",
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-semibold text-neutral-100 text-sm mb-1">
                                                {rec.bodyPartLabel}
                                            </h3>
                                            <p className="text-xs text-neutral-400">
                                                {rec.reason}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${
                                                rec.priority === "high"
                                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                    : rec.priority ===
                                                      "moderate"
                                                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                            }`}
                                        >
                                            {rec.priority === "high"
                                                ? "Wysoki"
                                                : rec.priority === "moderate"
                                                ? "Średni"
                                                : "Niski"}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {rec.exercises.slice(0, 3).map((ex) => (
                                            <button
                                                key={ex.id}
                                                onClick={() => {
                                                    if (
                                                        !selectedExercises.includes(
                                                            ex.id
                                                        )
                                                    ) {
                                                        setSelectedExercises([
                                                            ...selectedExercises,
                                                            ex.id,
                                                        ]);
                                                    }
                                                }}
                                                className="text-xs px-3 py-1.5 bg-neutral-800/60 hover:bg-neutral-700/60 text-neutral-300 rounded border border-neutral-700/30 flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                                            >
                                                <Plus className="w-3 h-3" />
                                                {ex.name}
                                            </button>
                                        ))}
                                        {rec.exercises.length > 3 && (
                                            <span className="text-xs text-neutral-500 py-1.5 px-2">
                                                +{rec.exercises.length - 3}{" "}
                                                więcej
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Template Selection */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <ClipboardList className="w-5 h-5 text-orange-400" />
                        <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Wybierz szablon
                        </h2>
                    </div>

                    {templates.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-neutral-800 rounded-lg">
                            <Dumbbell className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                            <p className="text-neutral-400 mb-4">
                                Nie masz jeszcze żadnych szablonów
                            </p>
                            <Link
                                href="/templates/new"
                                className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Stwórz pierwszy szablon
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {templates.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => selectTemplate(template.id)}
                                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                                        selectedTemplate === template.id
                                            ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20"
                                            : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-semibold text-neutral-100 text-base">
                                            {template.name}
                                        </h3>
                                        <span
                                            className={`px-2.5 py-1 rounded text-xs font-medium border ${
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
                                        <p className="text-sm text-neutral-400 line-clamp-2">
                                            {template.description}
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Custom Name */}
                {selectedTemplate && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 mb-6">
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                            Nazwa treningu (opcjonalnie)
                        </label>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder={`np. ${
                                templates.find((t) => t.id === selectedTemplate)
                                    ?.name
                            } - ${new Date().toLocaleDateString("pl-PL")}`}
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-neutral-500"
                        />
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <Link
                        href="/dashboard"
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 border-2 border-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-900 hover:border-neutral-700 transition-all font-medium"
                    >
                        <X className="w-5 h-5" />
                        Anuluj
                    </Link>
                    <button
                        onClick={startWorkout}
                        disabled={starting || !selectedTemplate}
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3.5 rounded-lg hover:bg-orange-600 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
                    >
                        {starting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Rozpoczynanie...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5 fill-current" />
                                Rozpocznij
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
