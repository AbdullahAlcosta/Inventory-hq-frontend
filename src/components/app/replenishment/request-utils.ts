import type { Scope } from "@/hooks/use-session";
import type { Location, StoreRequest } from "@/lib/types";

export const REQUEST_STATUSES = ["pending_approval", "requested", "picked", "packed", "shipped", "confirmed", "rejected"] as const;

export const requestSteps = [
    { id: "requested", label: "Requested" },
    { id: "picked", label: "Picked" },
    { id: "packed", label: "Packed" },
    { id: "shipped", label: "Shipped" },
    { id: "confirmed", label: "Confirmed" },
];

/** Store-to-store transfers get an extra first step: the warehouse manager's approval. */
export const transferSteps = [{ id: "pending_approval", label: "Warehouse approval" }, ...requestSteps];

/** Request status labels without the "· In Transit" suffix, for steppers/timelines. */
export const requestStatusLabel = (s: string) => (s === "rejected" ? "Rejected" : (transferSteps.find((x) => x.id === s)?.label ?? s));

/**
 * Sending side: pick, pack, ship. The manager of the source location (the warehouse manager for
 * warehouse requests; the sending store's manager for an approved store transfer), plus executives.
 */
export const canFulfil = (scope: Scope, r: StoreRequest) => scope.isExecutive || (scope.isManager && scope.locationIds.includes(r.sourceId));

/** Receiving side: confirm receipt. Staff assigned to the requesting store, plus executives. */
export const canConfirmReceipt = (scope: Scope, r: StoreRequest) => scope.isExecutive || scope.locationIds.includes(r.storeId);

/** New requests are opened for one store: the active location must be a store this person works at. */
export const canCreateRequest = (scope: Scope) => scope.activeLocation?.type === "store" && (scope.isExecutive || scope.locationIds.includes(scope.activeLocation.id));

/** True when stock moves between two stores rather than from a warehouse. */
export const isStoreToStore = (r: StoreRequest, locations: Location[]) => locations.find((l) => l.id === r.sourceId)?.type === "store";

/** Statuses the sending side still has to act on. */
export const OPEN_TO_FULFIL: StoreRequest["status"][] = ["requested", "picked", "packed"];

/** Store transfers waiting on the warehouse manager's decision. */
export const isAwaitingApproval = (r: StoreRequest) => r.status === "pending_approval";
