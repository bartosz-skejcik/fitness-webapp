import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
    variable: "--font-inter-sans",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Fitness Tracker - Śledź swoje treningi",
    description: "Aplikacja do śledzenia treningów i postępów",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pl">
            <body className={`${inter.variable} antialiased`}>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
