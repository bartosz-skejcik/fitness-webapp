import React from "react";

type Props = {
    icon: React.ReactNode;
    title: string;
    buttons?: React.ReactNode[];
};

export default function Header({ icon, title, buttons }: Props) {
    return (
        <header className="bg-white shadow-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {icon}
                        <h1 className="text-md font-semibold text-gray-900">
                            {title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">{buttons}</div>
                </div>
            </div>
        </header>
    );
}
