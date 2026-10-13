import type { FC } from "react";
import { ClipboardCheck, Copy06, Edit05, LinkBroken01, PackageX, RefreshCw01, Repeat04, Scan, Truck01 } from "@untitledui/icons";
import { daysOfCover } from "@/lib/selectors";
import type { ApprovalType, Variant } from "@/lib/types";

export const approvalTypeMeta: Record<ApprovalType, { label: string; icon: FC<{ className?: string }>; tone: string }> = {
    reorder: { label: "Reorder suggestion", icon: Repeat04, tone: "bg-blue-50 text-blue-600" },
    count_variance: { label: "Count variance", icon: ClipboardCheck, tone: "bg-orange-50 text-orange-600" },
    adjustment: { label: "Adjustment", icon: Edit05, tone: "bg-orange-50 text-orange-600" },
    unexpected_item: { label: "Unexpected item", icon: Scan, tone: "bg-purple-50 text-purple-600" },
    partial_po: { label: "Partial PO", icon: PackageX, tone: "bg-purple-50 text-purple-600" },
    mismatch: { label: "Mismatch", icon: RefreshCw01, tone: "bg-red-50 text-red-600" },
    import_duplicate: { label: "Import duplicate", icon: Copy06, tone: "bg-gray-100 text-gray-700" },
    sync_failure: { label: "Blocked push / sync", icon: LinkBroken01, tone: "bg-red-50 text-red-600" },
    transfer_request: { label: "Store transfer", icon: Truck01, tone: "bg-indigo-50 text-indigo-600" },
};

export type ApprovalGroup = "all" | "reorder" | "transfers" | "counts" | "receiving" | "mismatch" | "import" | "sync";

export const approvalGroups: { id: ApprovalGroup; label: string; types: ApprovalType[] }[] = [
    { id: "all", label: "All", types: [] },
    { id: "reorder", label: "Reorder suggestions", types: ["reorder"] },
    { id: "transfers", label: "Store transfers", types: ["transfer_request"] },
    { id: "counts", label: "Counts & adjustments", types: ["count_variance", "adjustment"] },
    { id: "receiving", label: "Receiving exceptions", types: ["unexpected_item", "partial_po"] },
    { id: "mismatch", label: "Reconciliation mismatches", types: ["mismatch"] },
    { id: "import", label: "Import duplicates", types: ["import_duplicate"] },
    { id: "sync", label: "Blocked pushes & sync failures", types: ["sync_failure"] },
];

export const inGroup = (group: ApprovalGroup, type: ApprovalType) => group === "all" || approvalGroups.find((g) => g.id === group)!.types.includes(type);

/* ------------------------------------------------------------------ */
/* Reordering (PRD §5.8)                                               */
/* ------------------------------------------------------------------ */

export type ReorderStatus = "reorder" | "watch" | "ok";

export const reorderStatusMeta: Record<ReorderStatus, { label: string; color: "error" | "warning" | "success" }> = {
    reorder: { label: "Reorder now", color: "error" },
    watch: { label: "Watch", color: "warning" },
    ok: { label: "OK", color: "success" },
};

const DAY = 24 * 60 * 60 * 1000;

/** Sales speed, days of cover and run-out projection for one variant at its warehouse. */
export const reorderInfo = (variant: Variant, available: number) => {
    const cover = daysOfCover(available, variant.dailySales);
    const runOutDate = Number.isFinite(cover) ? new Date(Date.now() + Math.max(0, cover) * DAY).toISOString() : null;
    let status: ReorderStatus = "ok";
    if (available <= variant.reorderPoint || cover <= variant.leadTimeDays) status = "reorder";
    else if (cover <= variant.leadTimeDays + 7) status = "watch";
    return { cover, runOutDate, status };
};

export const formatDays = (days: number) => (Number.isFinite(days) ? `${days < 10 ? days.toFixed(1).replace(/\.0$/, "") : Math.round(days)} d` : "—");

/** "1 case", "3 cases", "2 boxes" — for units of measure. */
export const unitCount = (n: number, unit: string) => {
    const u = unit.toLowerCase();
    const plural = /(s|x|ch|sh)$/.test(u) ? `${u}es` : `${u}s`;
    return `${new Intl.NumberFormat("en-US").format(n)} ${n === 1 ? u : plural}`;
};
