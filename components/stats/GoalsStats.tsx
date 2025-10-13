import {
    Trophy,
    Award,
    TrendingUp,
    Loader2,
    Lock,
    CheckCircle2,
} from "lucide-react";
import { useGoalsStats } from "@/hooks/useGoalsStats";

interface GoalsStatsProps {
    userId: string | undefined;
}

export default function GoalsStats({ userId }: GoalsStatsProps) {
    const { stats, loading, error } = useGoalsStats(userId);

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

    const unlockedBadges = stats.badges.filter((b) => b.unlocked);
    const lockedBadges = stats.badges.filter((b) => !b.unlocked);

    return (
        <div className="space-y-6">
            {/* Unlocked Badges */}
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Odznaki odblokowane ({unlockedBadges.length}/
                        {stats.badges.length})
                    </h3>
                </div>
                {unlockedBadges.length === 0 ? (
                    <p className="text-neutral-500 text-xs">
                        Kontynuuj treningi, aby odblokować odznaki!
                    </p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {unlockedBadges.map((badge) => (
                            <div
                                key={badge.id}
                                className="bg-neutral-900 border border-orange-500/30 rounded-lg p-4 text-center"
                            >
                                <div className="text-4xl mb-2">
                                    {badge.icon}
                                </div>
                                <h4 className="text-sm font-semibold text-neutral-100 mb-1">
                                    {badge.title}
                                </h4>
                                <p className="text-xs text-neutral-500">
                                    {badge.description}
                                </p>
                                <div className="flex items-center justify-center gap-1 mt-2">
                                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    <span className="text-xs text-green-400">
                                        Odblokowane
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Locked Badges */}
            {lockedBadges.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Lock className="w-5 h-5 text-neutral-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Do zdobycia
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {lockedBadges.map((badge) => (
                            <div
                                key={badge.id}
                                className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 text-center opacity-60"
                            >
                                <div className="text-4xl mb-2 grayscale">
                                    {badge.icon}
                                </div>
                                <h4 className="text-sm font-semibold text-neutral-100 mb-1">
                                    {badge.title}
                                </h4>
                                <p className="text-xs text-neutral-500 mb-2">
                                    {badge.description}
                                </p>
                                {badge.progress !== undefined &&
                                    badge.target !== undefined && (
                                        <div className="mt-2">
                                            <div className="w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden mb-1">
                                                <div
                                                    className="h-full bg-orange-500 transition-all duration-300"
                                                    style={{
                                                        width: `${
                                                            (badge.progress /
                                                                badge.target) *
                                                            100
                                                        }%`,
                                                    }}
                                                />
                                            </div>
                                            <p className="text-xs text-neutral-500">
                                                {badge.progress}/{badge.target}
                                            </p>
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Personal Records */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Ostatnie rekordy (30 dni)
                    </h3>
                </div>
                {stats.recentPRs.length === 0 ? (
                    <p className="text-neutral-500 text-xs">
                        Brak nowych rekordów w ostatnim miesiącu
                    </p>
                ) : (
                    <div className="space-y-3">
                        {stats.recentPRs.map((pr, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
                            >
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-neutral-100">
                                        {pr.exerciseName}
                                    </h4>
                                    <p className="text-xs text-neutral-500">
                                        {new Date(pr.date).toLocaleDateString(
                                            "pl-PL",
                                            {
                                                day: "numeric",
                                                month: "long",
                                            }
                                        )}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-blue-400">
                                        {pr.weight}kg
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        × {pr.reps} reps
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Top 3 Improvements This Month */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Top 3 poprawy w tym miesiącu
                    </h3>
                </div>
                {stats.topImprovements.length === 0 ? (
                    <p className="text-neutral-500 text-xs">
                        Kontynuuj treningi, aby zobaczyć postępy!
                    </p>
                ) : (
                    <div className="space-y-3">
                        {stats.topImprovements.map((improvement, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-4 bg-neutral-900 rounded-lg"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="text-2xl font-bold text-green-400">
                                        #{index + 1}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-neutral-100">
                                            {improvement.exerciseName}
                                        </h4>
                                        <p className="text-xs text-neutral-500">
                                            {improvement.from}kg →{" "}
                                            {improvement.to}kg
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-green-400">
                                        +{improvement.improvement.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
