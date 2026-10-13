"use client";

import type { FC } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, LayersThree01, PackageCheck, PackageSearch, Scan, ShoppingCart01, Truck01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { LocationName } from "@/components/app/item-cell";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import type { Scope } from "@/hooks/use-session";
import { formatNumber, pluralize, timeAgo } from "@/lib/format";
import type { PurchaseOrder, StoreRequest } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { RecentActivity } from "./recent-activity";

interface QuickAction {
    label: string;
    description: string;
    href: string;
    icon: FC<{ className?: string }>;
}

const QuickActions = ({ actions }: { actions: QuickAction[] }) => (
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

const lineUnits = (r: StoreRequest) => r.lines.reduce((s, l) => s + l.requestedQty, 0);

const RequestList = ({ requests, empty, side }: { requests: StoreRequest[]; empty: string; side: "store" | "warehouse" }) =>
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
                                {side === "store" ? (
                                    <>
                                        From <LocationName id={r.warehouseId} />
                                    </>
                                ) : (
                                    <>
                                        For <LocationName id={r.storeId} />
                                    </>
                                )}{" "}
                                · {pluralize(r.lines.length, "item")} · {formatNumber(lineUnits(r))} units · {timeAgo(r.createdAt)}
                            </p>
                        </div>
                        <StatusBadge status={r.status} size="sm" />
                    </Link>
                </li>
            ))}
        </ul>
    );

const ViewAll = ({ href, label = "View all" }: { href: string; label?: string }) => (
    <Link href={href} className="text-sm font-semibold text-primary hover:underline">
        {label}
    </Link>
);

export const StoreAssociateHome = ({ scope }: { scope: Scope }) => {
    const stockLevels = useAppStore((s) => s.stockLevels);
    const storeRequests = useAppStore((s) => s.storeRequests);
    const storeIds = scope.stores.map((s) => s.id);

    const { available, incoming, open, mine } = useMemo(() => {
        const ids = new Set(storeIds);
        const reqs = storeRequests.filter((r) => ids.has(r.storeId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
            available: stockLevels.filter((s) => ids.has(s.locationId)).reduce((sum, s) => sum + s.available, 0),
            incoming: reqs.filter((r) => r.status === "shipped"),
            open: reqs.filter((r) => r.status !== "confirmed"),
            mine: reqs,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stockLevels, storeRequests, storeIds.join()]);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Available units" value={formatNumber(available)} icon={LayersThree01} href="/stock/inventory" hint="Sellable stock in your store" />
                <StatCard
                    label="Deliveries to confirm"
                    value={incoming.length}
                    icon={PackageCheck}
                    tone={incoming.length ? "warning" : "default"}
                    href="/replenishment/requests"
                    hint="Shipped · In Transit"
                />
                <StatCard label="Open requests" value={open.length} icon={Truck01} href="/replenishment/requests" hint="Not yet confirmed" />
            </div>

            <QuickActions
                actions={[
                    { label: "Request stock", description: "Ask the warehouse to send items", href: "/replenishment/requests/new", icon: Truck01 },
                    { label: "Product lookup", description: "Find stock at every location", href: "/stock/lookup", icon: PackageSearch },
                    { label: "Start a count", description: "Scan and count your shelves", href: storeIds[0] ? `/stock/counts?start=${storeIds[0]}` : "/stock/counts", icon: ClipboardCheck },
                    {
                        label: "Confirm delivery",
                        description: incoming.length ? `${pluralize(incoming.length, "shipment")} arrived?` : "Nothing in transit",
                        href: incoming[0] ? `/replenishment/requests/view?id=${incoming[0].id}` : "/replenishment/requests",
                        icon: PackageCheck,
                    },
                ]}
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card title="Your requests" flush actions={<ViewAll href="/replenishment/requests" />}>
                    <RequestList requests={mine.slice(0, 6)} empty="No requests yet" side="store" />
                </Card>
                <RecentActivity scope={scope} limit={6} />
            </div>
        </div>
    );
};

export const WarehouseAssociateHome = ({ scope }: { scope: Scope }) => {
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const storeRequests = useAppStore((s) => s.storeRequests);
    const vendors = useAppStore((s) => s.vendors);
    const whIds = scope.warehouses.map((w) => w.id);

    const { toReceive, toWork } = useMemo(() => {
        const ids = new Set(whIds);
        return {
            toReceive: purchaseOrders.filter((p) => ids.has(p.warehouseId) && (p.status === "sent" || p.status === "receiving")),
            toWork: storeRequests.filter((r) => ids.has(r.warehouseId) && ["requested", "picked", "packed"].includes(r.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [purchaseOrders, storeRequests, whIds.join()]);

    const count = (s: StoreRequest["status"]) => toWork.filter((r) => r.status === s).length;
    const units = (p: PurchaseOrder) => p.lines.reduce((s, l) => s + l.orderedQty, 0);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="POs to receive" value={toReceive.length} icon={Scan} tone={toReceive.length ? "warning" : "default"} href="/purchasing/receiving" />
                <StatCard label="To pick" value={count("requested")} icon={Truck01} href="/replenishment/requests" />
                <StatCard label="To pack" value={count("picked")} icon={PackageCheck} href="/replenishment/requests" />
                <StatCard label="To ship" value={count("packed")} icon={Truck01} href="/replenishment/requests" />
            </div>

            <QuickActions
                actions={[
                    { label: "Receive a delivery", description: "Scan a vendor shipment in", href: "/purchasing/receiving", icon: Scan },
                    { label: "Store requests", description: "Pick, pack and ship", href: "/replenishment/requests", icon: Truck01 },
                    { label: "Product lookup", description: "Find stock at every location", href: "/stock/lookup", icon: PackageSearch },
                    { label: "Start a count", description: "Count a section of the warehouse", href: whIds[0] ? `/stock/counts?start=${whIds[0]}` : "/stock/counts", icon: ClipboardCheck },
                ]}
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card title="POs to receive" flush actions={<ViewAll href="/purchasing/receiving" label="Receiving" />}>
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
                <Card title="Store requests to work" description="Oldest first." flush actions={<ViewAll href="/replenishment/requests" />}>
                    <RequestList requests={toWork.slice(0, 8)} empty="No requests waiting" side="warehouse" />
                </Card>
            </div>
        </div>
    );
};
