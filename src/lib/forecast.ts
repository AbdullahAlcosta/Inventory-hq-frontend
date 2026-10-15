/**
 * Reorder forecasting (PRD §5.8). Pure — takes data as arguments so the backend can reuse it.
 */
import type { Product, PurchaseOrder, Variant } from "@/lib/types";

/** Days of stock to order beyond the vendor lead time when a variant doesn't set its own. */
export const DEFAULT_COVER_DAYS = 14;

/** PO statuses that still bring stock in (not yet fully received). */
export const OPEN_PO_STATUSES: PurchaseOrder["status"][] = ["created", "sent", "receiving"];

/** Units still expected on open POs for one variant delivered to one destination. */
export const unitsOnOrder = (purchaseOrders: PurchaseOrder[], variantId: string, destinationId: string, unitsPerPurchaseUnit: number) =>
    purchaseOrders
        .filter((po) => po.warehouseId === destinationId && OPEN_PO_STATUSES.includes(po.status))
        .flatMap((po) => po.lines)
        .filter((l) => l.variantId === variantId)
        .reduce((sum, l) => sum + Math.max(0, l.orderedQty * unitsPerPurchaseUnit - l.receivedUnits), 0);

export interface ForecastResult {
    /** At/below minimum qty, or projected to run out before the vendor can deliver. */
    needsOrder: boolean;
    dailyDemand: number;
    /** Units needed after counting stock and open POs (before rounding to cases). */
    neededUnits: number;
    /** Purchase units (cases) to order — 0 when nothing is needed. */
    cases: number;
    /** Selling units the cases add up to. */
    units: number;
    runOutDate: string | null;
    reason: string;
}

/**
 * How much to order for one variant at one destination.
 * need = daily demand × (lead time + cover days) + minimum qty − available − already on open POs,
 * rounded up to whole purchase units (cases).
 */
export const forecastOrder = (variant: Variant, product: Product, available: number, onOrder: number, today = new Date()): ForecastResult => {
    const upp = Math.max(1, product.uom.unitsPerPurchaseUnit);
    const demand = Math.max(0, variant.dailySales);
    const coverDays = variant.coverDays ?? DEFAULT_COVER_DAYS;
    const minQty = variant.reorderPoint;
    const position = available + onOrder;
    const daysLeft = demand > 0 ? available / demand : Infinity;
    const runOutDate = Number.isFinite(daysLeft) ? new Date(today.getTime() + daysLeft * 86_400_000).toISOString() : null;

    const belowMin = position <= minQty;
    const runsOutFirst = demand > 0 && position / demand <= variant.leadTimeDays;
    const needsOrder = belowMin || runsOutFirst;
    const neededUnits = Math.max(0, Math.ceil(demand * (variant.leadTimeDays + coverDays) + minQty - position));
    const cases = needsOrder ? Math.max(1, Math.ceil(neededUnits / upp)) : 0;

    const parts = [`${demand.toFixed(1)}/day × (${variant.leadTimeDays} d lead + ${coverDays} d cover) + min ${minQty} − ${available} available`];
    if (onOrder) parts.push(`− ${onOrder} on open POs`);
    const reason = !needsOrder
        ? onOrder && available <= minQty
            ? `Covered by ${onOrder} units already on order.`
            : "Above minimum qty."
        : `${belowMin ? "At/below minimum qty" : "Runs out before delivery"}: ${parts.join(" ")} = ${neededUnits} units → ${cases} × ${upp}.`;

    return { needsOrder, dailyDemand: demand, neededUnits, cases, units: cases * upp, runOutDate, reason };
};
