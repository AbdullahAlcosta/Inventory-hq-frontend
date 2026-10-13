"use client";

import { useMemo, useState } from "react";
import { SearchLg, SwitchHorizontal01 } from "@untitledui/icons";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Empty } from "@/components/app/empty";
import { VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { ChannelLogo } from "@/components/app/channels/channel-logo";
import { useEyebrow, useScopedConnections } from "@/components/app/channels/channel-utils";
import { EditAllocationModal } from "@/components/app/channels/edit-allocation-modal";
import { ModeBadge } from "@/components/app/channels/mode-badge";
import { useRequiredScope } from "@/hooks/use-session";
import { allocationFor, channelAllocation, stockAt } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";

export default function AllocationPage() {
    const scope = useRequiredScope();
    const eyebrow = useEyebrow(scope);
    const connections = useScopedConnections(scope);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const allocations = useAppStore((s) => s.allocations);

    const stores = useMemo(() => scope.stores.filter((st) => connections.some((c) => c.locationId === st.id)), [scope.stores, connections]);
    const [picked, setPicked] = useState<string | null>(null);
    const storeId = stores.some((s) => s.id === picked) ? picked! : (stores[0]?.id ?? null);
    const store = stores.find((s) => s.id === storeId);
    const storeConnections = connections.filter((c) => c.locationId === storeId);

    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<string | null>(null);

    const rows = useMemo(() => {
        if (!store) return [];
        const q = query.trim().toLowerCase();
        const data = { stockLevels, allocations };
        return variants
            .map((v) => ({ v, p: products.find((p) => p.id === v.productId) }))
            .filter(({ p }) => p && p.businessUnitId === store.businessUnitId && p.status !== "archived")
            .filter(({ v, p }) => !q || `${p!.name} ${v.name} ${v.sku}`.toLowerCase().includes(q))
            .map(({ v }) => ({
                id: v.id,
                available: stockAt(data, v.id, store.id).available,
                alloc: allocationFor(data, v.id, store.id),
                sellable: Object.fromEntries(storeConnections.map((c) => [c.id, channelAllocation(data, v.id, c).sellable])),
            }));
    }, [store, variants, products, stockLevels, allocations, query, storeConnections]);

    return (
        <>
            <PageHeader
                eyebrow={eyebrow}
                title="Allocation"
                description="Decide how each store's Available stock is split between the channels selling it. Moving stock between channels doesn't move anything physically."
            />

            {stores.length === 0 ? (
                <div className="rounded-2xl bg-primary ring-1 ring-secondary">
                    <Empty icon={SwitchHorizontal01} title="No stores with channels" description="Connect a sales channel to a store first." />
                </div>
            ) : (
                <TableCard.Root className="rounded-2xl">
                    <div className="flex flex-col gap-3 border-b border-secondary px-5 py-4 md:flex-row md:items-end md:justify-between md:px-6">
                        <div className="w-full md:w-72">
                            <Select
                                label="Store"
                                size="sm"
                                items={stores.map((s) => ({ id: s.id, label: s.name }))}
                                selectedKey={storeId}
                                onSelectionChange={(k) => setPicked(k as string)}
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                            <span>Selling from this store:</span>
                            {storeConnections.map((c) => (
                                <span key={c.id} className="flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pr-2.5 pl-0.5 font-medium text-secondary">
                                    <ChannelLogo channel={c.channel} size="sm" className="size-5 rounded-full text-[8px]" />
                                    {c.name}
                                </span>
                            ))}
                        </div>
                        <div className="w-full md:w-64">
                            <Input aria-label="Search" size="sm" icon={SearchLg} placeholder="Search item or SKU" value={query} onChange={setQuery} />
                        </div>
                    </div>
                    {rows.length === 0 ? (
                        <Empty title="No items" description="Nothing matches your search." />
                    ) : (
                        <Table aria-label="Allocation by item" size="sm">
                            <Table.Header>
                                <Table.Head id="item" label="Item" isRowHeader />
                                <Table.Head id="available" label="Available" />
                                <Table.Head id="mode" label="Mode" />
                                <Table.Head id="reserved" label="Reserved" />
                                {storeConnections.map((c) => (
                                    <Table.Head key={c.id} id={c.id} label={c.name.split(" · ")[0]} tooltip={`${c.name}: sellable = allocation − ${c.safetyBuffer} buffer`} />
                                ))}
                                <Table.Head id="actions" label="" />
                            </Table.Header>
                            <Table.Body items={rows} dependencies={[storeConnections]}>
                                {(r) => {
                                    const reserved = storeConnections.find((c) => c.id === r.alloc.reservedConnectionId);
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
                                            {storeConnections.map((c) => (
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
            )}

            {store && (
                <EditAllocationModal
                    isOpen={!!editing}
                    onOpenChange={(o) => !o && setEditing(null)}
                    variantId={editing}
                    locationId={store.id}
                    connections={storeConnections}
                />
            )}
        </>
    );
}
