"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    WorkoutTemplate,
    WorkoutTemplateExercise,
    Exercise,
    WorkoutType,
} from "@/types/database";
import { TargetBodyPart } from "@/types/database";
import {
    ArrowLeft,
    Edit2,
    Save,
    Plus,
    Trash2,
    Play,
    Loader2,
    X,
    Share2,
    ClipboardList,
    TrendingUp,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../../components/header";

interface ExerciseWithDetails extends WorkoutTemplateExercise {
    exercise: Exercise;
}

export default function TemplateDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const templateId = params.id as string;
    const supabase = createClient();

    const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
    const [exercises, setExercises] = useState<ExerciseWithDetails[]>([]);
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isShared, setIsShared] = useState(false);
    const [sharingLoading, setSharingLoading] = useState(false);

    // Edit state
    const [editName, setEditName] = useState("");
    const [editType, setEditType] = useState<WorkoutType>("upper");
    const [editDescription, setEditDescription] = useState("");
    const [editExercises, setEditExercises] = useState<ExerciseWithDetails[]>(
        []
    );
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState("");
    const [newExerciseTarget, setNewExerciseTarget] = useState<
        TargetBodyPart | ""
    >("");
    const [editingExerciseIndex, setEditingExerciseIndex] = useState<
        number | null
    >(null);

    useEffect(() => {
        if (!user) {
            router.push("/login");
        }
    }, [user, router]);

    useEffect(() => {
        if (user && templateId) {
            fetchTemplateData();
            fetchAllExercises();
            checkIfShared();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, templateId]);

    async function checkIfShared() {
        try {
            const { data, error } = await supabase
                .from("shared_workout_templates")
                .select("id")
                .eq("workout_template_id", templateId)
                .single();

            if (error && error.code !== "PGRST116") {
                // PGRST116 is "not found" error, which is expected
                throw error;
            }

            setIsShared(!!data);
        } catch (error) {
            console.error("Error checking if template is shared:", error);
        }
    }

    async function fetchTemplateData() {
        setLoading(true);
        try {
            // Fetch template
            const { data: templateData, error: templateError } = await supabase
                .from("workout_templates")
                .select("*")
                .eq("id", templateId)
                .single();

            if (templateError) throw templateError;
            setTemplate(templateData);
            setEditName(templateData.name);
            setEditType(templateData.workout_type);
            setEditDescription(templateData.description || "");

            // Fetch template exercises
            const { data: exercisesData, error: exercisesError } =
                await supabase
                    .from("workout_template_exercises")
                    .select(
                        `
          *,
          exercise:exercises(*)
        `
                    )
                    .eq("workout_template_id", templateId)
                    .order("order_index");

            if (exercisesError) {
                console.error(
                    "Error fetching template exercises:",
                    exercisesError
                );
                throw exercisesError;
            }

            console.log("Fetched template exercises:", exercisesData);
            console.log("Number of exercises:", exercisesData?.length || 0);

            // Check if exercises are properly joined
            if (exercisesData && exercisesData.length > 0) {
                exercisesData.forEach((ex, idx) => {
                    console.log(`Exercise ${idx + 1}:`, {
                        id: ex.id,
                        exercise_id: ex.exercise_id,
                        has_exercise_data: !!ex.exercise,
                        exercise_name: ex.exercise?.name || "NO NAME",
                    });
                });
            }

            const exercisesWithDetails = exercisesData as ExerciseWithDetails[];
            setExercises(exercisesWithDetails);
            setEditExercises(exercisesWithDetails);
        } catch (error) {
            console.error("Error fetching template:", error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchAllExercises() {
        try {
            const { data, error } = await supabase
                .from("exercises")
                .select("*")
                .order("name");

            if (error) throw error;
            setAllExercises(data || []);
        } catch (error) {
            console.error("Error fetching exercises:", error);
        }
    }

    async function createNewExercise() {
        if (!newExerciseName.trim() || !user) return;

        try {
            const { data, error } = await supabase
                .from("exercises")
                .insert({
                    name: newExerciseName,
                    muscle_group: editType,
                    target_body_part: newExerciseTarget || null,
                    user_id: user.id,
                })
                .select()
                .single();

            if (error) throw error;

            setAllExercises([...allExercises, data]);
            addExerciseToTemplate(data);
            setNewExerciseName("");
        } catch (error) {
            console.error("Error creating exercise:", error);
            alert("Błąd podczas tworzenia ćwiczenia");
        }
    }

    function addExerciseToTemplate(exercise: Exercise) {
        const exists = editExercises.find((e) => e.exercise_id === exercise.id);
        if (exists) {
            alert("To ćwiczenie jest już dodane");
            return;
        }

        const newExercise: ExerciseWithDetails = {
            id: `temp-${Date.now()}`,
            workout_template_id: templateId,
            exercise_id: exercise.id,
            order_index: editExercises.length,
            sets_count: 3,
            created_at: new Date().toISOString(),
            exercise: exercise,
        };

        setEditExercises([...editExercises, newExercise]);
        setShowExercisePicker(false);
    }

    function removeExercise(index: number) {
        const newExercises = editExercises.filter((_, i) => i !== index);
        setEditExercises(
            newExercises.map((ex, i) => ({ ...ex, order_index: i }))
        );
    }

    function updateSetsCount(index: number, count: number) {
        const newExercises = [...editExercises];
        newExercises[index].sets_count = Math.max(1, count);
        setEditExercises(newExercises);
    }

    function updateExerciseTarget(index: number, target: TargetBodyPart | "") {
        const newExercises = [...editExercises];
        newExercises[index].exercise = {
            ...newExercises[index].exercise,
            target_body_part: target || null,
        };
        setEditExercises(newExercises);
    }

    async function saveExerciseChanges(index: number) {
        const exercise = editExercises[index];
        try {
            // Update the exercise in the database
            const { error } = await supabase
                .from("exercises")
                .update({
                    target_body_part: exercise.exercise.target_body_part,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", exercise.exercise_id);

            if (error) throw error;
            setEditingExerciseIndex(null);
        } catch (error) {
            console.error("Error updating exercise:", error);
            alert("Błąd podczas aktualizacji ćwiczenia");
        }
    }

    function moveExercise(index: number, direction: "up" | "down") {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === editExercises.length - 1)
        ) {
            return;
        }

        const newExercises = [...editExercises];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        [newExercises[index], newExercises[targetIndex]] = [
            newExercises[targetIndex],
            newExercises[index],
        ];
        setEditExercises(
            newExercises.map((ex, i) => ({ ...ex, order_index: i }))
        );
    }

    async function saveChanges() {
        if (!editName.trim() || !user) {
            alert("Wypełnij wszystkie wymagane pola");
            return;
        }

        setSaving(true);
        try {
            // Update template
            const { error: templateError } = await supabase
                .from("workout_templates")
                .update({
                    name: editName,
                    workout_type: editType,
                    description: editDescription || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", templateId);

            if (templateError) throw templateError;

            // Delete existing template exercises
            const { error: deleteError } = await supabase
                .from("workout_template_exercises")
                .delete()
                .eq("workout_template_id", templateId);

            if (deleteError) throw deleteError;

            // Insert new template exercises
            if (editExercises.length > 0) {
                const exercisesToInsert = editExercises.map((ex) => ({
                    workout_template_id: templateId,
                    exercise_id: ex.exercise_id,
                    order_index: ex.order_index,
                    sets_count: ex.sets_count,
                }));

                const { error: insertError } = await supabase
                    .from("workout_template_exercises")
                    .insert(exercisesToInsert);

                if (insertError) throw insertError;
            }

            // Refresh data
            await fetchTemplateData();
            setEditing(false);
        } catch (error) {
            console.error("Error saving template:", error);
            alert("Błąd podczas zapisywania zmian");
        } finally {
            setSaving(false);
        }
    }

    function cancelEdit() {
        setEditName(template?.name || "");
        setEditType(template?.workout_type || "upper");
        setEditDescription(template?.description || "");
        setEditExercises(exercises);
        setEditing(false);
    }

    async function deleteTemplate() {
        if (
            !confirm(
                "Czy na pewno chcesz usunąć ten szablon? Tej operacji nie można cofnąć."
            )
        ) {
            return;
        }

        try {
            const { error } = await supabase
                .from("workout_templates")
                .delete()
                .eq("id", templateId);

            if (error) throw error;
            router.push("/templates");
        } catch (error) {
            console.error("Error deleting template:", error);
            alert("Błąd podczas usuwania szablonu");
        }
    }

    async function startWorkout() {
        router.push(`/workout/new?template=${templateId}`);
    }

    async function toggleShare() {
        if (!user || !template) return;

        setSharingLoading(true);
        try {
            if (isShared) {
                // Unshare the template
                const { error } = await supabase
                    .from("shared_workout_templates")
                    .delete()
                    .eq("workout_template_id", templateId);

                if (error) throw error;
                setIsShared(false);
            } else {
                // Share the template
                const { error } = await supabase
                    .from("shared_workout_templates")
                    .insert({
                        workout_template_id: templateId,
                        shared_by_user_id: user.id,
                        is_public: true,
                    });

                if (error) throw error;
                setIsShared(true);
            }
        } catch (error) {
            console.error("Error toggling share:", error);
            alert("Błąd podczas zmiany udostępniania");
        } finally {
            setSharingLoading(false);
        }
    }

    const workoutTypeLabels: Record<WorkoutType, string> = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
    };

    const workoutTypeColors: Record<WorkoutType, string> = {
        upper: "bg-blue-500/100/10 text-blue-400 border border-blue-500/20",
        lower: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
        legs: "bg-blue-500/100/10 text-blue-400 border border-blue-500/20",
        cardio: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    };

    const targetBodyPartLabels: Record<string, string> = {
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!template) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <div className="text-center">
                    <p className="text-neutral-400 mb-3 text-sm">
                        Nie znaleziono szablonu
                    </p>
                    <Link
                        href="/templates"
                        className="text-blue-400 hover:underline text-xs"
                    >
                        Powrót do szablonów
                    </Link>
                </div>
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
                        {!editing && (
                            <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                    workoutTypeColors[template.workout_type]
                                }`}
                            >
                                {workoutTypeLabels[template.workout_type]}
                            </span>
                        )}
                    </>
                }
                title={editing ? "EDYTUJ SZABLON" : template.name.toUpperCase()}
                buttons={
                    !editing
                        ? [
                              <button
                                  key="share"
                                  onClick={toggleShare}
                                  disabled={sharingLoading}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs ${
                                      isShared
                                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                                  }`}
                              >
                                  {sharingLoading ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                      <Share2 className="w-4 h-4" />
                                  )}
                                  <span className="hidden sm:inline">
                                      {isShared ? "Udostępniony" : "Udostępnij"}
                                  </span>
                              </button>,
                              <button
                                  key="edit"
                                  onClick={() => setEditing(true)}
                                  className="flex items-center gap-2 bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors text-xs"
                              >
                                  <Edit2 className="w-4 h-4" />
                                  <span className="hidden sm:inline">
                                      Edytuj
                                  </span>
                              </button>,
                              <button
                                  key="start"
                                  onClick={startWorkout}
                                  className="flex items-center gap-2 bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors text-xs"
                              >
                                  <Play className="w-4 h-4" />
                                  <span className="hidden sm:inline">
                                      Rozpocznij
                                  </span>
                              </button>,
                          ]
                        : [
                              <button
                                  key="cancel"
                                  onClick={cancelEdit}
                                  className="flex items-center gap-2 text-neutral-400 hover:text-neutral-100"
                              >
                                  <X className="w-5 h-5" />
                              </button>,
                          ]
                }
            />

            <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
                {!editing ? (
                    // View Mode
                    <>
                        {template.description && (
                            <div className="bg-neutral-900 rounded-lg  p-4 mb-6">
                                <h2 className="text-sm font-medium text-neutral-500 mb-2">
                                    Opis
                                </h2>
                                <p className="text-neutral-100">
                                    {template.description}
                                </p>
                            </div>
                        )}

                        <div className="bg-neutral-900 rounded-lg  p-4 mb-6">
                            <h2 className="text-sm font-semibold text-neutral-100 mb-4">
                                Ćwiczenia ({exercises.length})
                            </h2>

                            {exercises.length === 0 ? (
                                <div className="text-center py-6 text-neutral-500">
                                    <p>Brak ćwiczeń w tym szablonie</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {exercises.map((ex, idx) => (
                                        <div
                                            key={ex.id}
                                            className="flex items-center gap-4 p-4 bg-neutral-950 rounded-lg"
                                        >
                                            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium text-neutral-100">
                                                    {ex.exercise?.name ||
                                                        `Exercise ID: ${ex.exercise_id}`}
                                                </h3>
                                                {ex.exercise
                                                    ?.target_body_part && (
                                                    <p className="text-xs text-neutral-400 mt-1">
                                                        {targetBodyPartLabels[
                                                            ex.exercise
                                                                .target_body_part
                                                        ] ||
                                                            ex.exercise
                                                                .target_body_part}
                                                    </p>
                                                )}
                                                {!ex.exercise && (
                                                    <p className="text-xs text-red-400 mt-1">
                                                        Błąd: Nie można
                                                        załadować danych
                                                        ćwiczenia
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-sm text-neutral-400">
                                                <span className="font-medium">
                                                    {ex.sets_count}
                                                </span>{" "}
                                                serie
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={deleteTemplate}
                                className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                            >
                                <Trash2 className="w-5 h-5" />
                                Usuń szablon
                            </button>
                            <button
                                onClick={startWorkout}
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-all font-medium "
                            >
                                <Play className="w-5 h-5" />
                                Rozpocznij
                            </button>
                        </div>
                    </>
                ) : (
                    // Edit Mode
                    <>
                        <div className="bg-neutral-900 rounded-lg  p-4 mb-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                                        Nazwa treningu
                                    </label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) =>
                                            setEditName(e.target.value)
                                        }
                                        className="w-full px-4 py-2 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-2">
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
                                                onClick={() =>
                                                    setEditType(type)
                                                }
                                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                                    editType === type
                                                        ? "bg-orange-500 text-white"
                                                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                                                }`}
                                            >
                                                {workoutTypeLabels[type]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                                        Opis (opcjonalnie)
                                    </label>
                                    <textarea
                                        value={editDescription}
                                        onChange={(e) =>
                                            setEditDescription(e.target.value)
                                        }
                                        rows={3}
                                        className="w-full px-4 py-2 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-neutral-900 rounded-lg  p-4 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-neutral-100">
                                    Ćwiczenia
                                </h2>
                                <button
                                    onClick={() =>
                                        setShowExercisePicker(
                                            !showExercisePicker
                                        )
                                    }
                                    className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                    Dodaj ćwiczenie
                                </button>
                            </div>

                            {showExercisePicker && (
                                <div className="mb-4 p-4 bg-neutral-950 rounded-lg">
                                    <h3 className="font-medium text-neutral-100 mb-3">
                                        Wybierz ćwiczenie
                                    </h3>

                                    <div className="mb-4 space-y-2">
                                        <input
                                            type="text"
                                            value={newExerciseName}
                                            onChange={(e) =>
                                                setNewExerciseName(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Nazwa nowego ćwiczenia"
                                            className="w-full px-4 py-2 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            onKeyPress={(e) =>
                                                e.key === "Enter" &&
                                                createNewExercise()
                                            }
                                        />
                                        <select
                                            value={newExerciseTarget}
                                            onChange={(e) =>
                                                setNewExerciseTarget(
                                                    e.target
                                                        .value as TargetBodyPart
                                                )
                                            }
                                            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg"
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
                                            <option value="glutes">
                                                Pośladki
                                            </option>
                                            <option value="chest">
                                                Klatka piersiowa
                                            </option>
                                            <option value="back">Plecy</option>
                                            <option value="biceps">
                                                Biceps
                                            </option>
                                            <option value="triceps">
                                                Triceps
                                            </option>
                                            <option value="shoulders">
                                                Barki
                                            </option>
                                            <option value="calves">
                                                Łydki
                                            </option>
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
                                        <button
                                            onClick={createNewExercise}
                                            className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                                        >
                                            Utwórz nowe ćwiczenie
                                        </button>
                                    </div>

                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                        {allExercises.length === 0 ? (
                                            <p className="text-neutral-400 text-center py-4">
                                                Brak ćwiczeń. Utwórz pierwsze
                                                ćwiczenie powyżej.
                                            </p>
                                        ) : (
                                            allExercises
                                                .filter(
                                                    (e) =>
                                                        e.user_id === user?.id
                                                )
                                                .map((exercise) => (
                                                    <button
                                                        key={exercise.id}
                                                        onClick={() =>
                                                            addExerciseToTemplate(
                                                                exercise
                                                            )
                                                        }
                                                        className="w-full text-left px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-blue-500/30 hover:bg-blue-500/100/10 transition-colors"
                                                    >
                                                        {exercise.name}
                                                    </button>
                                                ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {editExercises.length === 0 ? (
                                <div className="text-center py-6 text-neutral-500">
                                    <p>Dodaj ćwiczenia do szablonu</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {editExercises.map((exercise, index) => (
                                        <div
                                            key={exercise.id}
                                            className="p-4 bg-neutral-950 rounded-lg space-y-3"
                                        >
                                            {/* Exercise Name and Move Buttons */}
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() =>
                                                            moveExercise(
                                                                index,
                                                                "up"
                                                            )
                                                        }
                                                        disabled={index === 0}
                                                        className="text-neutral-600 hover:text-neutral-400 disabled:opacity-30"
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            moveExercise(
                                                                index,
                                                                "down"
                                                            )
                                                        }
                                                        disabled={
                                                            index ===
                                                            editExercises.length -
                                                                1
                                                        }
                                                        className="text-neutral-600 hover:text-neutral-400 disabled:opacity-30"
                                                    >
                                                        ▼
                                                    </button>
                                                </div>

                                                <div className="flex-1">
                                                    <p className="font-medium text-neutral-100">
                                                        {exercise.exercise.name}
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        removeExercise(index)
                                                    }
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Target Body Part */}
                                            <div>
                                                <label className="block text-xs text-neutral-400 mb-1">
                                                    Część ciała
                                                </label>
                                                <select
                                                    value={
                                                        exercise.exercise
                                                            .target_body_part ||
                                                        ""
                                                    }
                                                    onChange={(e) => {
                                                        updateExerciseTarget(
                                                            index,
                                                            e.target.value as
                                                                | TargetBodyPart
                                                                | ""
                                                        );
                                                        if (
                                                            !exercise.id.startsWith(
                                                                "temp-"
                                                            )
                                                        ) {
                                                            setEditingExerciseIndex(
                                                                index
                                                            );
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg text-sm"
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
                                                    <option value="glutes">
                                                        Pośladki
                                                    </option>
                                                    <option value="chest">
                                                        Klatka piersiowa
                                                    </option>
                                                    <option value="back">
                                                        Plecy
                                                    </option>
                                                    <option value="biceps">
                                                        Biceps
                                                    </option>
                                                    <option value="triceps">
                                                        Triceps
                                                    </option>
                                                    <option value="shoulders">
                                                        Barki
                                                    </option>
                                                    <option value="calves">
                                                        Łydki
                                                    </option>
                                                    <option value="core">
                                                        Brzuch
                                                    </option>
                                                    <option value="forearms">
                                                        Przedramiona
                                                    </option>
                                                    <option value="neck">
                                                        Szyja
                                                    </option>
                                                    <option value="adductors">
                                                        Przywodziciele
                                                    </option>
                                                    <option value="abductors">
                                                        Odwodziciele
                                                    </option>
                                                </select>
                                            </div>

                                            {/* Sets Count */}
                                            <div>
                                                <label className="block text-xs text-neutral-400 mb-1">
                                                    Liczba serii
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={exercise.sets_count}
                                                    onChange={(e) =>
                                                        updateSetsCount(
                                                            index,
                                                            parseInt(
                                                                e.target.value
                                                            ) || 1
                                                        )
                                                    }
                                                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg text-sm"
                                                />
                                            </div>

                                            {/* Save button for existing exercises */}
                                            {!exercise.id.startsWith("temp-") &&
                                                editingExerciseIndex ===
                                                    index && (
                                                    <button
                                                        onClick={() =>
                                                            saveExerciseChanges(
                                                                index
                                                            )
                                                        }
                                                        className="w-full bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                                    >
                                                        Zapisz zmiany ćwiczenia
                                                    </button>
                                                )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={cancelEdit}
                                className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-950 transition-colors text-center font-medium"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={saveChanges}
                                disabled={saving || !editName.trim()}
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Zapisywanie...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Zapisz zmiany
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </main>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-800 px-4 py-3">
                <div className="max-w-7xl mx-auto flex justify-around items-center gap-4">
                    <Link
                        href="/templates"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 text-blue-400 hover:bg-neutral-800 transition-colors"
                    >
                        <ClipboardList className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/workout/new"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                    >
                        <Play className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/progress"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 text-blue-400 hover:bg-neutral-800 transition-colors"
                    >
                        <TrendingUp className="w-6 h-6" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
