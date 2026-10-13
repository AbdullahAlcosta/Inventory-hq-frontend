"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ClockRewind } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import type { Scope } from "@/hooks/use-session";
import { formatSigned, timeAgo } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

/** Last few audit entries in the user's scope (on one location: only what happened there). */
export const RecentActivity = ({ scope, limit = 8 }: { scope: Scope; limit?: number }) => {
    const activity = useAppStore((s) => s.activity);
    const employees = useAppStore((s) => s.employees);

    const entries = useMemo(() => {
        const companyPeople = new Set(employees.filter((e) => e.companyId === scope.companyId).map((e) => e.id));
        return activity
            .filter((a) => (a.locationId ? scope.activeLocationIds.includes(a.locationId) : !scope.activeLocation && scope.canManage && companyPeople.has(a.by)))
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, limit);
    }, [activity, employees, scope, limit]);

    return (
        <Card
            title="Recent activity"
            flush
            actions={
                scope.canManage && (
                    <Link href="/stock/activity" className="text-sm font-semibold text-primary hover:underline">
                        Activity log
                    </Link>
                )
            }
        >
            {entries.length === 0 ? (
                <Empty icon={ClockRewind} title="No activity yet" />
            ) : (
                <ul className="divide-y divide-secondary">
                    {entries.map((a) => (
                        <li key={a.id} className="flex items-start gap-3 px-5 py-3 md:px-6">
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gray-300" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-primary">{a.message}</p>
                                <p className="text-xs text-tertiary">
                                    <EmployeeName id={a.by} />
                                    {a.locationId && (
                                        <>
                                            {" · "}
                                            <LocationName id={a.locationId} />
                                        </>
                                    )}
                                    {" · "}
                                    {timeAgo(a.at)}
                                </p>
                            </div>
                            {typeof a.quantity === "number" && a.quantity !== 0 && (
                                <span className={cx("shrink-0 text-sm font-semibold tabular-nums", a.quantity > 0 ? "text-success-primary" : "text-error-primary")}>
                                    {formatSigned(a.quantity)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
};
