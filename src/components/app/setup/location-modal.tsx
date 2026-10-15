"use client";

import { useEffect, useState } from "react";
import { Building02, Home03 } from "@untitledui/icons";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import type { BusinessUnit, Location, LocationType } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

/** Add or edit a store / warehouse. Pass `location` to edit. */
export const LocationModal = ({
    isOpen,
    onOpenChange,
    businessUnits,
    location,
    defaultBusinessUnitId,
    lockBusinessUnit,
    onCreated,
}: {
    isOpen: boolean;
    onOpenChange: (o: boolean) => void;
    businessUnits: BusinessUnit[];
    location?: Location | null;
    defaultBusinessUnitId?: string;
    /** Hide the brand select (the brand comes from where the modal was opened). */
    lockBusinessUnit?: boolean;
    /** Called with the new location's id after it's added. */
    onCreated?: (id: string) => void;
}) => {
    const addLocation = useAppStore((s) => s.addLocation);
    const updateLocation = useAppStore((s) => s.updateLocation);
    const locations = useAppStore((s) => s.locations);
    const [buId, setBuId] = useState("");
    const [type, setType] = useState<LocationType>("store");
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [address, setAddress] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setBuId(location?.businessUnitId ?? defaultBusinessUnitId ?? businessUnits[0]?.id ?? "");
        setType(location?.type ?? "store");
        setName(location?.name ?? "");
        setCode(location?.code ?? "");
        setAddress(location?.address ?? "");
    }, [isOpen, location, defaultBusinessUnitId, businessUnits]);

    const codeTaken = !!code.trim() && locations.some((l) => l.id !== location?.id && l.code.toLowerCase() === code.trim().toLowerCase() && businessUnits.some((b) => b.id === l.businessUnitId));
    const ready = buId && name.trim() && code.trim() && address.trim() && !codeTaken;

    const save = () => {
        if (!ready) return;
        const input = { businessUnitId: buId, type, name: name.trim(), code: code.trim().toUpperCase(), address: address.trim() };
        if (location) {
            updateLocation(location.id, input);
            toast.success("Location updated", input.name);
        } else {
            const id = addLocation(input);
            toast.success(`${type === "store" ? "Store" : "Warehouse"} added`, "Run an opening count before it starts selling or shipping.");
            onOpenChange(false);
            onCreated?.(id);
            return;
        }
        onOpenChange(false);
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={location ? "Edit location" : lockBusinessUnit && buId ? `Add location to ${businessUnits.find((b) => b.id === buId)?.name ?? "brand"}` : "Add location"}
            description={location ? undefined : "New locations start empty. An opening count sets their starting stock."}
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" size="lg" isDisabled={!ready} onPress={save}>
                        {location ? "Save changes" : "Add location"}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                {!(lockBusinessUnit && buId) && (
                <Select
                    label="Brand"
                    isRequired
                    items={businessUnits.map((b) => ({ id: b.id, label: b.name }))}
                    selectedKey={buId || null}
                    onSelectionChange={(k) => k && setBuId(String(k))}
                >
                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
                )}
                <div>
                    <p className="mb-1.5 text-sm font-medium text-secondary">Type</p>
                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Type">
                        {(
                            [
                                { id: "store", label: "Store", hint: "Sells to customers", icon: Home03 },
                                { id: "warehouse", label: "Warehouse", hint: "Receives POs, ships to stores", icon: Building02 },
                            ] as const
                        ).map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                role="radio"
                                aria-checked={type === o.id}
                                onClick={() => setType(o.id)}
                                className={cx(
                                    "flex items-start gap-3 rounded-xl p-3 text-left ring-1 outline-hidden ring-inset focus-visible:ring-2 focus-visible:ring-brand",
                                    type === o.id ? "bg-primary ring-2 ring-gray-900" : "ring-primary hover:bg-primary_hover",
                                )}
                            >
                                <o.icon className="mt-0.5 size-5 shrink-0 text-fg-secondary" />
                                <span>
                                    <span className="block text-sm font-semibold text-primary">{o.label}</span>
                                    <span className="block text-xs text-tertiary">{o.hint}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Input label="Name" isRequired placeholder={type === "store" ? "e.g. Dublin Smoke Shop" : "e.g. Smoke Shops Warehouse"} value={name} onChange={setName} className="sm:col-span-2" />
                    <Input
                        label="Code"
                        isRequired
                        placeholder="e.g. DUB"
                        value={code}
                        onChange={setCode}
                        isInvalid={codeTaken}
                        hint={codeTaken ? "Code already used" : undefined}
                    />
                </div>
                <Input label="Address" isRequired placeholder="Street, city, state" value={address} onChange={setAddress} />
            </div>
        </ModalDialog>
    );
};
