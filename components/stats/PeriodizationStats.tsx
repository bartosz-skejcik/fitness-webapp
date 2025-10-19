"use client";

import { usePeriodization } from "@/hooks/usePeriodization";
import {
    Loader2,
    Calendar,
    TrendingUp,
    Activity,
    Zap,
    Pause,
} from "lucide-react";

export default function PeriodizationStats() {
    const { summary, loading } = usePeriodization(12);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!summary || !summary.currentPhase) {
        return (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
                <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-300 mb-2">
                    Brak danych o periodyzacji
                </h3>
                <p className="text-sm text-neutral-500">
                    Zaloguj więcej treningów aby zobaczyć analizę faz
                    treningowych.
                </p>
            </div>
        );
    }

    const getPhaseColor = (type: string) => {
        switch (type) {
            case "accumulation":
                return "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400";
            case "intensification":
                return "from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400";
            case "deload":
                return "from-green-500/20 to-green-600/10 border-green-500/30 text-green-400";
            case "transition":
                return "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400";
            default:
                return "from-neutral-500/20 to-neutral-600/10 border-neutral-500/30 text-neutral-400";
        }
    };

    const getPhaseIcon = (type: string) => {
        switch (type) {
            case "accumulation":
                return <Activity className="w-6 h-6" />;
            case "intensification":
                return <Zap className="w-6 h-6" />;
            case "deload":
                return <Pause className="w-6 h-6" />;
            case "transition":
                return <TrendingUp className="w-6 h-6" />;
            default:
                return <Calendar className="w-6 h-6" />;
        }
    };

    const getPhaseLabel = (type: string) => {
        switch (type) {
            case "accumulation":
                return "Akumulacja";
            case "intensification":
                return "Intensyfikacja";
            case "deload":
                return "Deload";
            case "transition":
                return "Przejście";
            default:
                return type;
        }
    };

    const getNextPhaseLabel = (type: string) => {
        switch (type) {
            case "accumulation":
                return "Faza Akumulacji";
            case "intensification":
                return "Faza Intensyfikacji";
            case "deload":
                return "Tydzień Deloadowy";
            case "transition":
                return "Faza Przejściowa";
            default:
                return type;
        }
    };

    return (
        <div className="space-y-6">
            {/* Current Phase */}
            <div
                className={`bg-gradient-to-br ${getPhaseColor(
                    summary.currentPhase.type
                )} border-2 rounded-lg p-6`}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-black/20 rounded-lg">
                        {getPhaseIcon(summary.currentPhase.type)}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-1">
                            Faza: {getPhaseLabel(summary.currentPhase.type)}
                        </h3>
                        <p className="text-sm opacity-90">
                            Tydzień {summary.weeksSincePhaseChange + 1} obecnej
                            fazy
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-xs opacity-75 mb-1">Objętość</p>
                        <p className="text-xl font-bold">
                            {Math.round(
                                summary.currentPhase.volume
                            ).toLocaleString()}{" "}
                            kg
                        </p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-xs opacity-75 mb-1">Intensywność</p>
                        <p className="text-xl font-bold">
                            {summary.currentPhase.intensity.toFixed(0)}%
                        </p>
                    </div>
                </div>

                <div className="bg-black/20 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-sm">Cechy fazy:</h4>
                    <ul className="space-y-1">
                        {summary.currentPhase.characteristics.map(
                            (char, idx) => (
                                <li
                                    key={idx}
                                    className="text-sm flex items-start gap-2"
                                >
                                    <span className="opacity-75">•</span>
                                    <span>{char}</span>
                                </li>
                            )
                        )}
                    </ul>
                </div>
            </div>

            {/* Recommendation */}
            <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-orange-400 mb-1">
                            Następny krok:{" "}
                            {getNextPhaseLabel(summary.recommendedNextPhase)}
                        </h3>
                        <p className="text-sm text-orange-300">
                            {summary.recommendation}
                        </p>
                    </div>
                </div>
            </div>

            {/* Phase History */}
            {summary.phaseHistory.length > 1 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-neutral-800">
                        <h3 className="text-sm font-bold text-neutral-100">
                            HISTORIA FAZ TRENINGOWYCH
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {summary.phaseHistory
                            .slice()
                            .reverse()
                            .map((phase, idx) => {
                                const isCurrent = idx === 0;
                                const weeksDuration =
                                    Math.ceil(
                                        (new Date(phase.weekEnd).getTime() -
                                            new Date(
                                                phase.weekStart
                                            ).getTime()) /
                                            (7 * 24 * 60 * 60 * 1000)
                                    ) + 1;

                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-3 p-3 rounded-lg ${
                                            isCurrent
                                                ? "bg-orange-500/10 border border-orange-500/20"
                                                : "bg-neutral-800/30"
                                        }`}
                                    >
                                        <div
                                            className={`p-2 rounded-lg ${
                                                isCurrent
                                                    ? "bg-orange-500/20"
                                                    : "bg-neutral-700/50"
                                            }`}
                                        >
                                            {getPhaseIcon(phase.type)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className={`font-semibold ${
                                                        isCurrent
                                                            ? "text-orange-400"
                                                            : "text-neutral-300"
                                                    }`}
                                                >
                                                    {getPhaseLabel(phase.type)}
                                                </span>
                                                {isCurrent && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                                        Obecna
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-neutral-400">
                                                <span>
                                                    {new Date(
                                                        phase.weekStart
                                                    ).toLocaleDateString(
                                                        "pl-PL"
                                                    )}{" "}
                                                    -{" "}
                                                    {new Date(
                                                        phase.weekEnd
                                                    ).toLocaleDateString(
                                                        "pl-PL"
                                                    )}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    {weeksDuration}{" "}
                                                    {weeksDuration === 1
                                                        ? "tydzień"
                                                        : "tygodni"}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    {Math.round(
                                                        phase.volume
                                                    ).toLocaleString()}{" "}
                                                    kg
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className="bg-blue-500/10 border-2 border-blue-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400 mb-2">
                    📚 O periodyzacji treningowej
                </h3>
                <div className="space-y-3 text-sm text-blue-300">
                    <div>
                        <p className="font-semibold mb-1">
                            🔵 Faza Akumulacji (3-4 tygodnie)
                        </p>
                        <p className="text-xs opacity-90">
                            Wysoka objętość, umiarkowana intensywność. Budowanie
                            bazy wytrzymałościowej, zwiększanie tolerancji na
                            objętość treningową. 8-15 powtórzeń, średnie
                            ciężary.
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold mb-1">
                            🟠 Faza Intensyfikacji (2-3 tygodnie)
                        </p>
                        <p className="text-xs opacity-90">
                            Wysoka intensywność, niższa objętość. Budowanie siły
                            maksymalnej, wykorzystanie adaptacji z fazy
                            akumulacji. 3-6 powtórzeń, ciężkie ciężary.
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold mb-1">
                            🟢 Tydzień Deloadowy (1 tydzień)
                        </p>
                        <p className="text-xs opacity-90">
                            Znacznie obniżona objętość (40-50%) i intensywność.
                            Pozwala na pełną regenerację i supercompensację.
                            Przygotowuje do kolejnego cyklu treningowego.
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold mb-1">
                            🟣 Faza Przejściowa
                        </p>
                        <p className="text-xs opacity-90">
                            Zrównoważona objętość i intensywność. Okres między
                            fazami lub utrzymanie formy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
