import {
    TrendingUp,
    Calendar,
    Clock,
    Activity,
    Loader2,
    BarChart3,
    TrendingDown,
    ChevronDown,
    Check,
} from "lucide-react";
import { useTrendsStats } from "@/hooks/useTrendsStats";
import { Line, LineChart, XAxis, CartesianGrid, LabelList } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Checkbox } from "../ui/checkbox";
import { useState, useMemo } from "react";

interface TrendsStatsProps {
    userId: string | undefined;
}

export default function TrendsStats({ userId }: TrendsStatsProps) {
    const { stats, loading, error } = useTrendsStats(userId);
    const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>(
        []
    );

    // Sort exercises by number of data points (most done to least done)
    const sortedExercises = useMemo(() => {
        return [...stats.topExerciseProgress].sort(
            (a, b) => b.dataPoints.length - a.dataPoints.length
        );
    }, [stats.topExerciseProgress]);

    // Initialize selected exercises when data loads
    useMemo(() => {
        if (selectedExerciseIds.length === 0 && sortedExercises.length > 0) {
            // Select top 6 by default
            setSelectedExerciseIds(
                sortedExercises.slice(0, 6).map((e) => e.exerciseId)
            );
        }
    }, [sortedExercises, selectedExerciseIds.length]);

    // Filter exercises based on selection
    const filteredExercises = useMemo(() => {
        if (selectedExerciseIds.length === 0) {
            return sortedExercises.slice(0, 6);
        }
        return sortedExercises.filter((e) =>
            selectedExerciseIds.includes(e.exerciseId)
        );
    }, [sortedExercises, selectedExerciseIds]);

    const toggleExercise = (exerciseId: string) => {
        setSelectedExerciseIds((prev) =>
            prev.includes(exerciseId)
                ? prev.filter((id) => id !== exerciseId)
                : [...prev, exerciseId]
        );
    };

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
                <Card
                    metal
                    className="p-6 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10 border-blue-500/20"
                >
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
                </Card>

                <Card
                    metal
                    className="p-6 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-orange-500/10 border-orange-500/20"
                >
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
                </Card>
            </div>

            {/* Weekly Progress */}
            <Card metal className="p-6">
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
            </Card>

            {/* Exercise Progress Charts */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                        <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                            Postęp ćwiczeń
                        </h3>
                    </div>
                    {sortedExercises.length > 0 && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-neutral-800 border-neutral-700 text-neutral-100 hover:bg-neutral-700 hover:text-neutral-100"
                                >
                                    <ChevronDown className="w-4 h-4 mr-2" />
                                    Wybierz ćwiczenia (
                                    {selectedExerciseIds.length})
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-80 bg-neutral-900 border-neutral-800 p-0"
                                align="end"
                            >
                                <div className="p-4 border-b border-neutral-800">
                                    <h4 className="text-sm font-semibold text-neutral-100">
                                        Wybierz ćwiczenia
                                    </h4>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        Od najczęściej trenowanych
                                    </p>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {sortedExercises.map((exercise) => (
                                        <div
                                            key={exercise.exerciseId}
                                            className="flex items-center gap-3 p-3 hover:bg-neutral-800/50 cursor-pointer border-b border-neutral-800/50 last:border-0"
                                            onClick={() =>
                                                toggleExercise(
                                                    exercise.exerciseId
                                                )
                                            }
                                        >
                                            <Checkbox
                                                checked={selectedExerciseIds.includes(
                                                    exercise.exerciseId
                                                )}
                                                onCheckedChange={() =>
                                                    toggleExercise(
                                                        exercise.exerciseId
                                                    )
                                                }
                                                className="border-neutral-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm text-neutral-100">
                                                    {exercise.exerciseName}
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {exercise.dataPoints.length}{" "}
                                                    sesji
                                                </p>
                                            </div>
                                            {selectedExerciseIds.includes(
                                                exercise.exerciseId
                                            ) && (
                                                <Check className="w-4 h-4 text-blue-500" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
                {stats.topExerciseProgress.length === 0 ? (
                    <p className="text-neutral-500 text-xs">Brak danych</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredExercises.map((exercise, index) => {
                            const minWeight = Math.min(
                                ...exercise.dataPoints.map((d) => d.maxWeight)
                            );
                            const maxWeight = Math.max(
                                ...exercise.dataPoints.map((d) => d.maxWeight)
                            );
                            const avgWeight =
                                exercise.dataPoints.reduce(
                                    (sum, d) => sum + d.maxWeight,
                                    0
                                ) / exercise.dataPoints.length;

                            // Calculate trend
                            const recentAvg =
                                exercise.dataPoints
                                    .slice(-3)
                                    .reduce((sum, d) => sum + d.maxWeight, 0) /
                                3;
                            const oldAvg =
                                exercise.dataPoints
                                    .slice(0, 3)
                                    .reduce((sum, d) => sum + d.maxWeight, 0) /
                                3;
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

                            // Create chart config for this exercise
                            const chartConfig = {
                                weight: {
                                    label: "Ciężar",
                                    color: chartColors[
                                        index % chartColors.length
                                    ],
                                },
                            };

                            // Format data for recharts
                            const chartData = exercise.dataPoints.map(
                                (point) => ({
                                    date: new Date(
                                        point.date
                                    ).toLocaleDateString("pl-PL", {
                                        day: "numeric",
                                        month: "short",
                                    }),
                                    weight: point.maxWeight,
                                })
                            );

                            return (
                                <Card key={exercise.exerciseId} metal>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base font-semibold text-neutral-100">
                                            {exercise.exerciseName}
                                        </CardTitle>
                                        <CardDescription className="text-xs text-neutral-400">
                                            Średnia: {avgWeight.toFixed(1)} kg
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pb-2">
                                        <ChartContainer
                                            config={chartConfig}
                                            className="h-[140px] w-full"
                                        >
                                            <LineChart
                                                accessibilityLayer
                                                data={chartData}
                                                margin={{
                                                    top: 20,
                                                    left: 12,
                                                    right: 12,
                                                }}
                                            >
                                                <CartesianGrid
                                                    vertical={false}
                                                    stroke="hsl(var(--neutral-800))"
                                                />
                                                <XAxis
                                                    dataKey="date"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickMargin={8}
                                                    stroke="hsl(var(--neutral-600))"
                                                    fontSize={11}
                                                    angle={-20}
                                                    textAnchor="end"
                                                />
                                                <ChartTooltip
                                                    cursor={false}
                                                    content={
                                                        <ChartTooltipContent
                                                            indicator="line"
                                                            formatter={(
                                                                value
                                                            ) => `${value} kg`}
                                                        />
                                                    }
                                                />
                                                <Line
                                                    dataKey="weight"
                                                    type="natural"
                                                    stroke="var(--color-weight)"
                                                    strokeWidth={2}
                                                    dot={{
                                                        fill: "var(--color-weight)",
                                                    }}
                                                    activeDot={{
                                                        r: 6,
                                                    }}
                                                >
                                                    <LabelList
                                                        position="top"
                                                        offset={12}
                                                        className="fill-neutral-300"
                                                        fontSize={11}
                                                        formatter={(
                                                            value: number
                                                        ) => `${value}kg`}
                                                    />
                                                </Line>
                                            </LineChart>
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
                                                                ostatnie sesje
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
                                                                ostatnie sesje
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-neutral-500">
                                                            Stabilny trend
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-neutral-500 leading-none">
                                                    {minWeight}kg → {maxWeight}
                                                    kg
                                                </div>
                                            </div>
                                        </div>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Workout Frequency Heatmap */}
            <Card metal className="p-6">
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
            </Card>
        </div>
    );
}
