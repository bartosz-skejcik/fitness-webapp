import {
    TrendingUp,
    Calendar,
    Clock,
    Activity,
    Loader2,
    BarChart3,
} from "lucide-react";
import { useTrendsStats } from "@/hooks/useTrendsStats";

interface TrendsStatsProps {
    userId: string | undefined;
}

export default function TrendsStats({ userId }: TrendsStatsProps) {
    const { stats, loading, error } = useTrendsStats(userId);

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

    return (
        <div className="space-y-6">
            {/* Best Performance Time/Day */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Najlepszy dzień
                            </p>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">
                        {stats.bestDay || "N/A"}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                        Najbardziej produktywny dzień tygodnia
                    </p>
                </div>

                <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Najlepsza godzina
                            </p>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-orange-400">
                        {stats.bestTime || "N/A"}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                        Najbardziej produktywna pora dnia
                    </p>
                </div>
            </div>

            {/* Weekly Progress */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Postęp tygodniowy
                    </h3>
                </div>
                {stats.weeklyProgress.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div className="space-y-3">
                        {stats.weeklyProgress.slice(-8).map((week, index) => (
                            <div
                                key={week.weekStart}
                                className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
                            >
                                <div className="flex-1">
                                    <p className="text-sm text-neutral-100">
                                        Tydzień{" "}
                                        {new Date(
                                            week.weekStart
                                        ).toLocaleDateString("pl-PL", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        {week.workouts} treningów
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-neutral-100">
                                        {week.volume > 1000
                                            ? `${(week.volume / 1000).toFixed(
                                                  1
                                              )}k`
                                            : week.volume}
                                    </p>
                                    {index > 0 && week.improvement !== 0 && (
                                        <p
                                            className={`text-xs font-medium ${
                                                week.improvement > 0
                                                    ? "text-green-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {week.improvement > 0 ? "+" : ""}
                                            {week.improvement}%
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Exercise Progress Charts */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Postęp ćwiczeń
                    </h3>
                </div>
                {stats.topExerciseProgress.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div className="space-y-6">
                        {stats.topExerciseProgress.map((exercise) => {
                            const minWeight = Math.min(
                                ...exercise.dataPoints.map((d) => d.maxWeight)
                            );
                            const maxWeight = Math.max(
                                ...exercise.dataPoints.map((d) => d.maxWeight)
                            );
                            const range = maxWeight - minWeight || 1;

                            return (
                                <div key={exercise.exerciseId}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-neutral-100">
                                            {exercise.exerciseName}
                                        </h4>
                                        <span className="text-xs text-neutral-400">
                                            {minWeight}kg → {maxWeight}kg
                                        </span>
                                    </div>
                                    <div className="flex items-end gap-1 h-24">
                                        {exercise.dataPoints.map(
                                            (point, index) => {
                                                const height =
                                                    ((point.maxWeight -
                                                        minWeight) /
                                                        range) *
                                                    100;
                                                return (
                                                    <div
                                                        key={index}
                                                        className="flex-1 flex flex-col items-center"
                                                    >
                                                        <div
                                                            className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-400"
                                                            style={{
                                                                height: `${Math.max(
                                                                    height,
                                                                    5
                                                                )}%`,
                                                            }}
                                                            title={`${
                                                                point.maxWeight
                                                            }kg - ${new Date(
                                                                point.date
                                                            ).toLocaleDateString(
                                                                "pl-PL"
                                                            )}`}
                                                        />
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Workout Frequency Heatmap */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Mapa częstotliwości (ostatnie 90 dni)
                    </h3>
                </div>
                {stats.workoutHeatmap.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div>
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"].map(
                                (day) => (
                                    <div
                                        key={day}
                                        className="text-xs text-neutral-500 text-center"
                                    >
                                        {day}
                                    </div>
                                )
                            )}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: 90 }, (_, i) => {
                                const date = new Date();
                                date.setDate(date.getDate() - (89 - i));
                                const dateStr = date
                                    .toISOString()
                                    .split("T")[0];
                                const workout = stats.workoutHeatmap.find(
                                    (w) => w.date === dateStr
                                );
                                const count = workout?.count || 0;

                                let bgColor = "bg-neutral-800";
                                if (count === 1) bgColor = "bg-orange-500/30";
                                if (count === 2) bgColor = "bg-orange-500/60";
                                if (count >= 3) bgColor = "bg-orange-500";

                                return (
                                    <div
                                        key={dateStr}
                                        className={`aspect-square ${bgColor} rounded-sm hover:ring-1 hover:ring-orange-400 transition-all cursor-pointer`}
                                        title={`${date.toLocaleDateString(
                                            "pl-PL"
                                        )}: ${count} treningi`}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-3">
                            <span className="text-xs text-neutral-500">
                                Mniej
                            </span>
                            <div className="w-3 h-3 bg-neutral-800 rounded-sm" />
                            <div className="w-3 h-3 bg-orange-500/30 rounded-sm" />
                            <div className="w-3 h-3 bg-orange-500/60 rounded-sm" />
                            <div className="w-3 h-3 bg-orange-500 rounded-sm" />
                            <span className="text-xs text-neutral-500">
                                Więcej
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
