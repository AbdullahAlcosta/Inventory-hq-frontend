/**
 * Vendor invoice fixtures for the static MVP.
 *
 * There is no OCR service yet: when someone photographs a Bargain Line Wholesale receipt we
 * "read" this fixture, which is a line-for-line copy of a real sales receipt (page 1 of 2).
 * Duplicate rows, the multi-page footer and the prices are exactly as printed.
 */
import type { ParsedInvoice } from "@/lib/invoice";
import type { InvoiceLine, VendorInvoice } from "@/lib/types";

export const BARGAIN_LINE_VENDOR_ID = "v_bargain";

const rows: [string, string, number, number][] = [
    ["855906007017", "GRABBA LEAF 25CT", 2, 31.99],
    ["012300030717", "CAMEL BLACK SERIES BLUE BX", 1, 116.82],
    ["012300010542", "CAMEL BLACK SERIES GOLD BX", 1, 116.47],
    ["012300012669", "CAMEL BLACK SERIES RED BX", 1, 116.47],
    ["012300010276", "CAMEL BLACK SERIES SLIV BLENBX", 1, 116.47],
    ["012300844017", "CAMEL TURKISH BLEND GOLD", 1, 131.02],
    ["012300844185", "CAMEL TURKISH BLEND SILVER", 1, 131.02],
    ["012300215138", "CAMEL PLATINUM BX", 1, 131.02],
    ["012300154130", "KAMEL RED BX", 1, 147.02],
    ["012300101134", "CAMEL NONFILTER", 1, 151.55],
    ["028200138408", "MARLB GOLD BX", 4, 111.39],
    ["028200135704", "MARLB RED BX", 3, 111.39],
    ["028200138408", "MARLB GOLD BX", 2, 111.39],
    ["011000010005", "MONTE RED KING BOX", 1, 67.01],
    ["043300109004", "LUCKY STRIKE GOLD BOX", 1, 90.19],
    ["043300109271", "LUCKY STRIKE RED 100 BOX", 1, 90.19],
    ["043300109189", "LUCKY STRIKE RED BOX", 1, 90.19],
    ["028200196309", "MARLB 72'S RED BX", 1, 111.39],
    ["028200194800", "MARLB 100 BLEND #27", 1, 111.39],
    ["011000010029", "MONTE RED 100 BOX", 1, 67.01],
    ["043300045180", "LUCKY STRIKE KSF NFLT", 1, 152.25],
    ["026100806601", "NEWPO NON MENTHOL GOLD BOX", 1, 112.2],
    ["026100028256", "NEWPO NM RESERVE BOX", 1, 112.4],
    ["026100120219", "NEWPO NM BLEND 100S", 1, 122.1],
    ["026100806618", "NEWPO NON MENT GOLD100 BOX", 1, 112.2],
    ["090500100393", "KOOL NM SUPER LONG 100", 1, 116.98],
    ["026100028430", "NEWPO NM RESERVE 100", 1, 112.4],
    ["076940197087", "LD SILVER BX", 1, 58.19],
    ["076940197094", "LD SILVER 100'S", 1, 58.19],
    ["047995855185", "AMSPI BX FULL BODIED BLUE", 1, 122.2],
    ["027200011162", "CAPRI 120 MAGENTA BOX", 1, 157.5],
    ["027200011162", "CAPRI 120 MAGENTA BOX", 1, 157.5],
    ["047995855185", "AMSPI BX FULL BODIED BLUE", 1, 122.2],
    ["047995856045", "AMSPI BX FULL BOD DARK BL", 1, 122.45],
    ["047995200305", "AMSPI BX BALANCED HUNTER", 1, 122.45],
];

export const bargainLineReceiptLines: InvoiceLine[] = rows.map(([code, description, qty, unitPrice]) => ({
    code,
    description,
    qty,
    unitPrice,
    extended: Math.round(qty * unitPrice * 100) / 100,
}));

/** BARGAIN LINE WHOLESALE · 701 Kennedy St, Oakland CA · Sales Receipt · Page 1 of 2 ("Continued on next page"). */
export const bargainLineReceipt: ParsedInvoice = {
    vendorName: "Bargain Line Wholesale",
    number: "472580",
    accountNumber: "6623",
    date: "2026-07-07",
    pages: 1,
    totalPages: 2,
    lines: bargainLineReceiptLines,
};

/** Recorded invoices in the seed (none yet — scan one from Receiving or Vendor Invoices). */
export const vendorInvoices: VendorInvoice[] = [];
