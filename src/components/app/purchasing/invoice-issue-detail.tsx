"use client";

import Link from "next/link";
import { Field } from "@/components/app/card";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate } from "@/lib/format";
import { reconcileInvoice } from "@/lib/invoice";
import { useAppStore } from "@/store/app-store";
import { InvoiceIssueList, InvoiceTotals } from "./invoice-report";

/** Approval panel body for an "Invoice issue": header facts, totals and the problems found. */
export const InvoiceIssueDetail = ({ invoiceId }: { invoiceId: string }) => {
    const scope = useRequiredScope();
    const inv = useAppStore((s) => s.vendorInvoices.find((i) => i.id === invoiceId));
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === inv?.vendorId));
    const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === inv?.poId));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    if (!inv) return <p className="text-sm text-tertiary">This invoice is no longer available.</p>;
    // Totals are recomputed so "received" reflects scanning done after the invoice was recorded; issues are as recorded.
    const totals = reconcileInvoice({ products, variants }, { lines: inv.lines, po, pages: inv.pages, totalPages: inv.totalPages }).totals;
    const priceChanges = inv.issues.filter((i) => i.kind === "price_change").length;
    return (
        <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Vendor">{vendor?.name ?? "—"}</Field>
                <Field label="Invoice #">
                    <Link href={`/purchasing/invoices/view?id=${inv.id}`} className="text-brand-secondary hover:underline">
                        {inv.number}
                    </Link>
                </Field>
                <Field label="Purchase order">
                    {po ? (
                        scope.canSeePurchasing || scope.locationIds.includes(po.warehouseId) ? (
                            <Link href={`/purchasing/orders/view?id=${po.id}`} className="text-brand-secondary hover:underline">
                                {po.number}
                            </Link>
                        ) : (
                            po.number
                        )
                    ) : (
                        "No PO"
                    )}
                </Field>
                <Field label="Delivered to">
                    <LocationName id={inv.destinationId} />
                </Field>
                <Field label="Invoice date">{formatDate(inv.date + "T12:00:00")}</Field>
                <Field label="Scanned by">
                    <EmployeeName id={inv.createdBy} />
                </Field>
                <Field label="Billed">{formatCurrency(inv.total)}</Field>
                <Field label="Pages">{inv.totalPages ? `${inv.pages} of ${inv.totalPages}` : inv.pages}</Field>
            </dl>
            <InvoiceTotals totals={totals} hasPo={!!po} />
            <InvoiceIssueList issues={inv.issues} />
            {inv.disputeNote && <p className="rounded-xl bg-secondary p-3 text-sm text-secondary">Disputed: {inv.disputeNote}</p>}
            <p className="text-xs text-tertiary">
                Accept &amp; update costs sets each item’s cost to the invoiced price{priceChanges ? ` (${priceChanges} price change${priceChanges === 1 ? "" : "s"})` : ""}. Dispute with vendor saves your note as the dispute. Resolve closes it as handled.
            </p>
        </div>
    );
};
