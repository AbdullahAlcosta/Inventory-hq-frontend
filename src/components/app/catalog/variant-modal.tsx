"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import type { Product, Variant } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { type VariantDraft, draftFromVariant, emptyVariantDraft, suggestSku, variantFromDraft } from "./catalog-utils";
import { DuplicateList } from "./duplicate-list";
import { useVariantDuplicateCheck } from "./use-duplicate-check";
import { VariantFields } from "./variant-fields";

interface VariantModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    product: Product;
    /** Edit this variant. Leave empty to add a new one. */
    variant?: Variant | null;
    /** Prefill for a new variant (e.g. "Add as variant of…" from the create form). */
    initial?: Partial<VariantDraft>;
    onSaved?: (variantId: string) => void;
}

export const VariantModal = ({ isOpen, onOpenChange, product, variant, initial, onSaved }: VariantModalProps) => {
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const allVendors = useAppStore((s) => s.vendors);
    const addVariant = useAppStore((s) => s.addVariant);
    const updateVariant = useAppStore((s) => s.updateVariant);
    const vendors = useMemo(() => allVendors.filter((v) => v.businessUnitIds.includes(product.businessUnitId)), [allVendors, product.businessUnitId]);

    const [draft, setDraft] = useState<VariantDraft>(() => (variant ? draftFromVariant(variant) : emptyVariantDraft(initial)));
    const [override, setOverride] = useState(false);

    // Reset whenever the modal opens for a different target.
    useEffect(() => {
        if (!isOpen) return;
        const siblings = variants.filter((v) => v.productId === product.id);
        const ref = siblings[0];
        setDraft(
            variant
                ? draftFromVariant(variant)
                : emptyVariantDraft({
                      price: ref ? String(ref.price) : "",
                      cost: ref ? String(ref.cost) : "",
                      reorderPoint: ref ? String(ref.reorderPoint) : "10",
                      restockQty: ref ? String(ref.restockQty) : "24",
                      leadTimeDays: ref ? String(ref.leadTimeDays) : "7",
                      vendorId: ref?.vendorId ?? null,
                      ...initial,
                  }),
        );
        setOverride(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, variant?.id, product.id]);

    const suggestedSku = suggestSku(product.brand, product.productLine, draft.name);
    const effectiveDraft = { ...draft, sku: draft.sku.trim() || suggestedSku };
    const { blocking, similar: rawSimilar } = useVariantDuplicateCheck({ products, variants }, product, effectiveDraft, variant?.id);
    const similar = variant && variant.name.trim() === draft.name.trim() ? [] : rawSimilar;

    const missingName = !draft.name.trim();
    const canSave = !missingName && !blocking.length && (!similar.length || override);

    const save = () => {
        if (!canSave) return;
        const data = variantFromDraft(effectiveDraft, variant?.attributes ?? {}, variant?.dailySales ?? 0);
        if (variant) {
            updateVariant(variant.id, data);
            toast.success("Variant updated", `${product.name} — ${data.name}`);
            onSaved?.(variant.id);
        } else {
            const id = addVariant(product.id, data);
            toast.success("Variant added", `${product.name} — ${data.name}`);
            onSaved?.(id);
        }
        onOpenChange(false);
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size="lg"
            title={variant ? "Edit variant" : "Add variant"}
            description={
                <>
                    Variant name preview:{" "}
                    <span className="font-semibold text-primary">
                        {product.name} {draft.name.trim() || <span className="text-quaternary">+ variant</span>}
                    </span>
                </>
            }
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" size="lg" isDisabled={!canSave} onPress={save}>
                        {variant ? "Save variant" : "Add variant"}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <VariantFields
                    draft={draft}
                    onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                    vendors={vendors}
                    suggestedSku={suggestedSku}
                    purchaseUnit={product.uom.purchaseUnit}
                    sellingUnit={product.uom.sellingUnit}
                    autoFocus
                />
                <DuplicateList
                    tone="error"
                    matches={blocking}
                    title="This barcode or SKU is already in the catalog"
                    description="A barcode or SKU can only belong to one item. Change it, or edit the existing item instead."
                />
                <DuplicateList
                    matches={similar}
                    title="A similar variant already exists"
                    description="Check it's not the same item under a slightly different name."
                >
                    <Checkbox isSelected={override} onChange={setOverride} label="It's a different variant — add it anyway" />
                </DuplicateList>
            </div>
        </ModalDialog>
    );
};
