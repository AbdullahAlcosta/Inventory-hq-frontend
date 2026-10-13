"use client";

import type { FC } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { CheckDone01, ChevronRight, Truck01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { LocationName } from "@/components/app/item-cell";
import { StatusBadge } from "@/components/app/status-badge";
import { approvalTypeMeta } from "@/components/app/approvals/approval-meta";
import type { Scope } from "@/hooks/use-session";
import { formatNumber, pluralize, timeAgo } from "@/lib/format";
import { canDecideApproval, totalOnHand } from "@/lib/selectors";
import type { Approval, StoreRequest } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

export interface QuickAction {
    label: string;
    description: string;
    href: string;
    icon: FC<{ className?: string }>;
}

export const QuickActions = ({ actions }: { actions: QuickAction[] }) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((a) => (
            <Link
                key={a.label}
                href={a.href}
                className="group flex items-center gap-3 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary outline-hidden transition duration-100 ease-linear hover:ring-gray-300 focus-visible:ring-2 focus-visible:ring-brand"
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white">
                    <a.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-primary">{a.label}</span>
                    <span className="block text-xs text-tertiary">{a.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-quaternary group-hover:text-fg-secondary" />
            </Link>
        ))}
    </div>
);

export const ViewAll = ({ href, label = "View all" }: { href: string; label?: string }) => (
    <Link href={href} className="text-sm font-semibold text-primary hover:underline">
        {label}
    </Link>
);

const requestUnits = (r: StoreRequest) => r.lines.reduce((s, l) => s + l.requestedQty, 0);

/**
 * Store requests as a compact list. `side` says which end we're looking from:
 * "incoming" (we asked for it — show the source) or "outgoing" (we fulfil it — show the requesting store).
 */
export const RequestList = ({ requests, empty, side }: { requests: StoreRequest[]; empty: string; side: "incoming" | "outgoing" }) =>
    requests.length === 0 ? (
        <Empty icon={Truck01} title={empty} />
    ) : (
        <ul className="divide-y divide-secondary">
            {requests.map((r) => (
                <li key={r.id}>
                    <Link href={`/replenishment/requests/view?id=${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-primary_hover md:px-6">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-primary">{r.number}</p>
                            <p className="truncate text-xs text-tertiary">
                                {side === "incoming" ? (
                                    <>
                                        From <LocationName id={r.sourceId} />
                                    </>
                                ) : (
                                    <>
                                        For <LocationName id={r.storeId} />
                                    </>
                                )}{" "}
                                · {pluralize(r.lines.length, "item")} · {formatNumber(requestUnits(r))} units · {timeAgo(r.createdAt)}
                            </p>
                        </div>
                        <StatusBadge status={r.status} size="sm" />
                    </Link>
                </li>
            ))}
        </ul>
    );

/** Pending approvals the user can decide, within the active business units (and, optionally, only at some locations). */
export const usePendingApprovals = (scope: Scope, locationIds?: string[]) => {
    const approvals = useAppStore((s) => s.approvals);
    return useMemo(() => {
        const locs = locationIds ? new Set(locationIds) : null;
        return approvals
            .filter(
                (a) =>
                    a.status === "pending" &&
                    scope.activeBusinessUnitIds.includes(a.businessUnitId) &&
                    canDecideApproval(scope.user, a, scope) &&
                    (!locs || (a.locationId !== null && locs.has(a.locationId))),
            )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [approvals, scope, locationIds?.join()]);
};

export const ApprovalsCard = ({ approvals, title = "Needs attention", description = "Top pending approvals." }: { approvals: Approval[]; title?: string; description?: string }) => (
    <Card title={title} description={description} flush actions={<ViewAll href="/approvals" />}>
        {approvals.length === 0 ? (
            <Empty icon={CheckDone01} title="All caught up" description="Nothing is waiting on a decision." />
        ) : (
            <ul className="divide-y divide-secondary">
                {approvals.slice(0, 6).map((a) => (
                    <li key={a.id}>
                        <Link href="/approvals" className="flex items-center gap-3 px-5 py-3 hover:bg-primary_hover md:px-6">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-tertiary">
                                    {approvalTypeMeta[a.type].label}
                                    {a.locationId && (
                                        <>
                                            {" · "}
                                            <LocationName id={a.locationId} />
                                        </>
                                    )}
                                </p>
                                <p className="truncate text-sm font-medium text-primary">{a.title}</p>
                            </div>
                            <span className="shrink-0 text-xs text-tertiary">{timeAgo(a.createdAt)}</span>
                            <ChevronRight className="size-4 shrink-0 text-fg-quaternary" />
                        </Link>
                    </li>
                ))}
            </ul>
        )}
    </Card>
);

export interface LocationMetrics {
    /** Sellable units. */
    available: number;
    /** On hand (all states) at cost. */
    value: number;
    /** Variants of this location's business unit at or below their reorder point. */
    low: number;
    /** Requests this store made that aren't confirmed yet. */
    requestsIn: StoreRequest[];
    /** Requests this location has to fulfil (pick/pack/ship). */
    requestsOut: StoreRequest[];
}

/** Per-location stock and request figures. */
export const useLocationMetrics = (locationIds: string[]) => {
    const stockLevels = useAppStore((s) => s.stockLevels);
    const variants = useAppStore((s) => s.variants);
    const products = useAppStore((s) => s.products);
    const locations = useAppStore((s) => s.locations);
    const storeRequests = useAppStore((s) => s.storeRequests);
    const key = locationIds.join();

    return useMemo(() => {
        const map = new Map<string, LocationMetrics>();
        locationIds.forEach((id) => map.set(id, { available: 0, value: 0, low: 0, requestsIn: [], requestsOut: [] }));
        const variantMap = new Map(variants.map((v) => [v.id, v]));
        const productBu = new Map(products.map((p) => [p.id, p.businessUnitId]));
        const locBu = new Map(locations.map((l) => [l.id, l.businessUnitId]));
        stockLevels.forEach((s) => {
            const m = map.get(s.locationId);
            if (!m) return;
            const v = variantMap.get(s.variantId);
            if (!v) return;
            m.available += s.available;
            m.value += totalOnHand(s) * v.cost;
            if (productBu.get(v.productId) === locBu.get(s.locationId) && s.available <= v.reorderPoint) m.low++;
        });
        const newestFirst = [...storeRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        newestFirst.forEach((r) => {
            if (r.status === "confirmed") return;
            map.get(r.storeId)?.requestsIn.push(r);
            if (r.status !== "shipped") map.get(r.sourceId)?.requestsOut.push(r);
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stockLevels, variants, products, locations, storeRequests, key]);
};
