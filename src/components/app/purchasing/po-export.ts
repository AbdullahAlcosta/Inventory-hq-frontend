import { formatCurrency, formatDate } from "@/lib/format";
import type { Location, Product, PurchaseOrder, Variant, Vendor } from "@/lib/types";
import { productForVariant } from "./po-utils";

interface ExportData {
    products: Product[];
    variants: Variant[];
    vendor?: Vendor;
    warehouse?: Location;
}

const rowsFor = (po: PurchaseOrder, data: ExportData) =>
    po.lines.map((l) => {
        const v = data.variants.find((x) => x.id === l.variantId);
        const p = productForVariant(data, l.variantId);
        return {
            sku: v?.sku ?? "",
            item: p && v ? `${p.name} — ${v.name}` : "Unknown item",
            qty: l.orderedQty,
            unit: p?.uom.purchaseUnit ?? "Unit",
            units: l.orderedQty * (p?.uom.unitsPerPurchaseUnit ?? 1),
            sellingUnit: p?.uom.sellingUnit ?? "Each",
            unitCost: l.unitCost,
            total: l.orderedQty * l.unitCost,
        };
    });

const csvCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadPOCsv = (po: PurchaseOrder, data: ExportData) => {
    const rows = rowsFor(po, data);
    const lines = [
        ["Purchase order", po.number],
        ["Vendor", data.vendor?.name ?? ""],
        ["Ship to", `${data.warehouse?.name ?? ""} — ${data.warehouse?.address ?? ""}`],
        ["Created", formatDate(po.createdAt)],
        [],
        ["SKU", "Item", "Qty", "Purchase unit", "Units", "Selling unit", "Unit cost", "Line total"],
        ...rows.map((r) => [r.sku, r.item, r.qty, r.unit, r.units, r.sellingUnit, r.unitCost.toFixed(2), r.total.toFixed(2)]),
        [],
        ["", "", "", "", "", "", "Total", rows.reduce((a, r) => a + r.total, 0).toFixed(2)],
    ];
    const blob = new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${po.number}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Opens a clean, print-friendly copy of the PO and the browser's print dialog (save as PDF from there). */
export const printPO = (po: PurchaseOrder, data: ExportData) => {
    const rows = rowsFor(po, data);
    const total = rows.reduce((a, r) => a + r.total, 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(po.number)}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#101828;margin:40px;font-size:13px}
h1{font-size:24px;margin:0}.muted{color:#667085}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px;border-bottom:1px solid #eaecf0}
th{font-size:11px;color:#667085;text-transform:uppercase;letter-spacing:.04em}td.r,th.r{text-align:right}
tfoot td{font-weight:600;border:0}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-end"><div><p class="muted">Purchase order</p><h1>${esc(po.number)}</h1></div><p class="muted">${esc(formatDate(po.createdAt))}</p></div>
<div class="grid"><div><p class="muted">Vendor</p><strong>${esc(data.vendor?.name ?? "")}</strong><br>${esc(data.vendor?.contactName ?? "")}<br>${esc(data.vendor?.email ?? "")}<br>${esc(data.vendor?.phone ?? "")}</div>
<div><p class="muted">Ship to</p><strong>${esc(data.warehouse?.name ?? "")}</strong><br>${esc(data.warehouse?.address ?? "")}</div></div>
<table><thead><tr><th>SKU</th><th>Item</th><th class="r">Qty</th><th class="r">Units</th><th class="r">Unit cost</th><th class="r">Total</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.sku)}</td><td>${esc(r.item)}</td><td class="r">${r.qty} ${esc(r.unit)}</td><td class="r">${r.units} ${esc(r.sellingUnit)}</td><td class="r">${formatCurrency(r.unitCost)}</td><td class="r">${formatCurrency(r.total)}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="5" class="r">Total</td><td class="r">${formatCurrency(total)}</td></tr></tfoot></table>
${po.notes ? `<p class="muted" style="margin-top:24px">Notes</p><p>${esc(po.notes)}</p>` : ""}
<script>window.onload=()=>{window.print()}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    return true;
};
