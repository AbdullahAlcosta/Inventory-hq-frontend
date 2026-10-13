"use client";

import { useMemo, useState, Suspense } from "react";
import { ClipboardCheck } from "@untitledui/icons";
import { useSearchParams } from "next/navigation";
import { Card, Field } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { EmployeeName, VariantCell } from "@/components/app/item-cell";
import { ConfirmDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { type ScanFeedback, ScanInput } from "@/components/app/scan-input";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { signedClass } from "@/components/app/stock/stock-utils";
import { toast } from "@/components/app/toast";
import { VariantPicker } from "@/components/app/variant-picker";
import { Button } from "@/components/base/buttons/button";
import { InputNumber } from "@/components/base/input/input-number";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatNumber, formatSigned, pluralize } from "@/lib/format";
import { lookupCode } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

function CountSheetPage() {
    const id = useSearchParams().get("id") ?? "";
    const scope = useRequiredScope();
    const count = useAppStore((s) => s.counts.find((c) => c.id === id));
    const location = useAppStore((s) => s.locations.find((l) => l.id === count?.locationId));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const approvals = useAppStore((s) => s.approvals);
    const updateCountLine = useAppStore((s) => s.updateCountLine);
    const addCountLine = useAppStore((s) => s.addCountLine);
    const submitCount = useAppStore((s) => s.submitCount);

    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const buProducts = useMemo(() => products.filter((p) => p.businessUnitId === location?.businessUnitId), [products, location]);

    const simulate = useMemo(() => {
        if (!count) return [];
        const list = count.lines.slice(0, 5).flatMap((l, i) => {
            const v = variants.find((x) => x.id === l.variantId);
            const p = v && products.find((x) => x.id === v.productId);
            if (!v || !p) return [];
            const sell = v.barcodes.find((b) => b.unit === "selling");
            const cs = v.barcodes.find((b) => b.unit === "purchase");
            const out = sell ? [{ code: sell.code, label: `${p.name} — ${v.name}`, hint: "1 unit" }] : [];
            if (i === 0 && cs) out.push({ code: cs.code, label: `${p.name} — ${v.name}`, hint: `${p.uom.purchaseUnit} of ${p.uom.unitsPerPurchaseUnit}` });
            return out;
        });
        // One item that isn't on the sheet yet, to show it gets added.
        const extra = variants.find(
            (v) => buProducts.some((p) => p.id === v.productId && p.status === "active") && !count.lines.some((l) => l.variantId === v.id),
        );
        const extraCode = extra?.barcodes.find((b) => b.unit === "selling");
        if (extra && extraCode) {
            const p = buProducts.find((x) => x.id === extra.productId)!;
            list.push({ code: extraCode.code, label: `${p.name} — ${extra.name}`, hint: "Not on this sheet" });
        }
        return list;
    }, [count, variants, products, buProducts]);

    if (!count || !location || !scope.locationIds.includes(count.locationId)) {
        return (
            <>
                <PageHeader title="Count" backHref="/stock/control" backLabel="Stock Control" />
                <Card>
                    <Empty icon={ClipboardCheck} title="Count not found" description="It may belong to a location you don’t have access to." />
                </Card>
            </>
        );
    }

    const editable = count.status === "in_progress";
    const counted = count.lines.filter((l) => l.countedQty !== null).length;
    const uncounted = count.lines.length - counted;
    const varianceLines = count.lines.filter((l) => l.countedQty !== null && l.countedQty !== l.systemQty);
    const net = count.lines.reduce((n, l) => n + (l.countedQty !== null ? l.countedQty - l.systemQty : 0), 0);
    const approval = approvals.find((a) => a.payload.type === "count_variance" && a.payload.countId === count.id);

    const onScan = (code: string, qty: number): ScanFeedback => {
        const hit = lookupCode({ products: buProducts, variants }, code);
        if (!hit)
            return {
                tone: "error",
                title: "Unknown barcode",
                description: `${code} isn’t in the ${location.name} catalog. Set it aside and tell your manager.`,
            };
        const label = `${hit.product.name} — ${hit.variant.name}`;
        const onSheet = count.lines.find((l) => l.variantId === hit.variant.id);
        if (!onSheet) addCountLine(count.id, hit.variant.id);
        const current = onSheet?.countedQty ?? 0;
        const add = hit.units * qty;
        updateCountLine(count.id, hit.variant.id, current + add);
        setLastScanned(hit.variant.id);
        return {
            tone: onSheet ? "success" : "warning",
            title: `${label}: ${formatNumber(current + add)} counted`,
            description: [
                hit.unit === "purchase" ? `${hit.product.uom.purchaseUnit} barcode — added ${add} units.` : `+${add}`,
                !onSheet ? "This item wasn’t on the sheet, so it was added." : "",
            ]
                .filter(Boolean)
                .join(" "),
        };
    };

    const submit = () => {
        const { variances } = submitCount(count.id);
        if (variances) toast.success("Sent to Approvals", `${pluralize(variances, "variance")} — stock changes once a manager approves.`);
        else toast.success("Count approved", "Everything matched. No changes needed.");
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                backHref="/stock/control"
                backLabel="Stock Control"
                eyebrow={location.name}
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        {count.kind === "opening" ? "Opening" : "Cycle"} count {count.number}
                        <StatusBadge status={count.status} />
                    </span>
                }
                description={editable ? "Scan each item. Every scan adds one; a case barcode adds the whole case. You can also type the count." : undefined}
                className="mb-0"
                actions={
                    editable && (
                        <Button size="lg" onPress={() => (uncounted ? setConfirmOpen(true) : submit())}>
                            Submit count
                        </Button>
                    )
                }
            />

            {editable ? (
                <Card>
                    <ScanInput onScan={onScan} simulate={simulate} withQuantity placeholder="Scan an item barcode, then press Enter" />
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <StatCard label="Lines" value={formatNumber(count.lines.length)} />
                        <StatCard label="Variances" value={formatNumber(varianceLines.length)} tone={varianceLines.length ? "warning" : "success"} />
                        <StatCard label="Net change" value={<span className={signedClass(net)}>{formatSigned(net)}</span>} hint="Units vs. system" />
                        <StatCard label="Status" value={<StatusBadge status={count.status} size="lg" />} />
                    </div>
                    <Card>
                        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <Field label="Started by">
                                <EmployeeName id={count.createdBy} />
                            </Field>
                            <Field label="Started">{formatDateTime(count.createdAt)}</Field>
                            <Field label="Submitted">{count.submittedAt ? formatDateTime(count.submittedAt) : "—"}</Field>
                            <Field label="Decision">
                                {approval?.decidedBy ? (
                                    <>
                                        <EmployeeName id={approval.decidedBy} /> · {formatDateTime(approval.decidedAt!)}
                                    </>
                                ) : count.status === "approved" ? (
                                    "No variances — approved automatically"
                                ) : (
                                    "Waiting for a manager"
                                )}
                            </Field>
                        </dl>
                        {count.status === "submitted" && (
                            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-secondary">
                                    {scope.canManage
                                        ? "Review the variances in Approvals. Approving sets stock to the counted quantities."
                                        : "A manager will review these variances in Approvals."}
                                </p>
                                {scope.canManage && (
                                    <Button size="md" color="secondary" href="/approvals">
                                        Open Approvals
                                    </Button>
                                )}
                            </div>
                        )}
                    </Card>
                </>
            )}

            <Card
                flush
                title="Count sheet"
                description={
                    editable
                        ? `${formatNumber(counted)} of ${pluralize(count.lines.length, "line")} counted · ${pluralize(varianceLines.length, "variance")} so far`
                        : `${pluralize(count.lines.length, "line")}`
                }
                actions={
                    editable && (
                        <VariantPicker
                            businessUnitIds={[location.businessUnitId]}
                            exclude={count.lines.map((l) => l.variantId)}
                            onSelect={(v) => {
                                addCountLine(count.id, v);
                                setLastScanned(v);
                            }}
                            placeholder="Add an item…"
                            size="sm"
                            className="w-full sm:w-72"
                        />
                    )
                }
            >
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead>
                            <tr className="border-b border-secondary bg-secondary text-left text-xs font-semibold text-tertiary">
                                <th className="px-5 py-3 md:px-6">Item</th>
                                <th className="px-3 py-3 text-right">System</th>
                                <th className="px-3 py-3 text-right">Counted</th>
                                <th className="px-5 py-3 text-right md:px-6">Variance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {count.lines.map((l) => {
                                const diff = l.countedQty === null ? null : l.countedQty - l.systemQty;
                                return (
                                    <tr
                                        key={l.variantId}
                                        className={cx(
                                            "border-b border-secondary last:border-0",
                                            lastScanned === l.variantId ? "bg-green-50" : diff ? "bg-orange-50/50" : "",
                                        )}
                                    >
                                        <td className="max-w-[360px] px-5 py-3 md:px-6">
                                            <VariantCell variantId={l.variantId} />
                                        </td>
                                        <td className="px-3 py-3 text-right text-tertiary tabular-nums">{formatNumber(l.systemQty)}</td>
                                        <td className="px-3 py-3 text-right">
                                            {editable ? (
                                                <div className="ml-auto w-28">
                                                    <InputNumber
                                                        aria-label="Counted quantity"
                                                        size="sm"
                                                        minValue={0}
                                                        placeholder="—"
                                                        value={l.countedQty ?? NaN}
                                                        onChange={(v) => updateCountLine(count.id, l.variantId, Number.isNaN(v) ? null : v)}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-primary tabular-nums">{formatNumber(l.countedQty ?? 0)}</span>
                                            )}
                                        </td>
                                        <td
                                            className={cx(
                                                "px-5 py-3 text-right font-semibold tabular-nums md:px-6",
                                                diff === null ? "text-quaternary" : signedClass(diff),
                                            )}
                                        >
                                            {diff === null ? "—" : diff === 0 ? "Match" : formatSigned(diff)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {count.lines.length === 0 && <Empty icon={ClipboardCheck} title="No items yet" description="Scan an item to add it to this count." />}
            </Card>

            <ConfirmDialog
                isOpen={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Submit with uncounted items?"
                description={`${pluralize(uncounted, "line")} ${uncounted === 1 ? "has" : "have"} no count and will be submitted as 0.`}
                confirmLabel="Submit count"
                onConfirm={submit}
            />
        </div>
    );
}

export default function CountSheetPageRoute() {
    return (
        <Suspense>
            <CountSheetPage />
        </Suspense>
    );
}
