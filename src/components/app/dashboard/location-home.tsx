"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, CoinsStacked01, LayersThree01, PackageCheck, PackageSearch, Scan, ShoppingCart01, Truck01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import type { Scope } from "@/hooks/use-session";
import { formatCompactCurrency, formatCurrency, formatNumber, pluralize, timeAgo } from "@/lib/format";
import type { Location, PurchaseOrder, StoreRequest } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { ApprovalsCard, QuickActions, RequestList, ViewAll, useLocationMetrics, usePendingApprovals } from "./dashboard-parts";
import { RecentActivity } from "./recent-activity";
import { SalesChart } from "./sales-chart";

const EMPTY: StoreRequest[] = [];

/** One store, picked in the Location switcher (associates and managers). */
export const StoreHome = ({ scope, store }: { scope: Scope; store: Location }) => {
    const metrics = useLocationMetrics([store.id]).get(store.id);
    const pending = usePendingApprovals(scope, [store.id]);

    const incoming = metrics?.requestsIn ?? EMPTY;
    const toFulfil = metrics?.requestsOut ?? EMPTY;
    const shipped = incoming.filter((r) => r.status === "shipped");
    const open = incoming.filter((r) => r.status !== "shipped");
    const value = metrics?.value ?? 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <StatCard label="Available units" value={formatNumber(metrics?.available ?? 0)} icon={LayersThree01} href="/stock/inventory" hint="Sellable stock here" />
                <StatCard label="Inventory value" value={formatCompactCurrency(value)} icon={CoinsStacked01} hint={`${formatCurrency(value)} at cost`} />
                <StatCard
                    label="Low stock items"
                    value={metrics?.low ?? 0}
                    icon={AlertTriangle}
                    tone={metrics?.low ? "error" : "default"}
                    href="/stock/inventory"
                    hint="At or below reorder point"
                />
                <StatCard
                    label="Deliveries to confirm"
                    value={shipped.length}
                    icon={PackageCheck}
                    tone={shipped.length ? "warning" : "default"}
                    href="/replenishment/requests"
                    hint="Shipped · in transit"
                />
                <StatCard label="Open requests" value={open.length} icon={Truck01} href="/replenishment/requests" hint="Requested, not shipped yet" />
                <StatCard
                    label="Requests to fulfil"
                    value={toFulfil.length}
                    icon={ShoppingCart01}
                    tone={toFulfil.length ? "warning" : "default"}
                    href="/replenishment/requests"
                    hint="Other stores asked us"
                />
            </div>

            <QuickActions
                actions={[
                    { label: "Request stock", description: "Ask the warehouse or a store to send items", href: "/replenishment/requests/new", icon: Truck01 },
                    { label: "Product lookup", description: "Find stock at every location", href: "/stock/lookup", icon: PackageSearch },
                    { label: "Stock control", description: "Count shelves or adjust stock", href: "/stock/control", icon: ClipboardCheck },
                    {
                        label: "Confirm delivery",
                        description: shipped.length ? `${pluralize(shipped.length, "shipment")} arrived?` : "Nothing in transit",
                        href: shipped[0] ? `/replenishment/requests/view?id=${shipped[0].id}` : "/replenishment/requests",
                        icon: PackageCheck,
                    },
                ]}
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="min-w-0 xl:col-span-2">
                    <SalesChart storeIds={[store.id]} description={`Revenue at ${store.name}, last 30 days.`} />
                </div>
                {scope.canManage ? (
                    <ApprovalsCard approvals={pending} title="Pending approvals" description={`Waiting on a decision at ${store.name}.`} />
                ) : (
                    <Card title="Incoming deliveries" flush actions={<ViewAll href="/replenishment/requests" />}>
                        <RequestList requests={shipped.slice(0, 6)} empty="Nothing in transit" side="incoming" />
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card title="Our requests" description="Stock this store asked for." flush actions={<ViewAll href="/replenishment/requests" />}>
                    <RequestList requests={incoming.slice(0, 6)} empty="No open requests" side="incoming" />
                </Card>
                <Card title="To fulfil" description="Other stores asked us for stock." flush actions={<ViewAll href="/replenishment/requests" />}>
                    <RequestList requests={toFulfil.slice(0, 6)} empty="Nothing to send" side="outgoing" />
                </Card>
            </div>

            <RecentActivity scope={scope} limit={8} />
        </div>
    );
};

/** One warehouse, picked in the Location switcher. */
export const WarehouseHome = ({ scope, warehouse }: { scope: Scope; warehouse: Location }) => {
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const vendors = useAppStore((s) => s.vendors);
    const metrics = useLocationMetrics([warehouse.id]).get(warehouse.id);
    const pending = usePendingApprovals(scope, [warehouse.id]);

    const toReceive = useMemo(
        () => purchaseOrders.filter((p) => p.warehouseId === warehouse.id && (p.status === "sent" || p.status === "receiving")),
        [purchaseOrders, warehouse.id],
    );
    // Oldest first: that's the order to work them in.
    const queue = useMemo(() => [...(metrics?.requestsOut ?? EMPTY)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [metrics]);
    const count = (s: StoreRequest["status"]) => queue.filter((r) => r.status === s).length;
    const units = (p: PurchaseOrder) => p.lines.reduce((s, l) => s + l.orderedQty, 0);
    const value = metrics?.value ?? 0;
    const low = metrics?.low ?? 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <StatCard
                    label="POs to receive"
                    value={toReceive.length}
                    icon={Scan}
                    tone={toReceive.length ? "warning" : "default"}
                    href={scope.canSeePurchasing ? "/purchasing/receiving" : undefined}
                />
                <StatCard label="To pick" value={count("requested")} icon={Truck01} href="/replenishment/requests" />
                <StatCard label="To pack" value={count("picked")} icon={PackageCheck} href="/replenishment/requests" />
                <StatCard label="To ship" value={count("packed")} icon={Truck01} href="/replenishment/requests" />
                <StatCard
                    label="Reorder needed"
                    value={low}
                    icon={AlertTriangle}
                    tone={low ? "error" : "default"}
                    href={scope.canManagePurchasing ? "/purchasing/reorder" : "/stock/inventory"}
                    hint="At or below reorder point"
                />
                <StatCard label="Inventory value" value={formatCompactCurrency(value)} icon={CoinsStacked01} hint={`${formatCurrency(value)} at cost`} />
            </div>

            <QuickActions
                actions={[
                    ...(scope.canSeePurchasing ? [{ label: "Receive a delivery", description: "Scan a vendor shipment in", href: "/purchasing/receiving", icon: Scan }] : []),
                    { label: "Store requests", description: "Pick, pack and ship", href: "/replenishment/requests", icon: Truck01 },
                    { label: "Stock control", description: "Count a section or adjust stock", href: "/stock/control", icon: ClipboardCheck },
                    { label: "Product lookup", description: "Find stock at every location", href: "/stock/lookup", icon: PackageSearch },
                ]}
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card title="Store requests to work" description="Oldest first." flush actions={<ViewAll href="/replenishment/requests" />}>
                    <RequestList requests={queue.slice(0, 8)} empty="No requests waiting" side="outgoing" />
                </Card>
                <Card title="POs to receive" flush actions={scope.canSeePurchasing ? <ViewAll href="/purchasing/receiving" label="Receiving" /> : undefined}>
                    {toReceive.length === 0 ? (
                        <Empty icon={ShoppingCart01} title="Nothing to receive" description="Purchase orders show here once they're sent to the vendor." />
                    ) : (
                        <ul className="divide-y divide-secondary">
                            {toReceive.map((p) => (
                                <li key={p.id}>
                                    <Link href={`/purchasing/receiving/view?id=${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-primary_hover md:px-6">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-primary">{p.number}</p>
                                            <p className="truncate text-xs text-tertiary">
                                                {vendors.find((v) => v.id === p.vendorId)?.name ?? "Vendor"} · {pluralize(p.lines.length, "line")} · {formatNumber(units(p))} cases
                                                {p.sentAt ? ` · sent ${timeAgo(p.sentAt)}` : ""}
                                            </p>
                                        </div>
                                        <StatusBadge status={p.status} size="sm" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {scope.canManage ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <ApprovalsCard approvals={pending} title="Pending approvals" description={`Waiting on a decision at ${warehouse.name}.`} />
                    <RecentActivity scope={scope} limit={6} />
                </div>
            ) : (
                <RecentActivity scope={scope} limit={8} />
            )}
        </div>
    );
};
