"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Exercise, WorkoutType } from "@/types/database";
import { ArrowLeft, Plus, Trash2, Loader2, Save } from "lucide-react";
import Link from "next/link";
import Header from "../../../../components/header";

interface ExerciseWithSets extends Exercise {
    sets_count: number;
    order_index: number;
}

export default function NewTemplatePage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [name, setName] = useState("");
    const [workoutType, setWorkoutType] = useState<WorkoutType>("upper");
    const [description, setDescription] = useState("");
    const [selectedExercises, setSelectedExercises] = useState<
        ExerciseWithSets[]
    >([]);
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            fetchExercises();
        }
    }, [user]);

    async function fetchExercises() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("exercises")
                .select("*")
                .order("name");

            if (error) throw error;
            setAllExercises(data || []);
        } catch (error) {
            console.error("Error fetching exercises:", error);
        } finally {
            setLoading(false);
        }
    }

    async function createNewExercise() {
        if (!newExerciseName.trim() || !user) return;

        try {
            const { data, error } = await supabase
                .from("exercises")
                .insert({
                    name: newExerciseName,
                    muscle_group: workoutType,
                    user_id: user.id,
                })
                .select()
                .single();

            if (error) throw error;

            setAllExercises([...allExercises, data]);
            addExercise(data);
            setNewExerciseName("");
        } catch (error) {
            console.error("Error creating exercise:", error);
            alert("Błąd podczas tworzenia ćwiczenia");
        }
    }

    function addExercise(exercise: Exercise) {
        const exists = selectedExercises.find((e) => e.id === exercise.id);
        if (exists) {
            alert("To ćwiczenie jest już dodane");
            return;
        }

        setSelectedExercises([
            ...selectedExercises,
            {
                ...exercise,
                sets_count: 3,
                order_index: selectedExercises.length,
            },
        ]);
        setShowExercisePicker(false);
    }

    function removeExercise(index: number) {
        const newExercises = selectedExercises.filter((_, i) => i !== index);
        setSelectedExercises(
            newExercises.map((ex, i) => ({ ...ex, order_index: i }))
        );
    }

    function updateSetsCount(index: number, count: number) {
        const newExercises = [...selectedExercises];
        newExercises[index].sets_count = Math.max(1, count);
        setSelectedExercises(newExercises);
    }

    function moveExercise(index: number, direction: "up" | "down") {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === selectedExercises.length - 1)
        ) {
            return;
        }

        const newExercises = [...selectedExercises];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        [newExercises[index], newExercises[targetIndex]] = [
            newExercises[targetIndex],
            newExercises[index],
        ];
        setSelectedExercises(
            newExercises.map((ex, i) => ({ ...ex, order_index: i }))
        );
    }

    async function saveTemplate() {
        if (!name.trim() || selectedExercises.length === 0 || !user) {
            alert(
                "Wypełnij wszystkie pola i dodaj przynajmniej jedno ćwiczenie"
            );
            return;
        }

        setSaving(true);
        try {
            // Create template
            const { data: template, error: templateError } = await supabase
                .from("workout_templates")
                .insert({
                    name,
                    workout_type: workoutType,
                    description: description || null,
                    user_id: user.id,
                })
                .select()
                .single();

            if (templateError) throw templateError;

            // Add exercises to template
            const exercisesToInsert = selectedExercises.map((ex) => ({
                workout_template_id: template.id,
                exercise_id: ex.id,
                order_index: ex.order_index,
                sets_count: ex.sets_count,
            }));

            const { error: exercisesError } = await supabase
                .from("workout_template_exercises")
                .insert(exercisesToInsert);

            if (exercisesError) throw exercisesError;

            router.push("/dashboard");
        } catch (error) {
            console.error("Error saving template:", error);
            alert("Błąd podczas zapisywania szablonu");
        } finally {
            setSaving(false);
        }
    }

    const workoutTypeLabels = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

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
                title="NOWY SZABLON"
            />

            <main className="max-w-4xl mx-auto px-4 py-6">
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                                Nazwa treningu
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="np. Trening górnej części ciała"
                                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder:text-neutral-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                                Typ treningu
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {(
                                    Object.keys(
                                        workoutTypeLabels
                                    ) as WorkoutType[]
                                ).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setWorkoutType(type)}
                                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                                            workoutType === type
                                                ? "bg-blue-500 text-white"
                                                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                                        }`}
                                    >
                                        {workoutTypeLabels[type]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                                Opis (opcjonalnie)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Dodatkowe informacje o treningu"
                                rows={3}
                                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder:text-neutral-600"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-neutral-100">
                            Ćwiczenia
                        </h2>
                        <button
                            onClick={() =>
                                setShowExercisePicker(!showExercisePicker)
                            }
                            className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors text-xs"
                        >
                            <Plus className="w-4 h-4" />
                            Dodaj
                        </button>
                    </div>

                    {showExercisePicker && (
                        <div className="mb-3 p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg">
                            <h3 className="font-medium text-neutral-100 text-xs mb-2">
                                Wybierz ćwiczenie
                            </h3>

                            <div className="mb-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newExerciseName}
                                        onChange={(e) =>
                                            setNewExerciseName(e.target.value)
                                        }
                                        placeholder="Nazwa nowego ćwiczenia"
                                        className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs placeholder:text-neutral-600"
                                        onKeyPress={(e) =>
                                            e.key === "Enter" &&
                                            createNewExercise()
                                        }
                                    />
                                    <button
                                        onClick={createNewExercise}
                                        className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors text-xs"
                                    >
                                        Utwórz
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-1.5">
                                {loading ? (
                                    <div className="text-center py-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto" />
                                    </div>
                                ) : allExercises.length === 0 ? (
                                    <p className="text-neutral-500 text-center py-4 text-xs">
                                        Brak ćwiczeń. Utwórz pierwsze ćwiczenie
                                        powyżej.
                                    </p>
                                ) : (
                                    allExercises.map((exercise) => (
                                        <button
                                            key={exercise.id}
                                            onClick={() =>
                                                addExercise(exercise)
                                            }
                                            className="w-full text-left px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg hover:border-blue-500 hover:bg-neutral-800 transition-colors text-neutral-100 text-xs"
                                        >
                                            {exercise.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {selectedExercises.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500 text-xs">
                            <p>Dodaj ćwiczenia do szablonu</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {selectedExercises.map((exercise, index) => (
                                <div
                                    key={exercise.id}
                                    className="flex items-center gap-2 p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg"
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() =>
                                                moveExercise(index, "up")
                                            }
                                            disabled={index === 0}
                                            className="text-neutral-500 hover:text-neutral-300 disabled:opacity-30 text-xs"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() =>
                                                moveExercise(index, "down")
                                            }
                                            disabled={
                                                index ===
                                                selectedExercises.length - 1
                                            }
                                            className="text-neutral-500 hover:text-neutral-300 disabled:opacity-30 text-xs"
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    <div className="flex-1">
                                        <p className="font-medium text-neutral-100 text-sm">
                                            {exercise.name}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-neutral-400">
                                            Serie:
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={exercise.sets_count}
                                            onChange={(e) =>
                                                updateSetsCount(
                                                    index,
                                                    parseInt(e.target.value) ||
                                                        1
                                                )
                                            }
                                            className="w-14 px-2 py-1 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded text-center text-xs"
                                        />
                                    </div>

                                    <button
                                        onClick={() => removeExercise(index)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <Link
                        href="/dashboard"
                        className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-900 transition-colors text-center font-medium text-xs"
                    >
                        Anuluj
                    </Link>
                    <button
                        onClick={saveTemplate}
                        disabled={
                            saving ||
                            !name.trim() ||
                            selectedExercises.length === 0
                        }
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Zapisywanie...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Zapisz szablon
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
