"use client";

import { useMemo, useState } from "react";
import { Plus, Truck01 } from "@untitledui/icons";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { REQUEST_STATUSES, canCreateRequest } from "@/components/app/replenishment/request-utils";
import { StatusBadge, statusLabel } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StoreRequestStatus } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Filter = "all" | StoreRequestStatus;

export default function StoreRequestsPage() {
    const scope = useRequiredScope();
    const storeRequests = useAppStore((s) => s.storeRequests);
    const businessUnits = useAppStore((s) => s.businessUnits);

    // Store-level users see their store's requests; warehouse users see their warehouse's queue; managers/execs see both sides in scope.
    const scoped = useMemo(
        () =>
            storeRequests.filter((r) =>
                scope.isStoreLevel
                    ? scope.activeLocationIds.includes(r.storeId)
                    : scope.isWarehouseLevel
                      ? scope.activeLocationIds.includes(r.warehouseId)
                      : scope.activeLocationIds.includes(r.storeId) || scope.activeLocationIds.includes(r.warehouseId),
            ),
        [storeRequests, scope],
    );

    // Default to the status waiting on this person's side, when there is any.
    const [filter, setFilter] = useState<Filter>(() => {
        const waiting: StoreRequestStatus = scope.isWarehouseLevel ? "requested" : "shipped";
        return (scope.isWarehouseLevel || scope.isStoreLevel) && scoped.some((r) => r.status === waiting) ? waiting : "all";
    });

    const rows = useMemo(
        () =>
            scoped
                .filter((r) => filter === "all" || r.status === filter)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((r) => ({ id: r.id, r, units: r.lines.reduce((a, l) => a + l.requestedQty, 0) })),
        [scoped, filter],
    );

    const options = [
        ...REQUEST_STATUSES.map((s) => ({ id: s as Filter, label: s === "shipped" ? "Shipped" : statusLabel(s), count: scoped.filter((r) => r.status === s).length })),
        { id: "all" as Filter, label: "All", count: scoped.length },
    ];

    const buName = scope.activeBusinessUnitIds.length === 1 ? businessUnits.find((b) => b.id === scope.activeBusinessUnitIds[0])?.name : "Replenishment";
    const description = scope.isWarehouseLevel
        ? "Requests from stores to your warehouse. Pick, pack and ship them."
        : scope.isStoreLevel
          ? "Ask the warehouse for stock and confirm deliveries when they arrive."
          : "Stock moving from warehouses to stores.";

    return (
        <div>
            <PageHeader
                eyebrow={buName}
                title="Store Requests"
                description={description}
                actions={
                    canCreateRequest(scope) && (
                        <Button iconLeading={Plus} size="lg" href="/replenishment/requests/new">
                            New request
                        </Button>
                    )
                }
            />

            <FilterPills options={options} value={filter} onChange={setFilter} className="mb-4" />

            <TableCard.Root className="rounded-2xl">
                {rows.length === 0 ? (
                    <Empty
                        icon={Truck01}
                        title="No requests here"
                        description={filter === "all" ? "Store requests will show up here." : "Nothing in this status right now."}
                        action={
                            canCreateRequest(scope) && filter === "all" ? (
                                <Button iconLeading={Plus} href="/replenishment/requests/new">
                                    New request
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <Table aria-label="Store requests">
                        <Table.Header>
                            <Table.Head label="Request" isRowHeader />
                            <Table.Head label="Store" />
                            <Table.Head label="Warehouse" />
                            <Table.Head label="Lines / units" />
                            <Table.Head label="Created by" />
                            <Table.Head label="Created" />
                            <Table.Head label="Status" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(row) => (
                                <Table.Row id={row.id} href={`/replenishment/requests/${row.id}`} className="cursor-pointer">
                                    <Table.Cell className="font-semibold whitespace-nowrap text-primary">{row.r.number}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-primary">
                                        <LocationName id={row.r.storeId} />
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <LocationName id={row.r.warehouseId} />
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap tabular-nums">
                                        {row.r.lines.length} / {formatNumber(row.units)}
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <EmployeeName id={row.r.createdBy} />
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{formatDateTime(row.r.createdAt)}</Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge status={row.r.status} size="sm" />
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
