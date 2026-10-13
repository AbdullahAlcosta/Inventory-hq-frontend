import { daysOfCover } from "@/lib/selectors";
import type { Location, StockState, Variant } from "@/lib/types";

export const stateLabels: Record<StockState, string> = {
    available: "Available",
    inTransit: "In Transit",
    returns: "Returns",
    damaged: "Damaged",
};

export const reasonLabels: Record<string, string> = {
    damaged: "Damaged",
    expired: "Expired",
    lost: "Lost / missing",
    found: "Found extra",
    state_change: "State change",
    other: "Other",
};

/**
 * Sales speed at one location. `variant.dailySales` is the chain-wide rate:
 * a warehouse feeds every store so it uses the full rate, a store gets its share.
 */
export const dailySalesAt = (variant: Variant, location: Location, storesInBu: number) =>
    location.type === "warehouse" ? variant.dailySales : variant.dailySales / Math.max(1, storesInBu);

export const coverAt = (variant: Variant, location: Location, available: number, storesInBu: number) =>
    daysOfCover(available, dailySalesAt(variant, location, storesInBu));

/** Warehouse: at or below reorder point. Store: less than 3 days of cover (or 2 units or fewer). */
export const isLowStock = (variant: Variant, location: Location, available: number, storesInBu: number) => {
    if (location.type === "warehouse") return available <= variant.reorderPoint;
    return available <= 2 || coverAt(variant, location, available, storesInBu) < 3;
};

export const formatCover = (days: number) => {
    if (!Number.isFinite(days)) return "—";
    if (days < 1) return "< 1 day";
    if (days >= 100) return "99+ days";
    return `${Math.floor(days)} days`;
};

/** Select items for a location picker, stores first then warehouses. */
export const locationItems = (locations: Location[]) =>
    [...locations]
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "store" ? -1 : 1))
        .map((l) => ({ id: l.id, label: l.name, supportingText: l.type === "store" ? "Store" : "Warehouse" }));

export const signedClass = (n: number) => (n > 0 ? "text-success-primary" : n < 0 ? "text-error-primary" : "text-tertiary");
