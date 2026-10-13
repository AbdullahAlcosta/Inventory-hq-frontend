"use client";

import { ArrowRight } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import type { ComplianceFlag, Product } from "@/lib/types";
import { productName } from "./catalog-utils";
import { ComplianceFlagPicker } from "./compliance-chips";

export interface ProductDraft {
    brand: string;
    productLine: string;
    productType: string;
    description: string;
    attributes: Record<string, string>;
    complianceFlags: ComplianceFlag[];
    purchaseUnit: string;
    sellingUnit: string;
    unitsPerPurchaseUnit: string;
}

export const emptyProductDraft = (): ProductDraft => ({
    brand: "",
    productLine: "",
    productType: "",
    description: "",
    attributes: {},
    complianceFlags: [],
    purchaseUnit: "Case",
    sellingUnit: "Each",
    unitsPerPurchaseUnit: "10",
});

export const draftFromProduct = (p: Product): ProductDraft => ({
    brand: p.brand,
    productLine: p.productLine,
    productType: p.productType,
    description: p.description,
    attributes: Object.fromEntries(Object.entries(p.attributes).filter(([k]) => k !== "Brand" && k !== "Product Type")),
    complianceFlags: p.complianceFlags,
    purchaseUnit: p.uom.purchaseUnit,
    sellingUnit: p.uom.sellingUnit,
    unitsPerPurchaseUnit: String(p.uom.unitsPerPurchaseUnit),
});

export const productFromDraft = (d: ProductDraft) => {
    const attributes: Record<string, string> = { Brand: d.brand.trim(), "Product Type": d.productType.trim() };
    Object.entries(d.attributes).forEach(([k, v]) => v.trim() && (attributes[k] = v.trim()));
    return {
        brand: d.brand.trim(),
        productLine: d.productLine.trim(),
        productType: d.productType.trim(),
        name: productName(d.brand, d.productLine),
        description: d.description.trim(),
        attributes,
        complianceFlags: d.complianceFlags,
        uom: { purchaseUnit: d.purchaseUnit.trim() || "Case", sellingUnit: d.sellingUnit.trim() || "Each", unitsPerPurchaseUnit: Math.max(1, parseInt(d.unitsPerPurchaseUnit, 10) || 1) },
    };
};

type Patch = (patch: Partial<ProductDraft>) => void;

export const IdentityFields = ({ draft, onChange, productTypes = [] }: { draft: ProductDraft; onChange: Patch; productTypes?: string[] }) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Brand" placeholder="e.g. Geek Bar" value={draft.brand} onChange={(brand) => onChange({ brand })} isRequired hint="Full brand name, no abbreviations" />
        <Input
            label="Product line / model"
            placeholder="e.g. Pulse X"
            value={draft.productLine}
            onChange={(productLine) => onChange({ productLine })}
            isRequired
            hint="Don't include the flavor, color or size"
        />
        <div className="sm:col-span-2">
            <Input label="Product type" placeholder="e.g. Disposable Vape" value={draft.productType} onChange={(productType) => onChange({ productType })} isRequired />
            {productTypes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {productTypes.map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => onChange({ productType: t })}
                            className="cursor-pointer rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-secondary ring-1 ring-secondary ring-inset hover:bg-primary_hover"
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}
        </div>
        <TextArea className="sm:col-span-2" label="Description" placeholder="Short description for staff and channels" rows={3} value={draft.description} onChange={(description) => onChange({ description })} />
    </div>
);

export const AttributeFields = ({ draft, onChange, keys }: { draft: ProductDraft; onChange: Patch; keys: string[] }) =>
    keys.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {keys.map((k) => (
                <Input
                    key={k}
                    label={k}
                    placeholder={`Optional — or set per variant`}
                    value={draft.attributes[k] ?? ""}
                    onChange={(v) => onChange({ attributes: { ...draft.attributes, [k]: v } })}
                />
            ))}
        </div>
    ) : (
        <p className="text-sm text-tertiary">This business unit has no attribute keys.</p>
    );

export const ComplianceFields = ({ draft, onChange }: { draft: ProductDraft; onChange: Patch }) => (
    <ComplianceFlagPicker value={draft.complianceFlags} onChange={(complianceFlags) => onChange({ complianceFlags })} />
);

export const UomFields = ({ draft, onChange }: { draft: ProductDraft; onChange: Patch }) => {
    const n = Math.max(1, parseInt(draft.unitsPerPurchaseUnit, 10) || 1);
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input label="Purchase unit" placeholder="Case" value={draft.purchaseUnit} onChange={(purchaseUnit) => onChange({ purchaseUnit })} hint="What you buy in" />
                <Input label="Selling unit" placeholder="Each" value={draft.sellingUnit} onChange={(sellingUnit) => onChange({ sellingUnit })} hint="What you sell and count" />
                <Input
                    label={`${draft.sellingUnit || "Each"} per ${draft.purchaseUnit || "Case"}`}
                    value={draft.unitsPerPurchaseUnit}
                    onChange={(v) => onChange({ unitsPerPurchaseUnit: v.replace(/[^0-9]/g, "") })}
                    inputMode="numeric"
                />
            </div>
            <UomSummary purchaseUnit={draft.purchaseUnit || "Case"} sellingUnit={draft.sellingUnit || "Each"} units={n} />
        </div>
    );
};

export const UomSummary = ({ purchaseUnit, sellingUnit, units }: { purchaseUnit: string; sellingUnit: string; units: number }) => (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm">
        <span className="rounded-md bg-primary px-2 py-1 font-semibold text-primary ring-1 ring-secondary">1 {purchaseUnit}</span>
        <ArrowRight className="size-4 text-fg-quaternary" />
        <span className="rounded-md bg-primary px-2 py-1 font-semibold text-primary ring-1 ring-secondary">
            {units} {sellingUnit}
        </span>
        <span className="text-tertiary">· scanning a {purchaseUnit.toLowerCase()} barcode adds {units} units</span>
    </div>
);
