"use client";

import { useState } from "react";
import { AlertTriangle } from "@untitledui/icons";
import { LocationName } from "@/components/app/item-cell";
import { ConfirmDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { pluralize } from "@/lib/format";
import type { Approval, ApprovalType } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { approvalTypeMeta } from "./approval-meta";

export const ApprovalTypeCell = ({ type }: { type: ApprovalType }) => {
    const meta = approvalTypeMeta[type];
    return (
        <span className="flex items-center gap-2.5 whitespace-nowrap">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                <meta.icon className="size-4" />
            </span>
            <span className="text-sm font-medium text-secondary">{meta.label}</span>
        </span>
    );
};

/** Floating action bar for bulk-approving reorder suggestions ("4 invoices selected · Bulk Send"). */
export const BulkReorderBar = ({ approvals, onClear, onDone }: { approvals: Approval[]; onClear: () => void; onDone: (poIds: string[]) => void }) => {
    const [confirming, setConfirming] = useState(false);
    const vendors = useAppStore((s) => s.vendors);
    const approveReorders = useAppStore((s) => s.approveReorders);

    const reorders = approvals.flatMap((a) => (a.payload.type === "reorder" ? [{ approval: a, payload: a.payload }] : []));
    const withVendor = reorders.filter((r) => r.payload.vendorId && vendors.some((v) => v.id === r.payload.vendorId));
    const noVendor = reorders.length - withVendor.length;

    // One PO per vendor + destination warehouse (PRD §5.8).
    const groups = new Map<string, { vendorId: string; warehouseId: string; count: number }>();
    withVendor.forEach(({ payload }) => {
        const key = `${payload.vendorId}|${payload.warehouseId}`;
        const g = groups.get(key) ?? { vendorId: payload.vendorId!, warehouseId: payload.warehouseId, count: 0 };
        g.count++;
        groups.set(key, g);
    });

    if (!approvals.length) return null;

    return (
        <>
            <div className="fixed inset-x-4 bottom-4 z-40 flex justify-center lg:left-72">
                <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-white shadow-xl duration-200 animate-in fade-in slide-in-from-bottom-2 sm:px-5">
                    <p className="text-sm font-semibold">
                        {pluralize(approvals.length, "suggestion")} selected
                        <button className="ml-3 text-sm font-medium text-white/60 hover:text-white" onClick={onClear}>
                            Clear
                        </button>
                    </p>
                    <Button size="md" color="secondary" onPress={() => setConfirming(true)}>
                        Approve {approvals.length}
                        <span className="hidden sm:inline">&nbsp;{approvals.length === 1 ? "suggestion" : "suggestions"}</span>
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirming}
                onOpenChange={setConfirming}
                title={`Approve ${pluralize(approvals.length, "suggestion")}?`}
                description={`This creates ${pluralize(groups.size, "purchase order")} — one per vendor and warehouse — using each suggested quantity.`}
                confirmLabel={`Create ${pluralize(groups.size, "PO")}`}
                typeToConfirm="Approve All"
                onConfirm={() => {
                    const ids = approveReorders(withVendor.map((r) => ({ approvalId: r.approval.id, quantity: r.payload.suggestedQty })));
                    const numbers = useAppStore
                        .getState()
                        .purchaseOrders.filter((po) => ids.includes(po.id))
                        .map((po) => po.number);
                    toast.success(`${pluralize(ids.length, "purchase order")} created`, numbers.join(", "));
                    onDone(ids);
                }}
            >
                <ul className="divide-y divide-secondary rounded-xl ring-1 ring-secondary">
                    {Array.from(groups.values()).map((g) => (
                        <li key={`${g.vendorId}|${g.warehouseId}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                            <span className="min-w-0">
                                <span className="block truncate font-medium text-primary">{vendors.find((v) => v.id === g.vendorId)?.name}</span>
                                <span className="block truncate text-xs text-tertiary">
                                    to <LocationName id={g.warehouseId} />
                                </span>
                            </span>
                            <span className="shrink-0 text-tertiary">{pluralize(g.count, "item")}</span>
                        </li>
                    ))}
                </ul>
                {noVendor > 0 && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-warning-primary">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        {pluralize(noVendor, "item")} {noVendor === 1 ? "has" : "have"} no default vendor and will stay pending.
                    </p>
                )}
            </ConfirmDialog>
        </>
    );
};
