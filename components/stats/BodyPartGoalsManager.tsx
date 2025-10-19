"use client";

import { useState, useEffect } from "react";
import { useBodyPartGoals } from "@/hooks/useBodyPartGoals";
import { createClient } from "@/lib/supabase/client";
import type { TargetBodyPart, Exercise } from "@/types/database";
import {
    Loader2,
    Target,
    Plus,
    X,
    TrendingUp,
    Calendar,
    Dumbbell,
    CheckCircle2,
} from "lucide-react";

const targetBodyPartLabels: Record<TargetBodyPart, string> = {
    quads: "Czworogłowe ud",
    hamstrings: "Dwugłowe ud",
    glutes: "Pośladki",
    chest: "Klatka piersiowa",
    back: "Plecy",
    biceps: "Biceps",
    triceps: "Triceps",
    shoulders: "Barki",
    calves: "Łydki",
    core: "Brzuch",
    forearms: "Przedramiona",
    neck: "Kark",
    adductors: "Przywodziciele",
    abductors: "Odwodziciele",
};

const bodyPartOptions: TargetBodyPart[] = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "core",
    "forearms",
    "neck",
    "adductors",
    "abductors",
];

export default function BodyPartGoalsManager() {
    const { goalsWithProgress, loading, createGoal, deleteGoal } =
        useBodyPartGoals();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedBodyPart, setSelectedBodyPart] =
        useState<TargetBodyPart>("chest");
    const [goalType, setGoalType] = useState<
        "volume" | "frequency" | "specific_exercises"
    >("volume");
    const [targetValue, setTargetValue] = useState<string>("");
    const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>(
        []
    );
    const [availableExercises, setAvailableExercises] = useState<Exercise[]>(
        []
    );
    const [loadingExercises, setLoadingExercises] = useState(false);
    const [timeframe, setTimeframe] = useState<"weekly" | "monthly">("weekly");
    const [creating, setCreating] = useState(false);

    const supabase = createClient();

    // Fetch exercises when body part changes and goal type is specific_exercises
    useEffect(() => {
        async function fetchExercises() {
            if (goalType !== "specific_exercises") {
                setAvailableExercises([]);
                return;
            }

            setLoadingExercises(true);
            try {
                const { data, error } = await supabase
                    .from("exercises")
                    .select("*")
                    .eq("target_body_part", selectedBodyPart)
                    .order("name");

                if (error) throw error;
                setAvailableExercises(data || []);
            } catch (error) {
                console.error("Error fetching exercises:", error);
                setAvailableExercises([]);
            } finally {
                setLoadingExercises(false);
            }
        }

        fetchExercises();
    }, [selectedBodyPart, goalType, supabase]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    const handleCreateGoal = async () => {
        try {
            setCreating(true);

            let value: number | undefined;
            let exercises: string[] | undefined;

            if (goalType === "volume" || goalType === "frequency") {
                const parsed = parseFloat(targetValue);
                if (isNaN(parsed) || parsed <= 0) {
                    alert("Wprowadź prawidłową wartość");
                    return;
                }
                value = parsed;
            } else if (goalType === "specific_exercises") {
                // Get exercise names from selected IDs
                const selectedExerciseNames = availableExercises
                    .filter((ex) => selectedExerciseIds.includes(ex.id))
                    .map((ex) => ex.name);

                if (selectedExerciseNames.length === 0) {
                    alert("Wybierz przynajmniej jedno ćwiczenie");
                    return;
                }
                exercises = selectedExerciseNames;
            }

            await createGoal(
                selectedBodyPart,
                goalType,
                value,
                exercises,
                timeframe
            );

            // Reset form
            setShowCreateModal(false);
            setTargetValue("");
            setSelectedExerciseIds([]);
            setGoalType("volume");
            setTimeframe("weekly");
        } catch (error) {
            console.error("Error creating goal:", error);
            alert("Błąd podczas tworzenia celu");
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteGoal = async (goalId: string) => {
        if (!confirm("Czy na pewno chcesz usunąć ten cel?")) return;

        try {
            await deleteGoal(goalId);
        } catch (error) {
            console.error("Error deleting goal:", error);
            alert("Błąd podczas usuwania celu");
        }
    };

    const getGoalTypeLabel = (type: string) => {
        switch (type) {
            case "volume":
                return "Objętość";
            case "frequency":
                return "Częstotliwość";
            case "specific_exercises":
                return "Konkretne ćwiczenia";
            default:
                return type;
        }
    };

    const getGoalTypeIcon = (type: string) => {
        switch (type) {
            case "volume":
                return <TrendingUp className="w-4 h-4" />;
            case "frequency":
                return <Calendar className="w-4 h-4" />;
            case "specific_exercises":
                return <Dumbbell className="w-4 h-4" />;
            default:
                return <Target className="w-4 h-4" />;
        }
    };

    const getTimeframeLabel = (tf: string) => {
        return tf === "weekly" ? "tygodniowo" : "miesięcznie";
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-100">
                        Cele treningowe
                    </h2>
                    <p className="text-sm text-neutral-400 mt-1">
                        Śledź postępy dla poszczególnych partii mięśniowych
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Dodaj cel
                </button>
            </div>

            {/* Goals List */}
            {goalsWithProgress.length === 0 ? (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
                    <Target className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-neutral-300 mb-2">
                        Brak celów treningowych
                    </h3>
                    <p className="text-sm text-neutral-500 mb-4">
                        Dodaj cel dla wybranej partii mięśniowej aby śledzić
                        postępy
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                        Dodaj pierwszy cel
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {goalsWithProgress.map(
                        ({ goal, currentValue, progress, isAchieved }) => (
                            <div
                                key={goal.id}
                                className={`bg-neutral-900/50 border-2 rounded-lg p-5 ${
                                    isAchieved
                                        ? "border-green-500/30 bg-green-500/5"
                                        : "border-neutral-800"
                                }`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`p-2 rounded-lg ${
                                                isAchieved
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-orange-500/20 text-orange-400"
                                            }`}
                                        >
                                            {getGoalTypeIcon(goal.goal_type)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-neutral-100 mb-1">
                                                {
                                                    targetBodyPartLabels[
                                                        goal.body_part
                                                    ]
                                                }
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm text-neutral-400">
                                                <span>
                                                    {getGoalTypeLabel(
                                                        goal.goal_type
                                                    )}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    {getTimeframeLabel(
                                                        goal.timeframe
                                                    )}
                                                </span>
                                                {isAchieved && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1 text-green-400">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Osiągnięty
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() =>
                                            handleDeleteGoal(goal.id)
                                        }
                                        className="text-neutral-500 hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-3">
                                    <div className="flex items-center justify-between mb-2 text-sm">
                                        <span className="text-neutral-300">
                                            {goal.goal_type === "volume" && (
                                                <>
                                                    {Math.round(
                                                        currentValue
                                                    ).toLocaleString()}{" "}
                                                    /{" "}
                                                    {goal.target_value?.toLocaleString()}{" "}
                                                    kg
                                                </>
                                            )}
                                            {goal.goal_type === "frequency" && (
                                                <>
                                                    {currentValue} /{" "}
                                                    {goal.target_value}{" "}
                                                    {goal.timeframe === "weekly"
                                                        ? "treningów/tydzień"
                                                        : "treningów/miesiąc"}
                                                </>
                                            )}
                                            {goal.goal_type ===
                                                "specific_exercises" && (
                                                <>
                                                    {currentValue} /{" "}
                                                    {
                                                        goal.target_exercises
                                                            ?.length
                                                    }{" "}
                                                    ćwiczeń
                                                </>
                                            )}
                                        </span>
                                        <span
                                            className={
                                                isAchieved
                                                    ? "text-green-400 font-bold"
                                                    : "text-neutral-400"
                                            }
                                        >
                                            {Math.round(progress)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${
                                                isAchieved
                                                    ? "bg-green-500"
                                                    : "bg-gradient-to-r from-orange-500 to-orange-400"
                                            }`}
                                            style={{
                                                width: `${Math.min(
                                                    progress,
                                                    100
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Target Exercises List */}
                                {goal.goal_type === "specific_exercises" &&
                                    goal.target_exercises &&
                                    goal.target_exercises.length > 0 && (
                                        <div className="mt-3 p-3 bg-neutral-800/50 rounded-lg">
                                            <p className="text-xs text-neutral-400 mb-2">
                                                Docelowe ćwiczenia:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {goal.target_exercises.map(
                                                    (ex, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="text-xs px-2 py-1 bg-neutral-700 text-neutral-300 rounded"
                                                        >
                                                            {ex}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Create Goal Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-neutral-100">
                                Nowy cel treningowy
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-neutral-500 hover:text-neutral-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Body Part Selection */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">
                                    Partia mięśniowa
                                </label>
                                <select
                                    value={selectedBodyPart}
                                    onChange={(e) =>
                                        setSelectedBodyPart(
                                            e.target.value as TargetBodyPart
                                        )
                                    }
                                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    {bodyPartOptions.map((bp) => (
                                        <option key={bp} value={bp}>
                                            {targetBodyPartLabels[bp]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Goal Type Selection */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">
                                    Typ celu
                                </label>
                                <select
                                    value={goalType}
                                    onChange={(e) =>
                                        setGoalType(
                                            e.target.value as
                                                | "volume"
                                                | "frequency"
                                                | "specific_exercises"
                                        )
                                    }
                                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="volume">
                                        Objętość (kg)
                                    </option>
                                    <option value="frequency">
                                        Częstotliwość treningów
                                    </option>
                                    <option value="specific_exercises">
                                        Konkretne ćwiczenia
                                    </option>
                                </select>
                            </div>

                            {/* Timeframe Selection */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">
                                    Okres czasu
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setTimeframe("weekly")}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            timeframe === "weekly"
                                                ? "bg-orange-500 text-white"
                                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                        }`}
                                    >
                                        Tygodniowo
                                    </button>
                                    <button
                                        onClick={() => setTimeframe("monthly")}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            timeframe === "monthly"
                                                ? "bg-orange-500 text-white"
                                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                        }`}
                                    >
                                        Miesięcznie
                                    </button>
                                </div>
                            </div>

                            {/* Target Value Input */}
                            {(goalType === "volume" ||
                                goalType === "frequency") && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                                        {goalType === "volume"
                                            ? "Docelowa objętość (kg)"
                                            : "Liczba treningów"}
                                    </label>
                                    <input
                                        type="number"
                                        value={targetValue}
                                        onChange={(e) =>
                                            setTargetValue(e.target.value)
                                        }
                                        placeholder={
                                            goalType === "volume"
                                                ? "np. 5000"
                                                : "np. 2"
                                        }
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            )}

                            {/* Target Exercises Input */}
                            {goalType === "specific_exercises" && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                                        Wybierz ćwiczenia
                                    </label>
                                    {loadingExercises ? (
                                        <div className="flex items-center justify-center py-8 bg-neutral-800 border border-neutral-700 rounded-lg">
                                            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                        </div>
                                    ) : availableExercises.length === 0 ? (
                                        <div className="py-8 bg-neutral-800 border border-neutral-700 rounded-lg text-center">
                                            <p className="text-sm text-neutral-400">
                                                Brak ćwiczeń dla wybranej partii
                                                mięśniowej
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg max-h-60 overflow-y-auto">
                                            {availableExercises.map(
                                                (exercise) => {
                                                    const isSelected =
                                                        selectedExerciseIds.includes(
                                                            exercise.id
                                                        );
                                                    return (
                                                        <button
                                                            key={exercise.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedExerciseIds(
                                                                    (prev) =>
                                                                        isSelected
                                                                            ? prev.filter(
                                                                                  (
                                                                                      id
                                                                                  ) =>
                                                                                      id !==
                                                                                      exercise.id
                                                                              )
                                                                            : [
                                                                                  ...prev,
                                                                                  exercise.id,
                                                                              ]
                                                                );
                                                            }}
                                                            className={`w-full px-3 py-2 text-left border-b border-neutral-700 last:border-b-0 transition-colors ${
                                                                isSelected
                                                                    ? "bg-orange-500/20 text-orange-400"
                                                                    : "text-neutral-300 hover:bg-neutral-700/50"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                                        isSelected
                                                                            ? "bg-orange-500 border-orange-500"
                                                                            : "border-neutral-600"
                                                                    }`}
                                                                >
                                                                    {isSelected && (
                                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                                    )}
                                                                </div>
                                                                <span className="text-sm">
                                                                    {
                                                                        exercise.name
                                                                    }
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                    {selectedExerciseIds.length > 0 && (
                                        <p className="text-xs text-neutral-400 mt-2">
                                            Wybrano:{" "}
                                            {selectedExerciseIds.length}{" "}
                                            {selectedExerciseIds.length === 1
                                                ? "ćwiczenie"
                                                : selectedExerciseIds.length < 5
                                                ? "ćwiczenia"
                                                : "ćwiczeń"}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors"
                                >
                                    Anuluj
                                </button>
                                <button
                                    onClick={handleCreateGoal}
                                    disabled={creating}
                                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Tworzenie...
                                        </>
                                    ) : (
                                        "Utwórz cel"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
