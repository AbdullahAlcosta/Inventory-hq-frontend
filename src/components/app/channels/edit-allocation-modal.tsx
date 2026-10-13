"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { InputNumber } from "@/components/base/input/input-number";
import { Select } from "@/components/base/select/select";
import { VariantCell } from "@/components/app/item-cell";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { allocationFor, channelAllocation, stockAt } from "@/lib/selectors";
import type { Allocation, AllocationMode, ChannelConnection } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { ChannelLogo } from "./channel-logo";

const modes: { id: AllocationMode; title: string; body: string; example: string }[] = [
    {
        id: "shared",
        title: "Shared",
        body: "Every channel sells from the full Available count. First sale wins.",
        example: "20 on hand → Quickvee and Shopify are both told 20 (minus their buffer).",
    },
    {
        id: "dedicated",
        title: "Dedicated",
        body: "One channel gets a fixed amount only it can sell. Other channels share the rest.",
        example: "20 on hand, 5 dedicated to Shopify → Shopify is told 5, Quickvee is told 15.",
    },
    {
        id: "hybrid",
        title: "Hybrid",
        body: "One channel can sell everything, but the reserved part is off limits to the others.",
        example: "20 on hand, 5 reserved for Quickvee → Quickvee is told 20, Shopify is told 15.",
    },
];

interface Props {
    isOpen: boolean;
    onOpenChange: (o: boolean) => void;
    variantId: string | null;
    locationId: string;
    connections: ChannelConnection[];
}

export const EditAllocationModal = ({ isOpen, onOpenChange, variantId, locationId, connections }: Props) => {
    const stockLevels = useAppStore((s) => s.stockLevels);
    const allocations = useAppStore((s) => s.allocations);
    const setAllocation = useAppStore((s) => s.setAllocation);

    const [mode, setMode] = useState<AllocationMode>("shared");
    const [reservedId, setReservedId] = useState<string | null>(null);
    const [qty, setQty] = useState(0);

    useEffect(() => {
        if (!isOpen || !variantId) return;
        const current = allocationFor({ allocations }, variantId, locationId);
        setMode(current.mode);
        setReservedId(current.reservedConnectionId ?? connections[0]?.id ?? null);
        setQty(current.reservedQty);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, variantId, locationId]);

    if (!variantId) return null;
    const available = stockAt({ stockLevels }, variantId, locationId).available;
    const draft: Allocation =
        mode === "shared"
            ? { variantId, locationId, mode, reservedConnectionId: null, reservedQty: 0 }
            : { variantId, locationId, mode, reservedConnectionId: reservedId, reservedQty: qty };
    const hypothetical = { stockLevels, allocations: [draft] };

    const save = () => {
        setAllocation(draft);
        toast.success("Allocation saved", "Channels get the new numbers on their next sync or push.");
        onOpenChange(false);
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title="Edit allocation"
            description="Moving stock between channels doesn't move anything physically. It only changes what each channel is told it can sell."
            size="lg"
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" size="lg" isDisabled={mode !== "shared" && !reservedId} onPress={save}>
                        Save allocation
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-4 rounded-xl bg-secondary p-3">
                    <VariantCell variantId={variantId} link={false} />
                    <div className="shrink-0 text-right">
                        <p className="text-xs text-tertiary">Available here</p>
                        <p className="text-lg font-semibold text-primary tabular-nums">{available}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3" role="radiogroup" aria-label="Allocation mode">
                    {modes.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={mode === m.id}
                            onClick={() => setMode(m.id)}
                            className={cx(
                                "flex flex-col gap-1 rounded-xl p-4 text-left ring-1 transition duration-100 ease-linear",
                                mode === m.id ? "bg-primary ring-2 ring-gray-950" : "bg-primary ring-secondary hover:bg-primary_hover",
                            )}
                        >
                            <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                                <span className={cx("size-4 rounded-full ring-1 ring-inset", mode === m.id ? "bg-gray-950 ring-gray-950 shadow-[inset_0_0_0_4px_white]" : "ring-gray-300")} />
                                {m.title}
                            </span>
                            <span className="text-sm text-secondary">{m.body}</span>
                            <span className="text-xs text-tertiary">e.g. {m.example}</span>
                        </button>
                    ))}
                </div>

                {mode !== "shared" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label={mode === "dedicated" ? "Dedicated to" : "Reserved for"}
                            items={connections.map((c) => ({ id: c.id, label: c.name }))}
                            selectedKey={reservedId}
                            onSelectionChange={(k) => setReservedId(k as string)}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <InputNumber
                            label="Reserved quantity"
                            hint={qty > available ? `Only ${available} available — capped at ${available}.` : undefined}
                            minValue={0}
                            value={qty}
                            onChange={(n) => setQty(Number.isNaN(n) ? 0 : n)}
                        />
                    </div>
                )}

                <div>
                    <p className="mb-2 text-sm font-semibold text-primary">What each channel will be told</p>
                    <ul className="divide-y divide-secondary rounded-xl ring-1 ring-secondary">
                        {connections.map((c) => {
                            const r = channelAllocation(hypothetical, variantId, c);
                            return (
                                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                                    <ChannelLogo channel={c.channel} size="sm" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{c.name}</span>
                                    <span className="hidden text-sm text-tertiary tabular-nums sm:block">
                                        {r.allocated} allocated − {c.safetyBuffer} buffer =
                                    </span>
                                    <span className="w-12 text-right text-md font-semibold text-primary tabular-nums">{r.sellable}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </ModalDialog>
    );
};
