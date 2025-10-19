"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutSession, ExerciseLog, SetLog } from "@/types/database";

interface WeekMetrics {
    weekStart: string;
    totalVolume: number;
    averageIntensity: number; // Average % of 1RM estimated
    totalSets: number;
    workoutCount: number;
}

type PhaseType = "accumulation" | "intensification" | "deload" | "transition";

interface TrainingPhase {
    type: PhaseType;
    weekStart: string;
    weekEnd: string;
    volume: number;
    intensity: number;
    characteristics: string[];
    recommendation: string;
}

interface PeriodizationSummary {
    currentPhase: TrainingPhase | null;
    phaseHistory: TrainingPhase[];
    weeksSincePhaseChange: number;
    recommendedNextPhase: PhaseType;
    recommendation: string;
}

export function usePeriodization(weekCount: number = 12) {
    const [summary, setSummary] = useState<PeriodizationSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        analyzePeriodization();
    }, [weekCount]);

    const analyzePeriodization = async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - weekCount * 7);

            // Fetch workout sessions
            const { data: sessions, error: sessionsError } = await supabase
                .from("workout_sessions")
                .select("*")
                .eq("user_id", user.id)
                .gte("started_at", startDate.toISOString())
                .order("started_at", { ascending: true });

            if (sessionsError) throw sessionsError;

            if (!sessions || sessions.length === 0) {
                setSummary({
                    currentPhase: null,
                    phaseHistory: [],
                    weeksSincePhaseChange: 0,
                    recommendedNextPhase: "accumulation",
                    recommendation:
                        "Zacznij od fazy akumulacyjnej - wysoka objętość, umiarkowana intensywność.",
                });
                setLoading(false);
                return;
            }

            // Fetch exercise logs for these sessions
            const sessionIds = sessions.map((s) => s.id);
            const { data: exerciseLogs, error: logsError } = await supabase
                .from("exercise_logs")
                .select("*")
                .in("workout_session_id", sessionIds);

            if (logsError) throw logsError;

            // Fetch set logs
            const exerciseLogIds = exerciseLogs?.map((e) => e.id) || [];
            const { data: setLogs, error: setLogsError } = await supabase
                .from("set_logs")
                .select("*")
                .in("exercise_log_id", exerciseLogIds);

            if (setLogsError) throw setLogsError;

            // Calculate weekly metrics
            const weekMetrics = calculateWeeklyMetrics(
                sessions as WorkoutSession[],
                exerciseLogs as ExerciseLog[],
                setLogs as SetLog[]
            );

            // Identify training phases
            const phases = identifyPhases(weekMetrics);

            // Determine current phase and recommendation
            const currentPhase = phases[phases.length - 1] || null;
            const weeksSincePhaseChange = currentPhase
                ? Math.floor(
                      (new Date().getTime() -
                          new Date(currentPhase.weekStart).getTime()) /
                          (7 * 24 * 60 * 60 * 1000)
                  )
                : 0;

            const { recommendedNextPhase, recommendation } =
                getPhaseRecommendation(
                    currentPhase,
                    weeksSincePhaseChange,
                    phases
                );

            setSummary({
                currentPhase,
                phaseHistory: phases,
                weeksSincePhaseChange,
                recommendedNextPhase,
                recommendation,
            });
        } catch (error) {
            console.error("Error analyzing periodization:", error);
        } finally {
            setLoading(false);
        }
    };

    return { summary, loading };
}

function calculateWeeklyMetrics(
    sessions: WorkoutSession[],
    exerciseLogs: ExerciseLog[],
    setLogs: SetLog[]
): WeekMetrics[] {
    const weekMap = new Map<string, WeekMetrics>();

    sessions.forEach((session) => {
        const sessionDate = new Date(session.started_at);
        const weekStart = getWeekStart(sessionDate);
        const weekKey = weekStart.toISOString().split("T")[0];

        if (!weekMap.has(weekKey)) {
            weekMap.set(weekKey, {
                weekStart: weekKey,
                totalVolume: 0,
                averageIntensity: 0,
                totalSets: 0,
                workoutCount: 0,
            });
        }

        const weekMetric = weekMap.get(weekKey)!;
        weekMetric.workoutCount++;

        // Get sets for this session
        const sessionExercises = exerciseLogs.filter(
            (e) => e.workout_session_id === session.id
        );

        sessionExercises.forEach((exercise) => {
            const exerciseSets = setLogs.filter(
                (s) => s.exercise_log_id === exercise.id
            );

            exerciseSets.forEach((set) => {
                if (set.weight && set.reps) {
                    weekMetric.totalVolume += set.weight * set.reps;
                    weekMetric.totalSets++;

                    // Estimate intensity using Epley formula: 1RM ≈ weight × (1 + reps/30)
                    // Then intensity = weight / estimated1RM
                    const estimated1RM = set.weight * (1 + set.reps / 30);
                    const intensity = (set.weight / estimated1RM) * 100;
                    weekMetric.averageIntensity += intensity;
                }
            });
        });
    });

    // Calculate average intensity for each week
    weekMap.forEach((metric) => {
        if (metric.totalSets > 0) {
            metric.averageIntensity =
                metric.averageIntensity / metric.totalSets;
        }
    });

    return Array.from(weekMap.values()).sort(
        (a, b) =>
            new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
    );
}

function identifyPhases(weekMetrics: WeekMetrics[]): TrainingPhase[] {
    if (weekMetrics.length === 0) return [];

    const phases: TrainingPhase[] = [];
    let currentPhaseStart = 0;

    // Calculate average metrics across all weeks for baseline
    const avgVolume =
        weekMetrics.reduce((sum, w) => sum + w.totalVolume, 0) /
        weekMetrics.length;
    const avgIntensity =
        weekMetrics.reduce((sum, w) => sum + w.averageIntensity, 0) /
        weekMetrics.length;

    for (let i = 0; i < weekMetrics.length; i++) {
        const week = weekMetrics[i];
        const phaseType = classifyWeek(week, avgVolume, avgIntensity);

        // Check if phase changed
        if (i === 0) {
            currentPhaseStart = i;
        } else {
            const prevPhaseType = classifyWeek(
                weekMetrics[i - 1],
                avgVolume,
                avgIntensity
            );

            if (phaseType !== prevPhaseType || i === weekMetrics.length - 1) {
                // Phase ended, create phase object
                const endIdx = i === weekMetrics.length - 1 ? i : i - 1;
                const phaseWeeks = weekMetrics.slice(
                    currentPhaseStart,
                    endIdx + 1
                );

                const phase = createPhase(
                    prevPhaseType,
                    weekMetrics[currentPhaseStart].weekStart,
                    weekMetrics[endIdx].weekStart,
                    phaseWeeks
                );

                phases.push(phase);
                currentPhaseStart = i;
            }
        }
    }

    // Add final phase if not already added
    if (currentPhaseStart < weekMetrics.length) {
        const phaseWeeks = weekMetrics.slice(currentPhaseStart);
        const phaseType = classifyWeek(
            weekMetrics[currentPhaseStart],
            avgVolume,
            avgIntensity
        );

        const phase = createPhase(
            phaseType,
            weekMetrics[currentPhaseStart].weekStart,
            weekMetrics[weekMetrics.length - 1].weekStart,
            phaseWeeks
        );

        phases.push(phase);
    }

    return phases;
}

function classifyWeek(
    week: WeekMetrics,
    avgVolume: number,
    avgIntensity: number
): PhaseType {
    const volumeRatio = week.totalVolume / avgVolume;
    const intensityRatio = week.averageIntensity / avgIntensity;

    // Deload: low volume (< 60% average)
    if (volumeRatio < 0.6) {
        return "deload";
    }

    // Intensification: high intensity (> 110% average), lower volume
    if (intensityRatio > 1.1 && volumeRatio < 1.1) {
        return "intensification";
    }

    // Accumulation: high volume (> 110% average), moderate intensity
    if (volumeRatio > 1.1 && intensityRatio < 1.1) {
        return "accumulation";
    }

    // Transition: balanced metrics
    return "transition";
}

function createPhase(
    type: PhaseType,
    weekStart: string,
    weekEnd: string,
    weeks: WeekMetrics[]
): TrainingPhase {
    const totalVolume = weeks.reduce((sum, w) => sum + w.totalVolume, 0);
    const avgIntensity =
        weeks.reduce((sum, w) => sum + w.averageIntensity, 0) / weeks.length;

    const characteristics: string[] = [];
    let recommendation = "";

    switch (type) {
        case "accumulation":
            characteristics.push("Wysoka objętość treningowa");
            characteristics.push("Umiarkowana intensywność");
            characteristics.push("Budowanie bazy wytrzymałościowej");
            characteristics.push("Więcej powtórzeń, mniejsze ciężary");
            recommendation =
                "Kontynuuj fazę akumulacyjną przez 3-4 tygodnie. Po tym okresie przejdź do fazy intensyfikacji.";
            break;

        case "intensification":
            characteristics.push("Wysoka intensywność (cięższe ciężary)");
            characteristics.push("Niższa objętość treningowa");
            characteristics.push("Mniej powtórzeń, większe obciążenia");
            characteristics.push("Focus na budowaniu siły maksymalnej");
            recommendation =
                "Faza intensyfikacji powinna trwać 2-3 tygodnie. Następnie zrób tydzień deloadowy.";
            break;

        case "deload":
            characteristics.push("Znacznie obniżona objętość");
            characteristics.push("Okres regeneracji");
            characteristics.push("Pozwala na supercompensację");
            characteristics.push("Przygotowanie do kolejnego cyklu");
            recommendation =
                "Tydzień deloadowy jest kluczowy dla regeneracji. Po nim wróć do fazy akumulacyjnej.";
            break;

        case "transition":
            characteristics.push("Zrównoważona objętość i intensywność");
            characteristics.push("Okres przejściowy między fazami");
            characteristics.push("Dobre dla utrzymania formy");
            recommendation =
                "Zdecyduj czy chcesz zwiększyć objętość (akumulacja) czy intensywność (intensyfikacja).";
            break;
    }

    return {
        type,
        weekStart,
        weekEnd,
        volume: totalVolume,
        intensity: avgIntensity,
        characteristics,
        recommendation,
    };
}

function getPhaseRecommendation(
    currentPhase: TrainingPhase | null,
    weeksSincePhaseChange: number,
    phaseHistory: TrainingPhase[]
): { recommendedNextPhase: PhaseType; recommendation: string } {
    if (!currentPhase) {
        return {
            recommendedNextPhase: "accumulation",
            recommendation:
                "Zacznij od fazy akumulacyjnej - wysoka objętość, umiarkowana intensywność przez 3-4 tygodnie.",
        };
    }

    // Count weeks since last deload
    let weeksSinceDeload = 0;
    for (let i = phaseHistory.length - 1; i >= 0; i--) {
        if (phaseHistory[i].type === "deload") break;
        weeksSinceDeload++;
    }

    // Recommend deload if it's been > 6 weeks
    if (weeksSinceDeload > 6) {
        return {
            recommendedNextPhase: "deload",
            recommendation: `⚠️ Minęło ${weeksSinceDeload} tygodni od ostatniego deloadu! Zalecamy tydzień regeneracyjny (40-50% objętości) aby uniknąć przetrenowania i przygotować się do kolejnego cyklu.`,
        };
    }

    switch (currentPhase.type) {
        case "accumulation":
            if (weeksSincePhaseChange >= 4) {
                return {
                    recommendedNextPhase: "intensification",
                    recommendation: `✅ Zakończyłeś ${weeksSincePhaseChange} tygodni fazy akumulacyjnej. Czas przejść do intensyfikacji - zmniejsz objętość o 30%, zwiększ intensywność (większe ciężary, mniej powtórzeń).`,
                };
            }
            return {
                recommendedNextPhase: "accumulation",
                recommendation: `📊 Jesteś w ${weeksSincePhaseChange} tygodniu fazy akumulacyjnej. Kontynuuj jeszcze ${
                    4 - weeksSincePhaseChange
                } tygodnie przed przejściem do intensyfikacji.`,
            };

        case "intensification":
            if (weeksSincePhaseChange >= 3) {
                return {
                    recommendedNextPhase: "deload",
                    recommendation: `✅ Zakończyłeś ${weeksSincePhaseChange} tygodni fazy intensyfikacji. Czas na tydzień deloadowy! Zmniejsz objętość o 50% i intensywność o 20%. Pozwól ciału się zregenerować.`,
                };
            }
            return {
                recommendedNextPhase: "intensification",
                recommendation: `💪 Jesteś w ${weeksSincePhaseChange} tygodniu fazy intensyfikacji. Kontynuuj jeszcze ${
                    3 - weeksSincePhaseChange
                } tygodnie przed deloadem.`,
            };

        case "deload":
            return {
                recommendedNextPhase: "accumulation",
                recommendation: `🔄 Po deloadzie rozpocznij nowy cykl od fazy akumulacyjnej. Zbuduj bazę objętościową przez 3-4 tygodnie.`,
            };

        case "transition":
            // Look at previous phase to decide
            if (phaseHistory.length >= 2) {
                const prevPhase = phaseHistory[phaseHistory.length - 2];
                if (prevPhase.type === "accumulation") {
                    return {
                        recommendedNextPhase: "intensification",
                        recommendation: `Przejdź z fazy przejściowej do intensyfikacji - zwiększ ciężary, zmniejsz objętość.`,
                    };
                } else if (prevPhase.type === "intensification") {
                    return {
                        recommendedNextPhase: "deload",
                        recommendation: `Po intensyfikacji zalecamy tydzień deloadowy przed kolejnym cyklem.`,
                    };
                }
            }
            return {
                recommendedNextPhase: "accumulation",
                recommendation: `Zacznij nowy cykl od fazy akumulacyjnej - wysoką objętością i umiarkowaną intensywnością.`,
            };
    }
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday as week start
    return new Date(d.setDate(diff));
}
