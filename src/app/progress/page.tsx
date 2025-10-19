"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
    TrendingUp,
    Dumbbell,
    BarChart3,
    Target,
    ArrowLeft,
    ClipboardList,
    Play,
    Loader2,
    Activity,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";
import GeneralStats from "../../../components/stats/GeneralStats";
import StrengthStats from "../../../components/stats/StrengthStats";
import TrendsStats from "../../../components/stats/TrendsStats";
import GoalsStats from "../../../components/stats/GoalsStats";
import BodyPartAnalysis from "../../../components/stats/BodyPartAnalysis";

type TabType = "general" | "strength" | "trends" | "goals" | "bodyparts";

export default function ProgressPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("general");

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    const tabs: Array<{
        id: TabType;
        label: string;
        icon: React.ReactNode;
    }> = [
        {
            id: "general",
            label: "Ogólne",
            icon: <BarChart3 className="w-4 h-4" />,
        },
        {
            id: "strength",
            label: "Siła",
            icon: <Dumbbell className="w-4 h-4" />,
        },
        {
            id: "trends",
            label: "Trendy",
            icon: <TrendingUp className="w-4 h-4" />,
        },
        {
            id: "goals",
            label: "Cele",
            icon: <Target className="w-4 h-4" />,
        },
        {
            id: "bodyparts",
            label: "Analiza Partii",
            icon: <Activity className="w-4 h-4" />,
        },
    ];

    return (
        <div className="min-h-screen bg-neutral-950">
            <Header
                title="STATYSTYKI"
                icon={
                    <>
                        <Link
                            href="/dashboard"
                            className="text-neutral-400 hover:text-neutral-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                    </>
                }
                buttons={[]}
            />

            <main className="max-w-7xl mx-auto px-4 py-6 pb-24">
                {/* Tab Navigation */}
                <div className="mb-6 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    activeTab === tab.id
                                        ? "bg-orange-500 text-white"
                                        : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div>
                    {activeTab === "general" && (
                        <GeneralStats userId={user?.id} />
                    )}
                    {activeTab === "strength" && (
                        <StrengthStats userId={user?.id} />
                    )}
                    {activeTab === "trends" && (
                        <TrendsStats userId={user?.id} />
                    )}
                    {activeTab === "goals" && <GoalsStats userId={user?.id} />}
                    {activeTab === "bodyparts" && (
                        <BodyPartAnalysis userId={user?.id} />
                    )}
                </div>
            </main>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-800 px-4 py-3">
                <div className="max-w-7xl mx-auto flex justify-around items-center gap-4">
                    <Link
                        href="/templates"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 text-blue-400 hover:bg-neutral-800 transition-colors"
                    >
                        <ClipboardList className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/workout/new"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                    >
                        <Play className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/progress"
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-orange-500 border-2 border-orange-400 text-white transition-colors"
                    >
                        <TrendingUp className="w-6 h-6" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
