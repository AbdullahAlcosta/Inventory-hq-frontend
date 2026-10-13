import type { Scope } from "@/hooks/use-session";
import type { StoreRequest } from "@/lib/types";

export const REQUEST_STATUSES = ["requested", "picked", "packed", "shipped", "confirmed"] as const;

export const requestSteps = [
    { id: "requested", label: "Requested" },
    { id: "picked", label: "Picked" },
    { id: "packed", label: "Packed" },
    { id: "shipped", label: "Shipped" },
    { id: "confirmed", label: "Confirmed" },
];

/** Request status labels without the "· In Transit" suffix, for steppers/timelines. */
export const requestStatusLabel = (s: string) => requestSteps.find((x) => x.id === s)?.label ?? s;

/** Warehouse side: pick, pack, ship. */
export const canWorkWarehouse = (scope: Scope, r: StoreRequest) => scope.locationIds.includes(r.sourceId) && (scope.isWarehouseLevel || scope.canManage);

/** Store side: confirm receipt. */
export const canWorkStore = (scope: Scope, r: StoreRequest) => scope.locationIds.includes(r.storeId) && (scope.isStoreLevel || scope.canManage);

/** Store-level users and managers/executives can open new requests. */
export const canCreateRequest = (scope: Scope) => scope.stores.length > 0 && (scope.isStoreLevel || scope.canManage);
