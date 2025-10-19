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
    ChevronLeft,
    Trophy,
    X,
    List,
    Trash2,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../../components/header";

interface ExerciseLogWithDetails extends ExerciseLog {
    exercise: Exercise;
    sets: SetLog[];
    previousSets?: SetLog[];
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
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [showExerciseList, setShowExerciseList] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelling, setCancelling] = useState(false);

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

                    // Fetch previous workout data for this exercise
                    const { data: previousWorkouts, error: prevError } =
                        await supabase
                            .from("exercise_logs")
                            .select(
                                `
                            id,
                            workout_session_id,
                            workout_sessions!inner(completed_at)
                        `
                            )
                            .eq("exercise_id", log.exercise_id)
                            .neq("workout_session_id", sessionId)
                            .not("workout_sessions.completed_at", "is", null)
                            .order("workout_sessions(completed_at)", {
                                ascending: false,
                            })
                            .limit(1);

                    if (prevError)
                        console.error(
                            "Error fetching previous workout:",
                            prevError
                        );

                    let previousSets: SetLog[] = [];
                    if (previousWorkouts && previousWorkouts.length > 0) {
                        const { data: prevSets, error: prevSetsError } =
                            await supabase
                                .from("set_logs")
                                .select("*")
                                .eq("exercise_log_id", previousWorkouts[0].id)
                                .order("set_number");

                        if (prevSetsError)
                            console.error(
                                "Error fetching previous sets:",
                                prevSetsError
                            );
                        else previousSets = prevSets || [];
                    }

                    return {
                        ...log,
                        sets: sets || [],
                        previousSets,
                    };
                })
            );

            setExerciseLogs(logsWithSets as ExerciseLogWithDetails[]);

            // Auto-select first incomplete exercise
            const firstIncomplete = logsWithSets.find((log) =>
                log.sets.some((set: SetLog) => !set.completed)
            );
            if (firstIncomplete) {
                const index = logsWithSets.findIndex(
                    (l) => l.id === firstIncomplete.id
                );
                setCurrentExerciseIndex(index);
                setSelectedExercise(firstIncomplete as ExerciseLogWithDetails);
            } else if (logsWithSets.length > 0) {
                setCurrentExerciseIndex(0);
                setSelectedExercise(logsWithSets[0] as ExerciseLogWithDetails);
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

    async function cancelWorkout() {
        if (!session) return;

        setCancelling(true);
        try {
            // Delete all set logs first (cascade won't work from client)
            const { error: setsError } = await supabase
                .from("set_logs")
                .delete()
                .in(
                    "exercise_log_id",
                    exerciseLogs.map((log) => log.id)
                );

            if (setsError) throw setsError;

            // Delete all exercise logs
            const { error: logsError } = await supabase
                .from("exercise_logs")
                .delete()
                .eq("workout_session_id", session.id);

            if (logsError) throw logsError;

            // Delete the workout session
            const { error: sessionError } = await supabase
                .from("workout_sessions")
                .delete()
                .eq("id", session.id);

            if (sessionError) throw sessionError;

            router.push("/dashboard");
        } catch (error) {
            console.error("Error cancelling workout:", error);
            alert("Błąd podczas anulowania treningu");
        } finally {
            setCancelling(false);
            setShowCancelConfirm(false);
        }
    }

    function goToNextExercise() {
        if (currentExerciseIndex < exerciseLogs.length - 1) {
            const nextIndex = currentExerciseIndex + 1;
            setCurrentExerciseIndex(nextIndex);
            setSelectedExercise(exerciseLogs[nextIndex]);
        }
    }

    function goToPreviousExercise() {
        if (currentExerciseIndex > 0) {
            const prevIndex = currentExerciseIndex - 1;
            setCurrentExerciseIndex(prevIndex);
            setSelectedExercise(exerciseLogs[prevIndex]);
        }
    }

    function selectExerciseFromList(index: number) {
        setCurrentExerciseIndex(index);
        setSelectedExercise(exerciseLogs[index]);
        setShowExerciseList(false);
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

    const completedExercises = exerciseLogs.filter((log) =>
        log.sets.every((set) => set.completed)
    ).length;
    const progressPercentage =
        exerciseLogs.length > 0
            ? (completedExercises / exerciseLogs.length) * 100
            : 0;

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col">
            <Header
                icon={
                    <Link
                        href="/dashboard"
                        className="text-neutral-400 hover:text-neutral-100"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                }
                title={session.name.toUpperCase()}
                buttons={[
                    <button
                        key="cancel"
                        onClick={() => setShowCancelConfirm(true)}
                        className="flex items-center gap-2 bg-red-900/30 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/50 transition-colors text-xs border border-red-800/30"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Anuluj</span>
                    </button>,
                    <button
                        key="list"
                        onClick={() => setShowExerciseList(true)}
                        className="flex items-center gap-2 bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors text-xs"
                    >
                        <List className="w-4 h-4" />
                        <span className="hidden sm:inline">Lista</span>
                    </button>,
                ]}
            />

            {/* Progress Bar */}
            <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-neutral-400">
                            Postęp treningu
                        </span>
                        <span className="text-xs text-neutral-400">
                            {completedExercises} / {exerciseLogs.length} ćwiczeń
                        </span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-orange-500 transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Exercise List Modal */}
            {showExerciseList && (
                <div className="fixed inset-0 bg-neutral-950/95 z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-neutral-800">
                        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-neutral-100">
                                LISTA ĆWICZEŃ
                            </h2>
                            <button
                                onClick={() => setShowExerciseList(false)}
                                className="text-neutral-400 hover:text-neutral-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div>
                            {exerciseLogs.map((log, idx) => {
                                const completedSets = log.sets.filter(
                                    (s) => s.completed
                                ).length;
                                const totalSets = log.sets.length;
                                const isComplete = completedSets === totalSets;
                                const isCurrent = idx === currentExerciseIndex;

                                return (
                                    <button
                                        key={log.id}
                                        onClick={() =>
                                            selectExerciseFromList(idx)
                                        }
                                        className={`w-full flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-neutral-800 transition-colors ${
                                            isCurrent ? "bg-neutral-800" : ""
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                                    isComplete
                                                        ? "bg-orange-500 text-white"
                                                        : "bg-neutral-800 text-neutral-400"
                                                }`}
                                            >
                                                {isComplete ? (
                                                    <Check className="w-4 h-4" />
                                                ) : (
                                                    idx + 1
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <h3 className="font-semibold text-sm text-neutral-100">
                                                    {log.exercise.name}
                                                </h3>
                                                <p className="text-xs text-neutral-500">
                                                    {completedSets}/{totalSets}{" "}
                                                    serii
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-neutral-600" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 bg-neutral-950/95 z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 rounded-lg max-w-md w-full border border-neutral-800">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-400" />
                                </div>
                                <h2 className="text-lg font-bold text-neutral-100">
                                    Anulować trening?
                                </h2>
                            </div>
                            <p className="text-neutral-400 mb-6">
                                Czy na pewno chcesz anulować ten trening?
                                Wszystkie wprowadzone dane zostaną usunięte. Tej
                                operacji nie można cofnąć.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowCancelConfirm(false)}
                                    disabled={cancelling}
                                    className="flex-1 bg-neutral-800 text-neutral-300 py-3 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50 font-medium text-sm"
                                >
                                    Nie, kontynuuj
                                </button>
                                <button
                                    onClick={cancelWorkout}
                                    disabled={cancelling}
                                    className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
                                >
                                    {cancelling ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Usuwanie...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            Tak, anuluj
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
                {selectedExercise && (
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-neutral-100 mb-1">
                                {selectedExercise.exercise.name}
                            </h2>
                            <p className="text-xs text-neutral-500">
                                Ćwiczenie {currentExerciseIndex + 1} z{" "}
                                {exerciseLogs.length}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {selectedExercise.sets.map((set, idx) => (
                                <SetInput
                                    key={set.id}
                                    set={set}
                                    setNumber={idx + 1}
                                    onUpdate={(updates) =>
                                        updateSet(set.id, updates)
                                    }
                                    previousSet={
                                        selectedExercise.previousSets?.[idx]
                                    }
                                    isUnilateral={
                                        selectedExercise.exercise.is_unilateral
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Navigation */}
            <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-800 px-4 py-3">
                <div className="max-w-4xl mx-auto">
                    {allSetsCompleted ? (
                        <button
                            onClick={completeWorkout}
                            disabled={completing}
                            className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 font-semibold text-sm"
                        >
                            {completing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Zapisywanie...
                                </>
                            ) : (
                                <>
                                    <Trophy className="w-5 h-5" />
                                    Zakończ trening
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <button
                                onClick={goToPreviousExercise}
                                disabled={currentExerciseIndex === 0}
                                className="flex-1 flex items-center justify-center gap-2 bg-neutral-800 text-neutral-300 py-3 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium text-sm"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Poprzednie
                            </button>
                            <button
                                onClick={goToNextExercise}
                                disabled={
                                    currentExerciseIndex ===
                                    exerciseLogs.length - 1
                                }
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium text-sm"
                            >
                                Następne
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface SetInputProps {
    set: SetLog;
    setNumber: number;
    onUpdate: (updates: Partial<SetLog>) => void;
    previousSet?: SetLog;
    isUnilateral?: boolean;
}

function SetInput({
    set,
    setNumber,
    onUpdate,
    previousSet,
    isUnilateral,
}: SetInputProps) {
    const [reps, setReps] = useState<number | string>(set.reps || "");
    const [weight, setWeight] = useState<number | string>(set.weight || "");
    const [rir, setRir] = useState<number | string>(set.rir ?? "");
    const [side, setSide] = useState<"left" | "right" | null>(set.side || null);

    const handleComplete = () => {
        onUpdate({
            reps: Number(reps) || 0,
            weight: Number(weight) || 0,
            rir: Number(rir) || 0,
            side: isUnilateral ? side : null,
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
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-orange-400">
                            Seria {setNumber}
                        </span>
                        {isUnilateral && set.side && (
                            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
                                {set.side === "left" ? "Lewa" : "Prawa"}
                            </span>
                        )}
                    </div>
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
                {previousSet && (
                    <div className="mt-2 bg-neutral-900/50 rounded-lg p-2 border border-neutral-800">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs text-neutral-500">
                                Ostatnio:
                            </p>
                            {isUnilateral && previousSet.side && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                                    {previousSet.side === "left"
                                        ? "Lewa"
                                        : "Prawa"}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="text-xs font-bold text-neutral-300">
                                    {previousSet.reps}
                                </p>
                                <p className="text-[10px] text-neutral-500">
                                    Powtórzenia
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-neutral-300">
                                    {previousSet.weight} kg
                                </p>
                                <p className="text-[10px] text-neutral-500">
                                    Ciężar
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-neutral-300">
                                    {previousSet.rir ?? "-"}
                                </p>
                                <p className="text-[10px] text-neutral-500">
                                    RIR
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isUnilateral && (
                <div className="mb-4">
                    <label className="block text-xs font-medium text-neutral-300 mb-2">
                        Która strona?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setSide("left")}
                            className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                                side === "left"
                                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                                    : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600"
                            }`}
                        >
                            👈 Lewa
                        </button>
                        <button
                            type="button"
                            onClick={() => setSide("right")}
                            className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                                side === "right"
                                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                                    : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600"
                            }`}
                        >
                            Prawa 👉
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                        Powtórzenia
                    </label>
                    <input
                        type="text"
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
                        type="text"
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
                        type="text"
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
                disabled={isUnilateral && !side}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Check className="w-5 h-5" />
                {isUnilateral && !side ? "Wybierz stronę" : "Potwierdź serię"}
            </button>
        </div>
    );
}
