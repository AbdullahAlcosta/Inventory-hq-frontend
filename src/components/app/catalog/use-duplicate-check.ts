"use client";

import { useMemo } from "react";
import { type DuplicateMatch, findDuplicates } from "@/lib/selectors";
import type { Product, Variant } from "@/lib/types";
import { type VariantDraft, mergeMatches } from "./catalog-utils";

type Data = { products: Product[]; variants: Variant[] };

/** Runs findDuplicates() for a variant draft, checking both barcodes. */
export const checkVariantDraft = (
    data: Data,
    input: { businessUnitId: string; brand: string; productLine: string; draft: Pick<VariantDraft, "name" | "sku" | "sellingBarcode" | "caseBarcode"> },
    excludeVariantId?: string,
): DuplicateMatch[] => {
    const base = { businessUnitId: input.businessUnitId, brand: input.brand, productLine: input.productLine, variant: input.draft.name.trim() || undefined };
    const lists = [findDuplicates(data, { ...base, sku: input.draft.sku, upc: input.draft.sellingBarcode })];
    if (input.draft.caseBarcode.trim()) lists.push(findDuplicates(data, { ...base, upc: input.draft.caseBarcode }));
    return mergeMatches(lists).filter((m) => !excludeVariantId || m.variant?.id !== excludeVariantId);
};

/**
 * Duplicate check for adding/editing a variant of an existing product.
 * - blocking: exact UPC/SKU matches (can't be overridden)
 * - similar: a similarly named variant already on this product (can be overridden)
 */
export const useVariantDuplicateCheck = (data: Data, product: Product, draft: VariantDraft, excludeVariantId?: string) =>
    useMemo(() => {
        const all = checkVariantDraft(data, { businessUnitId: product.businessUnitId, brand: product.brand, productLine: product.productLine, draft }, excludeVariantId);
        const blocking = all.filter((m) => m.kind === "exact_code");
        const similar = all.filter((m) => m.kind === "same_variant" && m.product.id === product.id && !blocking.some((b) => b.variant?.id === m.variant?.id));
        return { blocking, similar };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.products, data.variants, product, draft.name, draft.sku, draft.sellingBarcode, draft.caseBarcode, excludeVariantId]);
