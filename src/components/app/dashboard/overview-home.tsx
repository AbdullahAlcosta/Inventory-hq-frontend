"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CheckDone01, CoinsStacked01, LayersThree01, RefreshCw01, ShoppingCart01, Truck01 } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Card } from "@/components/app/card";
import { ChannelLogo } from "@/components/app/channels/channel-logo";
import { useScopedConnections } from "@/components/app/channels/channel-utils";
import { Empty } from "@/components/app/empty";
import { LocationIcon } from "@/components/app/sidebar";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import type { Scope } from "@/hooks/use-session";
import { formatCompactCurrency, formatCurrency, formatNumber, timeAgo } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { ApprovalsCard, usePendingApprovals, useLocationMetrics } from "./dashboard-parts";
import { RecentActivity } from "./recent-activity";
import { SalesChart } from "./sales-chart";

/** Executives and multi-location managers on "All locations" or a brand. */
export const OverviewHome = ({ scope }: { scope: Scope }) => {
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const mismatches = useAppStore((s) => s.mismatches);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const setContext = useAppStore((s) => s.setContext);
    const connections = useScopedConnections(scope);
    const pending = usePendingApprovals(scope);
    const metrics = useLocationMetrics(scope.activeLocationIds);

    const totals = useMemo(() => {
        let available = 0;
        let value = 0;
        let low = 0;
        const open = new Set<string>();
        metrics.forEach((m) => {
            available += m.available;
            value += m.value;
            low += m.low;
            m.requestsIn.forEach((r) => open.add(r.id));
            m.requestsOut.forEach((r) => open.add(r.id));
        });
        return { available, value, low, openRequests: open.size };
    }, [metrics]);

    const openPos = useMemo(() => {
        const ids = new Set(scope.activeLocationIds);
        return purchaseOrders.filter((p) => ids.has(p.warehouseId) && !["complete", "resolved"].includes(p.status));
    }, [purchaseOrders, scope.activeLocationIds]);
    const receiving = openPos.filter((p) => p.status === "sent" || p.status === "receiving").length;

    const openMismatches = useMemo(() => {
        const connIds = new Set(connections.map((c) => c.id));
        return mismatches.filter((m) => connIds.has(m.connectionId) && m.status === "open");
    }, [mismatches, connections]);

    const statCount = 3 + (scope.canManage ? 1 : 0) + (scope.canSeePurchasing ? 1 : 0) + (scope.canManageChannels ? 1 : 0);
    const pendingAt = (locId: string) => pending.filter((a) => a.locationId === locId).length;
    const multiBu = scope.activeBusinessUnitIds.length > 1;

    const rows = scope.locations
        .map((l) => ({ id: l.id, location: l, m: metrics.get(l.id)!, bu: businessUnits.find((b) => b.id === l.businessUnitId) }))
        .filter((r) => r.m)
        .sort((a, b) => (a.bu?.name ?? "").localeCompare(b.bu?.name ?? "") || a.location.type.localeCompare(b.location.type) || a.location.name.localeCompare(b.location.name));

    return (
        <div className="flex flex-col gap-6">
            <div className={cx("grid grid-cols-1 gap-4 sm:grid-cols-2", statCount % 3 === 0 ? "xl:grid-cols-3 2xl:grid-cols-6" : "xl:grid-cols-4")}>
                {scope.canManage && (
                    <StatCard
                        label="Pending approvals"
                        value={pending.length}
                        icon={CheckDone01}
                        tone={pending.length ? "warning" : "default"}
                        href="/approvals"
                        hint="Waiting on your decision"
                    />
                )}
                <StatCard label="Low stock items" value={totals.low} icon={AlertTriangle} tone={totals.low ? "error" : "default"} hint="At or below reorder point" />
                {scope.canSeePurchasing && (
                    <StatCard label="Open POs" value={openPos.length} icon={ShoppingCart01} href="/purchasing/orders" hint={`${receiving} to receive`} />
                )}
                <StatCard label="Open store requests" value={totals.openRequests} icon={Truck01} hint="Not yet confirmed" />
                {scope.canManageChannels && (
                    <StatCard
                        label="Open mismatches"
                        value={openMismatches.length}
                        icon={RefreshCw01}
                        tone={openMismatches.length ? "warning" : "default"}
                        href="/channels/reconciliation"
                        hint="Channels vs our stock"
                    />
                )}
                <StatCard label="Inventory value" value={formatCompactCurrency(totals.value)} icon={CoinsStacked01} hint={`${formatNumber(totals.available)} units available · ${scope.locations.length} locations`} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="min-w-0 xl:col-span-2">
                    <SalesChart storeIds={scope.stores.map((s) => s.id)} description={`Revenue across ${scope.stores.length === 1 ? "1 store" : `${scope.stores.length} stores`}, last 30 days.`} />
                </div>
                {scope.canManage ? (
                    <ApprovalsCard approvals={pending} />
                ) : (
                    <RecentActivity scope={scope} limit={6} />
                )}
            </div>

            <div>
                <div className="mb-3">
                    <h2 className="text-lg font-semibold text-primary">Locations</h2>
                    <p className="text-sm text-tertiary">Pick a location to open its dashboard.</p>
                </div>
                <TableCard.Root size="sm" className="rounded-2xl">
                    {rows.length === 0 ? (
                        <Empty icon={LayersThree01} title="No locations" description="There are no locations in this view." />
                    ) : (
                        <Table aria-label="Locations" size="sm" onRowAction={(key) => setContext(`loc:${key}`)}>
                            <Table.Header>
                                <Table.Head label="Location" isRowHeader />
                                <Table.Head label="Type" />
                                <Table.Head label="Available" />
                                <Table.Head label="Inventory value" />
                                <Table.Head label="Low stock" />
                                <Table.Head label="Open requests" tooltip="Incoming (this store asked) / outgoing (to fulfil for others)" />
                                {scope.canManage && <Table.Head label="Pending approvals" />}
                            </Table.Header>
                            <Table.Body items={rows}>
                                {(r) => (
                                    <Table.Row id={r.id} className="cursor-pointer">
                                        <Table.Cell>
                                            <div className="flex min-w-48 items-center gap-3">
                                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-secondary">
                                                    <LocationIcon type={r.location.type} className="size-4" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-primary">{r.location.name}</p>
                                                    <p className="flex items-center gap-1.5 text-xs text-tertiary">
                                                        {multiBu && <BusinessUnitAvatar unit={r.bu} size="sm" className="size-4" />}
                                                        {multiBu ? `${r.bu?.name} · ` : ""}
                                                        {r.location.code}
                                                    </p>
                                                </div>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{r.location.type === "store" ? "Store" : "Warehouse"}</Table.Cell>
                                        <Table.Cell className="tabular-nums">{formatNumber(r.m.available)}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap tabular-nums">{formatCurrency(r.m.value)}</Table.Cell>
                                        <Table.Cell>
                                            <span className={cx("font-semibold tabular-nums", r.m.low ? "text-error-primary" : "text-primary")}>{r.m.low}</span>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap tabular-nums">
                                            {r.location.type === "store" ? `${r.m.requestsIn.length} in · ${r.m.requestsOut.length} out` : `${r.m.requestsOut.length} to ship`}
                                        </Table.Cell>
                                        {scope.canManage && (
                                            <Table.Cell className="tabular-nums">
                                                <span className={cx("font-semibold", pendingAt(r.id) ? "text-warning-primary" : "text-tertiary")}>{pendingAt(r.id)}</span>
                                            </Table.Cell>
                                        )}
                                    </Table.Row>
                                )}
                            </Table.Body>
                        </Table>
                    )}
                </TableCard.Root>
            </div>

            {scope.canManage && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className={cx("min-w-0", scope.canManageChannels ? "xl:col-span-2" : "xl:col-span-3")}>
                    <RecentActivity scope={scope} />
                </div>
                {scope.canManageChannels && (
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
                            <Empty icon={LayersThree01} title="No channels" description="No sales channels in these brands." />
                        ) : (
                            <ul className="divide-y divide-secondary">
                                {connections.map((c) => (
                                    <li key={c.id}>
                                        <Link href={`/channels/connections/view?id=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-primary_hover md:px-6">
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
                )}
            </div>
            )}
        </div>
    );
};
