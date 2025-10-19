"use client";

import { useInjuryRisk } from "@/hooks/useInjuryRisk";
import {
    Loader2,
    AlertTriangle,
    Shield,
    Activity,
    TrendingUp,
} from "lucide-react";

export default function InjuryRiskStats() {
    const { summary, loading } = useInjuryRisk(12);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-300 mb-2">
                    Brak danych o ryzyku kontuzji
                </h3>
                <p className="text-sm text-neutral-500">
                    Zaloguj więcej treningów aby zobaczyć analizę ryzyka
                    kontuzji.
                </p>
            </div>
        );
    }

    const getRiskColor = (risk: "low" | "moderate" | "high") => {
        switch (risk) {
            case "low":
                return "from-green-500/20 to-green-600/10 border-green-500/30 text-green-400";
            case "moderate":
                return "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400";
            case "high":
                return "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400";
        }
    };

    const getRiskLabel = (risk: "low" | "moderate" | "high") => {
        switch (risk) {
            case "low":
                return "Niskie ryzyko";
            case "moderate":
                return "Umiarkowane ryzyko";
            case "high":
                return "Wysokie ryzyko";
        }
    };

    const getSeverityColor = (severity: "low" | "moderate" | "high") => {
        switch (severity) {
            case "low":
                return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "moderate":
                return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
            case "high":
                return "bg-red-500/10 text-red-400 border-red-500/20";
        }
    };

    const getSeverityLabel = (severity: "low" | "moderate" | "high") => {
        switch (severity) {
            case "low":
                return "Niski";
            case "moderate":
                return "Średni";
            case "high":
                return "Wysoki";
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "volume_spike":
                return <TrendingUp className="w-5 h-5" />;
            case "imbalance":
                return <Activity className="w-5 h-5" />;
            case "overtraining":
                return <AlertTriangle className="w-5 h-5" />;
            case "neglected_stabilizer":
                return <Shield className="w-5 h-5" />;
            default:
                return <AlertTriangle className="w-5 h-5" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "volume_spike":
                return "Gwałtowny wzrost objętości";
            case "imbalance":
                return "Dysproporcja mięśniowa";
            case "overtraining":
                return "Wskaźnik przetrenowania";
            case "neglected_stabilizer":
                return "Zaniedbany stabilizator";
            default:
                return type;
        }
    };

    return (
        <div className="space-y-6">
            {/* Overall Risk Score */}
            <div
                className={`bg-gradient-to-br ${getRiskColor(
                    summary.overallRisk
                )} border-2 rounded-lg p-6`}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-2xl font-bold mb-1">
                            {getRiskLabel(summary.overallRisk)}
                        </h3>
                        <p className="text-sm opacity-90">
                            Ogólne ryzyko kontuzji
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold">
                            {summary.riskScore}
                        </div>
                        <div className="text-sm opacity-75">/ 100</div>
                    </div>
                </div>

                {summary.overallRisk === "high" && (
                    <div className="mt-4 p-3 bg-black/20 rounded-lg">
                        <p className="text-sm font-medium">
                            ⚠️ Wykryto poważne czynniki ryzyka. Zalecamy
                            przegląd planu treningowego i konsultację ze
                            specjalistą.
                        </p>
                    </div>
                )}
                {summary.overallRisk === "moderate" && (
                    <div className="mt-4 p-3 bg-black/20 rounded-lg">
                        <p className="text-sm font-medium">
                            ⚡ Wykryto potencjalne problemy. Zastosuj się do
                            rekomendacji poniżej.
                        </p>
                    </div>
                )}
                {summary.overallRisk === "low" && (
                    <div className="mt-4 p-3 bg-black/20 rounded-lg">
                        <p className="text-sm font-medium">
                            ✅ Trenujesz bezpiecznie! Kontynuuj obecny plan.
                        </p>
                    </div>
                )}
            </div>

            {/* Risk Categories Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-neutral-100">
                        {summary.volumeSpikes.length}
                    </p>
                    <p className="text-xs text-neutral-400">Skoki objętości</p>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 text-center">
                    <Activity className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-neutral-100">
                        {summary.imbalances.length}
                    </p>
                    <p className="text-xs text-neutral-400">Dysproporcje</p>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 text-center">
                    <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-neutral-100">
                        {summary.overtrainingIndicators.length}
                    </p>
                    <p className="text-xs text-neutral-400">Przetrenowanie</p>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 text-center">
                    <Shield className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-neutral-100">
                        {summary.neglectedStabilizers.length}
                    </p>
                    <p className="text-xs text-neutral-400">Stabilizatory</p>
                </div>
            </div>

            {/* Risk Factors Details */}
            {summary.factors.length > 0 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-neutral-800">
                        <h3 className="text-sm font-bold text-neutral-100">
                            WYKRYTE CZYNNIKI RYZYKA
                        </h3>
                    </div>
                    <div className="divide-y divide-neutral-800">
                        {summary.factors.map((factor, index) => (
                            <div key={index} className="p-4">
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`p-2 rounded-lg ${getSeverityColor(
                                            factor.severity
                                        )}`}
                                    >
                                        {getTypeIcon(factor.type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-semibold text-neutral-100">
                                                {getTypeLabel(factor.type)}
                                            </h4>
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded border ${getSeverityColor(
                                                    factor.severity
                                                )}`}
                                            >
                                                {getSeverityLabel(
                                                    factor.severity
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-300 mb-2">
                                            {factor.description}
                                        </p>
                                        <div className="bg-neutral-800/50 rounded-lg p-3">
                                            <p className="text-xs text-neutral-400 mb-1">
                                                💡 Rekomendacja:
                                            </p>
                                            <p className="text-sm text-neutral-200">
                                                {factor.recommendation}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* No Risk Factors */}
            {summary.factors.length === 0 && (
                <div className="bg-green-500/10 border-2 border-green-500/20 rounded-lg p-6 text-center">
                    <Shield className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-400 mb-2">
                        Świetna robota!
                    </h3>
                    <p className="text-sm text-green-300">
                        Nie wykryto żadnych czynników ryzyka kontuzji. Kontynuuj
                        trening według obecnego planu.
                    </p>
                </div>
            )}

            {/* General Tips */}
            <div className="bg-blue-500/10 border-2 border-blue-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-400 mb-2">
                    📚 Ogólne wskazówki prewencyjne
                </h3>
                <ul className="space-y-1.5 text-sm text-blue-300">
                    <li>
                        • Zawsze rozgrzewaj się przed treningiem (5-10 minut
                        cardio + mobilność)
                    </li>
                    <li>
                        • Stosuj progresję obciążeń nie szybszą niż 5-10%
                        tygodniowo
                    </li>
                    <li>
                        • Co 4-6 tygodni zaplanuj tydzień deloadowy (40-50%
                        objętości)
                    </li>
                    <li>
                        • Śpij minimum 7-8 godzin dziennie dla optymalnej
                        regeneracji
                    </li>
                    <li>
                        • Zwracaj uwagę na sygnały ciała - ból to ostrzeżenie,
                        nie ignoruj go
                    </li>
                    <li>
                        • Zrównoważona dieta i odpowiednie nawodnienie wspierają
                        regenerację
                    </li>
                </ul>
            </div>
        </div>
    );
}
