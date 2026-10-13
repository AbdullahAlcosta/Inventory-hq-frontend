import type { Scope } from "@/hooks/use-session";
import type { Location, StoreRequest } from "@/lib/types";

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

/**
 * Sending side: pick, pack, ship. Anyone assigned to the source location (store or warehouse,
 * manager or associate), plus executives.
 */
export const canFulfil = (scope: Scope, r: StoreRequest) => scope.isExecutive || scope.locationIds.includes(r.sourceId);

/** Receiving side: confirm receipt. Staff assigned to the requesting store, plus executives. */
export const canConfirmReceipt = (scope: Scope, r: StoreRequest) => scope.isExecutive || scope.locationIds.includes(r.storeId);

/** New requests are opened for one store: the active location must be a store this person works at. */
export const canCreateRequest = (scope: Scope) => scope.activeLocation?.type === "store" && (scope.isExecutive || scope.locationIds.includes(scope.activeLocation.id));

/** True when stock moves between two stores rather than from a warehouse. */
export const isStoreToStore = (r: StoreRequest, locations: Location[]) => locations.find((l) => l.id === r.sourceId)?.type === "store";

/** Statuses the sending side still has to act on. */
export const OPEN_TO_FULFIL: StoreRequest["status"][] = ["requested", "picked", "packed"];
