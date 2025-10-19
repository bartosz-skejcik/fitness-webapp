"use client";

import { useSymmetryAnalysis } from "@/hooks/useSymmetryAnalysis";
import { Loader2, AlertTriangle, Scale, CheckCircle2 } from "lucide-react";

export default function SymmetryStats() {
    const { summary, loading } = useSymmetryAnalysis(12);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!summary || summary.totalUnilateralExercises === 0) {
        return (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
                <Scale className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-300 mb-2">
                    Brak danych o symetrii
                </h3>
                <p className="text-sm text-neutral-500">
                    Aby zobaczyć analizę symetrii, zacznij wykonywać ćwiczenia
                    jednostronne i oznacz je jako takie w ustawieniach ćwiczeń.
                </p>
            </div>
        );
    }

    const getRiskColor = (level: "low" | "moderate" | "high") => {
        switch (level) {
            case "low":
                return "text-green-400 bg-green-500/10 border-green-500/20";
            case "moderate":
                return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
            case "high":
                return "text-red-400 bg-red-500/10 border-red-500/20";
        }
    };

    const getRiskLabel = (level: "low" | "moderate" | "high") => {
        switch (level) {
            case "low":
                return "Niskie ryzyko";
            case "moderate":
                return "Umiarkowane ryzyko";
            case "high":
                return "Wysokie ryzyko";
        }
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <Scale className="w-5 h-5 text-blue-400" />
                        <h3 className="text-sm font-semibold text-neutral-300">
                            Ćwiczenia jednostronne
                        </h3>
                    </div>
                    <p className="text-2xl font-bold text-neutral-100">
                        {summary.totalUnilateralExercises}
                    </p>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <h3 className="text-sm font-semibold text-neutral-300">
                            Wykryte niezrównoważenia
                        </h3>
                    </div>
                    <p className="text-2xl font-bold text-neutral-100">
                        {summary.exercisesWithImbalance}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                        (różnica {">"} 15%)
                    </p>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <h3 className="text-sm font-semibold text-neutral-300">
                            Średnie odchylenie
                        </h3>
                    </div>
                    <p className="text-2xl font-bold text-neutral-100">
                        {summary.averageImbalance.toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* Worst Imbalance Warning */}
            {summary.worstImbalance &&
                summary.worstImbalance.imbalancePercentage >= 15 && (
                    <div
                        className={`border-2 rounded-lg p-4 ${getRiskColor(
                            summary.worstImbalance.riskLevel
                        )}`}
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold mb-1">
                                    Największe niezrównoważenie:{" "}
                                    {summary.worstImbalance.exerciseName}
                                </h3>
                                <p className="text-sm opacity-90 mb-3">
                                    Różnica między stronami wynosi{" "}
                                    {summary.worstImbalance.imbalancePercentage.toFixed(
                                        1
                                    )}
                                    %. Silniejsza strona:{" "}
                                    {summary.worstImbalance.strongerSide ===
                                    "left"
                                        ? "lewa"
                                        : "prawa"}
                                    .
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="opacity-75 mb-1">
                                            Lewa strona:
                                        </p>
                                        <p className="font-semibold">
                                            {summary.worstImbalance.leftAvgWeight.toFixed(
                                                1
                                            )}{" "}
                                            kg ×{" "}
                                            {summary.worstImbalance.leftAvgReps.toFixed(
                                                0
                                            )}{" "}
                                            reps
                                        </p>
                                        <p className="text-xs opacity-75">
                                            {
                                                summary.worstImbalance
                                                    .leftSetsCount
                                            }{" "}
                                            serii
                                        </p>
                                    </div>
                                    <div>
                                        <p className="opacity-75 mb-1">
                                            Prawa strona:
                                        </p>
                                        <p className="font-semibold">
                                            {summary.worstImbalance.rightAvgWeight.toFixed(
                                                1
                                            )}{" "}
                                            kg ×{" "}
                                            {summary.worstImbalance.rightAvgReps.toFixed(
                                                0
                                            )}{" "}
                                            reps
                                        </p>
                                        <p className="text-xs opacity-75">
                                            {
                                                summary.worstImbalance
                                                    .rightSetsCount
                                            }{" "}
                                            serii
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* Exercise Symmetry Details */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-800">
                    <h3 className="text-sm font-bold text-neutral-100">
                        SZCZEGÓŁY SYMETRII ĆWICZEŃ
                    </h3>
                </div>
                <div className="divide-y divide-neutral-800">
                    {summary.metrics.map((metric) => (
                        <div key={metric.exerciseId} className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-neutral-100 mb-1">
                                        {metric.exerciseName}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded border ${getRiskColor(
                                                metric.riskLevel
                                            )}`}
                                        >
                                            {getRiskLabel(metric.riskLevel)}
                                        </span>
                                        <span className="text-xs text-neutral-500">
                                            Różnica:{" "}
                                            {metric.imbalancePercentage.toFixed(
                                                1
                                            )}
                                            %
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-neutral-800/50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Lewa strona
                                    </p>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">
                                                Średni ciężar:
                                            </span>
                                            <span className="font-semibold text-neutral-100">
                                                {metric.leftAvgWeight.toFixed(
                                                    1
                                                )}{" "}
                                                kg
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">
                                                Średnie reps:
                                            </span>
                                            <span className="font-semibold text-neutral-100">
                                                {metric.leftAvgReps.toFixed(0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">
                                                Objętość:
                                            </span>
                                            <span className="font-semibold text-neutral-100">
                                                {metric.leftVolume.toFixed(0)}{" "}
                                                kg
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>Serii:</span>
                                            <span>{metric.leftSetsCount}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-neutral-800/50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        Prawa strona
                                    </p>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">
                                                Średni ciężar:
                                            </span>
                                            <span className="font-semibold text-neutral-100">
                                                {metric.rightAvgWeight.toFixed(
                                                    1
                                                )}{" "}
                                                kg
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">
                                                Średnie reps:
                                            </span>
                                            <span className="font-semibold text-neutral-100">
                                                {metric.rightAvgReps.toFixed(0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-400">
                                                Objętość:
                                            </span>
                                            <span className="font-semibold text-neutral-100">
                                                {metric.rightVolume.toFixed(0)}{" "}
                                                kg
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>Serii:</span>
                                            <span>{metric.rightSetsCount}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Visual balance bar */}
                            <div className="mt-3">
                                <div className="flex h-4 rounded-full overflow-hidden bg-neutral-800">
                                    <div
                                        className="bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white"
                                        style={{
                                            width: `${
                                                (metric.leftVolume /
                                                    (metric.leftVolume +
                                                        metric.rightVolume)) *
                                                100
                                            }%`,
                                        }}
                                    >
                                        {metric.leftVolume > 0 && (
                                            <span className="px-1">L</span>
                                        )}
                                    </div>
                                    <div
                                        className="bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white"
                                        style={{
                                            width: `${
                                                (metric.rightVolume /
                                                    (metric.leftVolume +
                                                        metric.rightVolume)) *
                                                100
                                            }%`,
                                        }}
                                    >
                                        {metric.rightVolume > 0 && (
                                            <span className="px-1">P</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recommendations */}
            {summary.exercisesWithImbalance > 0 && (
                <div className="bg-blue-500/10 border-2 border-blue-500/20 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-400 mb-2">
                        💡 Rekomendacje
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-300">
                        <li>
                            • Zacznij serie od słabszej strony i dopasuj liczbę
                            powtórzeń na silniejszej stronie
                        </li>
                        <li>
                            • Rozważ dodanie dodatkowych serii na słabszą stronę
                        </li>
                        <li>
                            • Sprawdź technikę wykonania ćwiczeń - nieprawidłowa
                            forma może powodować nierówności
                        </li>
                        <li>
                            • Jeśli różnice przekraczają 20%, skonsultuj się z
                            trenerem lub fizjoterapeutą
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}
