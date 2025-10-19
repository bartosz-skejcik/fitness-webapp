import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
    TargetBodyPart,
    WorkoutSession,
    ExerciseLog,
    SetLog,
} from "@/types/database";

// Extended types for joined data
interface SessionWithCompletion {
    id: string;
    completed_at: string;
}

interface ExerciseLogWithExercise extends ExerciseLog {
    exercises?: {
        id: string;
        name: string;
        target_body_part: TargetBodyPart | null;
    }[];
}

export interface InjuryRiskFactor {
    type:
        | "volume_spike"
        | "imbalance"
        | "overtraining"
        | "neglected_stabilizer";
    severity: "low" | "moderate" | "high";
    bodyPart?: TargetBodyPart;
    description: string;
    recommendation: string;
    value?: number;
}

export interface InjuryRiskSummary {
    overallRisk: "low" | "moderate" | "high";
    riskScore: number; // 0-100
    factors: InjuryRiskFactor[];
    volumeSpikes: InjuryRiskFactor[];
    imbalances: InjuryRiskFactor[];
    overtrainingIndicators: InjuryRiskFactor[];
    neglectedStabilizers: InjuryRiskFactor[];
}

// Stabilizer muscles that are often neglected
const STABILIZER_MUSCLES: TargetBodyPart[] = [
    "core",
    "forearms",
    "calves",
    "neck",
    "adductors",
    "abductors",
];

export function useInjuryRisk(weekCount: number = 12) {
    const { user } = useAuth();
    const [summary, setSummary] = useState<InjuryRiskSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (user) {
            calculateInjuryRisk();
        }
    }, [user, weekCount]);

    async function calculateInjuryRisk() {
        setLoading(true);
        try {
            const factors: InjuryRiskFactor[] = [];

            // Get data for the analysis period
            const weeksAgo = new Date();
            weeksAgo.setDate(weeksAgo.getDate() - weekCount * 7);

            const { data: sessions, error: sessionsError } = await supabase
                .from("workout_sessions")
                .select("id, completed_at")
                .eq("user_id", user?.id)
                .not("completed_at", "is", null)
                .gte("completed_at", weeksAgo.toISOString())
                .order("completed_at", { ascending: true });

            if (sessionsError) throw sessionsError;
            if (!sessions || sessions.length === 0) {
                setSummary({
                    overallRisk: "low",
                    riskScore: 0,
                    factors: [],
                    volumeSpikes: [],
                    imbalances: [],
                    overtrainingIndicators: [],
                    neglectedStabilizers: [],
                });
                return;
            }

            const sessionIds = sessions.map((s) => s.id);

            // Get all exercise logs with body parts
            const { data: exerciseLogs, error: logsError } = await supabase
                .from("exercise_logs")
                .select(
                    `
                    id,
                    workout_session_id,
                    exercises!inner(
                        id,
                        name,
                        target_body_part
                    )
                `
                )
                .in("workout_session_id", sessionIds);

            if (logsError) throw logsError;

            // Get all set logs
            const exerciseLogIds = exerciseLogs?.map((log) => log.id) || [];
            const { data: setLogs, error: setsError } = await supabase
                .from("set_logs")
                .select("*")
                .in("exercise_log_id", exerciseLogIds)
                .eq("completed", true);

            if (setsError) throw setsError;

            // 1. Check for volume spikes (>30% increase week over week)
            const volumeSpikesFactors = await detectVolumeSpikes(
                sessions as unknown as WorkoutSession[],
                exerciseLogs as unknown as ExerciseLog[],
                setLogs || []
            );
            factors.push(...volumeSpikesFactors);

            // 2. Check for muscle imbalances
            const imbalanceFactors = await detectImbalances(
                (exerciseLogs || []) as unknown as ExerciseLog[],
                setLogs || []
            );
            factors.push(...imbalanceFactors);

            // 3. Check for overtraining indicators
            const overtrainingFactors = detectOvertraining(
                sessions as unknown as WorkoutSession[],
                setLogs || []
            );
            factors.push(...overtrainingFactors);

            // 4. Check for neglected stabilizers
            const stabilizerFactors = detectNeglectedStabilizers(
                (exerciseLogs || []) as unknown as ExerciseLog[],
                setLogs || []
            );
            factors.push(...stabilizerFactors);

            // Calculate overall risk score (0-100)
            const riskScore = calculateRiskScore(factors);
            const overallRisk: "low" | "moderate" | "high" =
                riskScore < 30 ? "low" : riskScore < 60 ? "moderate" : "high";

            setSummary({
                overallRisk,
                riskScore,
                factors,
                volumeSpikes: factors.filter((f) => f.type === "volume_spike"),
                imbalances: factors.filter((f) => f.type === "imbalance"),
                overtrainingIndicators: factors.filter(
                    (f) => f.type === "overtraining"
                ),
                neglectedStabilizers: factors.filter(
                    (f) => f.type === "neglected_stabilizer"
                ),
            });
        } catch (error) {
            console.error("Error calculating injury risk:", error);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }

    function detectVolumeSpikes(
        sessions: WorkoutSession[],
        exerciseLogs: ExerciseLog[],
        setLogs: SetLog[]
    ): InjuryRiskFactor[] {
        const factors: InjuryRiskFactor[] = [];

        // Group sessions by week
        const weeklyData: Map<
            number,
            { volume: number; sessions: WorkoutSession[] }
        > = new Map();

        sessions.forEach((session) => {
            if (!session.completed_at || !sessions[0].completed_at) return;

            const weekNumber = Math.floor(
                (new Date(session.completed_at).getTime() -
                    new Date(sessions[0].completed_at).getTime()) /
                    (7 * 24 * 60 * 60 * 1000)
            );

            if (!weeklyData.has(weekNumber)) {
                weeklyData.set(weekNumber, { volume: 0, sessions: [] });
            }

            const sessionLogs = exerciseLogs?.filter(
                (log) => log.workout_session_id === session.id
            );
            const sessionLogIds = sessionLogs?.map((log) => log.id) || [];
            const sessionSets = setLogs?.filter((set) =>
                sessionLogIds.includes(set.exercise_log_id)
            );

            const sessionVolume =
                sessionSets?.reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                ) || 0;

            const week = weeklyData.get(weekNumber)!;
            week.volume += sessionVolume;
            week.sessions.push(session);
        });

        // Check for spikes (>30% increase)
        const weeks = Array.from(weeklyData.entries()).sort(
            (a, b) => a[0] - b[0]
        );
        for (let i = 1; i < weeks.length; i++) {
            const prevVolume = weeks[i - 1][1].volume;
            const currVolume = weeks[i][1].volume;

            if (prevVolume > 0) {
                const increase = ((currVolume - prevVolume) / prevVolume) * 100;

                if (increase > 50) {
                    factors.push({
                        type: "volume_spike",
                        severity: "high",
                        description: `Gwałtowny wzrost objętości treningowej o ${increase.toFixed(
                            0
                        )}% w tygodniu ${i + 1}`,
                        recommendation:
                            "Zmniejsz objętość treningową o 20-30% w następnym tygodniu aby dać ciału czas na adaptację.",
                        value: increase,
                    });
                } else if (increase > 30) {
                    factors.push({
                        type: "volume_spike",
                        severity: "moderate",
                        description: `Znaczący wzrost objętości treningowej o ${increase.toFixed(
                            0
                        )}% w tygodniu ${i + 1}`,
                        recommendation:
                            "Monitoruj zmęczenie i rozważ stabilizację objętości w następnym tygodniu.",
                        value: increase,
                    });
                }
            }
        }

        return factors;
    }

    function detectImbalances(
        exerciseLogs: ExerciseLog[],
        setLogs: SetLog[]
    ): InjuryRiskFactor[] {
        const factors: InjuryRiskFactor[] = [];

        // Calculate volume per body part
        const bodyPartVolumes = new Map<TargetBodyPart, number>();

        exerciseLogs?.forEach((log) => {
            const bodyPart = log.exercise?.target_body_part;
            if (!bodyPart) return;

            const logSets = setLogs?.filter(
                (set) => set.exercise_log_id === log.id
            );
            const volume =
                logSets?.reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                ) || 0;

            bodyPartVolumes.set(
                bodyPart,
                (bodyPartVolumes.get(bodyPart) || 0) + volume
            );
        });

        // Check opposing muscle groups
        const opposingPairs: [TargetBodyPart, TargetBodyPart][] = [
            ["chest", "back"],
            ["quads", "hamstrings"],
            ["biceps", "triceps"],
            ["adductors", "abductors"],
        ];

        opposingPairs.forEach(([muscle1, muscle2]) => {
            const vol1 = bodyPartVolumes.get(muscle1) || 0;
            const vol2 = bodyPartVolumes.get(muscle2) || 0;

            if (vol1 === 0 || vol2 === 0) return;

            const ratio = Math.max(vol1, vol2) / Math.min(vol1, vol2);
            const difference = (ratio - 1) * 100;

            if (difference > 40) {
                factors.push({
                    type: "imbalance",
                    severity: "high",
                    bodyPart: vol1 > vol2 ? muscle1 : muscle2,
                    description: `Znacząca dysproporcja między ${muscle1} i ${muscle2} (${difference.toFixed(
                        0
                    )}%)`,
                    recommendation: `Zwiększ objętość treningową dla ${
                        vol1 < vol2 ? muscle1 : muscle2
                    } o 30-50%.`,
                    value: difference,
                });
            } else if (difference > 25) {
                factors.push({
                    type: "imbalance",
                    severity: "moderate",
                    bodyPart: vol1 > vol2 ? muscle1 : muscle2,
                    description: `Dysproporcja między ${muscle1} i ${muscle2} (${difference.toFixed(
                        0
                    )}%)`,
                    recommendation: `Rozważ dodanie 1-2 ćwiczeń dla ${
                        vol1 < vol2 ? muscle1 : muscle2
                    }.`,
                    value: difference,
                });
            }
        });

        return factors;
    }

    function detectOvertraining(
        sessions: WorkoutSession[],
        setLogs: SetLog[]
    ): InjuryRiskFactor[] {
        const factors: InjuryRiskFactor[] = [];

        // Check training frequency (too many workouts per week)
        const recentWeek = new Date();
        recentWeek.setDate(recentWeek.getDate() - 7);
        const recentSessions = sessions.filter(
            (s) => s.completed_at && new Date(s.completed_at) >= recentWeek
        );

        if (recentSessions.length >= 7) {
            factors.push({
                type: "overtraining",
                severity: "high",
                description: `Bardzo wysoka częstotliwość treningowa: ${recentSessions.length} sesji w ostatnim tygodniu`,
                recommendation:
                    "Zaplanuj 1-2 dni odpoczynku. Ciało potrzebuje czasu na regenerację.",
                value: recentSessions.length,
            });
        } else if (recentSessions.length >= 6) {
            factors.push({
                type: "overtraining",
                severity: "moderate",
                description: `Wysoka częstotliwość treningowa: ${recentSessions.length} sesji w ostatnim tygodniu`,
                recommendation:
                    "Rozważ dzień odpoczynku lub lekką sesję regeneracyjną.",
                value: recentSessions.length,
            });
        }

        // Check for lack of deload (no reduction in volume for extended period)
        if (sessions.length >= 8) {
            const last8Weeks = sessions.slice(-8).filter((s) => s.completed_at);
            const weeklyVolumes: number[] = [];

            for (let i = 0; i < last8Weeks.length; i++) {
                if (!last8Weeks[i].completed_at) continue;

                const weekStart = new Date(last8Weeks[i].completed_at!);
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 7);

                const weekSessions = sessions.filter((s) => {
                    if (!s.completed_at) return false;
                    const date = new Date(s.completed_at);
                    return date >= weekStart && date < weekEnd;
                });

                const weekSessionIds = weekSessions.map((s) => s.id);
                const weekSets = setLogs?.filter((set) =>
                    weekSessionIds.includes(set.exercise_log_id)
                );

                const volume =
                    weekSets?.reduce(
                        (sum, set) => sum + set.reps * (set.weight || 0),
                        0
                    ) || 0;

                weeklyVolumes.push(volume);
            }

            // Check if there was any deload (>20% reduction) in last 8 weeks
            let hadDeload = false;
            for (let i = 1; i < weeklyVolumes.length; i++) {
                if (weeklyVolumes[i - 1] > 0) {
                    const reduction =
                        ((weeklyVolumes[i - 1] - weeklyVolumes[i]) /
                            weeklyVolumes[i - 1]) *
                        100;
                    if (reduction > 20) {
                        hadDeload = true;
                        break;
                    }
                }
            }

            if (!hadDeload && weeklyVolumes.length >= 6) {
                factors.push({
                    type: "overtraining",
                    severity: "moderate",
                    description: "Brak deloadu przez ostatnie 6+ tygodni",
                    recommendation:
                        "Zaplanuj tydzień deloadowy (zmniejsz objętość o 40-50%) aby zapobiec przeciążeniu.",
                });
            }
        }

        return factors;
    }

    function detectNeglectedStabilizers(
        exerciseLogs: ExerciseLog[],
        setLogs: SetLog[]
    ): InjuryRiskFactor[] {
        const factors: InjuryRiskFactor[] = [];

        // Calculate volume per body part
        const bodyPartVolumes = new Map<TargetBodyPart, number>();
        const totalVolume =
            setLogs?.reduce(
                (sum, set) => sum + set.reps * (set.weight || 0),
                0
            ) || 0;

        exerciseLogs?.forEach((log) => {
            const bodyPart = log.exercise?.target_body_part;
            if (!bodyPart) return;

            const logSets = setLogs?.filter(
                (set) => set.exercise_log_id === log.id
            );
            const volume =
                logSets?.reduce(
                    (sum, set) => sum + set.reps * (set.weight || 0),
                    0
                ) || 0;

            bodyPartVolumes.set(
                bodyPart,
                (bodyPartVolumes.get(bodyPart) || 0) + volume
            );
        });

        // Check each stabilizer muscle
        STABILIZER_MUSCLES.forEach((stabilizer) => {
            const volume = bodyPartVolumes.get(stabilizer) || 0;
            const percentage =
                totalVolume > 0 ? (volume / totalVolume) * 100 : 0;

            if (volume === 0) {
                factors.push({
                    type: "neglected_stabilizer",
                    severity: "moderate",
                    bodyPart: stabilizer,
                    description: `Całkowicie zaniedbany stabilizator: ${stabilizer}`,
                    recommendation: `Dodaj ćwiczenia dla ${stabilizer} aby poprawić stabilność i zapobiec kontuzjom.`,
                    value: 0,
                });
            } else if (percentage < 2) {
                factors.push({
                    type: "neglected_stabilizer",
                    severity: "low",
                    bodyPart: stabilizer,
                    description: `Niski udział stabilizatora ${stabilizer} w treningu (${percentage.toFixed(
                        1
                    )}%)`,
                    recommendation: `Rozważ dodanie większej ilości pracy dla ${stabilizer}.`,
                    value: percentage,
                });
            }
        });

        return factors;
    }

    function calculateRiskScore(factors: InjuryRiskFactor[]): number {
        let score = 0;

        factors.forEach((factor) => {
            switch (factor.severity) {
                case "high":
                    score += 25;
                    break;
                case "moderate":
                    score += 15;
                    break;
                case "low":
                    score += 5;
                    break;
            }
        });

        return Math.min(score, 100); // Cap at 100
    }

    return { summary, loading, refetch: calculateInjuryRisk };
}
