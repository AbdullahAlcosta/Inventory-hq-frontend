import type { DuplicateMatch } from "@/lib/selectors";
import type { ComplianceFlag, ImportRow, Product, Variant } from "@/lib/types";

export const complianceFlags: { id: ComplianceFlag; label: string; hint: string }[] = [
    { id: "nicotine", label: "Contains nicotine", hint: "Vapes, pouches, e-liquid" },
    { id: "tobacco", label: "Tobacco", hint: "Cigars, shisha, cigarettes" },
    { id: "vape", label: "Vape device", hint: "Disposables, pods, kits" },
    { id: "age_21", label: "21+ only", hint: "Age check at sale" },
    { id: "hemp", label: "Hemp / CBD", hint: "Hemp-derived products" },
    { id: "lithium_battery", label: "Lithium battery", hint: "Shipping restrictions" },
];

export const flagLabel = (f: ComplianceFlag) => complianceFlags.find((x) => x.id === f)?.label ?? f;

/** Short code used for SKU suggestions: first 3 letters of each word, max 6 chars. */
const skuCode = (s: string) =>
    s
        .replace(/[^A-Za-z0-9 ]/g, "")
        .split(" ")
        .filter(Boolean)
        .map((w) => w.slice(0, 3).toUpperCase())
        .join("")
        .slice(0, 6);

export const suggestSku = (brand: string, line: string, variant: string) => {
    const parts = [skuCode(brand), skuCode(line), skuCode(variant)].filter(Boolean);
    return parts.length ? parts.join("-") : "";
};

/** Appendix A: Product name = Brand + Product Line / Model. */
export const productName = (brand: string, line: string) => [brand.trim(), line.trim()].filter(Boolean).join(" ");

export const priceRange = (variants: Pick<Variant, "price">[]) => {
    if (!variants.length) return null;
    const prices = variants.map((v) => v.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
};

export const margin = (price: number, cost: number) => (price > 0 ? (price - cost) / price : 0);

/** A variant being edited in a form. Numbers are kept as strings while typing. */
export interface VariantDraft {
    key: string;
    name: string;
    sku: string;
    skuTouched: boolean;
    sellingBarcode: string;
    caseBarcode: string;
    price: string;
    cost: string;
    reorderPoint: string;
    restockQty: string;
    leadTimeDays: string;
    vendorId: string | null;
}

let draftSeq = 0;
export const emptyVariantDraft = (partial: Partial<VariantDraft> = {}): VariantDraft => ({
    key: `vd_${++draftSeq}`,
    name: "",
    sku: "",
    skuTouched: false,
    sellingBarcode: "",
    caseBarcode: "",
    price: "",
    cost: "",
    reorderPoint: "10",
    restockQty: "24",
    leadTimeDays: "7",
    vendorId: null,
    ...partial,
});

export const draftFromVariant = (v: Variant): VariantDraft => ({
    key: v.id,
    name: v.name,
    sku: v.sku,
    skuTouched: true,
    sellingBarcode: v.barcodes.find((b) => b.unit === "selling")?.code ?? "",
    caseBarcode: v.barcodes.find((b) => b.unit === "purchase")?.code ?? "",
    price: String(v.price),
    cost: String(v.cost),
    reorderPoint: String(v.reorderPoint),
    restockQty: String(v.restockQty),
    leadTimeDays: String(v.leadTimeDays),
    vendorId: v.vendorId,
});

const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
};

export const variantFromDraft = (d: VariantDraft, attributes: Record<string, string> = {}, dailySales = 0): Omit<Variant, "id" | "productId"> => ({
    name: d.name.trim() || "Default",
    sku: d.sku.trim(),
    barcodes: [
        ...(d.sellingBarcode.trim() ? [{ code: d.sellingBarcode.trim(), unit: "selling" as const }] : []),
        ...(d.caseBarcode.trim() ? [{ code: d.caseBarcode.trim(), unit: "purchase" as const }] : []),
    ],
    price: num(d.price),
    cost: num(d.cost),
    attributes,
    reorderPoint: Math.round(num(d.reorderPoint)),
    restockQty: Math.round(num(d.restockQty)),
    leadTimeDays: Math.round(num(d.leadTimeDays)),
    vendorId: d.vendorId,
    dailySales,
});

/** Dedupe matches from several findDuplicates() calls (e.g. selling + case barcode). */
export const mergeMatches = (lists: DuplicateMatch[][]) => {
    const out: DuplicateMatch[] = [];
    lists.flat().forEach((m) => {
        if (!out.some((x) => x.product.id === m.product.id && x.variant?.id === m.variant?.id && x.kind === m.kind)) out.push(m);
    });
    // Strongest first
    const rank = { exact_code: 0, same_variant: 1, same_product: 2 };
    return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
};

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

export const importColumns = ["brand", "product_line", "product_type", "variant", "sku", "upc", "price", "cost"] as const;

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else quoted = false;
            } else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ",") {
            row.push(field);
            field = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else field += c;
    }
    if (field !== "" || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((f) => f.trim() !== ""));
};

const headerAliases: Record<string, (typeof importColumns)[number]> = {
    brand: "brand",
    product_line: "product_line",
    productline: "product_line",
    line: "product_line",
    model: "product_line",
    product_type: "product_type",
    producttype: "product_type",
    type: "product_type",
    category: "product_type",
    variant: "variant",
    variant_name: "variant",
    sku: "sku",
    upc: "upc",
    barcode: "upc",
    price: "price",
    cost: "cost",
};

export const rowsFromCsv = (text: string): { rows: ImportRow[]; error: string | null } => {
    const table = parseCsv(text);
    if (!table.length) return { rows: [], error: null };
    const header = table[0].map((h) => headerAliases[h.trim().toLowerCase().replace(/[\s-]+/g, "_")] ?? null);
    if (!header.includes("brand") || !header.includes("product_line")) {
        return { rows: [], error: "The first line must be a header with at least brand and product_line columns." };
    }
    const get = (r: string[], col: (typeof importColumns)[number]) => {
        const i = header.indexOf(col);
        return i >= 0 ? (r[i] ?? "").trim() : "";
    };
    const money = (s: string) => {
        const n = parseFloat(s.replace(/[$,]/g, ""));
        return Number.isFinite(n) ? n : 0;
    };
    const rows = table.slice(1).map((r) => ({
        brand: get(r, "brand"),
        productLine: get(r, "product_line"),
        productType: get(r, "product_type"),
        variant: get(r, "variant"),
        sku: get(r, "sku"),
        upc: get(r, "upc"),
        price: money(get(r, "price")),
        cost: money(get(r, "cost")),
    }));
    return { rows, error: null };
};

const csvField = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const rowsToCsv = (rows: ImportRow[]) =>
    [
        importColumns.join(","),
        ...rows.map((r) => [r.brand, r.productLine, r.productType, r.variant, r.sku, r.upc, r.price.toFixed(2), r.cost.toFixed(2)].map(csvField).join(",")),
    ].join("\n");

export const downloadText = (fileName: string, text: string, type = "text/csv") => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const productSearchText = (p: Product, variants: Variant[]) =>
    [p.name, p.brand, p.productLine, p.productType, ...variants.flatMap((v) => [v.name, v.sku, ...v.barcodes.map((b) => b.code)])].join(" ").toLowerCase();
