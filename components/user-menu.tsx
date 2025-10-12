"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, ChevronDown, Users } from "lucide-react";
import Link from "next/link";

export default function UserMenu() {
    const { user, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [userName, setUserName] = useState<string>("");
    const [avatar, setAvatar] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Get user name from user metadata
        if (user) {
            const fullName =
                user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                "Użytkownik";
            setUserName(fullName);
            setAvatar(user.user_metadata?.avatar_url || null);
        }
    }, [user]);

    useEffect(() => {
        // Close dropdown when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!user) return null;

    // Get initials for avatar
    const getInitials = (name: string) => {
        const parts = name.trim().split(" ");
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 hover:bg-neutral-900 rounded-lg px-3 transition-colors"
            >
                {avatar ? (
                    <img
                        src={avatar}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs">
                        {getInitials(userName)}
                    </div>
                )}
                <span className="text-neutral-200 text-sm font-medium hidden sm:inline">
                    {userName}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform hidden sm:block ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-neutral-800">
                        <p className="text-sm font-semibold text-neutral-100">
                            {userName}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                            {user.email}
                        </p>
                    </div>

                    <div className="py-1">
                        <Link
                            href="/friends"
                            className="w-full px-4 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                        >
                            <Users className="w-4 h-4" />
                            Znajomi
                        </Link>
                    </div>
                    <div className="py-1">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                signOut();
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Wyloguj
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
