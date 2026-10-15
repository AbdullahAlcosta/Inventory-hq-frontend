"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Eye, InfoCircle, Settings01, SearchLg } from "@untitledui/icons";
import { type ReorderStatus, formatDays, reorderInfo, reorderStatusMeta } from "@/components/app/approvals/approval-meta";
import { ReorderSettingsModal } from "@/components/app/approvals/reorder-settings-modal";
import { AutoReorderPanel } from "@/components/app/purchasing/auto-reorder-panel";
import { forecastOrder, unitsOnOrder } from "@/lib/forecast";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { LocationName, VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Table, TableCard } from "@/components/application/table/table";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDate, formatNumber } from "@/lib/format";
import { canDecideApproval, stockAt } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

type Filter = "all" | ReorderStatus;
const rank: Record<ReorderStatus, number> = { reorder: 0, watch: 1, ok: 2 };

export default function ReorderPage() {
    const scope = useRequiredScope();
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const locations = useAppStore((s) => s.locations);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const vendors = useAppStore((s) => s.vendors);
    const approvals = useAppStore((s) => s.approvals);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);

    const [filter, setFilter] = useState<Filter>("reorder");
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<string | null>(null);

    const rows = useMemo(() => {
        const pendingByVariant = new Map<string, (typeof approvals)[number]>();
        approvals.forEach((a) => {
            if (a.status === "pending" && a.payload.type === "reorder") pendingByVariant.set(a.payload.variantId, a);
        });
        return variants
            .flatMap((v) => {
                const product = products.find((p) => p.id === v.productId);
                if (!product || product.status !== "active" || !scope.activeBusinessUnitIds.includes(product.businessUnitId)) return [];
                const warehouse = locations.find((l) => l.businessUnitId === product.businessUnitId && l.type === "warehouse");
                if (!warehouse) return [];
                const available = stockAt({ stockLevels }, v.id, warehouse.id).available;
                const info = reorderInfo(v, available);
                const forecast = forecastOrder(v, product, available, unitsOnOrder(purchaseOrders, v.id, warehouse.id, product.uom.unitsPerPurchaseUnit));
                const approval = pendingByVariant.get(v.id);
                return [
                    {
                        id: v.id,
                        variant: v,
                        product,
                        warehouse,
                        available,
                        ...info,
                        forecast,
                        vendor: vendors.find((x) => x.id === v.vendorId),
                        approval,
                        canReview: approval ? canDecideApproval(scope.user, approval, { businessUnitIds: scope.businessUnitIds, locationIds: scope.locationIds }) : false,
                        search: `${product.name} ${v.name} ${v.sku}`.toLowerCase(),
                    },
                ];
            })
            .sort((a, b) => rank[a.status] - rank[b.status] || a.cover - b.cover);
    }, [variants, products, locations, stockLevels, vendors, approvals, purchaseOrders, scope]);

    const counts = { reorder: 0, watch: 0, ok: 0 };
    rows.forEach((r) => counts[r.status]++);
    const pendingSuggestions = rows.filter((r) => r.approval).length;
    const maxSales = Math.max(1, ...rows.map((r) => r.variant.dailySales));

    const q = query.trim().toLowerCase();
    const visible = rows.filter((r) => (filter === "all" || r.status === filter) && (!q || r.search.includes(q)));
    const eyebrow = scope.activeBusinessUnitIds.length === 1 ? businessUnits.find((b) => b.id === scope.activeBusinessUnitIds[0])?.name : "Purchasing";

    return (
        <div>
            <PageHeader
                eyebrow={eyebrow}
                title="Reorder"
                description="Warehouse stock against each item’s minimum qty, sales-speed forecast and vendor lead time."
                actions={
                    scope.autoPO === "suggest" && (
                        <Button href="/approvals?type=reorder" color="secondary" size="md">
                            Open suggestions in Approvals
                        </Button>
                    )
                }
            />

            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-primary p-4 text-sm shadow-xs ring-1 ring-secondary">
                <InfoCircle className="mt-0.5 size-5 shrink-0 text-fg-quaternary" />
                <p className="text-secondary">
                    {scope.autoPO === "off" ? (
                        <><span className="font-semibold text-primary">Automatic reorders are off.</span> Status is shown below; create POs by hand. Change it in Company settings.</>
                    ) : scope.autoPO === "auto_draft" ? (
                        <><span className="font-semibold text-primary">Draft POs are created automatically.</span> Nothing is sent to a vendor until someone reviews the draft and marks it sent.</>
                    ) : (
                        <><span className="font-semibold text-primary">Suggestions land in Approvals. Nothing is ordered automatically.</span> Approving a suggestion creates a purchase order — one per vendor.</>
                    )}{" "}
                    Order qty = sales/day × (lead time + cover days) + minimum qty − available − already on open POs, rounded up to whole cases.
                </p>
            </div>

            {scope.canManagePurchasing && <AutoReorderPanel scope={scope} />}

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Reorder now" value={formatNumber(counts.reorder)} hint="At/below minimum qty or runs out within lead time" icon={AlertTriangle} tone="error" />
                <StatCard label="Watch" value={formatNumber(counts.watch)} hint="Runs out within lead time + 7 days" icon={Eye} tone="warning" />
                <StatCard label="Pending suggestions" value={formatNumber(pendingSuggestions)} hint="Waiting for a decision" icon={CheckCircle} href="/approvals?type=reorder" />
            </div>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <FilterPills<Filter>
                    options={[
                        { id: "reorder", label: "Reorder now", count: counts.reorder },
                        { id: "watch", label: "Watch", count: counts.watch },
                        { id: "ok", label: "OK", count: counts.ok },
                        { id: "all", label: "All", count: rows.length },
                    ]}
                    value={filter}
                    onChange={setFilter}
                />
                <Input aria-label="Search items" icon={SearchLg} placeholder="Search items or SKU" value={query} onChange={setQuery} className="lg:max-w-80" />
            </div>

            <TableCard.Root size="sm">
                {visible.length === 0 ? (
                    <Empty title={rows.length ? "Nothing here" : "No items yet"} description={rows.length ? "No items match this filter." : "Add products to see reorder status."} />
                ) : (
                    <Table aria-label="Reorder overview">
                        <Table.Header>
                            <Table.Head label="Item" isRowHeader />
                            <Table.Head label="Status" />
                            <Table.Head label="Available" />
                            <Table.Head label="Min qty" />
                            <Table.Head label="Forecast order" />
                            <Table.Head label="Sales / day" />
                            <Table.Head label="Cover · runs out" />
                            <Table.Head label="Lead time" />
                            <Table.Head label="Vendor" />
                            <Table.Head label="" />
                        </Table.Header>
                        <Table.Body items={visible}>
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell className="max-w-72 min-w-56">
                                        <VariantCell variantId={r.id} />
                                        <span className="mt-0.5 block pl-11 text-xs text-quaternary">
                                            <LocationName id={r.warehouse.id} />
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <BadgeWithDot type="pill-color" size="sm" color={reorderStatusMeta[r.status].color}>
                                            {reorderStatusMeta[r.status].label}
                                        </BadgeWithDot>
                                    </Table.Cell>
                                    <Table.Cell className={cx("font-medium tabular-nums", r.available <= r.variant.reorderPoint ? "text-error-primary" : "text-primary")}>
                                        {formatNumber(r.available)}
                                    </Table.Cell>
                                    <Table.Cell className="tabular-nums">{formatNumber(r.variant.reorderPoint)}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap tabular-nums" title={r.forecast.reason}>
                                        {r.forecast.cases ? (
                                            <>
                                                <span className="font-medium text-primary">
                                                    {r.forecast.cases} × {r.product.uom.purchaseUnit.toLowerCase()}
                                                </span>
                                                <span className="block text-xs">{formatNumber(r.forecast.units)} units</span>
                                            </>
                                        ) : (
                                            "—"
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center gap-2">
                                            <span className="w-8 tabular-nums">{r.variant.dailySales.toFixed(1)}</span>
                                            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                                                <span className="block h-full rounded-full bg-gray-700" style={{ width: `${(r.variant.dailySales / maxSales) * 100}%` }} />
                                            </span>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap tabular-nums">
                                        <span className="font-medium text-primary">{formatDays(r.cover)}</span>
                                        <span className="block text-xs">{r.runOutDate ? formatDate(r.runOutDate) : "No sales"}</span>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap tabular-nums">{r.variant.leadTimeDays} d</Table.Cell>
                                    <Table.Cell className="min-w-36">{r.vendor?.name ?? <span className="text-error-primary">None</span>}</Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center justify-end gap-2">
                                            {r.approval && scope.autoPO !== "off" &&
                                                (r.canReview ? (
                                                    <Button size="sm" href={`/approvals?type=reorder&id=${r.approval.id}`}>
                                                        Review in Approvals
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs whitespace-nowrap text-tertiary">Suggested · awaiting warehouse</span>
                                                ))}
                                            {scope.canManagePurchasing && (
                                                <Button size="sm" color="tertiary" iconLeading={Settings01} aria-label="Edit reorder settings" onPress={() => setEditing(r.id)} />
                                            )}
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            {scope.canManagePurchasing && <ReorderSettingsModal variantId={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
