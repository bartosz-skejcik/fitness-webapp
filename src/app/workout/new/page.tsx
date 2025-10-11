"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WorkoutTemplate, WorkoutType, Exercise } from "@/types/database";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import Link from "next/link";
import Header from "../../../../components/header";

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
        upper: "bg-blue-100 text-blue-400 border-blue-500/30",
        lower: "bg-orange-500/20 text-orange-400 border-green-300",
        legs: "bg-purple-100 text-purple-800 border-purple-300",
        cardio: "bg-red-100 text-red-800 border-red-300",
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
                title="ROZPOCZNIJ"
            />

            <main className="max-w-4xl mx-auto px-4 py-6">
                <div className="bg-neutral-900 rounded-lg  p-4 mb-6">
                    <h2 className="text-sm font-semibold text-neutral-100 mb-4">
                        Wybierz szablon treningu
                    </h2>

                    {templates.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-neutral-400 mb-4">
                                Nie masz jeszcze żadnych szablonów
                            </p>
                            <Link
                                href="/templates/new"
                                className="inline-block bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                            >
                                Stwórz szablon
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {templates.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => selectTemplate(template.id)}
                                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                                        selectedTemplate === template.id
                                            ? "border-blue-500 bg-blue-500/10"
                                            : "border-neutral-800 hover:border-neutral-700"
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-semibold text-neutral-100">
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
                                        <p className="text-sm text-neutral-400">
                                            {template.description}
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {selectedTemplate && (
                    <div className="bg-neutral-900 rounded-lg  p-4 mb-6">
                        <h2 className="text-sm font-semibold text-neutral-100 mb-4">
                            Nazwa treningu (opcjonalnie)
                        </h2>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="np. Trening A - Poniedziałek"
                            className="w-full px-4 py-2 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                )}

                <div className="flex gap-4">
                    <Link
                        href="/dashboard"
                        className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-950 transition-colors text-center font-medium"
                    >
                        Anuluj
                    </Link>
                    <button
                        onClick={startWorkout}
                        disabled={starting || !selectedTemplate}
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed "
                    >
                        {starting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Rozpoczynanie...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Rozpocznij
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
