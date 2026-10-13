/**
 * Pure helpers that derive values from app data. They take the data as
 * arguments (never read the store directly) so they're easy to reuse on the
 * backend or in tests later.
 */
import type {
    Allocation,
    Approval,
    Barcode,
    BusinessUnit,
    ChannelConnection,
    ComplianceFlag,
    Employee,
    Location,
    Product,
    StockLevel,
    Variant,
} from "@/lib/types";

export interface DataSnapshot {
    businessUnits: BusinessUnit[];
    locations: Location[];
    employees: Employee[];
    products: Product[];
    variants: Variant[];
    stockLevels: StockLevel[];
    connections: ChannelConnection[];
    allocations: Allocation[];
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const productOf = (data: Pick<DataSnapshot, "products" | "variants">, variantId: string) => {
    const variant = data.variants.find((v) => v.id === variantId);
    return variant ? data.products.find((p) => p.id === variant.productId) : undefined;
};

/** Variant name per Appendix A: Brand + Product Line / Model + Variant. */
export const variantLabel = (data: Pick<DataSnapshot, "products" | "variants">, variantId: string) => {
    const variant = data.variants.find((v) => v.id === variantId);
    if (!variant) return "Unknown item";
    const product = data.products.find((p) => p.id === variant.productId);
    return product ? `${product.name} — ${variant.name}` : variant.name;
};

export const normalize = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

/** Rough similarity between two strings (0..1), based on shared tokens. */
export const similarity = (a: string, b: string) => {
    const ta = new Set(normalize(a).split(" ").filter(Boolean));
    const tb = new Set(normalize(b).split(" ").filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let shared = 0;
    ta.forEach((t) => tb.has(t) && shared++);
    return (2 * shared) / (ta.size + tb.size);
};

export interface DuplicateMatch {
    product: Product;
    variant: Variant | null;
    kind: "exact_code" | "same_variant" | "same_product";
    reason: string;
}

/**
 * Finds existing catalog entries a new item may duplicate. Used for the
 * "new product or variant?" guidance and for bulk import review.
 */
export const findDuplicates = (
    data: Pick<DataSnapshot, "products" | "variants">,
    input: { businessUnitId?: string; brand: string; productLine: string; variant?: string; sku?: string; upc?: string },
): DuplicateMatch[] => {
    const matches: DuplicateMatch[] = [];
    const code = input.upc?.trim();
    const sku = input.sku?.trim().toLowerCase();

    data.variants.forEach((v) => {
        const hitCode = code && v.barcodes.some((b) => b.code === code);
        const hitSku = sku && v.sku.toLowerCase() === sku;
        if (hitCode || hitSku) {
            const product = data.products.find((p) => p.id === v.productId)!;
            matches.push({ product, variant: v, kind: "exact_code", reason: hitCode ? `UPC ${code} already belongs to this item.` : `SKU ${input.sku} already exists.` });
        }
    });

    data.products
        .filter((p) => !input.businessUnitId || p.businessUnitId === input.businessUnitId)
        .forEach((p) => {
            if (matches.some((m) => m.product.id === p.id)) return;
            const sameBrand = normalize(p.brand) === normalize(input.brand);
            const lineScore = similarity(p.productLine, input.productLine);
            if (!sameBrand || lineScore < 0.6) return;
            const variantsOfP = data.variants.filter((v) => v.productId === p.id);
            const best = input.variant
                ? variantsOfP
                      .map((v) => ({ v, score: similarity(v.name, input.variant!) }))
                      .sort((a, b) => b.score - a.score)[0]
                : undefined;
            if (best && best.score >= 0.5) {
                matches.push({ product: p, variant: best.v, kind: "same_variant", reason: `Variant “${best.v.name}” is ${Math.round(best.score * 100)}% similar.` });
            } else {
                matches.push({ product: p, variant: null, kind: "same_product", reason: "Same brand and product line already exists — this is probably a new variant." });
            }
        });

    return matches;
};

/** Barcode lookup. A purchase-unit barcode converts to N selling units. */
export const lookupCode = (data: Pick<DataSnapshot, "products" | "variants">, code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return null;
    for (const v of data.variants) {
        const barcode: Barcode | undefined = v.barcodes.find((b) => b.code === trimmed);
        const skuHit = v.sku.toLowerCase() === trimmed.toLowerCase();
        if (barcode || skuHit) {
            const product = data.products.find((p) => p.id === v.productId)!;
            const unit = barcode?.unit ?? "selling";
            const units = unit === "purchase" ? product.uom.unitsPerPurchaseUnit : 1;
            return { variant: v, product, unit, units };
        }
    }
    return null;
};

export const blockedFlagsFor = (product: Product, connection: ChannelConnection): ComplianceFlag[] =>
    product.complianceFlags.filter((f) => connection.blockedFlags.includes(f));

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

export const emptyStock = (variantId: string, locationId: string): StockLevel => ({ variantId, locationId, available: 0, inTransit: 0, returns: 0, damaged: 0 });

export const stockAt = (data: Pick<DataSnapshot, "stockLevels">, variantId: string, locationId: string) =>
    data.stockLevels.find((s) => s.variantId === variantId && s.locationId === locationId) ?? emptyStock(variantId, locationId);

export const totalOnHand = (s: StockLevel) => s.available + s.inTransit + s.returns + s.damaged;

/** Days until stock runs out at the current sales speed. */
export const daysOfCover = (available: number, dailySales: number) => (dailySales > 0 ? available / dailySales : Infinity);

/* ------------------------------------------------------------------ */
/* Channels                                                            */
/* ------------------------------------------------------------------ */

export const allocationFor = (data: Pick<DataSnapshot, "allocations">, variantId: string, locationId: string): Allocation =>
    data.allocations.find((a) => a.variantId === variantId && a.locationId === locationId) ?? {
        variantId,
        locationId,
        mode: "shared",
        reservedConnectionId: null,
        reservedQty: 0,
    };

/**
 * How much a channel connection is told it may sell for one variant
 * (PRD §5.3): its allocation of the store's Available stock, minus its safety buffer.
 *
 * - shared:    every channel sells from the full Available count
 * - dedicated: the reserved channel sells only its reserved amount; others share the rest
 * - hybrid:    the reserved channel can sell everything; others can't touch the reserved part
 */
export const channelAllocation = (data: Pick<DataSnapshot, "allocations" | "stockLevels">, variantId: string, connection: ChannelConnection) => {
    if (!connection.locationId) return { allocated: 0, sellable: 0 };
    const available = stockAt(data, variantId, connection.locationId).available;
    const alloc = allocationFor(data, variantId, connection.locationId);
    const reserved = Math.min(alloc.reservedQty, available);
    const isReserved = alloc.reservedConnectionId === connection.id;

    let allocated = available;
    if (alloc.mode === "dedicated") allocated = isReserved ? reserved : available - reserved;
    if (alloc.mode === "hybrid") allocated = isReserved ? available : available - reserved;

    return { allocated, sellable: Math.max(0, allocated - connection.safetyBuffer) };
};

/* ------------------------------------------------------------------ */
/* Access & scope (PRD §4, §7: access comes from role + BU + location)  */
/* ------------------------------------------------------------------ */

export const companyBusinessUnits = (data: Pick<DataSnapshot, "businessUnits">, companyId: string) => data.businessUnits.filter((b) => b.companyId === companyId);

export const scopeFor = (data: Pick<DataSnapshot, "businessUnits" | "locations">, user: Employee) => {
    const companyBuIds = companyBusinessUnits(data, user.companyId).map((b) => b.id);
    if (user.role === "executive") {
        const locationIds = data.locations.filter((l) => companyBuIds.includes(l.businessUnitId)).map((l) => l.id);
        return { businessUnitIds: companyBuIds, locationIds };
    }
    const locationIds = user.locationIds.filter((id) => data.locations.some((l) => l.id === id && companyBuIds.includes(l.businessUnitId)));
    const businessUnitIds = Array.from(
        new Set([...user.businessUnitIds.filter((id) => companyBuIds.includes(id)), ...locationIds.map((id) => data.locations.find((l) => l.id === id)!.businessUnitId)]),
    );
    return { businessUnitIds, locationIds };
};

export const canDecideApproval = (user: Employee, approval: Approval, scope: { businessUnitIds: string[]; locationIds: string[] }) => {
    if (user.role === "executive") return scope.businessUnitIds.includes(approval.businessUnitId);
    if (user.role !== "manager") return false;
    if (approval.locationId) return scope.locationIds.includes(approval.locationId);
    return scope.businessUnitIds.includes(approval.businessUnitId);
};
