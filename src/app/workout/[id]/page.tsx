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
                        className="flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/20 transition-all text-sm border border-red-500/20 font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Anuluj</span>
                    </button>,
                    <button
                        key="list"
                        onClick={() => setShowExerciseList(true)}
                        className="flex items-center gap-2 bg-neutral-800 text-neutral-300 px-3 py-2 rounded-lg hover:bg-neutral-700 transition-all text-sm border border-neutral-700 font-medium"
                    >
                        <List className="w-4 h-4" />
                        <span className="hidden sm:inline">Lista</span>
                    </button>,
                ]}
            />

            {/* Progress Bar */}
            <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                            Postęp treningu
                        </span>
                        <span className="text-sm text-neutral-300 font-semibold">
                            {completedExercises} / {exerciseLogs.length}
                        </span>
                    </div>
                    <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Exercise List Modal */}
            {showExerciseList && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-neutral-900 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-hidden border border-neutral-800 shadow-2xl">
                        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                                Lista ćwiczeń
                            </h2>
                            <button
                                onClick={() => setShowExerciseList(false)}
                                className="text-neutral-400 hover:text-neutral-100 transition-colors p-1 hover:bg-neutral-800 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[calc(85vh-5rem)]">
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
                                        className={`w-full flex items-center justify-between p-5 border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/50 transition-all ${
                                            isCurrent
                                                ? "bg-neutral-800/70 border-l-4 border-l-orange-500"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                                                    isComplete
                                                        ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30"
                                                        : isCurrent
                                                        ? "bg-blue-500/20 text-blue-400 border-2 border-blue-500/50"
                                                        : "bg-neutral-800 text-neutral-500 border-2 border-neutral-700"
                                                }`}
                                            >
                                                {isComplete ? (
                                                    <Check className="w-5 h-5" />
                                                ) : (
                                                    idx + 1
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <h3 className="font-semibold text-base text-neutral-100 mb-0.5">
                                                    {log.exercise.name}
                                                </h3>
                                                <p className="text-xs text-neutral-500 font-medium">
                                                    {completedSets}/{totalSets}{" "}
                                                    {totalSets === 1
                                                        ? "seria"
                                                        : "serie"}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-neutral-600" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-neutral-900 rounded-lg max-w-md w-full border border-neutral-800 shadow-2xl">
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
                                    <Trash2 className="w-6 h-6 text-red-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-neutral-100 mb-2">
                                        Anulować trening?
                                    </h2>
                                    <p className="text-sm text-neutral-400 leading-relaxed">
                                        Wszystkie wprowadzone dane zostaną
                                        bezpowrotnie usunięte. Tej operacji nie
                                        można cofnąć.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowCancelConfirm(false)}
                                    disabled={cancelling}
                                    className="flex-1 bg-neutral-800 text-neutral-300 py-3 rounded-lg hover:bg-neutral-700 transition-all disabled:opacity-50 font-semibold text-sm border border-neutral-700"
                                >
                                    Nie, kontynuuj
                                </button>
                                <button
                                    onClick={cancelWorkout}
                                    disabled={cancelling}
                                    className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
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
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 pb-24">
                {selectedExercise && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 p-5 border-b border-neutral-800">
                            <h2 className="text-xl font-bold text-neutral-100 mb-1">
                                {selectedExercise.exercise.name}
                            </h2>
                            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
                                Ćwiczenie {currentExerciseIndex + 1} z{" "}
                                {exerciseLogs.length}
                            </p>
                        </div>

                        <div className="p-5 space-y-4">
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
            <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 px-4 py-4 shadow-2xl">
                <div className="max-w-4xl mx-auto">
                    {allSetsCompleted ? (
                        <button
                            onClick={completeWorkout}
                            disabled={completing}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 font-bold text-base shadow-lg shadow-orange-500/30"
                        >
                            {completing ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Zapisywanie...
                                </>
                            ) : (
                                <>
                                    <Trophy className="w-6 h-6 fill-current" />
                                    Zakończ trening
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <button
                                onClick={goToPreviousExercise}
                                disabled={currentExerciseIndex === 0}
                                className="flex-1 flex items-center justify-center gap-2 bg-neutral-800 text-neutral-300 py-3.5 rounded-lg hover:bg-neutral-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm border border-neutral-700"
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
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3.5 rounded-lg hover:bg-orange-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm shadow-lg shadow-orange-500/20"
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
    const [rir, setRir] = useState<number | string>(
        set.rir !== null && set.rir !== undefined && set.rir !== 0
            ? set.rir
            : ""
    );
    const [side, setSide] = useState<"left" | "right" | null>(set.side || null);

    // Validate numeric input - allows digits, decimal point, and backspace
    const handleNumericInput = (
        value: string,
        setter: (value: string) => void,
        allowDecimal = false
    ) => {
        // Allow empty string
        if (value === "") {
            setter("");
            return;
        }

        // Regex: optional digits, optional single decimal point, optional digits after decimal
        const regex = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;

        if (regex.test(value)) {
            setter(value);
        }
    };

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
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-2 border-orange-500/30 rounded-lg p-4 shadow-lg shadow-orange-500/5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-orange-400" />
                        </div>
                        <span className="font-bold text-orange-400">
                            Seria {setNumber}
                        </span>
                        {isUnilateral && set.side && (
                            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium">
                                {set.side === "left" ? "Lewa" : "Prawa"}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleUncomplete}
                        className="text-orange-400 hover:text-orange-300 text-sm font-semibold transition-colors"
                    >
                        Edytuj
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-neutral-900/50 rounded-lg p-3 text-center border border-orange-500/20">
                        <p className="text-lg font-bold text-orange-400 mb-0.5">
                            {set.reps}
                        </p>
                        <p className="text-xs text-orange-400/80 font-medium">
                            powtórzeń
                        </p>
                    </div>
                    <div className="bg-neutral-900/50 rounded-lg p-3 text-center border border-orange-500/20">
                        <p className="text-lg font-bold text-orange-400 mb-0.5">
                            {set.weight} kg
                        </p>
                        <p className="text-xs text-orange-400/80 font-medium">
                            ciężar
                        </p>
                    </div>
                    <div className="bg-neutral-900/50 rounded-lg p-3 text-center border border-orange-500/20">
                        <p className="text-lg font-bold text-orange-400 mb-0.5">
                            {set.rir ?? "-"}
                        </p>
                        <p className="text-xs text-orange-400/80 font-medium">
                            RIR
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-2 border-blue-500/30 rounded-lg p-4 shadow-lg shadow-blue-500/5">
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <span className="text-xs font-bold text-blue-400">
                            {setNumber}
                        </span>
                    </div>
                    <span className="font-bold text-blue-400">
                        Seria {setNumber}
                    </span>
                </div>
                {previousSet && (
                    <div className="bg-neutral-900/70 rounded-lg p-3 border border-neutral-800">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                Ostatnio:
                            </p>
                            {isUnilateral && previousSet.side && (
                                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-medium border border-neutral-700">
                                    {previousSet.side === "left"
                                        ? "Lewa"
                                        : "Prawa"}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                                <p className="text-sm font-bold text-neutral-200">
                                    {previousSet.reps}
                                </p>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                    Powtórzenia
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-neutral-200">
                                    {previousSet.weight} kg
                                </p>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                    Ciężar
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-neutral-200">
                                    {previousSet.rir ?? "-"}
                                </p>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                    RIR
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isUnilateral && (
                <div className="mb-4">
                    <label className="block text-xs font-bold text-neutral-300 mb-2 uppercase tracking-wider">
                        Która strona?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setSide("left")}
                            className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                                side === "left"
                                    ? "border-blue-500 bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/20"
                                    : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-800"
                            }`}
                        >
                            👈 Lewa
                        </button>
                        <button
                            type="button"
                            onClick={() => setSide("right")}
                            className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                                side === "right"
                                    ? "border-blue-500 bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/20"
                                    : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-800"
                            }`}
                        >
                            Prawa 👉
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-2 uppercase tracking-wider">
                        Powtórzenia
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={reps}
                        onChange={(e) =>
                            handleNumericInput(e.target.value, setReps, false)
                        }
                        className="w-full px-3 py-3.5 text-center text-base font-bold border-2 border-neutral-700 bg-neutral-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-neutral-100 transition-all placeholder:text-neutral-600"
                        placeholder="0"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-2 uppercase tracking-wider">
                        Ciężar (kg)
                    </label>
                    <input
                        type="text"
                        inputMode="decimal"
                        step="0.5"
                        value={weight}
                        onChange={(e) =>
                            handleNumericInput(e.target.value, setWeight, true)
                        }
                        className="w-full px-3 py-3.5 text-center text-base font-bold border-2 border-neutral-700 bg-neutral-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-neutral-100 transition-all placeholder:text-neutral-600"
                        placeholder="0"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-2 uppercase tracking-wider">
                        RIR
                    </label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={rir}
                        onChange={(e) =>
                            handleNumericInput(e.target.value, setRir, true)
                        }
                        className="w-full px-3 py-3.5 text-center text-base font-bold border-2 border-neutral-700 bg-neutral-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-neutral-100 transition-all placeholder:text-neutral-600"
                        placeholder="0"
                        min="0"
                        max="10"
                    />
                </div>
            </div>

            <button
                onClick={handleComplete}
                disabled={isUnilateral && !side}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
            >
                <Check className="w-5 h-5" />
                {isUnilateral && !side ? "Wybierz stronę" : "Potwierdź serię"}
            </button>
        </div>
    );
}
