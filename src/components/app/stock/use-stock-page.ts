"use client";

import { useScope } from "@/hooks/use-session";
import { useAppStore } from "@/store/app-store";

/** Page eyebrow: the active business unit (sidebar switcher), or "All brands". */
export const useActiveBuName = () => {
    const scope = useScope();
    const businessUnits = useAppStore((s) => s.businessUnits);
    const ids = scope?.activeBusinessUnitIds ?? [];
    return ids.length === 1 ? (businessUnits.find((b) => b.id === ids[0])?.name ?? "") : "All brands";
};

/** Page eyebrow for location-aware pages: the picked location, its business unit, or "All locations". */
export const useActiveContextName = () => {
    const scope = useScope();
    const businessUnits = useAppStore((s) => s.businessUnits);
    if (!scope) return "";
    if (scope.activeLocation) return `${scope.activeLocation.name} · ${scope.activeLocation.type === "store" ? "Store" : "Warehouse"}`;
    if (scope.context.startsWith("bu:")) return businessUnits.find((b) => b.id === scope.context.slice(3))?.name ?? "";
    return "All locations";
};

/** Downloads rows as a CSV file in the browser. */
export const downloadCsv = (fileName: string, rows: (string | number | null | undefined)[][]) => {
    const escape = (v: string | number | null | undefined) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
