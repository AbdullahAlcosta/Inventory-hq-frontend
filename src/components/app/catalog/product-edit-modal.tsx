"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { findDuplicates } from "@/lib/selectors";
import type { Product } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { productName } from "./catalog-utils";
import { DuplicateList } from "./duplicate-list";
import { AttributeFields, ComplianceFields, IdentityFields, type ProductDraft, UomFields, draftFromProduct, productFromDraft } from "./product-fields";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="border-t border-secondary pt-5 first:border-t-0 first:pt-0">
        <h3 className="mb-3 text-sm font-semibold text-primary">{title}</h3>
        {children}
    </section>
);

export const ProductEditModal = ({ isOpen, onOpenChange, product }: { isOpen: boolean; onOpenChange: (o: boolean) => void; product: Product }) => {
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const bu = useAppStore((s) => s.businessUnits.find((b) => b.id === product.businessUnitId));
    const updateProduct = useAppStore((s) => s.updateProduct);
    const [draft, setDraft] = useState<ProductDraft>(() => draftFromProduct(product));
    const [override, setOverride] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setDraft(draftFromProduct(product));
            setOverride(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, product.id]);

    const renamed = draft.brand.trim() !== product.brand || draft.productLine.trim() !== product.productLine;
    const matches = useMemo(
        () =>
            renamed
                ? findDuplicates({ products, variants }, { businessUnitId: product.businessUnitId, brand: draft.brand, productLine: draft.productLine }).filter(
                      (m) => m.product.id !== product.id && m.kind !== "exact_code",
                  )
                : [],
        [renamed, products, variants, product, draft.brand, draft.productLine],
    );

    const valid = draft.brand.trim() && draft.productLine.trim() && draft.productType.trim();
    const canSave = valid && (!matches.length || override);

    const save = () => {
        const next = productFromDraft(draft);
        updateProduct(product.id, next);
        toast.success("Product updated", next.name);
        onOpenChange(false);
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size="lg"
            title="Edit product"
            description={
                <>
                    Product name: <span className="font-semibold text-primary">{productName(draft.brand, draft.productLine) || "—"}</span>
                </>
            }
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" size="lg" isDisabled={!canSave} onPress={save}>
                        Save changes
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <Section title="Identity">
                    <IdentityFields draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
                </Section>
                <DuplicateList matches={matches} title="Another product already uses this name" description="Renaming would create a duplicate. Merge variants instead, or confirm they're different products.">
                    <Checkbox isSelected={override} onChange={setOverride} label="These are different products" />
                </DuplicateList>
                {bu && bu.attributeKeys.length > 0 && (
                    <Section title={`${bu.name} attributes`}>
                        <AttributeFields draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} keys={bu.attributeKeys} />
                    </Section>
                )}
                <Section title="Compliance">
                    <ComplianceFields draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
                </Section>
                <Section title="Units of measure">
                    <UomFields draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
                </Section>
            </div>
        </ModalDialog>
    );
};
