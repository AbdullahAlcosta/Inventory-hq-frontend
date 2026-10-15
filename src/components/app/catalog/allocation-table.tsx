"use client";

import { type ReactNode, useMemo, useState } from "react";
import { EditAllocationModal } from "@/components/app/channels/edit-allocation-modal";
import { ModeBadge } from "@/components/app/channels/mode-badge";
import { Empty } from "@/components/app/empty";
import { VariantCell } from "@/components/app/item-cell";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { allocationFor, channelAllocation, stockAt } from "@/lib/selectors";
import type { ChannelConnection, Location } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

interface AllocationTableProps {
    store: Location;
    /** Channel connections selling from this store. */
    connections: ChannelConnection[];
    /** Limit to these variants (e.g. one product's variants). */
    variantIds?: string[];
    query?: string;
    title?: ReactNode;
    description?: ReactNode;
    /** Controls shown above the table (store picker, search…). */
    toolbar?: ReactNode;
}

/**
 * How each item's Available stock at one store is split between the channels selling from it
 * (Shared / Dedicated / Hybrid), and what each channel is told it can sell.
 */
export const AllocationTable = ({ store, connections, variantIds, query = "", title, description, toolbar }: AllocationTableProps) => {
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const allocations = useAppStore((s) => s.allocations);
    const [editing, setEditing] = useState<string | null>(null);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        const data = { stockLevels, allocations };
        return variants
            .map((v) => ({ v, p: products.find((p) => p.id === v.productId) }))
            .filter(({ v, p }) => p && p.businessUnitId === store.businessUnitId && p.status !== "archived" && (!variantIds || variantIds.includes(v.id)))
            .filter(({ v, p }) => !q || `${p!.name} ${v.name} ${v.sku}`.toLowerCase().includes(q))
            .map(({ v }) => ({
                id: v.id,
                available: stockAt(data, v.id, store.id).available,
                alloc: allocationFor(data, v.id, store.id),
                sellable: Object.fromEntries(connections.map((c) => [c.id, channelAllocation(data, v.id, c).sellable])),
            }));
    }, [store, variants, products, stockLevels, allocations, query, connections, variantIds]);

    return (
        <>
            <TableCard.Root className="rounded-2xl" size="sm">
                {title && (
                    <TableCard.Header title={typeof title === "string" ? title : ""} description={typeof description === "string" ? description : undefined} />
                )}
                {toolbar}
                {rows.length === 0 ? (
                    <Empty title="No items" description={query ? "Nothing matches your search." : "No active items for this store."} />
                ) : (
                    <Table aria-label={`Allocation at ${store.name}`} size="sm">
                        <Table.Header>
                            <Table.Head id="item" label="Item" isRowHeader />
                            <Table.Head id="available" label="Available" />
                            <Table.Head id="mode" label="Mode" />
                            <Table.Head id="reserved" label="Reserved" />
                            {connections.map((c) => (
                                <Table.Head
                                    key={c.id}
                                    id={c.id}
                                    label={c.name.split(" · ")[0]}
                                    tooltip={`${c.name}: sellable = allocation − ${c.safetyBuffer} buffer`}
                                />
                            ))}
                            <Table.Head id="actions" label="" />
                        </Table.Header>
                        <Table.Body items={rows} dependencies={[connections]}>
                            {(r) => {
                                const reserved = connections.find((c) => c.id === r.alloc.reservedConnectionId);
                                return (
                                    <Table.Row id={r.id}>
                                        <Table.Cell>
                                            <VariantCell variantId={r.id} />
                                        </Table.Cell>
                                        <Table.Cell className="font-medium text-primary tabular-nums">{r.available}</Table.Cell>
                                        <Table.Cell>
                                            <ModeBadge mode={r.alloc.mode} />
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            {r.alloc.mode === "shared" ? (
                                                "—"
                                            ) : (
                                                <>
                                                    <span className="block font-medium text-primary tabular-nums">{r.alloc.reservedQty} units</span>
                                                    <span className="block text-xs">{reserved?.name ?? "Unknown channel"}</span>
                                                </>
                                            )}
                                        </Table.Cell>
                                        {connections.map((c) => (
                                            <Table.Cell key={c.id} className="font-semibold text-primary tabular-nums">
                                                {r.sellable[c.id]}
                                            </Table.Cell>
                                        ))}
                                        <Table.Cell>
                                            <Button size="xs" color="secondary" onPress={() => setEditing(r.id)}>
                                                Edit
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>
            <EditAllocationModal
                isOpen={!!editing}
                onOpenChange={(o) => !o && setEditing(null)}
                variantId={editing}
                locationId={store.id}
                connections={connections}
            />
        </>
    );
};

/** Shown in place of allocation screens when the company has the feature switched off. */
export const AllocationOff = ({ isExecutive }: { isExecutive: boolean }) => (
    <div className="rounded-2xl bg-primary ring-1 ring-secondary">
        <Empty
            title="Channel allocation is off"
            description="Every sales channel sells from the store’s full Available stock, minus its safety buffer. Turn allocation on in company settings to reserve stock for specific channels."
            action={
                isExecutive ? (
                    <Button href="/setup/settings" color="secondary">
                        Open company settings
                    </Button>
                ) : undefined
            }
        />
    </div>
);
