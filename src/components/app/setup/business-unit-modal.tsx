"use client";

import { useEffect, useState } from "react";
import { Check } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { InputTags } from "@/components/base/input/input-tags";
import type { BusinessUnit } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

const COLORS: BusinessUnit["color"][] = ["orange", "blue", "green", "purple", "pink", "gray"];
const swatch: Record<BusinessUnit["color"], string> = {
    orange: "bg-orange-500",
    blue: "bg-blue-500",
    green: "bg-green-600",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
    gray: "bg-gray-600",
};

/** Add or edit a Brand. Pass `unit` to edit. */
export const BusinessUnitModal = ({
    isOpen,
    onOpenChange,
    companyId,
    unit,
    onCreated,
}: {
    isOpen: boolean;
    onOpenChange: (o: boolean) => void;
    companyId: string;
    unit?: BusinessUnit | null;
    /** Called with the new brand's id after it's added. */
    onCreated?: (id: string) => void;
}) => {
    const addBusinessUnit = useAppStore((s) => s.addBusinessUnit);
    const updateBusinessUnit = useAppStore((s) => s.updateBusinessUnit);
    const [name, setName] = useState("");
    const [color, setColor] = useState<BusinessUnit["color"]>("orange");
    const [keys, setKeys] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        setName(unit?.name ?? "");
        setColor(unit?.color ?? "orange");
        setKeys(unit?.attributeKeys ?? ["Size", "Color"]);
    }, [isOpen, unit]);

    const save = () => {
        const clean = name.trim();
        if (!clean) return;
        if (unit) {
            updateBusinessUnit(unit.id, { name: clean, color, attributeKeys: keys });
            toast.success("Brand updated", clean);
        } else {
            const id = addBusinessUnit({ companyId, name: clean, color, attributeKeys: keys });
            toast.success("Brand added", "Next, add its stores and warehouses.");
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
            title={unit ? "Edit brand" : "Add brand"}
            description="A brand is a line of business with its own stores, warehouses and products."
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" size="lg" isDisabled={!name.trim()} onPress={save}>
                        {unit ? "Save changes" : "Add brand"}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <div className="flex items-end gap-3">
                    <BusinessUnitAvatar unit={{ name: name.trim() || "?", color }} size="lg" />
                    <Input label="Name" isRequired placeholder="e.g. Smoke Shops" value={name} onChange={setName} className="flex-1" autoFocus />
                </div>
                <div>
                    <p className="mb-1.5 text-sm font-medium text-secondary">Color</p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
                        {COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                role="radio"
                                aria-checked={color === c}
                                aria-label={c}
                                onClick={() => setColor(c)}
                                className={cx(
                                    "flex size-9 items-center justify-center rounded-full text-white ring-offset-2 outline-hidden focus-visible:ring-2 focus-visible:ring-brand",
                                    swatch[c],
                                    color === c && "ring-2 ring-gray-900",
                                )}
                            >
                                {color === c && <Check className="size-4" />}
                            </button>
                        ))}
                    </div>
                </div>
                <InputTags
                    label="Attribute keys"
                    placeholder="Type a key and press Enter"
                    hint="Attributes products in this brand carry, e.g. Flavor, Nicotine Strength, Size, Color."
                    value={keys}
                    onChange={setKeys}
                />
            </div>
        </ModalDialog>
    );
};
