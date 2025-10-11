"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Exercise, WorkoutType } from "@/types/database";
import {
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    Save,
    Loader2,
} from "lucide-react";
import Link from "next/link";

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
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Nowy szablon treningu
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nazwa treningu
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="np. Trening górnej części ciała"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            workoutType === type
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                    >
                                        {workoutTypeLabels[type]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Opis (opcjonalnie)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Dodatkowe informacje o treningu"
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Ćwiczenia
                        </h2>
                        <button
                            onClick={() =>
                                setShowExercisePicker(!showExercisePicker)
                            }
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Dodaj ćwiczenie
                        </button>
                    </div>

                    {showExercisePicker && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-900 mb-3">
                                Wybierz ćwiczenie
                            </h3>

                            <div className="mb-4">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newExerciseName}
                                        onChange={(e) =>
                                            setNewExerciseName(e.target.value)
                                        }
                                        placeholder="Nazwa nowego ćwiczenia"
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        onKeyPress={(e) =>
                                            e.key === "Enter" &&
                                            createNewExercise()
                                        }
                                    />
                                    <button
                                        onClick={createNewExercise}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        Utwórz nowe
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {loading ? (
                                    <div className="text-center py-4">
                                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                                    </div>
                                ) : allExercises.length === 0 ? (
                                    <p className="text-gray-600 text-center py-4">
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
                                            className="w-full text-left px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                        >
                                            {exercise.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {selectedExercises.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>Dodaj ćwiczenia do szablonu</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {selectedExercises.map((exercise, index) => (
                                <div
                                    key={exercise.id}
                                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() =>
                                                moveExercise(index, "up")
                                            }
                                            disabled={index === 0}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
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
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">
                                            {exercise.name}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <label className="text-sm text-gray-600">
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
                                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                                        />
                                    </div>

                                    <button
                                        onClick={() => removeExercise(index)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-4">
                    <Link
                        href="/dashboard"
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center font-medium"
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
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Zapisywanie...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Zapisz szablon
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
