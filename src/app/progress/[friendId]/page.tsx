"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    ArrowLeft,
    TrendingUp,
    Calendar,
    Dumbbell,
    Loader2,
    Target,
    Clock,
    Trophy,
    Activity,
    Zap,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../../components/header";
import { subDays, subMonths } from "date-fns";

type TimePeriod = "2weeks" | "1month" | "3months";

interface UserStats {
    totalWorkouts: number;
    totalSets: number;
    totalVolume: number;
    avgDuration: number;
    bestVolume: number;
    avgWeight: number;
    totalReps: number;
}

export default function FriendComparisonPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const friendId = params?.friendId as string;
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<TimePeriod>("1month");
    const [friendName, setFriendName] = useState("");
    const [myStats, setMyStats] = useState<UserStats>({
        totalWorkouts: 0,
        totalSets: 0,
        totalVolume: 0,
        avgDuration: 0,
        bestVolume: 0,
        avgWeight: 0,
        totalReps: 0,
    });
    const [friendStats, setFriendStats] = useState<UserStats>({
        totalWorkouts: 0,
        totalSets: 0,
        totalVolume: 0,
        avgDuration: 0,
        bestVolume: 0,
        avgWeight: 0,
        totalReps: 0,
    });

    useEffect(() => {
        if (!user) {
            router.push("/login");
        } else {
            fetchComparisonData();
        }
    }, [user, friendId, period]);

    async function fetchStatsForUser(userId: string): Promise<UserStats> {
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case "2weeks":
                startDate = subDays(now, 14);
                break;
            case "1month":
                startDate = subMonths(now, 1);
                break;
            case "3months":
                startDate = subMonths(now, 3);
                break;
        }

        const { data: sessions } = await supabase
            .from("workout_sessions")
            .select("*")
            .eq("user_id", userId)
            .gte("started_at", startDate.toISOString())
            .order("started_at");

        const sessionIds = (sessions || []).map((s) => s.id);

        if (sessionIds.length === 0) {
            return {
                totalWorkouts: 0,
                totalSets: 0,
                totalVolume: 0,
                avgDuration: 0,
                bestVolume: 0,
                avgWeight: 0,
                totalReps: 0,
            };
        }

        const { data: exerciseLogs } = await supabase
            .from("exercise_logs")
            .select("id, workout_session_id")
            .in("workout_session_id", sessionIds);

        const exerciseLogIds = (exerciseLogs || []).map((l) => l.id);

        if (exerciseLogIds.length === 0) {
            return {
                totalWorkouts: (sessions || []).length,
                totalSets: 0,
                totalVolume: 0,
                avgDuration: 0,
                bestVolume: 0,
                avgWeight: 0,
                totalReps: 0,
            };
        }

        const { data: sets } = await supabase
            .from("set_logs")
            .select("*")
            .in("exercise_log_id", exerciseLogIds)
            .eq("completed", true);

        const totalSets = (sets || []).length;
        const totalVolume = (sets || []).reduce(
            (sum, set) => sum + set.reps * (set.weight || 0),
            0
        );
        const totalReps = (sets || []).reduce((sum, set) => sum + set.reps, 0);
        const avgWeight =
            totalSets > 0
                ? (sets || []).reduce(
                      (sum, set) => sum + (set.weight || 0),
                      0
                  ) / totalSets
                : 0;

        const completedSessions = (sessions || []).filter(
            (s) => s.completed_at
        );
        const avgDuration =
            completedSessions.length > 0
                ? completedSessions.reduce((sum, s) => {
                      const start = new Date(s.started_at).getTime();
                      const end = new Date(s.completed_at!).getTime();
                      return sum + (end - start);
                  }, 0) /
                  completedSessions.length /
                  1000 /
                  60
                : 0;

        const volumeBySession: Record<string, number> = {};
        (sessions || []).forEach((session) => {
            const sessionLogs = (exerciseLogs || []).filter(
                (l) => l.workout_session_id === session.id
            );
            const sessionLogIds = sessionLogs.map((l) => l.id);
            const sessionSets = (sets || []).filter((s) =>
                sessionLogIds.includes(s.exercise_log_id)
            );
            const volume = sessionSets.reduce(
                (sum, set) => sum + set.reps * (set.weight || 0),
                0
            );
            volumeBySession[session.id] = volume;
        });

        const bestVolume =
            Object.keys(volumeBySession).length > 0
                ? Math.max(...Object.values(volumeBySession))
                : 0;

        return {
            totalWorkouts: (sessions || []).length,
            totalSets,
            totalVolume: Math.round(totalVolume),
            avgDuration: Math.round(avgDuration),
            bestVolume: Math.round(bestVolume),
            avgWeight: Math.round(avgWeight * 10) / 10,
            totalReps,
        };
    }

    async function fetchComparisonData() {
        setLoading(true);
        try {
            // Fetch friend's profile
            const { data: friendProfile } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("id", friendId)
                .single();

            if (friendProfile) {
                setFriendName(
                    friendProfile.full_name ||
                        friendProfile.email?.split("@")[0] ||
                        "Znajomy"
                );
            }

            // Fetch stats for both users
            const [myData, friendData] = await Promise.all([
                fetchStatsForUser(user?.id || ""),
                fetchStatsForUser(friendId),
            ]);

            setMyStats(myData);
            setFriendStats(friendData);
        } catch (error) {
            console.error("Error fetching comparison data:", error);
        } finally {
            setLoading(false);
        }
    }

    const periods = [
        { value: "2weeks" as TimePeriod, label: "2 tygodnie" },
        { value: "1month" as TimePeriod, label: "1 miesiąc" },
        { value: "3months" as TimePeriod, label: "3 miesiące" },
    ];

    function ComparisonStat({
        label,
        icon: Icon,
        myValue,
        friendValue,
        unit = "",
        format: formatFn,
    }: {
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        myValue: number;
        friendValue: number;
        unit?: string;
        format?: (val: number) => string;
    }) {
        const displayMyValue = formatFn ? formatFn(myValue) : myValue;
        const displayFriendValue = formatFn
            ? formatFn(friendValue)
            : friendValue;
        const myLeading = myValue > friendValue;
        const tied = myValue === friendValue;

        return (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-neutral-400 uppercase tracking-wider">
                        {label}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div
                        className={`p-3 rounded-lg ${
                            myLeading && !tied
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-neutral-950"
                        }`}
                    >
                        <p className="text-xs text-neutral-500 mb-1">Ty</p>
                        <p
                            className={`text-xl font-bold ${
                                myLeading && !tied
                                    ? "text-green-400"
                                    : "text-neutral-100"
                            }`}
                        >
                            {displayMyValue}
                            {unit}
                        </p>
                    </div>
                    <div
                        className={`p-3 rounded-lg ${
                            !myLeading && !tied
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-neutral-950"
                        }`}
                    >
                        <p className="text-xs text-neutral-500 mb-1">
                            {friendName}
                        </p>
                        <p
                            className={`text-xl font-bold ${
                                !myLeading && !tied
                                    ? "text-green-400"
                                    : "text-neutral-100"
                            }`}
                        >
                            {displayFriendValue}
                            {unit}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950">
            <Header
                icon={
                    <>
                        <Link
                            href="/friends"
                            className="text-neutral-400 hover:text-neutral-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                    </>
                }
                title="PORÓWNANIE"
            />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Period Selector */}
                <div className="mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {periods.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm ${
                                    period === p.value
                                        ? "bg-orange-500 text-white"
                                        : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-800"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ComparisonStat
                        label="Treningi"
                        icon={Calendar}
                        myValue={myStats.totalWorkouts}
                        friendValue={friendStats.totalWorkouts}
                    />

                    <ComparisonStat
                        label="Serie"
                        icon={Target}
                        myValue={myStats.totalSets}
                        friendValue={friendStats.totalSets}
                    />

                    <ComparisonStat
                        label="Objętość"
                        icon={Dumbbell}
                        myValue={myStats.totalVolume}
                        friendValue={friendStats.totalVolume}
                        format={(val) =>
                            val > 1000
                                ? `${(val / 1000).toFixed(1)}k`
                                : val.toString()
                        }
                    />

                    <ComparisonStat
                        label="Średni czas"
                        icon={Clock}
                        myValue={myStats.avgDuration}
                        friendValue={friendStats.avgDuration}
                        unit=" min"
                    />

                    <ComparisonStat
                        label="Najlepszy trening"
                        icon={Trophy}
                        myValue={myStats.bestVolume}
                        friendValue={friendStats.bestVolume}
                        format={(val) =>
                            val > 1000
                                ? `${(val / 1000).toFixed(1)}k`
                                : val.toString()
                        }
                    />

                    <ComparisonStat
                        label="Średni ciężar"
                        icon={Activity}
                        myValue={myStats.avgWeight}
                        friendValue={friendStats.avgWeight}
                        unit=" kg"
                    />

                    <ComparisonStat
                        label="Powtórzenia"
                        icon={Zap}
                        myValue={myStats.totalReps}
                        friendValue={friendStats.totalReps}
                        format={(val) =>
                            val > 1000
                                ? `${(val / 1000).toFixed(1)}k`
                                : val.toString()
                        }
                    />
                </div>

                {/* Winner Banner */}
                {myStats.totalWorkouts > 0 || friendStats.totalWorkouts > 0 ? (
                    <div className="mt-6 bg-gradient-to-r from-orange-500/10 to-blue-500/10 border border-orange-500/20 rounded-lg p-6 text-center">
                        <Trophy className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-neutral-100 mb-2">
                            {myStats.totalWorkouts > friendStats.totalWorkouts
                                ? "Świetna robota! Prowadzisz!"
                                : myStats.totalWorkouts <
                                  friendStats.totalWorkouts
                                ? `${friendName} prowadzi! Czas nadrobić!`
                                : "Remis! Świetna rywalizacja!"}
                        </h3>
                        <p className="text-sm text-neutral-400">
                            {myStats.totalWorkouts > friendStats.totalWorkouts
                                ? `Masz ${
                                      myStats.totalWorkouts -
                                      friendStats.totalWorkouts
                                  } więcej treningów`
                                : myStats.totalWorkouts <
                                  friendStats.totalWorkouts
                                ? `${
                                      friendStats.totalWorkouts -
                                      myStats.totalWorkouts
                                  } treningów różnicy`
                                : "Równy poziom aktywności"}
                        </p>
                    </div>
                ) : null}
            </main>
        </div>
    );
}
