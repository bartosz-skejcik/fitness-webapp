import {
    Dumbbell,
    Trophy,
    TrendingUp,
    BarChart3,
    Loader2,
    Award,
    Calendar,
    AlertTriangle,
} from "lucide-react";
import { useStrengthStats } from "@/hooks/useStrengthStats";
import { Card } from "../ui/card";

interface StrengthStatsProps {
    userId: string | undefined;
}

export default function StrengthStats({ userId }: StrengthStatsProps) {
    const { stats, loading, error } = useStrengthStats(userId);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
                <p className="text-red-400 text-sm">
                    Error loading stats: {error.message}
                </p>
            </div>
        );
    }

    const targetBodyPartLabels: Record<string, string> = {
        quads: "Czworogłowe ud",
        hamstrings: "Dwugłowe ud",
        glutes: "Pośladki",
        chest: "Klatka",
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

    const bodyPartColors: string[] = [
        "bg-blue-500",
        "bg-orange-500",
        "bg-purple-500",
        "bg-green-500",
        "bg-pink-500",
        "bg-yellow-500",
        "bg-cyan-500",
        "bg-red-500",
        "bg-indigo-500",
        "bg-teal-500",
        "bg-lime-500",
        "bg-amber-500",
        "bg-fuchsia-500",
        "bg-rose-500",
    ];

    return (
        <div className="space-y-6">
            {/* Volume Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card metal className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Łączna objętość
                            </p>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-neutral-100">
                        {stats.volumeData.totalVolume > 1000
                            ? `${(stats.volumeData.totalVolume / 1000).toFixed(
                                  1
                              )}k`
                            : stats.volumeData.totalVolume}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">kg × reps</p>
                </Card>

                <Card metal className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Ten tydzień
                            </p>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-neutral-100">
                        {stats.volumeData.weeklyVolume > 1000
                            ? `${(stats.volumeData.weeklyVolume / 1000).toFixed(
                                  1
                              )}k`
                            : stats.volumeData.weeklyVolume}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">kg × reps</p>
                </Card>

                <Card metal className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Średnie powtórzenia
                            </p>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-neutral-100">
                        {stats.volumeData.avgReps}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">reps/set</p>
                </Card>

                <Card metal className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Średnie serie
                            </p>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-neutral-100">
                        {stats.volumeData.avgSets}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                        sets/exercise
                    </p>
                </Card>
            </div>

            {/* Personal Records - Top 5 1RM */}
            <Card metal className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Najlepsze 1RM (Szacowane)
                    </h3>
                </div>
                {stats.personalRecords.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div className="space-y-3">
                        {stats.personalRecords.slice(0, 5).map((record) => (
                            <div
                                key={record.exerciseId}
                                className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
                            >
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-neutral-100">
                                        {record.exerciseName}
                                    </h4>
                                    <p className="text-xs text-neutral-500">
                                        PR: {record.maxWeight}kg ×{" "}
                                        {record.maxReps} reps
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-orange-400">
                                        {record.estimatedOneRM}
                                        <span className="text-xs text-neutral-400 ml-1">
                                            kg
                                        </span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Most Performed Exercises */}
            <Card metal className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Najczęściej wykonywane
                    </h3>
                </div>
                {stats.mostPerformedExercises.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stats.mostPerformedExercises.map((exercise, index) => (
                            <div
                                key={exercise.exerciseId}
                                className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-neutral-400 font-mono">
                                        #{index + 1}
                                    </span>
                                    <div>
                                        <h4 className="text-sm font-medium text-neutral-100">
                                            {exercise.exerciseName}
                                        </h4>
                                        {exercise.targetBodyPart && (
                                            <p className="text-xs text-neutral-500">
                                                {targetBodyPartLabels[
                                                    exercise.targetBodyPart
                                                ] || exercise.targetBodyPart}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-blue-400">
                                        {exercise.count}
                                        <span className="text-xs text-neutral-400 ml-1">
                                            x
                                        </span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Body Part Volume Distribution */}
            <Card metal className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Dumbbell className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Rozkład objętości po partiach
                    </h3>
                </div>
                {stats.bodyPartVolumes.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div className="space-y-4">
                        {stats.bodyPartVolumes.map((bodyPart, index) => (
                            <div key={bodyPart.bodyPart}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-neutral-100 font-medium">
                                            {targetBodyPartLabels[
                                                bodyPart.bodyPart
                                            ] || bodyPart.bodyPart}
                                        </span>
                                        <span className="text-xs text-neutral-500">
                                            ({bodyPart.exerciseCount}{" "}
                                            {bodyPart.exerciseCount === 1
                                                ? "ćwiczenie"
                                                : "ćwiczenia"}
                                            )
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-neutral-400">
                                            {bodyPart.percentage.toFixed(1)}%
                                        </span>
                                        <span className="text-xs text-neutral-500 ml-2">
                                            (
                                            {bodyPart.volume > 1000
                                                ? `${(
                                                      bodyPart.volume / 1000
                                                  ).toFixed(1)}k`
                                                : bodyPart.volume}{" "}
                                            kg)
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${
                                            bodyPartColors[
                                                index % bodyPartColors.length
                                            ]
                                        } transition-all duration-500`}
                                        style={{
                                            width: `${bodyPart.percentage}%`,
                                        }}
                                    />
                                </div>
                                {bodyPart.lastTrained && (
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Ostatnio trenowane:{" "}
                                        {new Date(
                                            bodyPart.lastTrained
                                        ).toLocaleDateString("pl-PL")}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Body Part PRs - Best Exercise Per Body Part */}
            {stats.bodyPartPRs.length > 0 && (
                <Card metal className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Najlepsze ćwiczenie na każdą partię
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stats.bodyPartPRs.map((pr) => (
                            <div
                                key={pr.bodyPart}
                                className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700/50"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                        {targetBodyPartLabels[pr.bodyPart] ||
                                            pr.bodyPart}
                                    </span>
                                    <span className="text-xs text-neutral-500">
                                        {new Date(
                                            pr.lastPerformed
                                        ).toLocaleDateString("pl-PL")}
                                    </span>
                                </div>
                                <h4 className="text-sm font-semibold text-neutral-100 mb-1">
                                    {pr.exerciseName}
                                </h4>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-neutral-400">
                                        {pr.maxWeight}kg × {pr.maxReps} reps
                                    </p>
                                    <p className="text-lg font-bold text-yellow-400">
                                        {pr.estimatedOneRM}
                                        <span className="text-xs text-neutral-400 ml-1">
                                            kg 1RM
                                        </span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Body Part Training Frequency */}
            {stats.bodyPartFrequency.length > 0 && (
                <Card metal className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Częstotliwość treningu partii
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {stats.bodyPartFrequency
                            .sort((a, b) => {
                                // Sort by days since last trained (most recent first)
                                if (a.daysSinceLastTrained === null) return 1;
                                if (b.daysSinceLastTrained === null) return -1;
                                return (
                                    a.daysSinceLastTrained -
                                    b.daysSinceLastTrained
                                );
                            })
                            .map((freq) => {
                                const isUndertrained =
                                    freq.daysSinceLastTrained !== null &&
                                    freq.daysSinceLastTrained > 14;
                                const isCritical =
                                    freq.daysSinceLastTrained !== null &&
                                    freq.daysSinceLastTrained > 30;

                                return (
                                    <div
                                        key={freq.bodyPart}
                                        className={`p-4 rounded-lg border ${
                                            isCritical
                                                ? "bg-red-500/10 border-red-500/30"
                                                : isUndertrained
                                                ? "bg-yellow-500/10 border-yellow-500/30"
                                                : "bg-neutral-800/50 border-neutral-700/50"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-neutral-100 uppercase tracking-wider">
                                                {targetBodyPartLabels[
                                                    freq.bodyPart
                                                ] || freq.bodyPart}
                                            </span>
                                            {(isUndertrained || isCritical) && (
                                                <AlertTriangle
                                                    className={`w-4 h-4 ${
                                                        isCritical
                                                            ? "text-red-400"
                                                            : "text-yellow-400"
                                                    }`}
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-neutral-400">
                                                    Ten tydzień:
                                                </span>
                                                <span className="font-semibold text-neutral-100">
                                                    {freq.timesThisWeek}x
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-neutral-400">
                                                    Ten miesiąc:
                                                </span>
                                                <span className="font-semibold text-neutral-100">
                                                    {freq.timesThisMonth}x
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-neutral-400">
                                                    Ostatni trening:
                                                </span>
                                                <span
                                                    className={`font-semibold ${
                                                        isCritical
                                                            ? "text-red-400"
                                                            : isUndertrained
                                                            ? "text-yellow-400"
                                                            : "text-green-400"
                                                    }`}
                                                >
                                                    {freq.daysSinceLastTrained !==
                                                    null
                                                        ? `${freq.daysSinceLastTrained} dni temu`
                                                        : "Nigdy"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            )}
        </div>
    );
}
