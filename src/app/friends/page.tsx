"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Friendship, UserProfile } from "@/types/database";
import {
    ArrowLeft,
    Users,
    UserPlus,
    Check,
    X,
    Loader2,
    Search,
    TrendingUp,
} from "lucide-react";
import Link from "next/link";
import Header from "../../../components/header";

export default function FriendsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState<
        (Friendship & { profile?: UserProfile })[]
    >([]);
    const [pendingRequests, setPendingRequests] = useState<
        (Friendship & { profile?: UserProfile })[]
    >([]);
    const [sentRequests, setSentRequests] = useState<
        (Friendship & { profile?: UserProfile })[]
    >([]);
    const [searchEmail, setSearchEmail] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
    const [activeTab, setActiveTab] = useState<"friends" | "requests">(
        "friends"
    );

    useEffect(() => {
        if (!user) {
            router.push("/login");
        } else {
            fetchFriends();
        }
    }, [user, router]);

    async function fetchFriends() {
        try {
            setLoading(true);

            // Fetch accepted friendships
            const { data: friendshipsData, error: friendshipsError } =
                await supabase
                    .from("friendships")
                    .select("*")
                    .or(`user_id.eq.${user?.id},friend_id.eq.${user?.id}`)
                    .eq("status", "accepted");

            if (friendshipsError) throw friendshipsError;

            // Fetch pending requests (received)
            const { data: pendingData, error: pendingError } = await supabase
                .from("friendships")
                .select("*")
                .eq("friend_id", user?.id)
                .eq("status", "pending");

            if (pendingError) throw pendingError;

            // Fetch sent requests
            const { data: sentData, error: sentError } = await supabase
                .from("friendships")
                .select("*")
                .eq("user_id", user?.id)
                .eq("status", "pending");

            if (sentError) throw sentError;

            // Get user profiles for friends
            const friendIds = (friendshipsData || []).map((f) =>
                f.user_id === user?.id ? f.friend_id : f.user_id
            );

            const pendingIds = (pendingData || []).map((f) => f.user_id);
            const sentIds = (sentData || []).map((f) => f.friend_id);

            const allUserIds = [...friendIds, ...pendingIds, ...sentIds];

            if (allUserIds.length > 0) {
                const { data: profiles } = await supabase
                    .from("user_profiles")
                    .select("*")
                    .in("id", allUserIds);

                // Attach profiles to friendships
                const friendsWithProfiles = (friendshipsData || []).map(
                    (f) => ({
                        ...f,
                        profile: (profiles || []).find(
                            (p) =>
                                p.id ===
                                (f.user_id === user?.id
                                    ? f.friend_id
                                    : f.user_id)
                        ),
                    })
                );

                const pendingWithProfiles = (pendingData || []).map((f) => ({
                    ...f,
                    profile: (profiles || []).find((p) => p.id === f.user_id),
                }));

                const sentWithProfiles = (sentData || []).map((f) => ({
                    ...f,
                    profile: (profiles || []).find((p) => p.id === f.friend_id),
                }));

                setFriends(friendsWithProfiles);
                setPendingRequests(pendingWithProfiles);
                setSentRequests(sentWithProfiles);
            }
        } catch (error) {
            console.error("Error fetching friends:", error);
        } finally {
            setLoading(false);
        }
    }

    async function searchUser() {
        if (!searchEmail.trim()) return;

        setSearching(true);
        setSearchResult(null);

        try {
            const { data: profiles } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("email", searchEmail.trim())
                .single();

            if (profiles && profiles.id !== user?.id) {
                setSearchResult(profiles);
            }
        } catch (error) {
            console.error("Error searching user:", error);
        } finally {
            setSearching(false);
        }
    }

    async function sendFriendRequest(friendId: string) {
        try {
            const { error } = await supabase.from("friendships").insert({
                user_id: user?.id,
                friend_id: friendId,
                status: "pending",
            });

            if (error) throw error;

            setSearchEmail("");
            setSearchResult(null);
            fetchFriends();
        } catch (error) {
            console.error("Error sending friend request:", error);
        }
    }

    async function acceptRequest(friendshipId: string) {
        try {
            const { error } = await supabase
                .from("friendships")
                .update({
                    status: "accepted",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", friendshipId);

            if (error) throw error;
            fetchFriends();
        } catch (error) {
            console.error("Error accepting request:", error);
        }
    }

    async function rejectRequest(friendshipId: string) {
        try {
            const { error } = await supabase
                .from("friendships")
                .delete()
                .eq("id", friendshipId);

            if (error) throw error;
            fetchFriends();
        } catch (error) {
            console.error("Error rejecting request:", error);
        }
    }

    async function removeFriend(friendshipId: string) {
        if (!confirm("Czy na pewno chcesz usunąć tego znajomego?")) return;

        try {
            const { error } = await supabase
                .from("friendships")
                .delete()
                .eq("id", friendshipId);

            if (error) throw error;
            fetchFriends();
        } catch (error) {
            console.error("Error removing friend:", error);
        }
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
                            href="/dashboard"
                            className="text-neutral-400 hover:text-neutral-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <Users className="w-5 h-5 text-orange-500" />
                    </>
                }
                title="ZNAJOMI"
            />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Search Section */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-6">
                    <h2 className="text-sm font-bold text-neutral-100 mb-3">
                        Dodaj znajomego
                    </h2>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchUser()}
                            placeholder="Wpisz email użytkownika"
                            className="flex-1 px-4 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <button
                            onClick={searchUser}
                            disabled={searching}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                        >
                            {searching ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Search className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    {searchResult && (
                        <div className="mt-4 p-3 bg-neutral-950 border border-neutral-700 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-neutral-100">
                                    {searchResult.full_name}
                                </p>
                                <p className="text-xs text-neutral-500">
                                    {searchResult.email}
                                </p>
                            </div>
                            <button
                                onClick={() =>
                                    sendFriendRequest(searchResult.id)
                                }
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                            >
                                <UserPlus className="w-4 h-4" />
                                Wyślij zaproszenie
                            </button>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab("friends")}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                            activeTab === "friends"
                                ? "bg-orange-500 text-white"
                                : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                        }`}
                    >
                        Znajomi ({friends.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("requests")}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                            activeTab === "requests"
                                ? "bg-orange-500 text-white"
                                : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                        }`}
                    >
                        Zaproszenia ({pendingRequests.length})
                    </button>
                </div>

                {/* Friends List */}
                {activeTab === "friends" && (
                    <div className="space-y-3">
                        {friends.length === 0 ? (
                            <div className="bg-neutral-900/50 rounded-lg p-8 text-center">
                                <Users className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                                <p className="text-neutral-500 text-sm">
                                    Nie masz jeszcze znajomych
                                </p>
                            </div>
                        ) : (
                            friends.map((friendship) => (
                                <div
                                    key={friendship.id}
                                    className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                                            {friendship.profile?.full_name?.[0]?.toUpperCase() ||
                                                "?"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-neutral-100">
                                                {friendship.profile
                                                    ?.full_name || "Użytkownik"}
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {friendship.profile?.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/progress/${friendship.profile?.id}`}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                                        >
                                            <TrendingUp className="w-4 h-4" />
                                            Porównaj
                                        </Link>
                                        <button
                                            onClick={() =>
                                                removeFriend(friendship.id)
                                            }
                                            className="px-3 py-1.5 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 transition-colors text-xs"
                                        >
                                            Usuń
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Pending Requests */}
                {activeTab === "requests" && (
                    <div className="space-y-3">
                        {pendingRequests.length === 0 &&
                        sentRequests.length === 0 ? (
                            <div className="bg-neutral-900/50 rounded-lg p-8 text-center">
                                <UserPlus className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                                <p className="text-neutral-500 text-sm">
                                    Brak zaproszeń
                                </p>
                            </div>
                        ) : (
                            <>
                                {pendingRequests.length > 0 && (
                                    <>
                                        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                                            Otrzymane
                                        </h3>
                                        {pendingRequests.map((request) => (
                                            <div
                                                key={request.id}
                                                className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                                                        {request.profile?.full_name?.[0]?.toUpperCase() ||
                                                            "?"}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-neutral-100">
                                                            {request.profile
                                                                ?.full_name ||
                                                                "Użytkownik"}
                                                        </p>
                                                        <p className="text-xs text-neutral-500">
                                                            {
                                                                request.profile
                                                                    ?.email
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() =>
                                                            acceptRequest(
                                                                request.id
                                                            )
                                                        }
                                                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            rejectRequest(
                                                                request.id
                                                            )
                                                        }
                                                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {sentRequests.length > 0 && (
                                    <>
                                        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 mt-6">
                                            Wysłane
                                        </h3>
                                        {sentRequests.map((request) => (
                                            <div
                                                key={request.id}
                                                className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-white font-bold text-sm">
                                                        {request.profile?.full_name?.[0]?.toUpperCase() ||
                                                            "?"}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-neutral-100">
                                                            {request.profile
                                                                ?.full_name ||
                                                                "Użytkownik"}
                                                        </p>
                                                        <p className="text-xs text-neutral-500">
                                                            Oczekuje na
                                                            odpowiedź
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        rejectRequest(
                                                            request.id
                                                        )
                                                    }
                                                    className="px-3 py-1.5 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 transition-colors text-xs"
                                                >
                                                    Anuluj
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
