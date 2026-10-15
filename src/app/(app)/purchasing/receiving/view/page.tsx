"use client";

import { useSearchParams } from "next/navigation";

import { use, useMemo, useRef, useState, Suspense } from "react";
import { AlertTriangle, CheckCircle, PackageCheck } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { LocationName } from "@/components/app/item-cell";
import { ConfirmDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { UnitsProgress } from "@/components/app/purchasing/flow-ui";
import { expectedUnits, poTotals, productForVariant } from "@/components/app/purchasing/po-utils";
import { ReceivingLine } from "@/components/app/purchasing/receiving-line";
import { ScanInput, type ScanFeedback, type SimulatedCode } from "@/components/app/scan-input";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { useRequiredScope } from "@/hooks/use-session";
import { formatNumber } from "@/lib/format";
import { lookupCode } from "@/lib/selectors";
import type { POStatus } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

interface ScanLogEntry {
    id: number;
    tone: ScanFeedback["tone"];
    text: string;
}

function ReceivePOPage() {
    const id = useSearchParams().get("id") ?? "";
    const scope = useRequiredScope();
    const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === id));
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === po?.vendorId));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const approvals = useAppStore((s) => s.approvals);
    const receiveScan = useAppStore((s) => s.receiveScan);
    const receiveManual = useAppStore((s) => s.receiveManual);
    const finishReceiving = useAppStore((s) => s.finishReceiving);
    const data = { products, variants };

    const [highlight, setHighlight] = useState<string | null>(null);
    const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [log, setLog] = useState<ScanLogEntry[]>([]);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState<POStatus | null>(null);

    // Demo barcodes: each line's case + selling barcode, a catalog item not on the PO, and an unknown code.
    const simulate = useMemo<SimulatedCode[]>(() => {
        if (!po) return [];
        const codes: SimulatedCode[] = [];
        po.lines.forEach((l) => {
            const v = variants.find((x) => x.id === l.variantId);
            const p = productForVariant(data, l.variantId);
            if (!v || !p) return;
            const purchase = v.barcodes.find((b) => b.unit === "purchase");
            const selling = v.barcodes.find((b) => b.unit === "selling");
            if (purchase) codes.push({ code: purchase.code, label: `${p.name} — ${v.name}`, hint: `1 ${p.uom.purchaseUnit} = ${p.uom.unitsPerPurchaseUnit} ${p.uom.sellingUnit}` });
            if (selling) codes.push({ code: selling.code, label: `${p.name} — ${v.name}`, hint: `single ${p.uom.sellingUnit.toLowerCase()}` });
        });
        const onPo = new Set(po.lines.map((l) => l.variantId));
        const other = variants.find((v) => !onPo.has(v.id) && v.barcodes.length > 0 && products.find((p) => p.id === v.productId)?.businessUnitId === po.businessUnitId);
        if (other) {
            const p = productForVariant(data, other.id)!;
            codes.push({ code: (other.barcodes.find((b) => b.unit === "selling") ?? other.barcodes[0]).code, label: `${p.name} — ${other.name}`, hint: "in catalog, not on this PO" });
        }
        codes.push({ code: "0049000012345", label: "Unknown barcode", hint: "not in the catalog" });
        return codes;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [po?.id, po?.lines.length, variants, products]);

    // Staff of this PO’s destination (warehouse or store), plus executives.
    if (!po || !(scope.isExecutive || (scope.canReceive && scope.locationIds.includes(po.warehouseId)))) {
        return (
            <div>
                <PageHeader backHref="/purchasing/receiving" backLabel="Receiving" title="Purchase order not found" />
                <Card>
                    <Empty title="This PO doesn’t exist or isn’t delivered to one of your locations." />
                </Card>
            </div>
        );
    }

    const totals = poTotals(data, po);
    const open = po.status === "sent" || po.status === "receiving";
    const shortLines = po.lines
        .map((l) => ({ line: l, expected: expectedUnits(data, l), product: productForVariant(data, l.variantId), variant: variants.find((v) => v.id === l.variantId) }))
        .filter((x) => x.line.receivedUnits < x.expected);
    const linesDone = po.lines.length - shortLines.length;
    const pendingUnexpected = approvals.filter((a) => a.status === "pending" && a.payload.type === "unexpected_item" && a.payload.poId === po.id).length;

    const pushLog = (tone: ScanFeedback["tone"], text: string) => setLog((l) => [{ id: Date.now() + Math.random(), tone, text }, ...l].slice(0, 8));
    const flash = (variantId: string | null) => {
        if (!variantId) return;
        setHighlight(variantId);
        clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => setHighlight(null), 1200);
    };

    const onScan = (code: string, qty: number): ScanFeedback => {
        const hit = lookupCode(data, code);
        const r = receiveScan(po.id, code, qty);
        if (r.kind === "matched") {
            const p = hit?.product;
            const conv = hit?.unit === "purchase" && p ? ` (${qty} ${p.uom.purchaseUnit} = ${r.units} ${p.uom.sellingUnit})` : qty > 1 ? ` (${qty} × 1 ${p?.uom.sellingUnit ?? "Each"})` : "";
            const title = `+${r.units} ${r.label}${conv}`;
            const line = useAppStore.getState().purchaseOrders.find((x) => x.id === po.id)?.lines.find((l) => l.variantId === r.variantId);
            const exp = line ? expectedUnits(data, line) : 0;
            const over = line && line.receivedUnits > exp;
            flash(r.variantId);
            pushLog(over ? "warning" : "success", title);
            return {
                tone: over ? "warning" : "success",
                title,
                description: line ? (over ? `More than ordered: ${line.receivedUnits} of ${exp} units. It still counts — check with your manager.` : `${line.receivedUnits} of ${exp} units received on this line.`) : undefined,
            };
        }
        if (r.kind === "unexpected") {
            pushLog("warning", `Not on PO: +${r.units} ${r.label}`);
            return {
                tone: "warning",
                title: "Not on this PO — added and sent to Approvals. Receiving continues.",
                description: `+${r.units} ${r.label}${hit ? "" : " (new draft product)"}`,
            };
        }
        pushLog("error", `Couldn’t receive ${code}`);
        return { tone: "error", title: `Couldn’t receive ${code}`, description: "Try again or enter the units by hand below." };
    };

    const finish = () => {
        const status = finishReceiving(po.id);
        setResult(status);
        if (status === "complete") toast.success(`${po.number} received complete`);
        else toast.warning(`${po.number} marked Partial`, "Shortage sent to Approvals.");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /* ---------------- result / closed states ---------------- */
    if (result || !open) {
        const status = result ?? po.status;
        const complete = status === "complete" || status === "resolved";
        const notSent = status === "created";
        return (
            <div className="mx-auto flex max-w-2xl flex-col gap-6">
                <PageHeader className="mb-0" backHref="/purchasing/receiving" backLabel="Receiving" eyebrow={vendor?.name} title={po.number} />
                <Card>
                    <div className="flex flex-col items-center py-6 text-center">
                        <span className={cx("flex size-16 items-center justify-center rounded-full ring-8", notSent ? "bg-gray-100 text-gray-600 ring-gray-50" : complete ? "bg-green-100 text-green-600 ring-green-50" : "bg-orange-100 text-orange-600 ring-orange-50")}>
                            {complete ? <CheckCircle className="size-8" /> : notSent ? <PackageCheck className="size-8" /> : <AlertTriangle className="size-8" />}
                        </span>
                        <h2 className="mt-5 text-display-xs font-semibold text-primary">
                            {notSent ? "Not sent to the vendor yet" : complete ? "Receiving complete" : "Received short — sent to Approvals"}
                        </h2>
                        <p className="mt-2 max-w-md text-md text-tertiary">
                            {notSent
                                ? "A manager needs to mark this PO as sent before it can be received."
                                : complete
                                  ? `All ${formatNumber(totals.units)} units are now Available here.`
                                  : `${formatNumber(totals.received)} of ${formatNumber(totals.units)} units received. The PO is Partial and a manager will resolve the shortage in Approvals.`}
                        </p>
                        <div className="mt-3">
                            <StatusBadge status={status} size="lg" />
                        </div>
                        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <Button size="xl" color="secondary" href={`/purchasing/orders/view?id=${po.id}`}>
                                View PO
                            </Button>
                            <Button size="xl" href="/purchasing/receiving">
                                Back to Receiving
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    /* ---------------- scan screen ---------------- */
    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-28 lg:pb-8">
            <PageHeader
                className="mb-0"
                backHref="/purchasing/receiving"
                backLabel="Receiving"
                eyebrow={
                    <>
                        {vendor?.name} → <LocationName id={po.warehouseId} />
                    </>
                }
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        Receive {po.number}
                        <StatusBadge status={po.status} />
                    </span>
                }
            />

            <Card>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-sm text-tertiary">Units received</p>
                        <p className="text-display-sm font-semibold text-primary tabular-nums">
                            {formatNumber(totals.received)}
                            <span className="text-display-xs text-quaternary"> / {formatNumber(totals.units)}</span>
                        </p>
                    </div>
                    <p className="text-sm text-tertiary">
                        {linesDone} of {po.lines.length} lines complete
                        {po.unexpected.length > 0 && ` · ${po.unexpected.length} not on PO`}
                    </p>
                </div>
                <UnitsProgress value={totals.received} max={totals.units} />
                <div className="mt-5 border-t border-secondary pt-5">
                    <ScanInput onScan={onScan} simulate={simulate} withQuantity placeholder="Scan a case or item barcode" />
                    <p className="mt-2 text-xs text-tertiary">Scanning a case barcode adds the whole case. Use × to scan one barcode for several cases. Items not on this PO are added and sent to Approvals — never blocked.</p>
                </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-3">
                <Card title="Lines" flush className="lg:col-span-2" description="Enter units by hand if a barcode won’t scan.">
                    <ul className="divide-y divide-secondary">
                        {po.lines.map((l) => (
                            <ReceivingLine
                                key={l.variantId}
                                line={l}
                                product={productForVariant(data, l.variantId)}
                                expected={expectedUnits(data, l)}
                                highlighted={highlight === l.variantId}
                                onAdjust={(delta) => {
                                    receiveManual(po.id, l.variantId, delta);
                                    flash(l.variantId);
                                }}
                            />
                        ))}
                    </ul>
                </Card>

                <div className="flex flex-col gap-5">
                    <Card title="Not on this PO" description={pendingUnexpected ? `${pendingUnexpected} waiting in Approvals` : undefined}>
                        {po.unexpected.length === 0 ? (
                            <p className="text-sm text-tertiary">Nothing unexpected so far.</p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {po.unexpected.map((u) => (
                                    <li key={u.barcode} className="flex items-start justify-between gap-3 rounded-xl bg-orange-50 px-3 py-2.5 ring-1 ring-orange-200 ring-inset">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-primary">{u.description}</p>
                                            <p className="font-mono text-xs text-tertiary">{u.barcode}</p>
                                        </div>
                                        <span className="text-sm font-semibold text-primary tabular-nums">+{u.units}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card title="Scan log">
                        {log.length === 0 ? (
                            <p className="text-sm text-tertiary">Scans from this session show here.</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {log.map((e) => (
                                    <li key={e.id} className="flex items-start gap-2 text-sm">
                                        <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", e.tone === "success" ? "bg-green-500" : e.tone === "warning" ? "bg-orange-500" : "bg-red-500")} />
                                        <span className="text-secondary">{e.text}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>

            {/* Finish bar — sticky at the bottom on phones/tablets */}
            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-secondary bg-primary/95 px-4 py-3 backdrop-blur lg:static lg:rounded-2xl lg:px-6 lg:py-4 lg:ring-1 lg:ring-secondary">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                    <p className="hidden text-sm text-tertiary sm:block">
                        {shortLines.length === 0 ? "Everything on the PO is here." : `${shortLines.length} line${shortLines.length === 1 ? "" : "s"} still short.`}
                    </p>
                    <Button size="xl" className="w-full sm:w-auto" iconLeading={PackageCheck} onPress={() => setConfirming(true)}>
                        Finish receiving
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirming}
                onOpenChange={setConfirming}
                title={shortLines.length ? "Finish with lines short?" : "Finish receiving?"}
                description={
                    shortLines.length
                        ? "The PO will be marked Partial and the shortage goes to Approvals for a manager to resolve."
                        : "Everything arrived. The PO will be marked Complete."
                }
                confirmLabel={shortLines.length ? "Finish as Partial" : "Finish as Complete"}
                onConfirm={finish}
            >
                {shortLines.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-secondary rounded-xl ring-1 ring-secondary">
                        {shortLines.map((s) => (
                            <li key={s.line.variantId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                <span className="min-w-0 truncate text-primary">
                                    {s.product?.name} — {s.variant?.name}
                                </span>
                                <span className="shrink-0 font-semibold text-orange-600 tabular-nums">
                                    {s.line.receivedUnits} of {s.expected}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-secondary">{formatNumber(totals.received)} units received across {po.lines.length} lines.</p>
                )}
            </ConfirmDialog>
        </div>
    );
}

export default function ReceivePOPageRoute() {
    return (
        <Suspense>
            <ReceivePOPage />
        </Suspense>
    );
}
