"use client";

import { LocationName } from "@/components/app/item-cell";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

/** Vendor page: spend per recorded invoice, with price-change counts. */
export const InvoiceVendorSpend = ({ vendorId }: { vendorId: string }) => {
    const scope = useRequiredScope();
    const all = useAppStore((s) => s.vendorInvoices);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const invoices = all.filter((i) => i.vendorId === vendorId && scope.businessUnitIds.includes(i.businessUnitId));
    const total = invoices.reduce((a, i) => a + i.total, 0);
    const rows = invoices.map((i) => ({ id: i.id, inv: i, po: purchaseOrders.find((p) => p.id === i.poId), priceChanges: i.issues.filter((x) => x.kind === "price_change").length }));
    return (
        <TableCard.Root className="rounded-2xl" size="sm">
            <TableCard.Header title="Invoices & spend" badge={String(invoices.length)} description={invoices.length ? `${formatCurrency(total)} billed across ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}.` : "No invoices scanned for this vendor yet."} />
            {rows.length > 0 && (
                <Table aria-label="Vendor invoices">
                    <Table.Header>
                        <Table.Head label="Invoice #" isRowHeader />
                        <Table.Head label="Date" />
                        <Table.Head label="PO" />
                        <Table.Head label="Delivered to" />
                        <Table.Head label="Price changes" />
                        <Table.Head label="Billed" />
                        <Table.Head label="Status" />
                    </Table.Header>
                    <Table.Body items={rows}>
                        {(r) => (
                            <Table.Row id={r.id} href={`/purchasing/invoices/view?id=${r.id}`} className="cursor-pointer">
                                <Table.Cell className="font-semibold text-primary">#{r.inv.number}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{formatDate(r.inv.date + "T12:00:00")}</Table.Cell>
                                <Table.Cell>{r.po?.number ?? "—"}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">
                                    <LocationName id={r.inv.destinationId} />
                                </Table.Cell>
                                <Table.Cell className="tabular-nums">{r.priceChanges || "—"}</Table.Cell>
                                <Table.Cell className="font-medium text-primary tabular-nums">{formatCurrency(r.inv.total)}</Table.Cell>
                                <Table.Cell>
                                    <StatusBadge size="sm" status={r.inv.status === "issues" ? "pending" : r.inv.status === "matched" ? "complete" : "resolved"} label={r.inv.status === "issues" ? "Issues" : r.inv.status === "matched" ? "Matched" : "Resolved"} />
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            )}
        </TableCard.Root>
    );
};
