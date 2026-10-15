"use client";

import { useMemo } from "react";
import type { Scope } from "@/hooks/use-session";
import type { ChannelConnection, ComplianceFlag, Mismatch } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

export const complianceFlags: { id: ComplianceFlag; label: string }[] = [
    { id: "nicotine", label: "Nicotine" },
    { id: "tobacco", label: "Tobacco" },
    { id: "vape", label: "Vape" },
    { id: "age_21", label: "21+ only" },
    { id: "hemp", label: "Hemp" },
    { id: "lithium_battery", label: "Lithium battery" },
];
export const flagLabel = (f: ComplianceFlag) => complianceFlags.find((x) => x.id === f)?.label ?? f;

export const scheduleOptions = ["Every 15 minutes", "Every 30 minutes", "Hourly", "Twice daily · 6:00 AM & 6:00 PM", "Daily · 6:00 AM"];

export const sourceLabel: Record<Mismatch["source"], string> = {
    scheduled_pull: "Scheduled pull",
    manual_pull: "Manual pull",
    upload: "Upload",
};

export const syncLabel = (c: Pick<ChannelConnection, "syncMode" | "schedule">) => (c.syncMode === "live" ? "Live" : c.schedule);

/** Eyebrow text: the active business unit, or "All brands". */
export const useEyebrow = (scope: Scope) => {
    const businessUnits = useAppStore((s) => s.businessUnits);
    if (scope.activeBusinessUnitIds.length === 1) return businessUnits.find((b) => b.id === scope.activeBusinessUnitIds[0])?.name ?? "";
    return "All brands";
};

/**
 * Connections the user may see: in an active business unit, and — for managers —
 * selling from one of their locations (or BU-level in one of their BUs).
 */
export const useScopedConnections = (scope: Scope) => {
    const connections = useAppStore((s) => s.connections);
    return useMemo(
        () =>
            connections.filter(
                (c) =>
                    scope.activeBusinessUnitIds.includes(c.businessUnitId) &&
                    (scope.isExecutive || c.level === "business_unit" || (c.locationId !== null && scope.activeLocationIds.includes(c.locationId))),
            ),
        [connections, scope],
    );
};
