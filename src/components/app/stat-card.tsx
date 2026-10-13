import type { FC, ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/utils/cx";

interface StatCardProps {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: FC<{ className?: string }>;
    href?: string;
    tone?: "default" | "warning" | "error" | "success";
}

const toneClass = {
    default: "bg-gray-100 text-gray-700",
    warning: "bg-orange-50 text-orange-600",
    error: "bg-red-50 text-red-600",
    success: "bg-green-50 text-green-600",
};

export const StatCard = ({ label, value, hint, icon: Icon, href, tone = "default" }: StatCardProps) => {
    const body = (
        <div className="flex h-full items-start justify-between gap-3 rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary transition duration-100 ease-linear group-hover:ring-gray-300">
            <div className="min-w-0">
                <p className="text-sm font-medium text-tertiary">{label}</p>
                <p className="mt-2 text-display-xs font-semibold text-primary">{value}</p>
                {hint && <p className="mt-1 text-sm text-tertiary">{hint}</p>}
            </div>
            {Icon && (
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", toneClass[tone])}>
                    <Icon className="size-5" />
                </span>
            )}
        </div>
    );
    return href ? (
        <Link href={href} className="group block outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-2xl">
            {body}
        </Link>
    ) : (
        body
    );
};
