"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Repeat04 } from "@untitledui/icons";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { type Scope, useScope } from "@/hooks/use-session";
import { formatNumber } from "@/lib/format";
import { forecastOrder, unitsOnOrder } from "@/lib/forecast";
import { stockAt } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";

/** Items at warehouses in the active brand(s) that need ordering, with forecast quantities. */
export const useAutoReorderPreview = (scope: Scope) => {
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const locations = useAppStore((s) => s.locations);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    return useMemo(
        () =>
            variants.flatMap((v) => {
                const product = products.find((p) => p.id === v.productId);
                if (!product || product.status !== "active" || !scope.activeBusinessUnitIds.includes(product.businessUnitId)) return [];
                return locations
                    .filter((l) => l.type === "warehouse" && l.businessUnitId === product.businessUnitId)
                    .flatMap((wh) => {
                        const fc = forecastOrder(v, product, stockAt({ stockLevels }, v.id, wh.id).available, unitsOnOrder(purchaseOrders, v.id, wh.id, product.uom.unitsPerPurchaseUnit));
                        return fc.needsOrder ? [{ variant: v, product, warehouse: wh, forecast: fc }] : [];
                    });
            }),
        [variants, products, locations, stockLevels, purchaseOrders, scope.activeBusinessUnitIds],
    );
};

const modeText = {
    off: "Automatic reorders are off — nothing is suggested or ordered.",
    suggest: "Suggestions go to Approvals. Run now to create the draft POs straight away instead.",
    auto_draft: "Draft POs are created automatically when you sign in. Nothing is sent until someone marks it sent.",
} as const;

/** Banner: what's below minimum and what auto-reorder would order. */
export const AutoReorderPanel = ({ scope }: { scope: Scope }) => {
    const rows = useAutoReorderPreview(scope);
    const runAutoReorder = useAppStore((s) => s.runAutoReorder);
    const router = useRouter();
    const withVendor = rows.filter((r) => r.variant.vendorId);
    const cases = withVendor.reduce((n, r) => n + r.forecast.cases, 0);
    const pos = new Set(withVendor.map((r) => `${r.variant.vendorId}|${r.warehouse.id}`)).size;

    const run = () => {
        const ids = runAutoReorder(scope.companyId);
        if (!ids.length) return toast.success("Nothing to reorder", "Every item is above its minimum qty or already on order.");
        toast.success(`${ids.length} draft PO${ids.length === 1 ? "" : "s"} created`, "Review them, then mark each as sent.");
        router.push("/purchasing/orders");
    };

    return (
        <div className="mb-5 flex flex-col gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary md:flex-row md:items-center md:justify-between md:p-5">
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Repeat04 className="size-5 text-fg-secondary" aria-hidden="true" />
                </span>
                <div>
                    <p className="text-md font-semibold text-primary">
                        Auto-reorder ·{" "}
                        {rows.length === 0
                            ? "nothing below minimum qty"
                            : `${formatNumber(rows.length)} item${rows.length === 1 ? "" : "s"} below minimum → ${formatNumber(cases)} case${cases === 1 ? "" : "s"} on ${pos} PO${pos === 1 ? "" : "s"}`}
                    </p>
                    <p className="mt-0.5 text-sm text-tertiary">
                        {modeText[scope.autoPO]}
                        {rows.length > withVendor.length && ` ${rows.length - withVendor.length} item(s) have no vendor and are skipped.`}
                    </p>
                </div>
            </div>
            {scope.canManagePurchasing && scope.autoPO !== "off" && (
                <Button size="md" iconLeading={Repeat04} isDisabled={withVendor.length === 0} onPress={run}>
                    Run auto-reorder now
                </Button>
            )}
        </div>
    );
};

/** Once per browser session per company: in "auto_draft" mode, create draft POs on app load. */
export const useAutoReorderOnLoad = () => {
    const scope = useScope();
    const runAutoReorder = useAppStore((s) => s.runAutoReorder);
    const companyId = scope?.companyId;
    const mode = scope?.autoPO;
    const allowed = scope?.canManagePurchasing;
    useEffect(() => {
        if (!companyId || mode !== "auto_draft" || !allowed) return;
        const key = `ihq-auto-reorder:${companyId}`;
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, new Date().toISOString());
        } catch {
            /* storage unavailable — still run once for this mount */
        }
        const ids = runAutoReorder(companyId);
        if (ids.length) toast.success(`Auto-reorder created ${ids.length} draft PO${ids.length === 1 ? "" : "s"}`, "Find them in Purchase Orders → Created.");
    }, [companyId, mode, allowed, runAutoReorder]);
};
