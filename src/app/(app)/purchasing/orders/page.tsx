"use client";

import { useMemo, useState } from "react";
import { Plus, SearchLg, ShoppingCart01 } from "@untitledui/icons";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { AutoReorderPanel } from "@/components/app/purchasing/auto-reorder-panel";
import { PO_STATUSES, poTotals } from "@/components/app/purchasing/po-utils";
import { StatusBadge, statusLabel } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { normalize } from "@/lib/selectors";
import type { POStatus } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Filter = "all" | POStatus;

export default function PurchaseOrdersPage() {
    const scope = useRequiredScope();
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const vendors = useAppStore((s) => s.vendors);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");

    // A picked warehouse narrows to that warehouse; otherwise every warehouse in scope for the active brand(s).
    const warehouseIds = useMemo(() => {
        if (scope.activeLocation) return [scope.activeLocation.id];
        // Destinations are warehouses or stores; purchasing managers also see POs they send to stores in their brand.
        return locations
            .filter((l) => scope.activeBusinessUnitIds.includes(l.businessUnitId) && (scope.locationIds.includes(l.id) || (scope.canManagePurchasing && scope.businessUnitIds.includes(l.businessUnitId))))
            .map((l) => l.id);
    }, [locations, scope.activeLocation, scope.locationIds, scope.activeBusinessUnitIds, scope.businessUnitIds, scope.canManagePurchasing]);
    const singleWarehouse = warehouseIds.length === 1 ? locations.find((l) => l.id === warehouseIds[0]) : undefined;
    const buName = scope.activeBusinessUnitIds.length === 1 ? businessUnits.find((b) => b.id === scope.activeBusinessUnitIds[0])?.name : "Purchasing";
    const eyebrow = scope.activeLocation ? scope.activeLocation.name : buName;

    const scoped = useMemo(() => purchaseOrders.filter((p) => warehouseIds.includes(p.warehouseId)), [purchaseOrders, warehouseIds]);

    const rows = useMemo(() => {
        const q = normalize(query);
        return scoped
            .filter((p) => filter === "all" || p.status === filter)
            .filter((p) => {
                if (!q) return true;
                const vendor = vendors.find((v) => v.id === p.vendorId)?.name ?? "";
                return normalize(`${p.number} ${vendor} ${p.notes}`).includes(q);
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((p) => ({ id: p.id, po: p, totals: poTotals({ products, variants }, p), vendor: vendors.find((v) => v.id === p.vendorId) }));
    }, [scoped, filter, query, vendors, products, variants]);

    const options = [
        { id: "all" as Filter, label: "All", count: scoped.length },
        ...PO_STATUSES.map((s) => ({ id: s as Filter, label: statusLabel(s), count: scoped.filter((p) => p.status === s).length })),
    ];

    return (
        <div>
            <PageHeader
                eyebrow={eyebrow}
                title="Purchase Orders"
                description={
                    scope.canManagePurchasing
                        ? `Orders to vendors for ${singleWarehouse ? singleWarehouse.name : "your locations"}. Placing the order with the vendor happens outside Inventory HQ.`
                        : `Orders coming in to ${singleWarehouse ? singleWarehouse.name : "your locations"}. Open one to see its lines or receive it.`
                }
                actions={
                    scope.canManagePurchasing && (
                        <Button iconLeading={Plus} size="lg" href="/purchasing/orders/new">
                            New PO
                        </Button>
                    )
                }
            />

            {scope.canManagePurchasing && <AutoReorderPanel scope={scope} />}

            <FilterPills options={options} value={filter} onChange={setFilter} className="mb-4" />

            <TableCard.Root className="rounded-2xl">
                <div className="flex flex-col gap-3 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <p className="text-md font-semibold text-primary">
                        {rows.length} purchase order{rows.length === 1 ? "" : "s"}
                    </p>
                    <Input aria-label="Search purchase orders" icon={SearchLg} placeholder="Search PO number or vendor" value={query} onChange={setQuery} className="md:max-w-xs" />
                </div>
                {rows.length === 0 ? (
                    <Empty icon={ShoppingCart01} title="No purchase orders" description={query || filter !== "all" ? "Try a different filter or search." : scope.canManagePurchasing ? "Create a PO to order stock for your warehouse." : "Purchase orders for your warehouse will show up here."} />
                ) : (
                    <Table aria-label="Purchase orders">
                        <Table.Header>
                            <Table.Head label="PO" isRowHeader />
                            <Table.Head label="Vendor" />
                            <Table.Head label="Destination" />
                            <Table.Head label="Lines" />
                            <Table.Head label="Units" />
                            <Table.Head label="Total cost" />
                            <Table.Head label="Created" />
                            <Table.Head label="Status" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(row) => (
                                <Table.Row id={row.id} href={`/purchasing/orders/view?id=${row.id}`} className="cursor-pointer">
                                    <Table.Cell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold whitespace-nowrap text-primary">{row.po.number}</span>
                                            {row.po.auto && (
                                                <Badge type="pill-color" color="blue" size="sm">
                                                    Auto
                                                </Badge>
                                            )}
                                            {row.po.source === "reorder" && !row.po.auto && (
                                                <Badge type="pill-color" color="purple" size="sm">
                                                    Reorder
                                                </Badge>
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-primary">{row.vendor?.name ?? "—"}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <LocationName id={row.po.warehouseId} />
                                    </Table.Cell>
                                    <Table.Cell className="tabular-nums">{row.totals.lines}</Table.Cell>
                                    <Table.Cell className="tabular-nums">{formatNumber(row.totals.units)}</Table.Cell>
                                    <Table.Cell className="font-medium whitespace-nowrap text-primary tabular-nums">{formatCurrency(row.totals.cost)}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{formatDate(row.po.createdAt)}</Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge status={row.po.status} size="sm" />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>
        </div>
    );
}
