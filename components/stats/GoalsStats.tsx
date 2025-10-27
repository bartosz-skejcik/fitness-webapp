import {
    Trophy,
    Award,
    TrendingUp,
    Loader2,
    CheckCircle2,
    Target,
} from "lucide-react";
import { useGoalsStats, Badge } from "@/hooks/useGoalsStats";
import BodyPartGoalsManager from "./BodyPartGoalsManager";
import { Card } from "../ui/card";

interface GoalsStatsProps {
    userId: string | undefined;
}

interface BadgeCardProps {
    badge: Badge;
}

function BadgeCard({ badge }: BadgeCardProps) {
    return (
        <div
            className={`rounded-lg p-4 text-center transition-all ${
                badge.unlocked
                    ? "bg-neutral-900 border border-orange-500/30"
                    : "bg-neutral-800/50 border border-neutral-700 opacity-60"
            }`}
        >
            <div
                className={`text-4xl mb-2 ${badge.unlocked ? "" : "grayscale"}`}
            >
                {badge.icon}
            </div>
            <h4 className="text-sm font-semibold text-neutral-100 mb-1">
                {badge.title}
            </h4>
            <p className="text-xs text-neutral-500 mb-2">{badge.description}</p>

            {badge.unlocked ? (
                <div className="flex items-center justify-center gap-1 mt-2">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400">Odblokowane</span>
                </div>
            ) : (
                badge.progress !== undefined &&
                badge.target !== undefined && (
                    <div className="mt-2">
                        <div className="w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden mb-1">
                            <div
                                className="h-full bg-orange-500 transition-all duration-300"
                                style={{
                                    width: `${Math.min(
                                        (badge.progress / badge.target) * 100,
                                        100
                                    )}%`,
                                }}
                            />
                        </div>
                        <p className="text-xs text-neutral-500">
                            {Math.floor(badge.progress)}/{badge.target}
                        </p>
                    </div>
                )
            )}
        </div>
    );
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

    // Group badges by category
    const generalBadges = stats.badges.filter((b) => b.category === "general");
    const bodypartBadges = stats.badges.filter(
        (b) => b.category === "bodypart"
    );
    const balanceBadges = stats.badges.filter((b) => b.category === "balance");

    return (
        <div className="space-y-6">
            {/* Body Part Goals Manager */}
            <BodyPartGoalsManager />

            {/* Divider */}
            <div className="border-t border-neutral-800 pt-6">
                <div className="flex items-center gap-2 mb-6">
                    <Trophy className="w-5 h-5 text-orange-500" />
                    <h2 className="text-xl font-bold text-neutral-100">
                        Odznaki i osiągnięcia
                    </h2>
                </div>
            </div>

            {/* Overall Progress */}
            <div className="bg-gradient-to-br from-orange-500/10 via-orange-500/5 border border-orange-500/20 rounded-lg p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-orange-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Postęp odznak
                        </h3>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-orange-400">
                            {unlockedBadges.length}/{stats.badges.length}
                        </p>
                        <p className="text-xs text-neutral-500">Odblokowane</p>
                    </div>
                </div>
                <div className="mt-4 w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
                        style={{
                            width: `${
                                (unlockedBadges.length / stats.badges.length) *
                                100
                            }%`,
                        }}
                    />
                </div>
            </div>

            {/* General Badges */}
            <Card metal className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-blue-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Odznaki ogólne (
                        {generalBadges.filter((b) => b.unlocked).length}/
                        {generalBadges.length})
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {generalBadges.map((badge) => (
                        <BadgeCard key={badge.id} badge={badge} />
                    ))}
                </div>
            </Card>

            {/* Body Part Badges */}
            <Card metal className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-purple-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Odznaki partii mięśniowych (
                        {bodypartBadges.filter((b) => b.unlocked).length}/
                        {bodypartBadges.length})
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {bodypartBadges.map((badge) => (
                        <BadgeCard key={badge.id} badge={badge} />
                    ))}
                </div>
            </Card>

            {/* Balance Badges */}
            <Card metal className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                        Odznaki balansu (
                        {balanceBadges.filter((b) => b.unlocked).length}/
                        {balanceBadges.length})
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {balanceBadges.map((badge) => (
                        <BadgeCard key={badge.id} badge={badge} />
                    ))}
                </div>
            </Card>

            {/* Recent Personal Records */}
            <Card metal className="p-6">
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
            </Card>

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
