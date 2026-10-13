"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CheckDone01, ChevronRight, CoinsStacked01, LayersThree01, RefreshCw01, ShoppingCart01, Truck01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { ChannelLogo } from "@/components/app/channels/channel-logo";
import { useScopedConnections } from "@/components/app/channels/channel-utils";
import type { Scope } from "@/hooks/use-session";
import { formatCompactCurrency, formatCurrency, timeAgo } from "@/lib/format";
import { canDecideApproval, totalOnHand } from "@/lib/selectors";
import type { ApprovalType } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { RecentActivity } from "./recent-activity";
import { SalesChart } from "./sales-chart";

export const approvalTypeLabel: Record<ApprovalType, string> = {
    reorder: "Reorder suggestion",
    count_variance: "Count variance",
    adjustment: "Adjustment",
    unexpected_item: "Unexpected item",
    partial_po: "Partial PO",
    mismatch: "Channel mismatch",
    import_duplicate: "Possible duplicate",
    sync_failure: "Sync / push issue",
};

export const ManagerHome = ({ scope }: { scope: Scope }) => {
    const approvals = useAppStore((s) => s.approvals);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const variants = useAppStore((s) => s.variants);
    const products = useAppStore((s) => s.products);
    const locations = useAppStore((s) => s.locations);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const storeRequests = useAppStore((s) => s.storeRequests);
    const mismatches = useAppStore((s) => s.mismatches);
    const connections = useScopedConnections(scope);

    const stats = useMemo(() => {
        const locIds = new Set(scope.activeLocationIds);
        const pending = approvals
            .filter((a) => a.status === "pending" && scope.activeBusinessUnitIds.includes(a.businessUnitId) && canDecideApproval(scope.user, a, scope))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const variantMap = new Map(variants.map((v) => [v.id, v]));
        const productBu = new Map(products.map((p) => [p.id, p.businessUnitId]));
        const locBu = new Map(locations.map((l) => [l.id, l.businessUnitId]));
        let low = 0;
        let value = 0;
        stockLevels.forEach((s) => {
            if (!locIds.has(s.locationId)) return;
            const v = variantMap.get(s.variantId);
            if (!v) return;
            value += totalOnHand(s) * v.cost;
            if (productBu.get(v.productId) === locBu.get(s.locationId) && s.available <= v.reorderPoint) low++;
        });
        const openPos = purchaseOrders.filter((p) => locIds.has(p.warehouseId) && !["complete", "resolved"].includes(p.status));
        const openRequests = storeRequests.filter((r) => (locIds.has(r.storeId) || locIds.has(r.warehouseId)) && r.status !== "confirmed");
        const connIds = new Set(connections.map((c) => c.id));
        const openMismatches = mismatches.filter((m) => connIds.has(m.connectionId) && m.status === "open");
        return { pending, low, value, openPos, openRequests, openMismatches };
    }, [approvals, stockLevels, variants, products, locations, purchaseOrders, storeRequests, mismatches, connections, scope]);

    const receiving = stats.openPos.filter((p) => p.status === "sent" || p.status === "receiving").length;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <StatCard label="Pending approvals" value={stats.pending.length} icon={CheckDone01} tone={stats.pending.length ? "warning" : "default"} href="/approvals" hint="Waiting on a decision" />
                <StatCard label="Low stock items" value={stats.low} icon={AlertTriangle} tone={stats.low ? "error" : "default"} href="/stock/inventory" hint="At or below reorder point" />
                <StatCard label="Open POs" value={stats.openPos.length} icon={ShoppingCart01} href="/purchasing/orders" hint={`${receiving} to receive`} />
                <StatCard label="Open store requests" value={stats.openRequests.length} icon={Truck01} href="/replenishment/requests" hint="Not yet confirmed" />
                <StatCard label="Open mismatches" value={stats.openMismatches.length} icon={RefreshCw01} tone={stats.openMismatches.length ? "warning" : "default"} href="/channels/reconciliation" hint="Channels vs our stock" />
                <StatCard label="Inventory value" value={formatCompactCurrency(stats.value)} icon={CoinsStacked01} hint={`${formatCurrency(stats.value)} at cost`} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="min-w-0 xl:col-span-2">
                    <SalesChart storeIds={scope.stores.map((s) => s.id)} />
                </div>
                <Card
                    title="Needs attention"
                    description="Top pending approvals."
                    flush
                    actions={
                        <Link href="/approvals" className="text-sm font-semibold text-primary hover:underline">
                            View all
                        </Link>
                    }
                >
                    {stats.pending.length === 0 ? (
                        <Empty icon={CheckDone01} title="All caught up" description="Nothing is waiting on a decision." />
                    ) : (
                        <ul className="divide-y divide-secondary">
                            {stats.pending.slice(0, 6).map((a) => (
                                <li key={a.id}>
                                    <Link href={`/approvals?id=${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-primary_hover md:px-6">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-tertiary">{approvalTypeLabel[a.type]}</p>
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
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="min-w-0 xl:col-span-2">
                    <RecentActivity scope={scope} />
                </div>
                <Card
                    title="Channel health"
                    flush
                    actions={
                        <Link href="/channels/connections" className="text-sm font-semibold text-primary hover:underline">
                            Connections
                        </Link>
                    }
                >
                    {connections.length === 0 ? (
                        <Empty icon={LayersThree01} title="No channels" description="No sales channels in these business units." />
                    ) : (
                        <ul className="divide-y divide-secondary">
                            {connections.map((c) => (
                                <li key={c.id}>
                                    <Link href={`/channels/connections/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-primary_hover md:px-6">
                                        <ChannelLogo channel={c.channel} size="sm" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-primary">{c.name}</p>
                                            <p className="text-xs text-tertiary">
                                                {c.syncMode === "live" ? "Live" : "Scheduled"} · {c.lastSyncAt ? `synced ${timeAgo(c.lastSyncAt)}` : "never synced"}
                                            </p>
                                        </div>
                                        <StatusBadge status={c.status} size="sm" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
};
