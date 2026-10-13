"use client";

import Link from "next/link";

import { useSearchParams } from "next/navigation";

import { use, useMemo, useState, Suspense } from "react";
import { AlertTriangle, Download01, Edit05, Printer, Scan, Send01 } from "@untitledui/icons";
import { Card, Field } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { EmployeeName, LocationName, VariantCell } from "@/components/app/item-cell";
import { ConfirmDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { HistoryTimeline, LineTable, Stepper, Td, UnitsProgress } from "@/components/app/purchasing/flow-ui";
import { downloadPOCsv, printPO } from "@/components/app/purchasing/po-export";
import { type DraftLine, POLinesEditor } from "@/components/app/purchasing/po-lines-editor";
import { expectedUnits, poSteps, poTotals, productForVariant } from "@/components/app/purchasing/po-utils";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDateTime, formatNumber, pluralize } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

function PurchaseOrderDetailPage() {
    const id = useSearchParams().get("id") ?? "";
    const scope = useRequiredScope();
    const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === id));
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === po?.vendorId));
    const warehouse = useAppStore((s) => s.locations.find((l) => l.id === po?.warehouseId));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const approvals = useAppStore((s) => s.approvals);
    const updatePurchaseOrder = useAppStore((s) => s.updatePurchaseOrder);
    const markPOSent = useAppStore((s) => s.markPOSent);
    const data = { products, variants };

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<DraftLine[]>([]);
    const [draftNotes, setDraftNotes] = useState("");
    const [confirmSend, setConfirmSend] = useState(false);

    const relatedApprovals = useMemo(
        () => approvals.filter((a) => (a.payload.type === "partial_po" || a.payload.type === "unexpected_item") && a.payload.poId === id),
        [approvals, id],
    );
    const partialApproval = relatedApprovals.find((a) => a.payload.type === "partial_po");

    if (!po || !scope.locationIds.includes(po.warehouseId)) {
        return (
            <div>
                <PageHeader backHref="/purchasing/orders" backLabel="Purchase Orders" title="Purchase order not found" />
                <Card>
                    <Empty title="This PO doesn’t exist or isn’t for one of your warehouses." />
                </Card>
            </div>
        );
    }

    const totals = poTotals(data, po);
    const canReceive = po.status === "sent" || po.status === "receiving";
    const notStarted = po.status === "created" || po.status === "sent";
    const exportData = { ...data, vendor, warehouse };

    const startEdit = () => {
        setDraft(po.lines.map(({ variantId, orderedQty, unitCost }) => ({ variantId, orderedQty, unitCost })));
        setDraftNotes(po.notes);
        setEditing(true);
    };
    const saveEdit = () => {
        if (draft.length === 0) {
            toast.error("A PO needs at least one line");
            return;
        }
        updatePurchaseOrder(po.id, { lines: draft.map((l) => ({ ...l, receivedUnits: 0 })), notes: draftNotes.trim() });
        setEditing(false);
        toast.success("PO updated");
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                className="mb-0"
                backHref="/purchasing/orders"
                backLabel="Purchase Orders"
                eyebrow={vendor?.name ?? "Purchase order"}
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        {po.number}
                        <StatusBadge status={po.status} size="lg" />
                        {po.source === "reorder" && (
                            <Badge type="pill-color" color="purple" size="md">
                                Reorder
                            </Badge>
                        )}
                    </span>
                }
                actions={
                    <>
                        <Button color="secondary" size="lg" iconLeading={Printer} onPress={() => !printPO(po, exportData) && toast.error("Allow pop-ups to print")}>
                            Print
                        </Button>
                        <Button color="secondary" size="lg" iconLeading={Download01} onPress={() => downloadPOCsv(po, exportData)}>
                            Download PO
                        </Button>
                        {po.status === "created" && scope.canManage && !editing && (
                            <>
                                <Button color="secondary" size="lg" iconLeading={Edit05} onPress={startEdit}>
                                    Edit lines
                                </Button>
                                <Button size="lg" iconLeading={Send01} onPress={() => setConfirmSend(true)}>
                                    Mark as sent to vendor
                                </Button>
                            </>
                        )}
                        {canReceive && (
                            <Button size="lg" iconLeading={Scan} href={`/purchasing/receiving/view?id=${po.id}`}>
                                Receive
                            </Button>
                        )}
                        {po.status === "partial" && partialApproval && scope.canManage && (
                            <Button size="lg" href={`/approvals?id=${partialApproval.id}`}>
                                Resolve in Approvals
                            </Button>
                        )}
                    </>
                }
            />

            <Card>
                <Stepper steps={poSteps(po.status)} current={po.status} history={po.history} />
            </Card>

            {po.status === "partial" && (
                <div className="flex items-start gap-3 rounded-xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200 ring-inset">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-600" />
                    <div className="text-sm">
                        <p className="font-semibold text-primary">Received short — waiting on a decision in Approvals.</p>
                        <p className="text-secondary">
                            {partialApproval?.summary ?? "Some lines arrived short."}{" "}
                            {partialApproval &&
                                (scope.canManage ? (
                                    <Link href={`/approvals?id=${partialApproval.id}`} className="font-semibold text-primary underline">
                                        Open the Approvals item
                                    </Link>
                                ) : (
                                    "A manager will resolve it."
                                ))}
                        </p>
                    </div>
                </div>
            )}

            <Card>
                <dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                    <Field label="Vendor">{vendor ? <Link href={`/purchasing/vendors/view?id=${vendor.id}`} className="hover:underline">{vendor.name}</Link> : "—"}</Field>
                    <Field label="Destination warehouse">
                        <LocationName id={po.warehouseId} />
                    </Field>
                    <Field label="Created by">
                        <EmployeeName id={po.createdBy} />
                        <span className="block text-sm font-normal text-tertiary">{formatDateTime(po.createdAt)}</span>
                    </Field>
                    <Field label="Total cost">
                        <span className="tabular-nums">{formatCurrency(totals.cost)}</span>
                        <span className="block text-sm font-normal text-tertiary">
                            {pluralize(totals.lines, "line")} · {formatNumber(totals.units)} units
                        </span>
                    </Field>
                </dl>
                {po.notes && !editing && (
                    <div className="mt-5 rounded-xl bg-secondary px-4 py-3">
                        <p className="text-xs font-semibold text-quaternary">Notes</p>
                        <p className="mt-0.5 text-sm text-secondary">{po.notes}</p>
                    </div>
                )}
            </Card>

            {editing ? (
                <Card
                    title="Edit lines"
                    description="Lines can change until the PO is sent to the vendor."
                    flush
                    actions={
                        <>
                            <Button color="secondary" onPress={() => setEditing(false)}>
                                Cancel
                            </Button>
                            <Button onPress={saveEdit}>Save changes</Button>
                        </>
                    }
                >
                    <POLinesEditor businessUnitId={po.businessUnitId} vendorId={po.vendorId} lines={draft} onChange={setDraft} />
                    <div className="border-t border-secondary px-5 py-4 md:px-6">
                        <TextArea label="Notes" rows={2} value={draftNotes} onChange={setDraftNotes} />
                    </div>
                </Card>
            ) : (
                <Card
                    title="Lines"
                    flush
                    description={notStarted ? undefined : `${formatNumber(totals.received)} of ${formatNumber(totals.units)} units received`}
                >
                    <LineTable
                        columns={[
                            { label: "Item" },
                            { label: "Ordered" },
                            { label: "Unit cost" },
                            ...(notStarted ? [] : [{ label: "Received" }, { label: "Remaining" }, { label: "Progress" }]),
                            { label: "Line total", className: "text-right" },
                        ]}
                    >
                        {po.lines.map((l) => {
                            const p = productForVariant(data, l.variantId);
                            const exp = expectedUnits(data, l);
                            const remaining = Math.max(0, exp - l.receivedUnits);
                            return (
                                <tr key={l.variantId}>
                                    <Td className="min-w-64">
                                        <VariantCell variantId={l.variantId} />
                                    </Td>
                                    <Td className="whitespace-nowrap">
                                        <span className="font-medium text-primary">
                                            {l.orderedQty} {p?.uom.purchaseUnit}
                                        </span>
                                        <span className="block text-xs">
                                            = {formatNumber(exp)} {p?.uom.sellingUnit}
                                        </span>
                                    </Td>
                                    <Td className="whitespace-nowrap tabular-nums">{formatCurrency(l.unitCost)}</Td>
                                    {!notStarted && (
                                        <>
                                            <Td className="font-medium text-primary tabular-nums">{formatNumber(l.receivedUnits)}</Td>
                                            <Td className={remaining > 0 && (po.status === "partial" || po.status === "resolved") ? "font-semibold text-orange-600 tabular-nums" : "tabular-nums"}>
                                                {formatNumber(remaining)}
                                            </Td>
                                            <Td>
                                                <UnitsProgress value={l.receivedUnits} max={exp} />
                                            </Td>
                                        </>
                                    )}
                                    <Td className="text-right font-medium whitespace-nowrap text-primary tabular-nums">{formatCurrency(l.orderedQty * l.unitCost)}</Td>
                                </tr>
                            );
                        })}
                    </LineTable>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Unexpected items" description="Scanned at receiving but not on this PO. Each one goes to Approvals for review.">
                    {po.unexpected.length === 0 ? (
                        <p className="text-sm text-tertiary">None.</p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-secondary">
                            {po.unexpected.map((u) => {
                                const ap = relatedApprovals.find((a) => a.payload.type === "unexpected_item" && a.payload.barcode === u.barcode);
                                return (
                                    <li key={u.barcode} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-primary">{u.description}</p>
                                            <p className="font-mono text-xs text-tertiary">{u.barcode}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3">
                                            <span className="text-sm font-semibold text-primary tabular-nums">+{u.units}</span>
                                            {ap && <StatusBadge status={ap.status} size="sm" />}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
                <Card title="History">
                    <HistoryTimeline events={po.history} />
                </Card>
            </div>

            <ConfirmDialog
                isOpen={confirmSend}
                onOpenChange={setConfirmSend}
                title={`Mark ${po.number} as sent?`}
                description="Do this after you’ve placed the order with the vendor (email, phone or their portal). Lines can’t be edited after this."
                confirmLabel="Mark as sent"
                onConfirm={() => {
                    markPOSent(po.id);
                    toast.success(`${po.number} sent to vendor`, "It now shows up in Receiving for the warehouse.");
                }}
            />
        </div>
    );
}

export default function PurchaseOrderDetailPageRoute() {
    return (
        <Suspense>
            <PurchaseOrderDetailPage />
        </Suspense>
    );
}
