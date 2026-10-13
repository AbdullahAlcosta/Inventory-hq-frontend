import type { POLine, Product, PurchaseOrder, Variant } from "@/lib/types";

type CatalogData = { products: Product[]; variants: Variant[] };

export const productForVariant = (data: CatalogData, variantId: string) => {
    const v = data.variants.find((x) => x.id === variantId);
    return v ? data.products.find((p) => p.id === v.productId) : undefined;
};

/** Selling units in one purchase unit for this variant (e.g. 10 Each per Case). */
export const unitsPer = (data: CatalogData, variantId: string) => productForVariant(data, variantId)?.uom.unitsPerPurchaseUnit ?? 1;

export const expectedUnits = (data: CatalogData, line: Pick<POLine, "variantId" | "orderedQty">) => line.orderedQty * unitsPer(data, line.variantId);

/** "6 Case = 60 Each" */
export const conversionText = (data: CatalogData, variantId: string, qty: number) => {
    const p = productForVariant(data, variantId);
    if (!p) return `${qty}`;
    const { purchaseUnit, sellingUnit, unitsPerPurchaseUnit } = p.uom;
    return `${qty} ${purchaseUnit} = ${qty * unitsPerPurchaseUnit} ${sellingUnit}`;
};

export const poTotals = (data: CatalogData, po: Pick<PurchaseOrder, "lines">) => {
    let units = 0;
    let received = 0;
    let cost = 0;
    po.lines.forEach((l) => {
        units += expectedUnits(data, l);
        received += l.receivedUnits;
        cost += l.orderedQty * l.unitCost;
    });
    return { lines: po.lines.length, units, received, cost };
};

export const PO_STATUSES = ["created", "sent", "receiving", "partial", "complete", "resolved"] as const;

export const poSteps = (status: PurchaseOrder["status"]) =>
    status === "partial" || status === "resolved"
        ? [
              { id: "created", label: "Created" },
              { id: "sent", label: "Sent to Vendor" },
              { id: "receiving", label: "Receiving" },
              { id: "partial", label: "Partial" },
              { id: "resolved", label: "Resolved" },
          ]
        : [
              { id: "created", label: "Created" },
              { id: "sent", label: "Sent to Vendor" },
              { id: "receiving", label: "Receiving" },
              { id: "complete", label: "Complete" },
          ];
