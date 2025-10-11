"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    WorkoutSession,
    ExerciseLog,
    SetLog,
    Exercise,
} from "@/types/database";
import {
    ArrowLeft,
    Check,
    Loader2,
    ChevronRight,
    Trophy,
    X,
} from "lucide-react";
import Link from "next/link";

interface ExerciseLogWithDetails extends ExerciseLog {
    exercise: Exercise;
    sets: SetLog[];
}

export default function WorkoutSessionPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const sessionId = params.id as string;
    const supabase = createClient();

    const [session, setSession] = useState<WorkoutSession | null>(null);
    const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogWithDetails[]>(
        []
    );
    const [loading, setLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] =
        useState<ExerciseLogWithDetails | null>(null);
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        if (user && sessionId) {
            fetchWorkoutSession();
        }
    }, [user, sessionId]);

    async function fetchWorkoutSession() {
        setLoading(true);
        try {
            // Fetch session
            const { data: sessionData, error: sessionError } = await supabase
                .from("workout_sessions")
                .select("*")
                .eq("id", sessionId)
                .single();

            if (sessionError) throw sessionError;
            setSession(sessionData);

            // Fetch exercise logs with exercises and sets
            const { data: logsData, error: logsError } = await supabase
                .from("exercise_logs")
                .select(
                    `
          *,
          exercise:exercises(*)
        `
                )
                .eq("workout_session_id", sessionId)
                .order("order_index");

            if (logsError) throw logsError;

            // Fetch sets for each exercise log
            const logsWithSets = await Promise.all(
                (logsData || []).map(async (log) => {
                    const { data: sets, error: setsError } = await supabase
                        .from("set_logs")
                        .select("*")
                        .eq("exercise_log_id", log.id)
                        .order("set_number");

                    if (setsError) throw setsError;

                    return {
                        ...log,
                        sets: sets || [],
                    };
                })
            );

            setExerciseLogs(logsWithSets as ExerciseLogWithDetails[]);

            // Auto-select first incomplete exercise
            const firstIncomplete = logsWithSets.find((log) =>
                log.sets.some((set: SetLog) => !set.completed)
            );
            if (firstIncomplete) {
                setSelectedExercise(firstIncomplete as ExerciseLogWithDetails);
            }
        } catch (error) {
            console.error("Error fetching workout session:", error);
        } finally {
            setLoading(false);
        }
    }

    async function updateSet(setId: string, updates: Partial<SetLog>) {
        try {
            const { error } = await supabase
                .from("set_logs")
                .update(updates)
                .eq("id", setId);

            if (error) throw error;

            // Update local state
            setExerciseLogs((prevLogs) =>
                prevLogs.map((log) => ({
                    ...log,
                    sets: log.sets.map((set) =>
                        set.id === setId ? { ...set, ...updates } : set
                    ),
                }))
            );

            // Update selected exercise if needed
            if (selectedExercise) {
                setSelectedExercise((prev) =>
                    prev
                        ? {
                              ...prev,
                              sets: prev.sets.map((set) =>
                                  set.id === setId
                                      ? { ...set, ...updates }
                                      : set
                              ),
                          }
                        : null
                );
            }
        } catch (error) {
            console.error("Error updating set:", error);
            alert("Błąd podczas aktualizacji serii");
        }
    }

    async function completeWorkout() {
        if (!session) return;

        setCompleting(true);
        try {
            const { error } = await supabase
                .from("workout_sessions")
                .update({ completed_at: new Date().toISOString() })
                .eq("id", session.id);

            if (error) throw error;

            router.push("/dashboard");
        } catch (error) {
            console.error("Error completing workout:", error);
            alert("Błąd podczas kończenia treningu");
        } finally {
            setCompleting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">
                        Nie znaleziono treningu
                    </p>
                    <Link
                        href="/dashboard"
                        className="text-blue-600 hover:underline"
                    >
                        Powrót do panelu
                    </Link>
                </div>
            </div>
        );
    }

    const allSetsCompleted = exerciseLogs.every((log) =>
        log.sets.every((set) => set.completed)
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </Link>
                            <div>
                                <h1 className="text-md font-bold text-gray-900">
                                    {session.name}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {new Date(
                                        session.started_at
                                    ).toLocaleTimeString("pl-PL", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={completeWorkout}
                            disabled={completing}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {completing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Trophy className="w-5 h-5" />
                                    <span className="hidden sm:inline">
                                        Zakończ
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">
                {/* Exercise List - Desktop/Tablet View */}
                <div className="hidden md:block mb-6">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        {exerciseLogs.map((log, idx) => {
                            const completedSets = log.sets.filter(
                                (s) => s.completed
                            ).length;
                            const totalSets = log.sets.length;
                            const isComplete = completedSets === totalSets;

                            return (
                                <button
                                    key={log.id}
                                    onClick={() => setSelectedExercise(log)}
                                    className={`w-full flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                                        selectedExercise?.id === log.id
                                            ? "bg-blue-50"
                                            : ""
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                                isComplete
                                                    ? "bg-green-500 text-white"
                                                    : "bg-gray-200 text-gray-600"
                                            }`}
                                        >
                                            {isComplete ? (
                                                <Check className="w-5 h-5" />
                                            ) : (
                                                idx + 1
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900">
                                                {log.exercise.name}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {completedSets}/{totalSets}{" "}
                                                serii
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Exercise - Set Logging */}
                {selectedExercise && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                {selectedExercise.exercise.name}
                            </h2>
                            <button
                                onClick={() => setSelectedExercise(null)}
                                className="md:hidden text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {selectedExercise.sets.map((set, idx) => (
                                <SetInput
                                    key={set.id}
                                    set={set}
                                    setNumber={idx + 1}
                                    onUpdate={(updates) =>
                                        updateSet(set.id, updates)
                                    }
                                />
                            ))}
                        </div>

                        {/* Mobile Exercise Navigation */}
                        <div className="md:hidden mt-6 flex gap-2">
                            {exerciseLogs.map((log, idx) => {
                                const isComplete = log.sets.every(
                                    (s) => s.completed
                                );
                                const isCurrent =
                                    selectedExercise?.id === log.id;

                                return (
                                    <button
                                        key={log.id}
                                        onClick={() => setSelectedExercise(log)}
                                        className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                                            isCurrent
                                                ? "bg-blue-600 text-white"
                                                : isComplete
                                                ? "bg-green-100 text-green-800"
                                                : "bg-gray-100 text-gray-700"
                                        }`}
                                    >
                                        {isComplete ? "✓" : idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Mobile Exercise List - When none selected */}
                {!selectedExercise && (
                    <div className="md:hidden bg-white rounded-xl shadow-sm overflow-hidden">
                        {exerciseLogs.map((log, idx) => {
                            const completedSets = log.sets.filter(
                                (s) => s.completed
                            ).length;
                            const totalSets = log.sets.length;
                            const isComplete = completedSets === totalSets;

                            return (
                                <button
                                    key={log.id}
                                    onClick={() => setSelectedExercise(log)}
                                    className="w-full flex items-center justify-between p-4 border-b last:border-b-0 active:bg-gray-50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                                isComplete
                                                    ? "bg-green-500 text-white"
                                                    : "bg-gray-200 text-gray-600"
                                            }`}
                                        >
                                            {isComplete ? (
                                                <Check className="w-5 h-5" />
                                            ) : (
                                                idx + 1
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900">
                                                {log.exercise.name}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {completedSets}/{totalSets}{" "}
                                                serii
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>
                            );
                        })}
                    </div>
                )}

                {allSetsCompleted && (
                    <div className="mt-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6 text-center shadow-lg">
                        <Trophy className="w-12 h-12 mx-auto mb-3" />
                        <h3 className="text-md font-bold mb-2">
                            Świetna robota!
                        </h3>
                        <p className="mb-4">Ukończyłeś wszystkie serie</p>
                        <button
                            onClick={completeWorkout}
                            disabled={completing}
                            className="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                            {completing ? "Zapisywanie..." : "Zakończ trening"}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

interface SetInputProps {
    set: SetLog;
    setNumber: number;
    onUpdate: (updates: Partial<SetLog>) => void;
}

function SetInput({ set, setNumber, onUpdate }: SetInputProps) {
    const [reps, setReps] = useState(set.reps || "");
    const [weight, setWeight] = useState(set.weight || "");
    const [rir, setRir] = useState(set.rir ?? "");

    const handleComplete = () => {
        onUpdate({
            reps: Number(reps) || 0,
            weight: Number(weight) || 0,
            rir: Number(rir) ?? null,
            completed: true,
        });
    };

    const handleUncomplete = () => {
        onUpdate({ completed: false });
    };

    if (set.completed) {
        return (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-green-800">
                        Seria {setNumber}
                    </span>
                    <button
                        onClick={handleUncomplete}
                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                        Edytuj
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-xl font-bold text-green-800">
                            {set.reps}
                        </p>
                        <p className="text-xs text-green-600">powtórzeń</p>
                    </div>
                    <div>
                        <p className="text-xl font-bold text-green-800">
                            {set.weight} kg
                        </p>
                        <p className="text-xs text-green-600">ciężar</p>
                    </div>
                    <div>
                        <p className="text-xl font-bold text-green-800">
                            {set.rir ?? "-"}
                        </p>
                        <p className="text-xs text-green-600">RIR</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="mb-4">
                <span className="font-bold text-blue-800 text-md">
                    Seria {setNumber}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Powtórzenia
                    </label>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        className="w-full px-3 py-3 text-center text-md font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Ciężar (kg)
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full px-3 py-3 text-center text-md font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        RIR
                    </label>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={rir}
                        onChange={(e) => setRir(e.target.value)}
                        className="w-full px-3 py-3 text-center text-md font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                        min="0"
                        max="10"
                    />
                </div>
            </div>

            <button
                onClick={handleComplete}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
                <Check className="w-5 h-5" />
                Potwierdź serię
            </button>
        </div>
    );
}
