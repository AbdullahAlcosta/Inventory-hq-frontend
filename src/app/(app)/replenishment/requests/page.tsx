"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, Truck01 } from "@untitledui/icons";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { OPEN_TO_FULFIL, REQUEST_STATUSES, canCreateRequest, isStoreToStore } from "@/components/app/replenishment/request-utils";
import { StatusBadge, statusLabel } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StoreRequest, StoreRequestStatus } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Filter = "all" | StoreRequestStatus;
type View = "requested" | "fulfil";

export default function StoreRequestsPage() {
    const scope = useRequiredScope();
    // Reset the view and filters when the Location switcher changes.
    return <StoreRequests key={scope.activeLocation?.id ?? "none"} />;
}

function StoreRequests() {
    const scope = useRequiredScope();
    // Location-gated: the app shell guarantees an active location.
    const location = scope.activeLocation!;
    const isStore = location.type === "store";
    const storeRequests = useAppStore((s) => s.storeRequests);
    const locations = useAppStore((s) => s.locations);

    const requestedByMe = useMemo(() => (isStore ? storeRequests.filter((r) => r.storeId === location.id) : []), [storeRequests, location.id, isStore]);
    const toFulfil = useMemo(() => storeRequests.filter((r) => r.sourceId === location.id), [storeRequests, location.id]);
    const openToFulfil = toFulfil.filter((r) => OPEN_TO_FULFIL.includes(r.status)).length;

    // Stores start on their own requests (managers jump to "To fulfill" when another store is waiting on them);
    // warehouses only fulfil.
    const [view, setView] = useState<View>(() => (!isStore || (scope.canManage && openToFulfil > 0) ? "fulfil" : "requested"));
    const activeView: View = isStore ? view : "fulfil";
    const scoped = activeView === "requested" ? requestedByMe : toFulfil;

    // Default to the status waiting on this side, when there is any.
    const defaultFilter = (v: View, list: StoreRequest[]): Filter => {
        if (v === "fulfil") {
            const first = OPEN_TO_FULFIL.find((s) => list.some((r) => r.status === s));
            return first ?? "all";
        }
        return list.some((r) => r.status === "shipped") ? "shipped" : "all";
    };
    const [filter, setFilter] = useState<Filter>(() => defaultFilter(activeView, scoped));

    const switchView = (v: View) => {
        setView(v);
        setFilter(defaultFilter(v, v === "requested" ? requestedByMe : toFulfil));
    };

    const rows = useMemo(
        () =>
            scoped
                .filter((r) => filter === "all" || r.status === filter)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((r) => ({ id: r.id, r, units: r.lines.reduce((a, l) => a + l.requestedQty, 0), storeToStore: isStoreToStore(r, locations) })),
        [scoped, filter, locations],
    );

    const options = [
        ...REQUEST_STATUSES.map((s) => ({ id: s as Filter, label: s === "shipped" ? "Shipped" : statusLabel(s), count: scoped.filter((r) => r.status === s).length })),
        { id: "all" as Filter, label: "All", count: scoped.length },
    ];

    const description = isStore
        ? "Ask the warehouse or another store for stock, confirm deliveries, and fulfil requests other stores send you."
        : "Requests from stores to this warehouse. Pick, pack and ship them.";

    const canCreate = canCreateRequest(scope);
    const tabs = [
        { id: "requested", label: `Requested by ${location.name}`, badge: requestedByMe.filter((r) => r.status !== "confirmed").length || undefined },
        { id: "fulfil", label: "To fulfill", badge: openToFulfil || undefined },
    ];

    const table = (
        <TableCard.Root className="rounded-2xl">
            {rows.length === 0 ? (
                <Empty
                    icon={Truck01}
                    title="No requests here"
                    description={
                        filter !== "all"
                            ? "Nothing in this status right now."
                            : activeView === "fulfil"
                              ? `Requests asking ${location.name} for stock will show up here.`
                              : `Requests ${location.name} sends will show up here.`
                    }
                    action={
                        canCreate && filter === "all" && activeView === "requested" ? (
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
                        <Table.Head label="From → to" />
                        <Table.Head label="Lines / units" />
                        <Table.Head label="Created by" />
                        <Table.Head label="Created" />
                        <Table.Head label="Status" />
                    </Table.Header>
                    <Table.Body items={rows}>
                        {(row) => (
                            <Table.Row id={row.id} href={`/replenishment/requests/view?id=${row.id}`} className="cursor-pointer">
                                <Table.Cell className="font-semibold whitespace-nowrap text-primary">{row.r.number}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">
                                    <span className="flex items-center gap-2">
                                        <LocationName id={row.r.sourceId} />
                                        <ArrowRight className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                        <span className="text-primary">
                                            <LocationName id={row.r.storeId} />
                                        </span>
                                        {row.storeToStore && (
                                            <Badge type="pill-color" color="blue" size="sm">
                                                Store → store
                                            </Badge>
                                        )}
                                    </span>
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
    );

    return (
        <div>
            <PageHeader
                eyebrow={location.name}
                title="Store Requests"
                description={description}
                actions={
                    canCreate && (
                        <Button iconLeading={Plus} size="lg" href="/replenishment/requests/new">
                            New request
                        </Button>
                    )
                }
            />

            {isStore ? (
                <Tabs selectedKey={activeView} onSelectionChange={(k) => switchView(String(k) as View)}>
                    <div className="mb-4 overflow-x-auto">
                        <Tabs.List type="underline" size="md" items={tabs} className="min-w-max" />
                    </div>
                    {tabs.map((t) => (
                        <Tabs.Panel key={t.id} id={t.id}>
                            <FilterPills options={options} value={filter} onChange={setFilter} className="mb-4" />
                            {table}
                        </Tabs.Panel>
                    ))}
                </Tabs>
            ) : (
                <>
                    <FilterPills options={options} value={filter} onChange={setFilter} className="mb-4" />
                    {table}
                </>
            )}
        </div>
    );
}
