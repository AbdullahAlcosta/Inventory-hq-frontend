"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera01, CheckCircle, File06, Plus, RefreshCw01, Trash01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { InputNumber } from "@/components/base/input/input-number";
import { formatCurrency } from "@/lib/format";
import { type ParsedInvoice, blockingIssues, reconcileInvoice, simulateInvoiceFromPo } from "@/lib/invoice";
import type { InvoiceLine, PurchaseOrder } from "@/lib/types";
import { BARGAIN_LINE_VENDOR_ID, bargainLineReceipt } from "@/mock/invoices";
import { useAppStore } from "@/store/app-store";
import { InvoiceIssueList, InvoiceLinesTable, InvoiceTotals } from "./invoice-report";

type Step = "upload" | "reading" | "edit" | "report" | "saved";

interface InvoiceScanProps {
    vendorId: string;
    destinationId: string;
    /** The PO this delivery is for. Without one, the report offers "Receive without a PO". */
    po?: PurchaseOrder | null;
    /** Render without the outer card (e.g. inside a page that already has one). */
    bare?: boolean;
    onRecorded?: (invoiceId: string) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * "Scan vendor invoice": photo → (simulated) OCR → editable lines → check against the PO → record.
 * In this static MVP the OCR is simulated: Bargain Line receipts read the fixture in src/mock/invoices.ts,
 * other vendors get lines generated from the PO with a few discrepancies.
 */
export const InvoiceScan = ({ vendorId, destinationId, po, bare, onRecorded }: InvoiceScanProps) => {
    const router = useRouter();
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === vendorId));
    const destination = useAppStore((s) => s.locations.find((l) => l.id === destinationId));
    const livePo = useAppStore((s) => (po ? s.purchaseOrders.find((p) => p.id === po.id) : undefined)) ?? null;
    const vendorInvoices = useAppStore((s) => s.vendorInvoices);
    const recordInvoice = useAppStore((s) => s.recordInvoice);
    const createPoFromInvoice = useAppStore((s) => s.createPoFromInvoice);
    const createProduct = useAppStore((s) => s.createProduct);

    const fileRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<Step>("upload");
    const [imageName, setImageName] = useState("");
    const [doc, setDoc] = useState<ParsedInvoice | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    const result = useMemo(
        () => (doc ? reconcileInvoice({ products, variants }, { lines: doc.lines, po: livePo, pages: doc.pages, totalPages: doc.totalPages }) : null),
        [doc, products, variants, livePo],
    );
    const already = doc ? vendorInvoices.find((i) => i.vendorId === vendorId && i.number.trim().toLowerCase() === doc.number.trim().toLowerCase()) : undefined;

    /** Simulated OCR: a short "reading" step, then the parsed document. */
    const read = (name: string, nextPage = false) => {
        setImageName((n) => (nextPage && n ? `${n}, ${name}` : name));
        setStep("reading");
        setTimeout(() => {
            if (nextPage && doc) {
                // Page 2 of a Bargain Line receipt: the PO lines that weren't on page 1.
                const onInvoice = new Set(doc.lines.map((l) => l.code));
                const more: InvoiceLine[] = (livePo?.lines ?? [])
                    .map((l) => {
                        const v = variants.find((x) => x.id === l.variantId);
                        const p = products.find((x) => x.id === v?.productId);
                        const code = v?.barcodes.find((b) => b.unit === "purchase")?.code ?? v?.sku ?? "";
                        return { code, description: `${p?.name ?? ""} ${v?.name ?? ""}`.toUpperCase().slice(0, 30), qty: l.orderedQty, unitPrice: l.unitCost, extended: round2(l.orderedQty * l.unitCost) };
                    })
                    .filter((l) => l.code && !onInvoice.has(l.code));
                setDoc({ ...doc, pages: doc.pages + 1, lines: [...doc.lines, ...more] });
                toast.success(`Page ${doc.pages + 1} read`, `${more.length} more line${more.length === 1 ? "" : "s"}.`);
            } else if (vendorId === BARGAIN_LINE_VENDOR_ID) {
                setDoc(structuredClone(bargainLineReceipt));
            } else if (livePo) {
                setDoc(simulateInvoiceFromPo({ products, variants }, livePo, vendor?.name ?? ""));
            } else {
                setDoc({ vendorName: vendor?.name ?? "", number: "", accountNumber: "", date: new Date().toISOString().slice(0, 10), pages: 1, totalPages: 1, lines: [{ code: "", description: "", qty: 1, unitPrice: 0, extended: 0 }] });
            }
            setStep("edit");
        }, 1400);
    };

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) read(file.name, step === "report" || step === "edit");
    };

    const setLine = (i: number, patch: Partial<InvoiceLine>) =>
        setDoc((d) => {
            if (!d) return d;
            const lines = d.lines.map((l, idx) => {
                if (idx !== i) return l;
                const next = { ...l, ...patch };
                // Keep extended in step with qty/price unless the person typed it.
                if (patch.extended === undefined && (patch.qty !== undefined || patch.unitPrice !== undefined) && Math.abs(round2(l.qty * l.unitPrice) - l.extended) < 0.01) next.extended = round2(next.qty * next.unitPrice);
                return next;
            });
            return { ...d, lines };
        });

    const record = () => {
        if (!doc) return null;
        if (!doc.number.trim()) {
            toast.error("Invoice number missing", "Type the invoice / transaction number from the document.");
            setStep("edit");
            return null;
        }
        const r = recordInvoice({ vendorId, poId: livePo?.id ?? null, destinationId, number: doc.number, accountNumber: doc.accountNumber, date: doc.date, pages: doc.pages, totalPages: doc.totalPages, lines: doc.lines, imageName: imageName || "photo.jpg" });
        if (!r.id) {
            toast.error(`Invoice #${doc.number} is already recorded`, "The same invoice can’t be recorded twice — it may be a duplicate bill.");
            return null;
        }
        const open = blockingIssues(r.issues).length;
        if (open) toast.warning(`Invoice #${doc.number} recorded`, `${open} issue${open === 1 ? "" : "s"} sent to Approvals.`);
        else toast.success(`Invoice #${doc.number} recorded`, "It matches the PO.");
        setSavedId(r.id);
        setStep("saved");
        onRecorded?.(r.id);
        return r.id;
    };

    const receiveWithoutPo = () => {
        if (!doc) return;
        const invoiceId = record();
        if (!invoiceId) return;
        const poId = createPoFromInvoice({ vendorId, destinationId, lines: doc.lines, invoiceNumber: doc.number, invoiceId });
        const number = useAppStore.getState().purchaseOrders.find((p) => p.id === poId)?.number;
        toast.success(`${number} created from the invoice`, "Scan the delivery in to receive it.");
        router.push(`/purchasing/receiving/view?id=${poId}`);
    };

    const unknown = result?.rows.filter((r) => !r.variantId && r.code) ?? [];
    const addUnknownAsDrafts = () => {
        const buId = destination?.businessUnitId ?? "";
        unknown.forEach((r) => {
            createProduct(
                {
                    businessUnitId: buId,
                    brand: r.description.split(" ")[0] ?? "",
                    productLine: r.description.split(" ").slice(1).join(" "),
                    productType: "",
                    name: r.description,
                    description: `Added from invoice #${doc?.number}. Review the name, units and price.`,
                    attributes: {},
                    complianceFlags: [],
                    uom: { purchaseUnit: "Case", sellingUnit: "Each", unitsPerPurchaseUnit: 1 },
                    status: "draft",
                },
                [{ name: "Default", sku: `INV-${r.code.slice(-6)}`, barcodes: [{ code: r.code, unit: "purchase" }], price: 0, cost: r.invoicePrice, attributes: {}, reorderPoint: 0, restockQty: 1, leadTimeDays: 7, vendorId, dailySales: 0 }],
            );
        });
        toast.success(`${unknown.length} draft product${unknown.length === 1 ? "" : "s"} added`, "Find them under Products → Draft to finish the details.");
    };

    const reset = () => {
        setDoc(null);
        setSavedId(null);
        setImageName("");
        setStep("upload");
    };

    const fileInput = <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onFile} aria-label="Invoice photo" />;

    let body: React.ReactNode = null;
    if (step === "upload") {
        body = (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm text-tertiary">
                    Photograph {vendor?.name ? `${vendor.name}’s` : "the vendor’s"} invoice or sales receipt. We read the lines and check them against {livePo ? livePo.number : "the catalog"}
                    {livePo ? " and what you scanned in" : ""}: missing or extra items, quantities, price changes, duplicate lines and math.
                </p>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <Button color="secondary" size="lg" iconLeading={File06} onPress={() => read("sample-receipt.jpg")}>
                        Use sample
                    </Button>
                    <Button size="lg" iconLeading={Camera01} onPress={() => fileRef.current?.click()}>
                        Take photo / upload
                    </Button>
                </div>
            </div>
        );
    } else if (step === "reading") {
        body = (
            <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
                <RefreshCw01 className="size-8 animate-spin text-fg-quaternary" />
                <p className="text-md font-semibold text-primary">Reading invoice…</p>
                <p className="text-sm text-tertiary">{imageName}</p>
            </div>
        );
    } else if (step === "edit" && doc) {
        const total = round2(doc.lines.reduce((a, l) => a + l.extended, 0));
        body = (
            <div className="flex flex-col gap-5">
                <p className="text-sm text-tertiary">Check what we read and fix anything that was misread before checking it against the PO.</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Input size="sm" label="Invoice / transaction #" value={doc.number} onChange={(v) => setDoc({ ...doc, number: v })} isInvalid={!!already} hint={already ? "Already recorded" : undefined} />
                    <Input size="sm" label="Account #" value={doc.accountNumber} onChange={(v) => setDoc({ ...doc, accountNumber: v })} />
                    <Input size="sm" label="Date" type="date" value={doc.date} onChange={(v) => setDoc({ ...doc, date: v })} />
                    <InputNumber size="sm" label="Pages scanned" minValue={1} value={doc.pages} onChange={(v) => setDoc({ ...doc, pages: Number.isNaN(v) ? 1 : v })} />
                    <InputNumber size="sm" label="Pages on invoice" minValue={1} value={doc.totalPages ?? NaN} placeholder="?" onChange={(v) => setDoc({ ...doc, totalPages: Number.isNaN(v) ? null : v })} />
                </div>
                <div className="overflow-x-auto rounded-xl ring-1 ring-secondary">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-secondary">
                            <tr className="text-xs font-semibold text-quaternary">
                                <th className="w-10 px-2 py-2 text-left">#</th>
                                <th className="px-2 py-2 text-left">Item lookup code</th>
                                <th className="px-2 py-2 text-left">Description</th>
                                <th className="w-24 px-2 py-2 text-right">Qty</th>
                                <th className="w-32 px-2 py-2 text-right">Price</th>
                                <th className="w-32 px-2 py-2 text-right">Extended</th>
                                <th className="w-10" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary">
                            {doc.lines.map((l, i) => {
                                const mathOff = Math.abs(round2(l.qty * l.unitPrice) - l.extended) > 0.01;
                                return (
                                    <tr key={i}>
                                        <td className="px-2 py-1.5 text-tertiary tabular-nums">{i + 1}</td>
                                        <td className="px-2 py-1.5">
                                            <Input size="sm" aria-label="Code" inputClassName="font-mono" value={l.code} onChange={(v) => setLine(i, { code: v })} />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <Input size="sm" aria-label="Description" value={l.description} onChange={(v) => setLine(i, { description: v })} />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <InputNumber size="sm" aria-label="Quantity" minValue={0} value={l.qty} onChange={(v) => setLine(i, { qty: Number.isNaN(v) ? 0 : v })} />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <InputNumber size="sm" aria-label="Unit price" minValue={0} formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} value={l.unitPrice} onChange={(v) => setLine(i, { unitPrice: Number.isNaN(v) ? 0 : v })} />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <InputNumber size="sm" aria-label="Extended" isInvalid={mathOff} formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} value={l.extended} onChange={(v) => setLine(i, { extended: Number.isNaN(v) ? 0 : v })} />
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <ButtonUtility size="xs" color="tertiary" icon={Trash01} tooltip="Remove line" onPress={() => setDoc({ ...doc, lines: doc.lines.filter((_, idx) => idx !== i) })} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button color="secondary" size="md" iconLeading={Plus} onPress={() => setDoc({ ...doc, lines: [...doc.lines, { code: "", description: "", qty: 1, unitPrice: 0, extended: 0 }] })}>
                            Add line
                        </Button>
                        <span className="text-sm text-tertiary">
                            {doc.lines.length} lines · total <span className="font-semibold text-primary tabular-nums">{formatCurrency(total)}</span>
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button color="secondary" size="lg" onPress={reset}>
                            Start over
                        </Button>
                        <Button size="lg" onPress={() => setStep("report")}>
                            {livePo ? "Check against PO" : "Check invoice"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    } else if (step === "report" && doc && result) {
        const open = blockingIssues(result.issues).length;
        const incomplete = result.issues.some((i) => i.kind === "incomplete_scan");
        body = (
            <div className="flex flex-col gap-5">
                <InvoiceTotals totals={result.totals} hasPo={!!livePo} />
                {already && (
                    <div className="rounded-xl bg-error-primary p-3 text-sm text-error-primary">
                        Invoice #{doc.number} from {vendor?.name} was already recorded on {new Date(already.createdAt).toLocaleDateString()}. Recording it again isn’t allowed — this may be a duplicate bill.
                    </div>
                )}
                <InvoiceIssueList issues={result.issues} />
                <InvoiceLinesTable rows={result.rows} hasPo={!!livePo} />
                <div className="flex flex-col gap-3 border-t border-secondary pt-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <Button color="secondary" size="lg" onPress={() => setStep("edit")}>
                            Back to edit
                        </Button>
                        {incomplete && (
                            <Button color="secondary" size="lg" iconLeading={Camera01} onPress={() => (vendorId === BARGAIN_LINE_VENDOR_ID ? read("page-2.jpg", true) : fileRef.current?.click())}>
                                Scan page {doc.pages + 1}
                            </Button>
                        )}
                        {unknown.length > 0 && livePo && (
                            <Button color="secondary" size="lg" onPress={addUnknownAsDrafts}>
                                Add {unknown.length} unknown as draft products
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {!livePo && (
                            <Button color="secondary" size="lg" isDisabled={!!already} onPress={receiveWithoutPo}>
                                Receive without a PO
                            </Button>
                        )}
                        <Button size="lg" isDisabled={!!already} onPress={record}>
                            {open ? `Record & send ${open} issue${open === 1 ? "" : "s"} to Approvals` : "Record invoice"}
                        </Button>
                    </div>
                </div>
                {!livePo && <p className="text-xs text-tertiary">Receive without a PO creates a PO from these lines (unknown codes become draft products) and opens it for scanning in.</p>}
            </div>
        );
    } else if (step === "saved") {
        const inv = vendorInvoices.find((i) => i.id === savedId);
        body = (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <CheckCircle className="size-6 shrink-0 text-fg-success-secondary" />
                    <div>
                        <p className="text-md font-semibold text-primary">Invoice #{inv?.number} recorded</p>
                        <p className="text-sm text-tertiary">
                            {inv?.status === "issues" ? `${blockingIssues(inv.issues).length} issues are waiting in Approvals for a manager at ${destination?.name}.` : "It matches — nothing to review."}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button color="secondary" size="lg" onPress={reset}>
                        Scan another
                    </Button>
                    {inv && (
                        <Button size="lg" href={`/purchasing/invoices/view?id=${inv.id}`}>
                            View invoice
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    const content = (
        <>
            {fileInput}
            {body}
        </>
    );
    if (bare) return content;
    return (
        <Card title="Scan vendor invoice" description={step === "upload" ? undefined : `${vendor?.name ?? "Vendor"}${doc?.number ? ` · #${doc.number}` : ""}${doc?.totalPages ? ` · page ${doc.pages} of ${doc.totalPages}` : ""}`}>
            {content}
        </Card>
    );
};
