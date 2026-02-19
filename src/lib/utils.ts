import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Format seconds as mm:ss (e.g. 90 -> 01:30)
export function formatSeconds(seconds?: number | null) {
    if (seconds === null || seconds === undefined) return "-";
    const clamped = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(clamped / 60);
    const remainingSeconds = clamped % 60;
    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${pad(minutes)}:${pad(remainingSeconds)}`;
}
