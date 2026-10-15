"use client";

import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, InfoCircle } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { formatCurrency } from "@/lib/format";
import { ISSUE_META, type ReconResult, type ReconRow } from "@/lib/invoice";
import type { InvoiceIssue } from "@/lib/types";
import { cx } from "@/utils/cx";

const toneBadge = { error: "error", warning: "warning", info: "gray" } as const;

const rowTone = (r: ReconRow) => {
    const kinds = r.issueKinds;
    if (kinds.some((k) => ISSUE_META[k].tone === "error")) return "error";
    if (kinds.length) return "warning";
    return "ok";
};

const qty = (n: number | null) => (n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Totals strip: invoice total vs PO total vs received value. */
export const InvoiceTotals = ({ totals, hasPo }: { totals: ReconResult["totals"]; hasPo: boolean }) => {
    const items: { label: string; value: ReactNode; hint?: string; tone?: "error" | "warning" }[] = [
        {
            label: "Invoice total",
            value: formatCurrency(totals.invoiceTotal),
            hint: Math.abs(totals.computedTotal - totals.invoiceTotal) > 0.01 ? `Qty × price adds up to ${formatCurrency(totals.computedTotal)}` : "Sum of the lines read",
            tone: Math.abs(totals.computedTotal - totals.invoiceTotal) > 0.01 ? "error" : undefined,
        },
    ];
    if (hasPo) {
        items.push({ label: "PO total", value: formatCurrency(totals.poTotal), hint: `Difference ${formatCurrency(totals.invoiceTotal - totals.poTotal)}`, tone: Math.abs(totals.invoiceTotal - totals.poTotal) > 0.01 ? "warning" : undefined });
        items.push({ label: "Received (at PO cost)", value: totals.receivedTotal === null ? "Not yet" : formatCurrency(totals.receivedTotal), hint: totals.receivedTotal === null ? "Scan the delivery to compare" : "What was scanned in" });
    }
    items.push({ label: "Money at risk", value: formatCurrency(totals.atRisk), hint: "Over-billed, not received, price increases", tone: totals.atRisk > 0 ? "error" : undefined });
    return (
        <dl className={cx("grid grid-cols-2 gap-3", hasPo ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
            {items.map((i) => (
                <div key={i.label} className={cx("rounded-xl p-3 ring-1 ring-inset", i.tone === "error" ? "bg-error-primary ring-error_subtle" : i.tone === "warning" ? "bg-warning-primary ring-orange-200" : "bg-secondary ring-secondary")}>
                    <dt className="text-xs font-medium text-tertiary">{i.label}</dt>
                    <dd className={cx("mt-1 text-lg font-semibold tabular-nums", i.tone === "error" ? "text-error-primary" : "text-primary")}>{i.value}</dd>
                    {i.hint && <p className="mt-0.5 text-xs text-tertiary">{i.hint}</p>}
                </div>
            ))}
        </dl>
    );
};

const IssueIcon = ({ tone }: { tone: InvoiceIssue["severity"] }) =>
    tone === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-fg-error-secondary" /> : tone === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-fg-warning-secondary" /> : <InfoCircle className="mt-0.5 size-4 shrink-0 text-fg-quaternary" />;

/** Issues grouped by kind (unknown UPCs collapse into one group so a long receipt stays readable). */
export const InvoiceIssueList = ({ issues }: { issues: InvoiceIssue[] }) => {
    if (issues.length === 0)
        return (
            <div className="flex items-center gap-3 rounded-xl bg-success-primary p-4 text-sm text-success-primary">
                <CheckCircle className="size-5 shrink-0" />
                Everything on the invoice matches the PO and what was received.
            </div>
        );
    const order: InvoiceIssue["kind"][] = ["incomplete_scan", "math_error", "duplicate_line", "not_ordered", "qty_mismatch", "short_received", "price_change", "not_shipped", "unknown_code"];
    return (
        <div className="flex flex-col gap-3">
            {order
                .map((kind) => ({ kind, items: issues.filter((i) => i.kind === kind) }))
                .filter((g) => g.items.length)
                .map((g) => {
                    const tone = g.items.some((i) => i.severity === "error") ? "error" : g.items.some((i) => i.severity === "warning") ? "warning" : "info";
                    return (
                        <section key={g.kind} className={cx("rounded-xl p-3 ring-1 ring-inset", tone === "error" ? "bg-error-primary ring-error_subtle" : tone === "warning" ? "bg-warning-primary ring-orange-200" : "bg-secondary ring-secondary")}>
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
                                {ISSUE_META[g.kind].label}
                                <Badge size="sm" type="pill-color" color={toneBadge[tone]}>
                                    {g.items.length}
                                </Badge>
                            </h4>
                            <ul className="mt-2 flex flex-col gap-1.5">
                                {(g.kind === "unknown_code" && g.items.length > 6 ? g.items.slice(0, 6) : g.items).map((i) => (
                                    <li key={i.id} className="flex items-start gap-2 text-sm text-secondary">
                                        <IssueIcon tone={i.severity} />
                                        <span className="min-w-0">{i.message}</span>
                                    </li>
                                ))}
                                {g.kind === "unknown_code" && g.items.length > 6 && <li className="pl-6 text-sm text-tertiary">…and {g.items.length - 6} more not in the catalog (see the lines below).</li>}
                            </ul>
                        </section>
                    );
                })}
        </div>
    );
};

/** Line-by-line comparison: invoice vs ordered vs received, price vs PO. */
export const InvoiceLinesTable = ({ rows, hasPo }: { rows: ReconRow[]; hasPo: boolean }) => (
    <div className="overflow-x-auto rounded-xl ring-1 ring-secondary">
        <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary">
                <tr className="text-xs font-semibold text-quaternary">
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Billed</th>
                    {hasPo && <th className="px-3 py-2 text-right">Ordered</th>}
                    {hasPo && <th className="px-3 py-2 text-right">Received</th>}
                    <th className="px-3 py-2 text-right">Price</th>
                    {hasPo && <th className="px-3 py-2 text-right">PO price</th>}
                    <th className="px-3 py-2 text-right">Extended</th>
                    <th className="px-3 py-2 text-left">Check</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
                {rows.map((r) => {
                    const tone = rowTone(r);
                    const qtyOff = r.orderedQty !== null && !r.poOnly && Math.abs(r.invoiceQty - r.orderedQty) > 1e-6;
                    const recOff = r.receivedQty !== null && r.invoiceQty - r.receivedQty > 1e-6;
                    const priceOff = r.poPrice !== null && !r.poOnly && Math.abs(r.invoicePrice - r.poPrice) > 0.005;
                    return (
                        <tr key={r.key} className={cx(tone === "error" && "bg-error-primary/60", tone === "warning" && "bg-warning-primary/60")}>
                            <td className="px-3 py-2.5 whitespace-nowrap text-tertiary tabular-nums">{r.sourceRows.length ? r.sourceRows.join(", ") : "—"}</td>
                            <td className="px-3 py-2.5">
                                <p className="font-medium text-primary">{r.description}</p>
                                <p className="font-mono text-xs text-tertiary">{r.code || "no code"}</p>
                            </td>
                            <td className={cx("px-3 py-2.5 text-right tabular-nums", r.poOnly ? "text-quaternary" : "font-semibold text-primary")}>{r.poOnly ? "—" : qty(r.invoiceQty)}</td>
                            {hasPo && <td className={cx("px-3 py-2.5 text-right tabular-nums", qtyOff ? "font-semibold text-error-primary" : "text-secondary")}>{qty(r.orderedQty)}</td>}
                            {hasPo && <td className={cx("px-3 py-2.5 text-right tabular-nums", recOff ? "font-semibold text-error-primary" : "text-secondary")}>{qty(r.receivedQty)}</td>}
                            <td className={cx("px-3 py-2.5 text-right tabular-nums", priceOff ? "font-semibold text-warning-primary" : "text-secondary")}>{r.poOnly ? "—" : r.invoicePrice.toFixed(2)}</td>
                            {hasPo && <td className="px-3 py-2.5 text-right text-secondary tabular-nums">{r.poPrice === null ? "—" : r.poPrice.toFixed(2)}</td>}
                            <td className="px-3 py-2.5 text-right text-primary tabular-nums">{r.poOnly ? "—" : r.extended.toFixed(2)}</td>
                            <td className="px-3 py-2.5">
                                {r.issueKinds.length === 0 ? (
                                    <Badge size="sm" type="pill-color" color="success">
                                        OK
                                    </Badge>
                                ) : (
                                    <div className="flex flex-wrap gap-1">
                                        {r.issueKinds.map((k) => (
                                            <Badge key={k} size="sm" type="pill-color" color={toneBadge[ISSUE_META[k].tone]}>
                                                {ISSUE_META[k].label}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);
