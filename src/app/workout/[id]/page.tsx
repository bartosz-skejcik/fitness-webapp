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
import Header from "../../../../components/header";

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
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <div className="text-center">
                    <p className="text-neutral-400 mb-4">
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
        <div className="min-h-screen bg-neutral-950 pb-20">
            <Header
                icon={
                    <>
                        <Link
                            href="/dashboard"
                            className="text-neutral-400 hover:text-neutral-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <p className="text-xs text-neutral-500">
                                {new Date(
                                    session.started_at
                                ).toLocaleTimeString("pl-PL", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>
                    </>
                }
                title={session.name.toUpperCase()}
                buttons={[
                    <button
                        key="complete"
                        onClick={completeWorkout}
                        disabled={completing}
                        className="flex items-center gap-2 bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-xs"
                    >
                        {completing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Trophy className="w-4 h-4" />
                                <span className="hidden sm:inline">
                                    Zakończ
                                </span>
                            </>
                        )}
                    </button>,
                ]}
            />

            <main className="max-w-4xl mx-auto px-4 py-6">
                {/* Exercise List - Desktop/Tablet View */}
                <div className="hidden md:block mb-6">
                    <div className="bg-neutral-900 rounded-lg  overflow-hidden">
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
                                    className={`w-full flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-neutral-950 transition-colors ${
                                        selectedExercise?.id === log.id
                                            ? "bg-blue-500/10"
                                            : ""
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                                                isComplete
                                                    ? "bg-orange-500/100 text-white"
                                                    : "bg-neutral-700 text-neutral-400"
                                            }`}
                                        >
                                            {isComplete ? (
                                                <Check className="w-5 h-5" />
                                            ) : (
                                                idx + 1
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-neutral-100">
                                                {log.exercise.name}
                                            </h3>
                                            <p className="text-sm text-neutral-500">
                                                {completedSets}/{totalSets}{" "}
                                                serii
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-neutral-600" />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Exercise - Set Logging */}
                {selectedExercise && (
                    <div className="bg-neutral-900 rounded-lg  p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-bold text-neutral-100">
                                {selectedExercise.exercise.name}
                            </h2>
                            <button
                                onClick={() => setSelectedExercise(null)}
                                className="md:hidden text-neutral-600 hover:text-neutral-400"
                            >
                                <X className="w-5 h-5" />
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
                                                ? "bg-orange-500 text-white"
                                                : isComplete
                                                ? "bg-orange-500/20 text-orange-400"
                                                : "bg-neutral-800 text-neutral-300"
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
                    <div className="md:hidden bg-neutral-900 rounded-lg  overflow-hidden">
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
                                    className="w-full flex items-center justify-between p-4 border-b last:border-b-0 active:bg-neutral-950"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                                isComplete
                                                    ? "bg-orange-500/100 text-white"
                                                    : "bg-neutral-700 text-neutral-400"
                                            }`}
                                        >
                                            {isComplete ? (
                                                <Check className="w-5 h-5" />
                                            ) : (
                                                idx + 1
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-neutral-100">
                                                {log.exercise.name}
                                            </h3>
                                            <p className="text-sm text-neutral-500">
                                                {completedSets}/{totalSets}{" "}
                                                serii
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-neutral-600" />
                                </button>
                            );
                        })}
                    </div>
                )}

                {allSetsCompleted && (
                    <div className="mt-6 bg-orange-500 text-white rounded-lg p-4 text-center ">
                        <Trophy className="w-6 h-6 mx-auto mb-3" />
                        <h3 className="text-sm font-bold mb-2">
                            Świetna robota!
                        </h3>
                        <p className="mb-4">Ukończyłeś wszystkie serie</p>
                        <button
                            onClick={completeWorkout}
                            disabled={completing}
                            className="bg-neutral-900 text-orange-400 px-4 py-2 rounded-lg font-semibold hover:bg-orange-500/10 transition-colors disabled:opacity-50"
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
    const [reps, setReps] = useState(set.reps || 0);
    const [weight, setWeight] = useState(set.weight || 0);
    const [rir, setRir] = useState(set.rir ?? 0);

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
            <div className="bg-orange-500/10 border-2 border-orange-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-orange-400">
                        Seria {setNumber}
                    </span>
                    <button
                        onClick={handleUncomplete}
                        className="text-orange-400 hover:text-green-700 text-sm font-medium"
                    >
                        Edytuj
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm font-bold text-orange-400">
                            {set.reps}
                        </p>
                        <p className="text-xs text-orange-400">powtórzeń</p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-orange-400">
                            {set.weight} kg
                        </p>
                        <p className="text-xs text-orange-400">ciężar</p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-orange-400">
                            {set.rir ?? "-"}
                        </p>
                        <p className="text-xs text-orange-400">RIR</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-blue-500/10 border-2 border-blue-500/20 rounded-lg p-4">
            <div className="mb-4">
                <span className="font-bold text-blue-400 text-md">
                    Seria {setNumber}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Powtórzenia
                    </label>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={reps}
                        onChange={(e) => setReps(Number(e.target.value) || 0)}
                        className="w-full px-3 py-3 text-center text-sm font-bold border-2 border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-neutral-200"
                        placeholder="0"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Ciężar (kg)
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value) || 0)}
                        className="w-full px-3 py-3 text-center text-sm font-bold border-2 border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-neutral-200"
                        placeholder="0"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                        RIR
                    </label>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={rir}
                        onChange={(e) => setRir(Number(e.target.value) || 0)}
                        className="w-full px-3 py-3 text-center text-sm font-bold border-2 border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-neutral-200"
                        placeholder="0"
                        min="0"
                        max="10"
                    />
                </div>
            </div>

            <button
                onClick={handleComplete}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
                <Check className="w-5 h-5" />
                Potwierdź serię
            </button>
        </div>
    );
}
