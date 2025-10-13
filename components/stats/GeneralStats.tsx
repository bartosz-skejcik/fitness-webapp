import {
    Calendar,
    Clock,
    Dumbbell,
    Flame,
    TrendingUp,
    Sun,
} from "lucide-react";
import { useGeneralStats } from "@/hooks/useGeneralStats";
import { Loader2 } from "lucide-react";

interface GeneralStatsProps {
    userId: string | undefined;
}

export default function GeneralStats({ userId }: GeneralStatsProps) {
    const { stats, loading, error } = useGeneralStats(userId);

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

    const dayLabels: Record<string, string> = {
        Monday: "Poniedziałek",
        Tuesday: "Wtorek",
        Wednesday: "Środa",
        Thursday: "Czwartek",
        Friday: "Piątek",
        Saturday: "Sobota",
        Sunday: "Niedziela",
    };

    return (
        <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Workouts */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Treningi ukończone
                            </p>
                        </div>
                    </div>
                    <p className="text-4xl font-bold text-neutral-100">
                        {stats.totalWorkouts}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                        Wszystkie treningi
                    </p>
                </div>

                {/* Total Exercises */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Ćwiczenia wykonane
                            </p>
                        </div>
                    </div>
                    <p className="text-4xl font-bold text-neutral-100">
                        {stats.totalExercises}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                        Łącznie w treningach
                    </p>
                </div>

                {/* Average Duration */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Średni czas treningu
                            </p>
                        </div>
                    </div>
                    <p className="text-4xl font-bold text-neutral-100">
                        {stats.averageWorkoutDuration}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">minut</p>
                </div>
            </div>

            {/* Workout Time */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Łączny czas treningów
                    </h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.totalWorkoutTime.thisWeek}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            minut ten tydzień
                        </p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {stats.totalWorkoutTime.thisMonth}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            minut ten miesiąc
                        </p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-100">
                            {Math.round(stats.totalWorkoutTime.allTime / 60)}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            godzin łącznie
                        </p>
                    </div>
                </div>
            </div>

            {/* Streaks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Flame className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Aktualna seria
                            </p>
                        </div>
                    </div>
                    <p className="text-4xl font-bold text-orange-400">
                        {stats.currentStreak}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                        {stats.currentStreak === 1
                            ? "dzień z rzędu"
                            : "dni z rzędu"}
                    </p>
                </div>

                <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">
                                Najlepsza seria
                            </p>
                        </div>
                    </div>
                    <p className="text-4xl font-bold text-blue-400">
                        {stats.bestStreak}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                        {stats.bestStreak === 1
                            ? "dzień z rzędu!"
                            : "dni z rzędu!"}
                    </p>
                </div>
            </div>

            {/* Most Frequent Days & Times */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Most Frequent Days */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Sun className="w-5 h-5 text-orange-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Najczęstsze dni
                        </h3>
                    </div>
                    {stats.mostFrequentDays.length === 0 ? (
                        <p className="text-neutral-500 text-xs">Brak danych</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.mostFrequentDays.map((item, index) => (
                                <div
                                    key={item.day}
                                    className="flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-neutral-400">
                                            #{index + 1}
                                        </span>
                                        <span className="text-sm text-neutral-100">
                                            {dayLabels[item.day] || item.day}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden w-20">
                                            <div
                                                className="h-full bg-orange-500"
                                                style={{
                                                    width: `${
                                                        (item.count /
                                                            stats.totalWorkouts) *
                                                        100
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-neutral-400 w-8 text-right">
                                            {item.count}x
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Most Frequent Times */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-blue-400" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Najczęstsze godziny
                        </h3>
                    </div>
                    {stats.mostFrequentTimes.length === 0 ? (
                        <p className="text-neutral-500 text-xs">Brak danych</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.mostFrequentTimes.map((item, index) => (
                                <div
                                    key={item.hour}
                                    className="flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-neutral-400">
                                            #{index + 1}
                                        </span>
                                        <span className="text-sm text-neutral-100">
                                            {item.hour}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden w-20">
                                            <div
                                                className="h-full bg-blue-500"
                                                style={{
                                                    width: `${
                                                        (item.count /
                                                            stats.totalWorkouts) *
                                                        100
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-neutral-400 w-8 text-right">
                                            {item.count}x
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
