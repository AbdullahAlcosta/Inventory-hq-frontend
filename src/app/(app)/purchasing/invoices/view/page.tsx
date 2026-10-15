"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, Field } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { ModalDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceIssueList, InvoiceLinesTable, InvoiceTotals } from "@/components/app/purchasing/invoice-report";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { reconcileInvoice } from "@/lib/invoice";
import { canDecideApproval } from "@/lib/selectors";
import { type InvoiceResolution, useAppStore } from "@/store/app-store";

function InvoiceDetailPage() {
    const id = useSearchParams().get("id") ?? "";
    const scope = useRequiredScope();
    const inv = useAppStore((s) => s.vendorInvoices.find((i) => i.id === id));
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === inv?.vendorId));
    const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === inv?.poId));
    const approval = useAppStore((s) => s.approvals.find((a) => a.id === inv?.approvalId));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const resolve = useAppStore((s) => s.resolveInvoiceIssues);
    const [acting, setActing] = useState<InvoiceResolution | null>(null);
    const [note, setNote] = useState("");

    const allowed = inv && (scope.isExecutive || scope.locationIds.includes(inv.destinationId) || (scope.canManagePurchasing && scope.businessUnitIds.includes(inv.businessUnitId)));
    if (!inv || !allowed) {
        return (
            <div>
                <PageHeader backHref="/purchasing/invoices" backLabel="Vendor Invoices" title="Invoice not found" />
                <Card>
                    <Empty title="This invoice doesn’t exist or isn’t for one of your locations." />
                </Card>
            </div>
        );
    }

    // Recompute against the PO as it is now (receiving may have continued), keep the recorded issues for the record.
    const live = reconcileInvoice({ products, variants }, { lines: inv.lines, po, pages: inv.pages, totalPages: inv.totalPages });
    const canDecide = inv.status === "issues" && (approval ? canDecideApproval(scope.user, approval, scope) || approval.status !== "pending" : scope.canManage) && scope.canManage;
    const statusLabel = inv.status === "issues" ? (inv.disputeNote ? "Disputed" : "Issues") : inv.status === "matched" ? "Matched" : "Resolved";

    const act = () => {
        if (!acting) return;
        resolve(inv.id, acting, note.trim() || undefined);
        toast.success(acting === "accept_costs" ? "Costs updated from the invoice" : acting === "dispute" ? "Marked as disputed" : "Invoice resolved", `#${inv.number}`);
        setActing(null);
        setNote("");
    };

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                className="mb-0"
                backHref="/purchasing/invoices"
                backLabel="Vendor Invoices"
                eyebrow={vendor?.name}
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        Invoice #{inv.number}
                        <StatusBadge status={inv.status === "issues" ? "pending" : inv.status === "matched" ? "complete" : "resolved"} label={statusLabel} />
                    </span>
                }
                actions={
                    canDecide && (
                        <>
                            <Button color="secondary" size="lg" onPress={() => setActing("resolve")}>
                                Resolve
                            </Button>
                            {!inv.disputeNote && (
                                <Button color="secondary" size="lg" onPress={() => setActing("dispute")}>
                                    Dispute with vendor
                                </Button>
                            )}
                            <Button size="lg" onPress={() => setActing("accept_costs")}>
                                Accept &amp; update costs
                            </Button>
                        </>
                    )
                }
            />

            <Card>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                    <Field label="Purchase order">
                        {po ? (
                            <Link href={`/purchasing/orders/view?id=${po.id}`} className="text-brand-secondary hover:underline">
                                {po.number}
                            </Link>
                        ) : (
                            "No PO"
                        )}
                    </Field>
                    <Field label="Delivered to">
                        <LocationName id={inv.destinationId} />
                    </Field>
                    <Field label="Invoice date">{formatDate(inv.date + "T12:00:00")}</Field>
                    <Field label="Account #">{inv.accountNumber || "—"}</Field>
                    <Field label="Billed">{formatCurrency(inv.total)}</Field>
                    <Field label="Pages">{inv.totalPages ? `${inv.pages} of ${inv.totalPages}` : inv.pages}</Field>
                    <Field label="Scanned by">
                        <EmployeeName id={inv.createdBy} /> · <span className="font-normal text-tertiary">{formatDateTime(inv.createdAt)}</span>
                    </Field>
                    <Field label="Photo">{inv.imageName}</Field>
                    {inv.resolution && <Field label="Outcome">{inv.resolution}</Field>}
                    {inv.disputeNote && (
                        <Field label="Dispute note" className="col-span-2">
                            {inv.disputeNote}
                        </Field>
                    )}
                </dl>
            </Card>

            <InvoiceTotals totals={live.totals} hasPo={!!po} />

            <Card title="Issues found" description={`Recorded ${formatDateTime(inv.createdAt)}`}>
                <InvoiceIssueList issues={inv.issues} />
            </Card>

            <Card title="Lines" description="Invoice vs ordered vs received, as of now." flush bodyClassName="p-4">
                <InvoiceLinesTable rows={live.rows} hasPo={!!po} />
            </Card>

            <ModalDialog
                isOpen={!!acting}
                onOpenChange={(o) => !o && setActing(null)}
                title={acting === "accept_costs" ? "Accept & update costs?" : acting === "dispute" ? "Dispute with vendor" : "Resolve invoice?"}
                description={
                    acting === "accept_costs"
                        ? "Item costs (and the PO line cost) are set to the invoiced price for every price change on this invoice."
                        : acting === "dispute"
                          ? "Note what you asked the vendor for (credit, corrected invoice…). The invoice stays open until it’s resolved."
                          : "Close the issues on this invoice as handled."
                }
                footer={
                    <>
                        <Button color="secondary" size="lg" onPress={() => setActing(null)}>
                            Cancel
                        </Button>
                        <Button size="lg" onPress={act}>
                            {acting === "accept_costs" ? "Accept & update costs" : acting === "dispute" ? "Save dispute" : "Resolve"}
                        </Button>
                    </>
                }
            >
                <TextArea label={acting === "dispute" ? "Dispute note" : "Note"} rows={3} value={note} onChange={setNote} placeholder="Optional" />
            </ModalDialog>
        </div>
    );
}

export default function InvoiceDetailRoute() {
    return (
        <Suspense>
            <InvoiceDetailPage />
        </Suspense>
    );
}
