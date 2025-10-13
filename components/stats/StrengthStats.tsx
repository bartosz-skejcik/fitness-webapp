import {
    Dumbbell,
    Trophy,
    TrendingUp,
    BarChart3,
    Loader2,
    Award,
} from "lucide-react";
import { useStrengthStats } from "@/hooks/useStrengthStats";

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

    const muscleGroupLabels: Record<string, string> = {
        upper: "Góra",
        lower: "Dół",
        legs: "Nogi",
        cardio: "Cardio",
        other: "Inne",
    };

    const muscleGroupColors: Record<string, string> = {
        upper: "bg-blue-500",
        lower: "bg-orange-500",
        legs: "bg-purple-500",
        cardio: "bg-green-500",
        other: "bg-neutral-500",
    };

    return (
        <div className="space-y-6">
            {/* Volume Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
                </div>
            </div>

            {/* Personal Records - Top 5 1RM */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
            </div>

            {/* Most Performed Exercises */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
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
                                        {exercise.muscleGroup && (
                                            <p className="text-xs text-neutral-500">
                                                {muscleGroupLabels[
                                                    exercise.muscleGroup
                                                ] || exercise.muscleGroup}
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
            </div>

            {/* Muscle Group Balance */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Dumbbell className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Balans grup mięśniowych
                    </h3>
                </div>
                {stats.muscleGroupBalance.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div className="space-y-4">
                        {stats.muscleGroupBalance.map((group) => (
                            <div key={group.muscleGroup}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-neutral-100">
                                        {muscleGroupLabels[group.muscleGroup] ||
                                            group.muscleGroup}
                                    </span>
                                    <span className="text-xs text-neutral-400">
                                        {group.percentage.toFixed(1)}% (
                                        {group.volume > 1000
                                            ? `${(group.volume / 1000).toFixed(
                                                  1
                                              )}k`
                                            : group.volume}{" "}
                                        kg)
                                    </span>
                                </div>
                                <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${
                                            muscleGroupColors[
                                                group.muscleGroup
                                            ] || "bg-neutral-500"
                                        } transition-all duration-500`}
                                        style={{
                                            width: `${group.percentage}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
