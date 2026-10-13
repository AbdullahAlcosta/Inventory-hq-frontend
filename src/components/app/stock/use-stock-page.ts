"use client";

import { useScope } from "@/hooks/use-session";
import { useAppStore } from "@/store/app-store";

/** Page eyebrow: the active business unit (sidebar switcher), or "All business units". */
export const useActiveBuName = () => {
    const scope = useScope();
    const businessUnits = useAppStore((s) => s.businessUnits);
    const ids = scope?.activeBusinessUnitIds ?? [];
    return ids.length === 1 ? (businessUnits.find((b) => b.id === ids[0])?.name ?? "") : "All business units";
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
