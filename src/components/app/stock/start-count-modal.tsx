"use client";

import { useMemo, useState } from "react";
import { XClose } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import type { Key } from "react-aria-components";
import { VariantCell } from "@/components/app/item-cell";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { VariantPicker } from "@/components/app/variant-picker";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { useRequiredScope } from "@/hooks/use-session";
import { pluralize } from "@/lib/format";
import { stockAt } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { LockedLocation } from "./locked-location";
import { isLowStock, locationItems } from "./stock-utils";

interface StartCountModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    locationId?: string;
}

export const StartCountModal = (props: StartCountModalProps) => {
    if (!props.isOpen) return null;
    return <StartCountForm key={props.locationId ?? "none"} {...props} />;
};

const StartCountForm = ({ isOpen, onOpenChange, locationId: initialLocation }: StartCountModalProps) => {
    const scope = useRequiredScope();
    const router = useRouter();
    const locations = useAppStore((s) => s.locations);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const startCount = useAppStore((s) => s.startCount);

    const [locationId, setLocationId] = useState<string | null>(initialLocation ?? (scope.locations.length === 1 ? scope.locations[0].id : null));
    const [selected, setSelected] = useState<string[]>([]);
    const location = locations.find((l) => l.id === locationId);
    const kind = location && !location.openingCountDone ? "opening" : "cycle";

    /** Every active variant sold by this location's business unit. */
    const buVariants = useMemo(() => {
        if (!location) return [];
        const ids = new Set(products.filter((p) => p.businessUnitId === location.businessUnitId && p.status !== "archived").map((p) => p.id));
        return variants.filter((v) => ids.has(v.productId));
    }, [location, products, variants]);

    const allHere = useMemo(() => {
        if (!location) return [];
        // Opening count: the location may have no stock records yet, so count the whole catalog.
        if (kind === "opening") return buVariants.map((v) => v.id);
        return buVariants.filter((v) => stockLevels.some((s) => s.variantId === v.id && s.locationId === location.id)).map((v) => v.id);
    }, [location, kind, buVariants, stockLevels]);

    const lowHere = useMemo(() => {
        if (!location) return [];
        const stores = locations.filter((l) => l.businessUnitId === location.businessUnitId && l.type === "store").length;
        return buVariants.filter((v) => isLowStock(v, location, stockAt({ stockLevels }, v.id, location.id).available, stores)).map((v) => v.id);
    }, [location, locations, buVariants, stockLevels]);

    const add = (ids: string[]) => setSelected((cur) => Array.from(new Set([...cur, ...ids])));

    const start = () => {
        if (!locationId || !selected.length) return;
        const id = startCount(locationId, selected, kind);
        toast.success(`${kind === "opening" ? "Opening" : "Cycle"} count started`, `${pluralize(selected.length, "item")} at ${location?.name}.`);
        onOpenChange(false);
        router.push(`/stock/control/count?id=${id}`);
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={location ? (kind === "opening" ? "Start opening count" : "Start cycle count") : "Start count"}
            description="Count what’s on the shelf. Differences go to Approvals before stock changes."
            size="md"
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="lg" isDisabled={!locationId || !selected.length} onPress={start}>
                        {selected.length ? `Start count · ${pluralize(selected.length, "item")}` : "Start count"}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                {initialLocation && location ? (
                    <LockedLocation name={location.name} type={location.type} />
                ) : (
                    <Select
                        label="Location"
                        placeholder="Select a location"
                        items={locationItems(scope.locations)}
                        selectedKey={locationId}
                        onSelectionChange={(k: Key | null) => {
                            setLocationId(k ? String(k) : null);
                            setSelected([]);
                        }}
                    >
                        {(item) => (
                            <Select.Item id={item.id} supportingText={item.supportingText}>
                                {item.label}
                            </Select.Item>
                        )}
                    </Select>
                )}

                {location && (
                    <div className="rounded-xl bg-secondary px-4 py-3">
                        <p className="text-sm font-semibold text-primary">{kind === "opening" ? "Opening count" : "Cycle count"}</p>
                        <p className="text-sm text-tertiary">
                            {kind === "opening"
                                ? "This location hasn’t had its opening count yet. Count everything on hand — approval sets the starting stock."
                                : "Spot-check some items. System quantities are compared with what you count."}
                        </p>
                    </div>
                )}

                {location && (
                    <div>
                        <p className="mb-1.5 text-sm font-medium text-secondary">Items to count</p>
                        <div className="mb-3 flex flex-wrap gap-2">
                            <Button size="sm" color="secondary" onPress={() => add(allHere)} isDisabled={!allHere.length}>
                                All items in this location ({allHere.length})
                            </Button>
                            <Button size="sm" color="secondary" onPress={() => add(lowHere)} isDisabled={!lowHere.length}>
                                Low stock items ({lowHere.length})
                            </Button>
                            {selected.length > 0 && (
                                <Button size="sm" color="link-gray" onPress={() => setSelected([])}>
                                    Clear
                                </Button>
                            )}
                        </div>
                        <VariantPicker businessUnitIds={[location.businessUnitId]} exclude={selected} onSelect={(id) => add([id])} placeholder="Add an item…" />
                        {selected.length > 0 && (
                            <ul className="mt-3 max-h-64 divide-y divide-secondary overflow-y-auto rounded-xl ring-1 ring-secondary">
                                {selected.map((id) => (
                                    <li key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                                        <VariantCell variantId={id} link={false} />
                                        <button
                                            type="button"
                                            aria-label="Remove"
                                            onClick={() => setSelected((cur) => cur.filter((x) => x !== id))}
                                            className="rounded-md p-1 text-fg-quaternary hover:bg-primary_hover hover:text-fg-secondary"
                                        >
                                            <XClose className="size-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </ModalDialog>
    );
};
