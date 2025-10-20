"use client";

import { useState } from "react";
import {
    AlertTriangle,
    TrendingDown,
    CheckCircle2,
    Lightbulb,
    Loader2,
    PieChart,
    Scale,
    TrendingUp,
} from "lucide-react";
import { useBodyPartAnalysis } from "@/hooks/useBodyPartAnalysis";
import { TargetBodyPart } from "@/types/database";
import { XAxis, CartesianGrid, Area, AreaChart } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "../ui/chart";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../ui/card";

interface BodyPartAnalysisProps {
    userId: string | undefined;
}

const targetBodyPartLabels: Record<TargetBodyPart, string> = {
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

export default function BodyPartAnalysis({ userId }: BodyPartAnalysisProps) {
    const { data, loading, error } = useBodyPartAnalysis(userId);
    const [compareBodyPart1, setCompareBodyPart1] = useState<
        TargetBodyPart | ""
    >("");
    const [compareBodyPart2, setCompareBodyPart2] = useState<
        TargetBodyPart | ""
    >("");

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
                    Error loading analysis: {error.message}
                </p>
            </div>
        );
    }

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
            {/* Smart Recommendations */}
            {data.recommendations.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="w-5 h-5 text-yellow-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Rekomendacje
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {data.recommendations.map((recommendation, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50"
                            >
                                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-neutral-200">
                                    {recommendation}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Muscle Imbalances */}
            {data.imbalances.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Scale className="w-5 h-5 text-orange-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Balans antagonistów
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {data.imbalances.map((imbalance, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded-lg border ${
                                    imbalance.isImbalanced
                                        ? "bg-orange-500/10 border-orange-500/30"
                                        : "bg-green-500/10 border-green-500/30"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-neutral-100">
                                        {imbalance.muscleGroup}
                                    </h4>
                                    {imbalance.isImbalanced ? (
                                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-neutral-400">
                                            {
                                                targetBodyPartLabels[
                                                    imbalance.part1
                                                ]
                                            }
                                        </span>
                                        <span className="text-xs text-neutral-300 font-mono">
                                            {imbalance.volume1 > 1000
                                                ? `${(
                                                      imbalance.volume1 / 1000
                                                  ).toFixed(1)}k`
                                                : imbalance.volume1}{" "}
                                            kg
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-500"
                                            style={{
                                                width: `${
                                                    (imbalance.volume1 /
                                                        Math.max(
                                                            imbalance.volume1,
                                                            imbalance.volume2
                                                        )) *
                                                    100
                                                }%`,
                                            }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs text-neutral-400">
                                            {
                                                targetBodyPartLabels[
                                                    imbalance.part2
                                                ]
                                            }
                                        </span>
                                        <span className="text-xs text-neutral-300 font-mono">
                                            {imbalance.volume2 > 1000
                                                ? `${(
                                                      imbalance.volume2 / 1000
                                                  ).toFixed(1)}k`
                                                : imbalance.volume2}{" "}
                                            kg
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 transition-all duration-500"
                                            style={{
                                                width: `${
                                                    (imbalance.volume2 /
                                                        Math.max(
                                                            imbalance.volume1,
                                                            imbalance.volume2
                                                        )) *
                                                    100
                                                }%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-neutral-700/50">
                                    <p className="text-xs text-neutral-400">
                                        Różnica:{" "}
                                        <span
                                            className={
                                                imbalance.isImbalanced
                                                    ? "text-orange-400 font-semibold"
                                                    : "text-green-400 font-semibold"
                                            }
                                        >
                                            {imbalance.difference.toFixed(1)}%
                                        </span>
                                        {imbalance.isImbalanced && (
                                            <span className="ml-2 text-orange-400">
                                                (zalecane &lt;20%)
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Undertrained Body Parts */}
            {data.undertrainedParts.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Partie wymagające uwagi
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.undertrainedParts.map((part) => (
                            <div
                                key={part.bodyPart}
                                className={`p-4 rounded-lg border ${
                                    part.severity === "critical"
                                        ? "bg-red-500/10 border-red-500/30"
                                        : "bg-yellow-500/10 border-yellow-500/30"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-neutral-100">
                                        {targetBodyPartLabels[part.bodyPart]}
                                    </h4>
                                    <AlertTriangle
                                        className={`w-4 h-4 ${
                                            part.severity === "critical"
                                                ? "text-red-400"
                                                : "text-yellow-400"
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-neutral-400">
                                        Ostatni trening:{" "}
                                        <span
                                            className={
                                                part.severity === "critical"
                                                    ? "text-red-400 font-semibold"
                                                    : "text-yellow-400 font-semibold"
                                            }
                                        >
                                            {part.daysSinceLastTrained} dni temu
                                        </span>
                                    </p>
                                    <p className="text-xs text-neutral-400">
                                        Ten miesiąc:{" "}
                                        <span className="text-neutral-300">
                                            {part.timesThisMonth}x
                                        </span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Volume Distribution */}
            {data.volumeDistribution.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChart className="w-5 h-5 text-blue-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Rozkład objętości treningu
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {data.volumeDistribution.map((dist, index) => (
                            <div key={dist.bodyPart}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-neutral-100 font-medium">
                                        {targetBodyPartLabels[dist.bodyPart]}
                                    </span>
                                    <div className="text-right">
                                        <span className="text-xs text-neutral-400">
                                            {dist.percentage.toFixed(1)}%
                                        </span>
                                        <span className="text-xs text-neutral-500 ml-2">
                                            (
                                            {dist.volume > 1000
                                                ? `${(
                                                      dist.volume / 1000
                                                  ).toFixed(1)}k`
                                                : dist.volume}{" "}
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
                                            width: `${dist.percentage}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 12-Week Progress History */}
            {data.progressHistory && data.progressHistory.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Historia 12 tygodni (Top 6 partii)
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {data.progressHistory
                            .slice(0, 6)
                            .map((history, index) => {
                                const maxVolume = Math.max(
                                    ...history.weeklyData.map((w) => w.volume)
                                );
                                const avgVolume =
                                    history.weeklyData.reduce(
                                        (sum, w) => sum + w.volume,
                                        0
                                    ) / history.weeklyData.length;

                                // Calculate trend
                                const recentAvg =
                                    history.weeklyData
                                        .slice(-4)
                                        .reduce((sum, w) => sum + w.volume, 0) /
                                    4;
                                const oldAvg =
                                    history.weeklyData
                                        .slice(0, 4)
                                        .reduce((sum, w) => sum + w.volume, 0) /
                                    4;
                                const trendPercent =
                                    oldAvg > 0
                                        ? ((recentAvg - oldAvg) / oldAvg) * 100
                                        : 0;

                                // Chart colors
                                const chartColors = [
                                    "hsl(217, 91%, 60%)", // blue
                                    "hsl(25, 95%, 53%)", // orange
                                    "hsl(271, 91%, 65%)", // purple
                                    "hsl(142, 71%, 45%)", // green
                                    "hsl(338, 90%, 65%)", // pink
                                ];

                                // Create chart config for this body part
                                const chartConfig = {
                                    volume: {
                                        label: "Objętość",
                                        color: chartColors[
                                            index % chartColors.length
                                        ],
                                    },
                                };

                                // Format data for recharts
                                const chartData = history.weeklyData.map(
                                    (week, i) => ({
                                        week: `${12 - i}w`,
                                        volume: week.volume,
                                    })
                                );

                                return (
                                    <Card
                                        key={history.bodyPart}
                                        className="bg-neutral-900 border-neutral-800"
                                    >
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base font-semibold text-neutral-100">
                                                {
                                                    targetBodyPartLabels[
                                                        history.bodyPart
                                                    ]
                                                }
                                            </CardTitle>
                                            <CardDescription className="text-xs text-neutral-400">
                                                Średnia:{" "}
                                                {avgVolume > 1000
                                                    ? `${(
                                                          avgVolume / 1000
                                                      ).toFixed(1)}k`
                                                    : Math.round(
                                                          avgVolume
                                                      )}{" "}
                                                kg/tydzień
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pb-2">
                                            <ChartContainer
                                                config={chartConfig}
                                                className="h-[140px] w-full"
                                            >
                                                <AreaChart
                                                    accessibilityLayer
                                                    data={chartData}
                                                    margin={{
                                                        left: 12,
                                                        right: 12,
                                                        top: 12,
                                                    }}
                                                >
                                                    <CartesianGrid
                                                        vertical={false}
                                                        stroke="hsl(var(--neutral-800))"
                                                    />
                                                    <XAxis
                                                        dataKey="week"
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={8}
                                                        stroke="hsl(var(--neutral-600))"
                                                        fontSize={11}
                                                    />
                                                    <ChartTooltip
                                                        cursor={false}
                                                        content={
                                                            <ChartTooltipContent
                                                                indicator="line"
                                                                formatter={(
                                                                    value
                                                                ) =>
                                                                    `${
                                                                        Number(
                                                                            value
                                                                        ) > 1000
                                                                            ? `${(
                                                                                  Number(
                                                                                      value
                                                                                  ) /
                                                                                  1000
                                                                              ).toFixed(
                                                                                  1
                                                                              )}k`
                                                                            : value
                                                                    } kg`
                                                                }
                                                            />
                                                        }
                                                    />
                                                    <Area
                                                        dataKey="volume"
                                                        type="natural"
                                                        fill="var(--color-volume)"
                                                        fillOpacity={0.4}
                                                        stroke="var(--color-volume)"
                                                        strokeWidth={2}
                                                    />
                                                </AreaChart>
                                            </ChartContainer>
                                        </CardContent>
                                        <CardFooter className="pt-0 pb-4">
                                            <div className="flex w-full items-start gap-2 text-xs">
                                                <div className="grid gap-1">
                                                    <div className="flex items-center gap-2 leading-none font-medium text-neutral-300">
                                                        {trendPercent > 0 ? (
                                                            <>
                                                                <TrendingUp className="h-3 w-3 text-green-500" />
                                                                <span className="text-green-500">
                                                                    +
                                                                    {trendPercent.toFixed(
                                                                        1
                                                                    )}
                                                                    %
                                                                </span>
                                                                <span className="text-neutral-400">
                                                                    ostatnie 4
                                                                    tygodnie
                                                                </span>
                                                            </>
                                                        ) : trendPercent < 0 ? (
                                                            <>
                                                                <TrendingDown className="h-3 w-3 text-red-500" />
                                                                <span className="text-red-500">
                                                                    {trendPercent.toFixed(
                                                                        1
                                                                    )}
                                                                    %
                                                                </span>
                                                                <span className="text-neutral-400">
                                                                    ostatnie 4
                                                                    tygodnie
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-neutral-500">
                                                                Stabilny trend
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-neutral-500 leading-none">
                                                        Max:{" "}
                                                        {maxVolume > 1000
                                                            ? `${(
                                                                  maxVolume /
                                                                  1000
                                                              ).toFixed(1)}k`
                                                            : maxVolume}{" "}
                                                        kg
                                                    </div>
                                                </div>
                                            </div>
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Body Part Comparison Tool */}
            {data.volumeDistribution.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Scale className="w-5 h-5 text-purple-500" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Porównaj partie mięśniowe
                        </h3>
                    </div>

                    {/* Selection Dropdowns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs text-neutral-400 mb-2">
                                Pierwsza partia
                            </label>
                            <select
                                value={compareBodyPart1}
                                onChange={(e) =>
                                    setCompareBodyPart1(
                                        e.target.value as TargetBodyPart | ""
                                    )
                                }
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-purple-500"
                            >
                                <option value="">Wybierz partię...</option>
                                {data.volumeDistribution.map((dist) => (
                                    <option
                                        key={dist.bodyPart}
                                        value={dist.bodyPart}
                                    >
                                        {targetBodyPartLabels[dist.bodyPart]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-neutral-400 mb-2">
                                Druga partia
                            </label>
                            <select
                                value={compareBodyPart2}
                                onChange={(e) =>
                                    setCompareBodyPart2(
                                        e.target.value as TargetBodyPart | ""
                                    )
                                }
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-purple-500"
                            >
                                <option value="">Wybierz partię...</option>
                                {data.volumeDistribution.map((dist) => (
                                    <option
                                        key={dist.bodyPart}
                                        value={dist.bodyPart}
                                    >
                                        {targetBodyPartLabels[dist.bodyPart]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Comparison Results */}
                    {compareBodyPart1 &&
                        compareBodyPart2 &&
                        compareBodyPart1 !== compareBodyPart2 &&
                        (() => {
                            const part1Data = data.volumeDistribution.find(
                                (d) => d.bodyPart === compareBodyPart1
                            );
                            const part2Data = data.volumeDistribution.find(
                                (d) => d.bodyPart === compareBodyPart2
                            );
                            const part1History = data.progressHistory?.find(
                                (h) => h.bodyPart === compareBodyPart1
                            );
                            const part2History = data.progressHistory?.find(
                                (h) => h.bodyPart === compareBodyPart2
                            );

                            if (!part1Data || !part2Data) return null;

                            const volumeDiff = Math.abs(
                                part1Data.volume - part2Data.volume
                            );
                            const volumeDiffPercent =
                                (volumeDiff /
                                    Math.max(
                                        part1Data.volume,
                                        part2Data.volume
                                    )) *
                                100;
                            const leader =
                                part1Data.volume > part2Data.volume
                                    ? compareBodyPart1
                                    : compareBodyPart2;

                            return (
                                <div className="space-y-6">
                                    {/* Volume Comparison */}
                                    <div className="bg-neutral-800/50 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-neutral-100 mb-4">
                                            Porównanie objętości
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="text-center">
                                                <p className="text-xs text-neutral-400 mb-1">
                                                    {
                                                        targetBodyPartLabels[
                                                            compareBodyPart1
                                                        ]
                                                    }
                                                </p>
                                                <p className="text-2xl font-bold text-blue-400">
                                                    {part1Data.volume > 1000
                                                        ? `${(
                                                              part1Data.volume /
                                                              1000
                                                          ).toFixed(1)}k`
                                                        : part1Data.volume}{" "}
                                                    kg
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {part1Data.percentage.toFixed(
                                                        1
                                                    )}
                                                    % całości
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-neutral-400 mb-1">
                                                    {
                                                        targetBodyPartLabels[
                                                            compareBodyPart2
                                                        ]
                                                    }
                                                </p>
                                                <p className="text-2xl font-bold text-orange-400">
                                                    {part2Data.volume > 1000
                                                        ? `${(
                                                              part2Data.volume /
                                                              1000
                                                          ).toFixed(1)}k`
                                                        : part2Data.volume}{" "}
                                                    kg
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {part2Data.percentage.toFixed(
                                                        1
                                                    )}
                                                    % całości
                                                </p>
                                            </div>
                                        </div>
                                        <div className="bg-neutral-900 rounded-lg p-3 text-center">
                                            <p className="text-xs text-neutral-400 mb-1">
                                                Różnica
                                            </p>
                                            <p
                                                className={`text-lg font-bold ${
                                                    volumeDiffPercent > 20
                                                        ? "text-orange-400"
                                                        : "text-green-400"
                                                }`}
                                            >
                                                {volumeDiffPercent.toFixed(1)}%
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {targetBodyPartLabels[leader]}{" "}
                                                prowadzi
                                            </p>
                                        </div>
                                    </div>

                                    {/* Trend Comparison */}
                                    {part1History && part2History && (
                                        <div className="bg-neutral-800/50 rounded-lg p-4">
                                            <h4 className="text-sm font-semibold text-neutral-100 mb-4">
                                                Porównanie trendu (12 tygodni)
                                            </h4>

                                            <ChartContainer
                                                config={{
                                                    part1: {
                                                        label: targetBodyPartLabels[
                                                            compareBodyPart1
                                                        ],
                                                        color: "hsl(217, 91%, 60%)", // blue
                                                    },
                                                    part2: {
                                                        label: targetBodyPartLabels[
                                                            compareBodyPart2
                                                        ],
                                                        color: "hsl(25, 95%, 53%)", // orange
                                                    },
                                                }}
                                                className="h-[240px] w-full"
                                            >
                                                <AreaChart
                                                    accessibilityLayer
                                                    data={part1History.weeklyData.map(
                                                        (week, index) => ({
                                                            week: `${
                                                                12 - index
                                                            }w`,
                                                            part1: week.volume,
                                                            part2:
                                                                part2History
                                                                    .weeklyData[
                                                                    index
                                                                ]?.volume || 0,
                                                        })
                                                    )}
                                                    margin={{
                                                        left: 12,
                                                        right: 12,
                                                        top: 12,
                                                    }}
                                                >
                                                    <CartesianGrid
                                                        vertical={false}
                                                        stroke="hsl(var(--neutral-800))"
                                                    />
                                                    <XAxis
                                                        dataKey="week"
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={8}
                                                        stroke="hsl(var(--neutral-600))"
                                                        fontSize={11}
                                                    />
                                                    <ChartTooltip
                                                        cursor={false}
                                                        content={
                                                            <ChartTooltipContent
                                                                indicator="dot"
                                                                formatter={(
                                                                    value
                                                                ) =>
                                                                    `${
                                                                        Number(
                                                                            value
                                                                        ) > 1000
                                                                            ? `${(
                                                                                  Number(
                                                                                      value
                                                                                  ) /
                                                                                  1000
                                                                              ).toFixed(
                                                                                  1
                                                                              )}k`
                                                                            : value
                                                                    } kg`
                                                                }
                                                            />
                                                        }
                                                    />
                                                    <Area
                                                        dataKey="part2"
                                                        type="natural"
                                                        fill="var(--color-part2)"
                                                        fillOpacity={0.4}
                                                        stroke="var(--color-part2)"
                                                        strokeWidth={2}
                                                        stackId="a"
                                                    />
                                                    <Area
                                                        dataKey="part1"
                                                        type="natural"
                                                        fill="var(--color-part1)"
                                                        fillOpacity={0.4}
                                                        stroke="var(--color-part1)"
                                                        strokeWidth={2}
                                                        stackId="a"
                                                    />
                                                    <ChartLegend
                                                        content={
                                                            <ChartLegendContent className="text-neutral-300" />
                                                        }
                                                    />
                                                </AreaChart>
                                            </ChartContainer>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                </div>
            )}

            {/* No Data State */}
            {data.volumeDistribution.length === 0 &&
                data.imbalances.length === 0 &&
                data.undertrainedParts.length === 0 && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-12 text-center">
                        <PieChart className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-neutral-300 mb-2">
                            Brak danych do analizy
                        </h3>
                        <p className="text-sm text-neutral-500">
                            Wykonaj kilka treningów, aby zobaczyć szczegółową
                            analizę swoich partii mięśniowych
                        </p>
                    </div>
                )}
        </div>
    );
}
