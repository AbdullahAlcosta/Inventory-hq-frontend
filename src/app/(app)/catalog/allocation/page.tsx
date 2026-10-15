"use client";

import { useMemo, useState } from "react";
import { SearchLg, SwitchHorizontal01 } from "@untitledui/icons";
import { AllocationOff, AllocationTable } from "@/components/app/catalog/allocation-table";
import { ChannelLogo } from "@/components/app/channels/channel-logo";
import { useEyebrow, useScopedConnections } from "@/components/app/channels/channel-utils";
import { Empty } from "@/components/app/empty";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { useRequiredScope } from "@/hooks/use-session";

export default function AllocationPage() {
    const scope = useRequiredScope();
    const eyebrow = useEyebrow(scope);
    const connections = useScopedConnections(scope);

    const stores = useMemo(() => scope.stores.filter((st) => connections.some((c) => c.locationId === st.id)), [scope.stores, connections]);
    // Default to the store picked in the sidebar, if it sells on channels.
    const [picked, setPicked] = useState<string | null>(scope.activeLocation?.type === "store" ? scope.activeLocation.id : null);
    const storeId = stores.some((s) => s.id === picked) ? picked! : (stores[0]?.id ?? null);
    const store = stores.find((s) => s.id === storeId);
    const storeConnections = connections.filter((c) => c.locationId === storeId);
    const [query, setQuery] = useState("");

    return (
        <>
            <PageHeader
                eyebrow={eyebrow}
                title="Allocation"
                description="Decide how each product’s Available stock at a store is split between the channels selling it. Moving stock between channels doesn’t move anything physically."
            />

            {!scope.allocationEnabled ? (
                <AllocationOff isExecutive={scope.isExecutive} />
            ) : !store ? (
                <div className="rounded-2xl bg-primary ring-1 ring-secondary">
                    <Empty icon={SwitchHorizontal01} title="No stores with channels" description="Connect a sales channel to a store first." />
                </div>
            ) : (
                <AllocationTable
                    store={store}
                    connections={storeConnections}
                    query={query}
                    toolbar={
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
                    }
                />
            )}
        </>
    );
}
