"use client";

import type { Key } from "react-aria-components";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import type { Vendor } from "@/lib/types";
import type { VariantDraft } from "./catalog-utils";

interface VariantFieldsProps {
    draft: VariantDraft;
    onChange: (patch: Partial<VariantDraft>) => void;
    vendors: Vendor[];
    /** Suggested SKU shown as hint while the user hasn't typed one. */
    suggestedSku?: string;
    purchaseUnit?: string;
    sellingUnit?: string;
    autoFocus?: boolean;
}

const money = (s: string) => s.replace(/[^0-9.]/g, "");
const whole = (s: string) => s.replace(/[^0-9]/g, "");

/** The editable fields of one variant. Used by the create form and the add/edit variant modal. */
export const VariantFields = ({ draft, onChange, vendors, suggestedSku, purchaseUnit = "Case", sellingUnit = "Each", autoFocus }: VariantFieldsProps) => {
    const vendorItems = [{ id: "none", label: "No default vendor" }, ...vendors.map((v) => ({ id: v.id, label: v.name }))];
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
            <Input
                className="col-span-2"
                size="sm"
                label="Variant"
                placeholder="e.g. Blue Razz Ice"
                value={draft.name}
                onChange={(name) => onChange({ name })}
                hint="Flavor, color, strength or size only"
                autoFocus={autoFocus}
                isRequired
            />
            <Input
                className="col-span-2"
                size="sm"
                label="SKU"
                placeholder={suggestedSku || "Auto-suggested"}
                value={draft.sku}
                onChange={(sku) => onChange({ sku, skuTouched: sku !== "" })}
                hint={!draft.skuTouched && suggestedSku ? "Suggested from brand, line and variant" : undefined}
                inputClassName="font-mono"
            />
            <Input
                className="col-span-2"
                size="sm"
                label={`Selling barcode (${sellingUnit})`}
                placeholder="UPC on the unit"
                value={draft.sellingBarcode}
                onChange={(v) => onChange({ sellingBarcode: whole(v) })}
                inputMode="numeric"
                inputClassName="font-mono"
            />
            <Input
                className="col-span-2"
                size="sm"
                label={`Case barcode (${purchaseUnit})`}
                placeholder="UPC on the case"
                value={draft.caseBarcode}
                onChange={(v) => onChange({ caseBarcode: whole(v) })}
                inputMode="numeric"
                inputClassName="font-mono"
            />
            <Input size="sm" label="Price" placeholder="0.00" value={draft.price} onChange={(v) => onChange({ price: money(v) })} inputMode="decimal" />
            <Input size="sm" label="Cost" placeholder="0.00" value={draft.cost} onChange={(v) => onChange({ cost: money(v) })} inputMode="decimal" />
            <Input size="sm" label="Minimum qty" value={draft.reorderPoint} onChange={(v) => onChange({ reorderPoint: whole(v) })} inputMode="numeric" />
            <Input size="sm" label="Restock qty" value={draft.restockQty} onChange={(v) => onChange({ restockQty: whole(v) })} inputMode="numeric" />
            <Input size="sm" label="Lead time (days)" value={draft.leadTimeDays} onChange={(v) => onChange({ leadTimeDays: whole(v) })} inputMode="numeric" />
            <Select
                className="col-span-2 md:col-span-3"
                size="sm"
                label="Default vendor"
                items={vendorItems}
                selectedKey={draft.vendorId ?? "none"}
                onSelectionChange={(k: Key | null) => onChange({ vendorId: !k || k === "none" ? null : String(k) })}
            >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
        </div>
    );
};
