import React from "react";

type Props = {
    icon: React.ReactNode;
    title: string;
    buttons?: React.ReactNode[];
};

export default function Header({ icon, title, buttons }: Props) {
    return (
        <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h1 className="text-sm font-semibold text-neutral-100">
                            {title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">{buttons}</div>
                </div>
            </div>
        </header>
    );
}
