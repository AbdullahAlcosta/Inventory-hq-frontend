/**
 * Vendor invoice reconciliation (pure).
 *
 * Takes the lines read off a vendor invoice / sales receipt and checks them against the
 * purchase order and what was actually received by scan. Everything here is a pure function
 * of the data passed in, so the backend can run the same rules later.
 */
import { lookupCode } from "@/lib/selectors";
import type { InvoiceIssue, InvoiceLine, Product, PurchaseOrder, Variant } from "@/lib/types";

type CatalogData = { products: Product[]; variants: Variant[] };

/** One invoice row after duplicate lines are merged, with its catalog / PO match. */
export interface ReconRow {
    key: string;
    code: string;
    description: string;
    /** 1-based row numbers on the invoice this row came from (more than one = duplicate line). */
    sourceRows: number[];
    variantId: string | null;
    productId: string | null;
    /** Purchase unit of the matched product, e.g. "Carton". */
    unit: string;
    /** In purchase units. */
    invoiceQty: number;
    orderedQty: number | null;
    /** Received by scan, in purchase units (may be fractional). Null when receiving hasn't started. */
    receivedQty: number | null;
    /** Per purchase unit. */
    invoicePrice: number;
    poPrice: number | null;
    /** Catalog cost per purchase unit. */
    catalogCost: number | null;
    extended: number;
    /** True when the row is only on the PO (not billed). */
    poOnly: boolean;
    issueKinds: InvoiceIssue["kind"][];
}

export interface ReconTotals {
    /** Sum of the extended amounts as printed. */
    invoiceTotal: number;
    /** Sum of qty × price — differs from invoiceTotal when lines have math errors. */
    computedTotal: number;
    /** Value of the PO as ordered. */
    poTotal: number;
    /** Value of what was scanned in, at PO cost. Null when nothing has been received yet. */
    receivedTotal: number | null;
    /** Invoice total of the lines that match a PO line. */
    matchedInvoiceTotal: number;
    /** Billed amount you may want back: over-billing, not-received units, price increases, duplicates. */
    atRisk: number;
}

export interface ReconResult {
    rows: ReconRow[];
    issues: InvoiceIssue[];
    totals: ReconTotals;
}

export const ISSUE_META: Record<InvoiceIssue["kind"], { label: string; tone: "error" | "warning" | "info" }> = {
    duplicate_line: { label: "Duplicate line", tone: "warning" },
    not_ordered: { label: "Not ordered", tone: "error" },
    not_shipped: { label: "Not on invoice", tone: "warning" },
    qty_mismatch: { label: "Qty differs from PO", tone: "error" },
    short_received: { label: "Billed but not received", tone: "error" },
    price_change: { label: "Price change", tone: "warning" },
    unknown_code: { label: "Unknown UPC", tone: "warning" },
    math_error: { label: "Math error", tone: "error" },
    incomplete_scan: { label: "Incomplete scan", tone: "warning" },
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : 0);
export const formatPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

let issueSeq = 0;
const issueId = () => `ii_${Date.now().toString(36)}_${(issueSeq++).toString(36)}`;

export interface ReconInput {
    lines: InvoiceLine[];
    po: PurchaseOrder | null | undefined;
    /** Pages photographed, and the page count printed on the invoice ("Page 1 of 2"). */
    pages: number;
    totalPages: number | null;
}

export const reconcileInvoice = (data: CatalogData, { lines, po, pages, totalPages }: ReconInput): ReconResult => {
    const issues: InvoiceIssue[] = [];
    const add = (i: Omit<InvoiceIssue, "id" | "severity"> & { severity?: InvoiceIssue["severity"] }) =>
        issues.push({ ...i, id: issueId(), severity: i.severity ?? ISSUE_META[i.kind].tone });

    // 1. Math on each printed line.
    lines.forEach((l, i) => {
        const expected = round2(l.qty * l.unitPrice);
        if (Math.abs(expected - l.extended) > 0.01) {
            add({
                kind: "math_error",
                code: l.code,
                message: `Row ${i + 1} (${l.description || l.code}): ${l.qty} × ${l.unitPrice.toFixed(2)} = ${expected.toFixed(2)}, but the invoice says ${l.extended.toFixed(2)}.`,
                amount: round2(l.extended - expected),
            });
        }
    });

    // 2. Merge lines with the same code.
    const groups = new Map<string, { code: string; description: string; rows: number[]; lines: InvoiceLine[] }>();
    lines.forEach((l, i) => {
        const code = l.code.trim();
        const key = code || `row-${i}`;
        const g = groups.get(key) ?? { code, description: l.description, rows: [], lines: [] };
        g.rows.push(i + 1);
        g.lines.push(l);
        groups.set(key, g);
    });

    const receivingStarted = !!po && (po.status !== "created" && po.status !== "sent" ? true : po.lines.some((l) => l.receivedUnits > 0));
    const rows: ReconRow[] = [];
    const seenVariants = new Set<string>();
    let atRisk = 0;

    groups.forEach((g, key) => {
        const qtyRaw = g.lines.reduce((a, l) => a + l.qty, 0);
        const extended = round2(g.lines.reduce((a, l) => a + l.extended, 0));
        const priceRaw = g.lines[0].unitPrice;
        const hit = g.code ? lookupCode(data, g.code) : null;
        const upp = hit?.product.uom.unitsPerPurchaseUnit ?? 1;
        // Normalise to purchase units (a selling-unit barcode billed per pack is converted).
        const toPU = hit && hit.unit === "selling" ? 1 / upp : 1;
        const invoiceQty = qtyRaw * toPU;
        const invoicePrice = hit && hit.unit === "selling" ? priceRaw * upp : priceRaw;
        const line = hit && po ? po.lines.find((l) => l.variantId === hit.variant.id) : undefined;
        if (hit) seenVariants.add(hit.variant.id);

        const row: ReconRow = {
            key,
            code: g.code,
            description: g.description,
            sourceRows: g.rows,
            variantId: hit?.variant.id ?? null,
            productId: hit?.product.id ?? null,
            unit: hit?.product.uom.purchaseUnit ?? "Unit",
            invoiceQty,
            orderedQty: line ? line.orderedQty : null,
            receivedQty: line && receivingStarted ? line.receivedUnits / upp : null,
            invoicePrice,
            poPrice: line ? line.unitCost : null,
            catalogCost: hit ? round2(hit.variant.cost * upp) : null,
            extended,
            poOnly: false,
            issueKinds: [],
        };
        const flag = (i: Omit<InvoiceIssue, "id" | "severity" | "code" | "variantId"> & { severity?: InvoiceIssue["severity"] }) => {
            add({ ...i, code: g.code, variantId: row.variantId });
            if (!row.issueKinds.includes(i.kind)) row.issueKinds.push(i.kind);
        };
        const name = hit ? `${hit.product.name} — ${hit.variant.name}` : g.description || g.code;

        if (g.rows.length > 1) {
            const prices = Array.from(new Set(g.lines.map((l) => l.unitPrice)));
            flag({
                kind: "duplicate_line",
                message: `${name} appears on ${g.rows.length} rows (${g.rows.join(", ")}) — billed twice? Merged to ${qtyRaw} for checking.${prices.length > 1 ? ` Prices differ: ${prices.map((p) => p.toFixed(2)).join(" / ")}.` : ""}`,
                invoiceQty,
                amount: round2(g.lines.slice(1).reduce((a, l) => a + l.extended, 0)),
            });
        }
        if (!hit) {
            flag({
                kind: "unknown_code",
                message: `${g.code || "(no code)"} “${g.description}” isn’t in the catalog. Link it to an item or add it as a draft product.`,
                invoiceQty,
                invoicePrice,
                amount: extended,
            });
        } else if (po && !line) {
            flag({
                kind: "not_ordered",
                message: `${name}: billed ${fmtQty(invoiceQty)} but it isn’t on ${po.number}.`,
                invoiceQty,
                invoicePrice,
                amount: extended,
            });
            atRisk += extended;
        }

        if (line) {
            if (Math.abs(invoiceQty - line.orderedQty) > 1e-6) {
                const over = invoiceQty > line.orderedQty;
                flag({
                    kind: "qty_mismatch",
                    severity: over ? "error" : "warning",
                    message: `${name}: invoice ${fmtQty(invoiceQty)}, ordered ${fmtQty(line.orderedQty)}${over ? " — billed more than ordered" : " — billed less (backorder?)"}.`,
                    invoiceQty,
                    orderedQty: line.orderedQty,
                    amount: over ? round2((invoiceQty - line.orderedQty) * invoicePrice) : 0,
                });
                if (over) atRisk += (invoiceQty - line.orderedQty) * invoicePrice;
            }
            if (row.receivedQty !== null && invoiceQty - row.receivedQty > 1e-6) {
                const missing = invoiceQty - row.receivedQty;
                flag({
                    kind: "short_received",
                    message: `${name}: billed ${fmtQty(invoiceQty)}, received ${fmtQty(row.receivedQty)} by scan.`,
                    invoiceQty,
                    receivedQty: row.receivedQty,
                    amount: round2(missing * invoicePrice),
                });
                atRisk += missing * invoicePrice;
            }
            if (Math.abs(invoicePrice - line.unitCost) > 0.005) {
                const change = pct(line.unitCost, invoicePrice);
                flag({
                    kind: "price_change",
                    severity: invoicePrice > line.unitCost ? "warning" : "info",
                    message: `${name}: ${invoicePrice.toFixed(2)} on the invoice vs ${line.unitCost.toFixed(2)} on the PO (${formatPct(change)})${row.catalogCost !== null && Math.abs(row.catalogCost - line.unitCost) > 0.005 ? `; catalog cost ${row.catalogCost.toFixed(2)}` : ""}.`,
                    invoicePrice,
                    poPrice: line.unitCost,
                    catalogCost: row.catalogCost ?? undefined,
                    changePct: change,
                    invoiceQty,
                    amount: round2((invoicePrice - line.unitCost) * invoiceQty),
                });
                if (invoicePrice > line.unitCost) atRisk += (invoicePrice - line.unitCost) * invoiceQty;
            }
        } else if (hit && !po && row.catalogCost !== null && Math.abs(invoicePrice - row.catalogCost) > 0.005) {
            const change = pct(row.catalogCost, invoicePrice);
            flag({
                kind: "price_change",
                severity: invoicePrice > row.catalogCost ? "warning" : "info",
                message: `${name}: ${invoicePrice.toFixed(2)} on the invoice vs catalog cost ${row.catalogCost.toFixed(2)} (${formatPct(change)}).`,
                invoicePrice,
                catalogCost: row.catalogCost,
                changePct: change,
                invoiceQty,
                amount: round2((invoicePrice - row.catalogCost) * invoiceQty),
            });
        }
        rows.push(row);
    });

    // 3. PO lines nobody billed.
    const multiPage = totalPages !== null && pages < totalPages;
    po?.lines
        .filter((l) => !seenVariants.has(l.variantId))
        .forEach((l) => {
            const v = data.variants.find((x) => x.id === l.variantId);
            const p = v ? data.products.find((x) => x.id === v.productId) : undefined;
            const upp = p?.uom.unitsPerPurchaseUnit ?? 1;
            const name = p && v ? `${p.name} — ${v.name}` : l.variantId;
            const purchase = v?.barcodes.find((b) => b.unit === "purchase") ?? v?.barcodes[0];
            add({
                kind: "not_shipped",
                code: purchase?.code ?? v?.sku,
                variantId: l.variantId,
                message: `${name}: ordered ${fmtQty(l.orderedQty)} on ${po.number} but not on the invoice${multiPage ? " (may be on a page you haven’t scanned)" : " — not shipped or not billed"}.`,
                orderedQty: l.orderedQty,
                receivedQty: receivingStarted ? l.receivedUnits / upp : undefined,
                amount: 0,
            });
            rows.push({
                key: `po-${l.variantId}`,
                code: purchase?.code ?? v?.sku ?? "",
                description: name,
                sourceRows: [],
                variantId: l.variantId,
                productId: p?.id ?? null,
                unit: p?.uom.purchaseUnit ?? "Unit",
                invoiceQty: 0,
                orderedQty: l.orderedQty,
                receivedQty: receivingStarted ? l.receivedUnits / upp : null,
                invoicePrice: 0,
                poPrice: l.unitCost,
                catalogCost: v ? round2(v.cost * upp) : null,
                extended: 0,
                poOnly: true,
                issueKinds: ["not_shipped"],
            });
        });

    // 4. Pages.
    if (multiPage) {
        add({
            kind: "incomplete_scan",
            message: `The invoice says page ${pages} of ${totalPages}. Scan the remaining page${totalPages! - pages === 1 ? "" : "s"} before recording — lines and the invoice total may be missing.`,
        });
    }

    const invoiceTotal = round2(lines.reduce((a, l) => a + l.extended, 0));
    const computedTotal = round2(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
    const poTotal = po ? round2(po.lines.reduce((a, l) => a + l.orderedQty * l.unitCost, 0)) : 0;
    const receivedTotal =
        po && receivingStarted
            ? round2(
                  po.lines.reduce((a, l) => {
                      const v = data.variants.find((x) => x.id === l.variantId);
                      const upp = data.products.find((p) => p.id === v?.productId)?.uom.unitsPerPurchaseUnit ?? 1;
                      return a + (l.receivedUnits / upp) * l.unitCost;
                  }, 0),
              )
            : null;
    const matchedInvoiceTotal = round2(rows.filter((r) => r.orderedQty !== null && !r.poOnly).reduce((a, r) => a + r.extended, 0));
    // Duplicates are a risk on their own only when they push the qty above what was ordered (already counted) — or there's no PO.
    if (!po) issues.filter((i) => i.kind === "duplicate_line").forEach((i) => (atRisk += i.amount ?? 0));

    return { rows, issues, totals: { invoiceTotal, computedTotal, poTotal, receivedTotal, matchedInvoiceTotal, atRisk: round2(atRisk) } };
};

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Issues that need a person to look (info-level notes like a price drop don't). */
export const blockingIssues = (issues: InvoiceIssue[]) => issues.filter((i) => i.severity !== "info");

/* ------------------------------------------------------------------ */
/* Simulated OCR for the static MVP                                    */
/* ------------------------------------------------------------------ */

export interface ParsedInvoice {
    vendorName: string;
    number: string;
    accountNumber: string;
    date: string;
    pages: number;
    totalPages: number | null;
    lines: InvoiceLine[];
}

/**
 * Builds a plausible invoice from a PO, with a few deliberate discrepancies so the
 * reconciliation has something to show: one price increase, one over-billed qty,
 * one duplicate row and one arithmetic slip.
 */
export const simulateInvoiceFromPo = (data: CatalogData, po: PurchaseOrder, vendorName: string): ParsedInvoice => {
    const lines: InvoiceLine[] = po.lines.map((l) => {
        const v = data.variants.find((x) => x.id === l.variantId);
        const p = v ? data.products.find((x) => x.id === v.productId) : undefined;
        const code = v?.barcodes.find((b) => b.unit === "purchase")?.code ?? v?.sku ?? l.variantId;
        const description = `${p?.name ?? ""} ${v?.name ?? ""}`.trim().toUpperCase().slice(0, 30);
        return { code, description, qty: l.orderedQty, unitPrice: l.unitCost, extended: round2(l.orderedQty * l.unitCost) };
    });
    if (lines[0]) {
        lines[0].unitPrice = round2(lines[0].unitPrice * 1.04);
        lines[0].extended = round2(lines[0].qty * lines[0].unitPrice);
    }
    if (lines.length > 1) {
        const last = lines[lines.length - 1];
        last.qty += 1;
        last.extended = round2(last.qty * last.unitPrice);
    }
    if (lines.length > 2) {
        lines.splice(2, 0, { ...lines[1], qty: 1, extended: lines[1].unitPrice });
        lines[1].extended = round2(lines[1].extended + 1);
    }
    const n = 30000 + (parseInt(po.number.replace(/\D/g, ""), 10) % 1000) * 17;
    return {
        vendorName,
        number: `INV-${n}`,
        accountNumber: "",
        date: new Date().toISOString().slice(0, 10),
        pages: 1,
        totalPages: 1,
        lines,
    };
};
