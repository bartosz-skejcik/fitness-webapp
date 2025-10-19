"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Exercise, TargetBodyPart, WorkoutType } from "@/types/database";
import {
    ArrowLeft,
    Edit2,
    Trash2,
    Loader2,
    Save,
    X,
    Search,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";

export default function ExercisesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(
        null
    );
    const [saving, setSaving] = useState(false);

    // Edit form state
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editMuscleGroup, setEditMuscleGroup] =
        useState<WorkoutType>("upper");
    const [editTargetBodyPart, setEditTargetBodyPart] = useState<
        TargetBodyPart | ""
    >("");
    const [editIsUnilateral, setEditIsUnilateral] = useState(false);

    useEffect(() => {
        if (user) {
            fetchExercises();
        }
    }, [user]);

    useEffect(() => {
        // Filter exercises based on search query
        if (searchQuery.trim() === "") {
            setFilteredExercises(exercises);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredExercises(
                exercises.filter(
                    (ex) =>
                        ex.name.toLowerCase().includes(query) ||
                        ex.target_body_part?.toLowerCase().includes(query) ||
                        ex.muscle_group?.toLowerCase().includes(query)
                )
            );
        }
    }, [searchQuery, exercises]);

    async function fetchExercises() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("exercises")
                .select("*")
                .eq("user_id", user?.id)
                .order("name");

            if (error) throw error;
            setExercises(data || []);
            setFilteredExercises(data || []);
        } catch (error) {
            console.error("Error fetching exercises:", error);
        } finally {
            setLoading(false);
        }
    }

    function startEditing(exercise: Exercise) {
        setEditingExercise(exercise);
        setEditName(exercise.name);
        setEditDescription(exercise.description || "");
        setEditMuscleGroup(exercise.muscle_group || "upper");
        setEditTargetBodyPart(exercise.target_body_part || "");
        setEditIsUnilateral(exercise.is_unilateral || false);
    }

    function cancelEditing() {
        setEditingExercise(null);
        setEditName("");
        setEditDescription("");
        setEditMuscleGroup("upper");
        setEditTargetBodyPart("");
        setEditIsUnilateral(false);
    }

    async function saveExercise() {
        if (!editingExercise || !editName.trim()) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from("exercises")
                .update({
                    name: editName,
                    description: editDescription || null,
                    muscle_group: editMuscleGroup,
                    target_body_part: editTargetBodyPart || null,
                    is_unilateral: editIsUnilateral,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", editingExercise.id);

            if (error) throw error;

            // Update local state
            setExercises(
                exercises.map((ex) =>
                    ex.id === editingExercise.id
                        ? {
                              ...ex,
                              name: editName,
                              description: editDescription || undefined,
                              muscle_group: editMuscleGroup,
                              target_body_part: editTargetBodyPart || null,
                              is_unilateral: editIsUnilateral,
                          }
                        : ex
                )
            );

            cancelEditing();
        } catch (error) {
            console.error("Error updating exercise:", error);
            alert("Błąd podczas aktualizacji ćwiczenia");
        } finally {
            setSaving(false);
        }
    }

    async function deleteExercise(exerciseId: string) {
        if (
            !confirm(
                "Czy na pewno chcesz usunąć to ćwiczenie? Spowoduje to usunięcie wszystkich danych treningowych związanych z tym ćwiczeniem."
            )
        ) {
            return;
        }

        try {
            const { error } = await supabase
                .from("exercises")
                .delete()
                .eq("id", exerciseId);

            if (error) throw error;

            setExercises(exercises.filter((ex) => ex.id !== exerciseId));
        } catch (error) {
            console.error("Error deleting exercise:", error);
            alert("Błąd podczas usuwania ćwiczenia");
        }
    }

    const targetBodyPartLabels: Record<TargetBodyPart, string> = {
        quads: "Czworogłowe uda",
        hamstrings: "Dwugłowe uda",
        glutes: "Pośladki",
        chest: "Klatka piersiowa",
        back: "Plecy",
        biceps: "Biceps",
        triceps: "Triceps",
        shoulders: "Barki",
        calves: "Łydki",
        core: "Brzuch",
        forearms: "Przedramiona",
        neck: "Szyja",
        adductors: "Przywodziciele",
        abductors: "Odwodziciele",
    };

    const muscleGroupLabels: Record<WorkoutType, string> = {
        upper: "Górna",
        lower: "Dolna",
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
                icon={
                    <Link
                        href="/templates"
                        className="text-neutral-400 hover:text-neutral-100"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                }
                title="MOJE ĆWICZENIA"
            />

            <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Szukaj ćwiczenia..."
                            className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Exercises Count */}
                <div className="mb-4 text-sm text-neutral-400">
                    {filteredExercises.length}{" "}
                    {filteredExercises.length === 1 ? "ćwiczenie" : "ćwiczeń"}
                </div>

                {/* Exercise List */}
                <div className="space-y-3">
                    {filteredExercises.map((exercise) => (
                        <div
                            key={exercise.id}
                            className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
                        >
                            {editingExercise?.id === exercise.id ? (
                                /* Edit Mode */
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) =>
                                            setEditName(e.target.value)
                                        }
                                        placeholder="Nazwa ćwiczenia"
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    />

                                    <textarea
                                        value={editDescription}
                                        onChange={(e) =>
                                            setEditDescription(e.target.value)
                                        }
                                        placeholder="Opis (opcjonalnie)"
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                                        rows={2}
                                    />

                                    <select
                                        value={editMuscleGroup}
                                        onChange={(e) =>
                                            setEditMuscleGroup(
                                                e.target.value as WorkoutType
                                            )
                                        }
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm"
                                    >
                                        <option value="upper">
                                            Górna partia
                                        </option>
                                        <option value="lower">
                                            Dolna partia
                                        </option>
                                        <option value="legs">Nogi</option>
                                        <option value="cardio">Cardio</option>
                                    </select>

                                    <select
                                        value={editTargetBodyPart}
                                        onChange={(e) =>
                                            setEditTargetBodyPart(
                                                e.target.value as TargetBodyPart
                                            )
                                        }
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm"
                                    >
                                        <option value="">
                                            Wybierz część ciała
                                        </option>
                                        <option value="quads">
                                            Czworogłowe uda
                                        </option>
                                        <option value="hamstrings">
                                            Dwugłowe uda
                                        </option>
                                        <option value="glutes">Pośladki</option>
                                        <option value="chest">
                                            Klatka piersiowa
                                        </option>
                                        <option value="back">Plecy</option>
                                        <option value="biceps">Biceps</option>
                                        <option value="triceps">Triceps</option>
                                        <option value="shoulders">Barki</option>
                                        <option value="calves">Łydki</option>
                                        <option value="core">Brzuch</option>
                                        <option value="forearms">
                                            Przedramiona
                                        </option>
                                        <option value="neck">Szyja</option>
                                        <option value="adductors">
                                            Przywodziciele
                                        </option>
                                        <option value="abductors">
                                            Odwodziciele
                                        </option>
                                    </select>

                                    <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editIsUnilateral}
                                            onChange={(e) =>
                                                setEditIsUnilateral(
                                                    e.target.checked
                                                )
                                            }
                                            className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-orange-500 focus:ring-2 focus:ring-orange-500"
                                        />
                                        <span>
                                            Ćwiczenie jednostronne (jedna strona
                                            naraz)
                                        </span>
                                    </label>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={saveExercise}
                                            disabled={
                                                saving || !editName.trim()
                                            }
                                            className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Zapisywanie...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    Zapisz
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={cancelEditing}
                                            disabled={saving}
                                            className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                                        >
                                            <X className="w-4 h-4" />
                                            Anuluj
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* View Mode */
                                <div>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-neutral-100 mb-1">
                                                {exercise.name}
                                            </h3>
                                            {exercise.description && (
                                                <p className="text-sm text-neutral-400 mb-2">
                                                    {exercise.description}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                {exercise.muscle_group && (
                                                    <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        {
                                                            muscleGroupLabels[
                                                                exercise
                                                                    .muscle_group
                                                            ]
                                                        }
                                                    </span>
                                                )}
                                                {exercise.target_body_part && (
                                                    <span className="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                        {
                                                            targetBodyPartLabels[
                                                                exercise
                                                                    .target_body_part
                                                            ]
                                                        }
                                                    </span>
                                                )}
                                                {exercise.is_unilateral && (
                                                    <span className="text-xs px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                        Jednostronne
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() =>
                                                    startEditing(exercise)
                                                }
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    deleteExercise(exercise.id)
                                                }
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {filteredExercises.length === 0 && !loading && (
                        <div className="text-center py-12">
                            <p className="text-neutral-400 mb-4">
                                {searchQuery
                                    ? "Nie znaleziono ćwiczeń"
                                    : "Nie masz jeszcze żadnych ćwiczeń"}
                            </p>
                            {!searchQuery && (
                                <Link
                                    href="/templates/new"
                                    className="text-orange-500 hover:underline"
                                >
                                    Utwórz szablon i dodaj ćwiczenia
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
