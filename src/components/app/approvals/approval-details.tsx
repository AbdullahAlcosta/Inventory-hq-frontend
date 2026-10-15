"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, InfoCircle } from "@untitledui/icons";
import { Field } from "@/components/app/card";
import { EmployeeName, LocationName, VariantCell } from "@/components/app/item-cell";
import { StatusBadge } from "@/components/app/status-badge";
import { VariantPicker } from "@/components/app/variant-picker";
import { Button } from "@/components/base/buttons/button";
import { InputNumber } from "@/components/base/input/input-number";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatSigned, pluralize } from "@/lib/format";
import { forecastOrder, unitsOnOrder } from "@/lib/forecast";
import { productOf, stockAt } from "@/lib/selectors";
import type { Approval, ApprovalPayload } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { unitCount } from "./approval-meta";

type P<T extends ApprovalPayload["type"]> = Extract<ApprovalPayload, { type: T }>;

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

/** Link into purchasing or channels, shown as plain text to people who can't open those screens. */
export const ScopedLink = ({ area, href, className, children }: { area: "purchasing" | "channels"; href: string; className?: string; children: ReactNode }) => {
    const scope = useRequiredScope();
    const allowed = area === "purchasing" ? scope.canSeePurchasing : scope.canManageChannels;
    return allowed ? (
        <Link href={href} className={className}>
            {children}
        </Link>
    ) : (
        <span>{children}</span>
    );
};

export const FieldGrid = ({ children }: { children: ReactNode }) => <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;

export const Section = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
    <section className={cx("flex flex-col gap-3", className)}>
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {children}
    </section>
);

export const Callout = ({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) => (
    <div className={cx("flex gap-3 rounded-xl p-3 text-sm", tone === "warning" ? "bg-warning-primary text-warning-primary" : "bg-secondary text-secondary")}>
        {tone === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <InfoCircle className="mt-0.5 size-4 shrink-0 text-fg-quaternary" />}
        <div className="min-w-0">{children}</div>
    </div>
);

const MiniTable = ({ head, children }: { head: string[]; children: ReactNode }) => (
    <div className="overflow-x-auto rounded-xl ring-1 ring-secondary">
        <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-secondary">
                <tr>
                    {head.map((h, i) => (
                        <th key={h} className={cx("px-3 py-2 text-xs font-semibold whitespace-nowrap text-quaternary", i === 0 ? "text-left" : "text-right")}>
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-secondary">{children}</tbody>
        </table>
    </div>
);

const Num = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cx("px-3 py-2.5 text-right whitespace-nowrap tabular-nums", className)}>{children}</td>;

/* ------------------------------------------------------------------ */
/* Per-type detail panels                                              */
/* ------------------------------------------------------------------ */

export const ReorderDetail = ({ payload, quantity, onQuantity, editable }: { payload: P<"reorder">; quantity: number; onQuantity: (n: number) => void; editable: boolean }) => {
    const variant = useAppStore((s) => s.variants.find((v) => v.id === payload.variantId));
    const product = useAppStore((s) => productOf(s, payload.variantId));
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === payload.vendorId));
    const live = useAppStore((s) => stockAt(s, payload.variantId, payload.warehouseId).available);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const forecast = variant && product ? forecastOrder(variant, product, live, unitsOnOrder(purchaseOrders, variant.id, payload.warehouseId, product.uom.unitsPerPurchaseUnit)) : null;
    const days = Math.max(0, Math.round((new Date(payload.runOutDate).getTime() - Date.now()) / 86400000));
    const upp = product?.uom.unitsPerPurchaseUnit ?? 1;
    const cases = Math.max(1, Math.ceil(quantity / upp));

    return (
        <>
            <VariantCell variantId={payload.variantId} />
            <FieldGrid>
                <Field label="Warehouse">
                    <LocationName id={payload.warehouseId} />
                </Field>
                <Field label="Current stock">
                    {unitCount(live, product?.uom.sellingUnit ?? "unit")}
                    {live !== payload.currentStock && <span className="block text-xs font-normal text-tertiary">{formatNumber(payload.currentStock)} when suggested</span>}
                </Field>
                <Field label="Sales speed">{payload.dailySales.toFixed(1)} / day</Field>
                <Field label="Projected run-out">
                    {formatDate(payload.runOutDate)} <span className={cx("font-normal", days <= (variant?.leadTimeDays ?? 0) ? "text-error-primary" : "text-tertiary")}>· {days === 0 ? "today" : `in ${pluralize(days, "day")}`}</span>
                </Field>
                <Field label="Lead time">{variant ? pluralize(variant.leadTimeDays, "day") : "—"}</Field>
                <Field label="Vendor">{vendor?.name ?? <span className="text-error-primary">No default vendor</span>}</Field>
                {variant && (
                    <Field label="Minimum qty · cover">
                        {formatNumber(variant.reorderPoint)} · {pluralize(variant.coverDays ?? 14, "day")} beyond lead time
                    </Field>
                )}
                {forecast && (
                    <Field label="Forecast">
                        {forecast.cases ? `${forecast.cases} × ${product?.uom.purchaseUnit.toLowerCase()} (${formatNumber(forecast.units)} units)` : "Nothing needed now"}
                        <span className="block text-xs font-normal text-tertiary">{forecast.reason}</span>
                    </Field>
                )}
            </FieldGrid>
            {!vendor && <Callout tone="warning">This item has no default vendor, so no PO can be created. Set one on the Reorder page, or dismiss.</Callout>}
            <Section title="Quantity to order">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
                    <InputNumber
                        aria-label="Quantity"
                        label={`Quantity (${product?.uom.sellingUnit.toLowerCase() ?? "units"})`}
                        className="sm:max-w-48"
                        minValue={1}
                        value={quantity}
                        onChange={(n) => onQuantity(Number.isNaN(n) ? 1 : n)}
                        isDisabled={!editable}
                    />
                    <p className="pb-2.5 text-sm text-tertiary">
                        = {unitCount(cases, product?.uom.purchaseUnit ?? "case")} of {upp}
                        {cases * upp !== quantity && <span> ({formatNumber(cases * upp)} units)</span>}
                    </p>
                </div>
            </Section>
        </>
    );
};

export const CountDetail = ({ payload }: { payload: P<"count_variance"> }) => {
    const count = useAppStore((s) => s.counts.find((c) => c.id === payload.countId));
    if (!count) return <Callout tone="warning">This count no longer exists.</Callout>;
    const lines = count.lines.map((l) => ({ ...l, variance: (l.countedQty ?? 0) - l.systemQty }));
    const variances = lines.filter((l) => l.variance !== 0);
    const net = variances.reduce((n, l) => n + l.variance, 0);
    return (
        <>
            <FieldGrid>
                <Field label="Count">
                    {count.number} <span className="font-normal text-tertiary">· {count.kind === "opening" ? "Opening" : "Cycle"}</span>
                </Field>
                <Field label="Location">
                    <LocationName id={count.locationId} />
                </Field>
                <Field label="Counted by">
                    <EmployeeName id={count.createdBy} />
                </Field>
                <Field label="Submitted">{formatDateTime(count.submittedAt ?? count.createdAt)}</Field>
                <Field label="Lines with variance">
                    {variances.length} of {lines.length}
                </Field>
                <Field label="Net change">{formatSigned(net)}</Field>
            </FieldGrid>
            <Section title="System vs counted">
                <MiniTable head={["Item", "System", "Counted", "Variance"]}>
                    {lines.map((l) => (
                        <tr key={l.variantId} className={cx(l.variance !== 0 ? "bg-warning-primary/60" : "text-tertiary")}>
                            <td className="max-w-60 px-3 py-2.5">
                                <VariantCell variantId={l.variantId} link={false} />
                            </td>
                            <Num>{formatNumber(l.systemQty)}</Num>
                            <Num>{l.countedQty === null ? "—" : formatNumber(l.countedQty)}</Num>
                            <Num className={cx("font-semibold", l.variance < 0 && "text-error-primary", l.variance > 0 && "text-success-primary")}>{l.variance === 0 ? "0" : formatSigned(l.variance)}</Num>
                        </tr>
                    ))}
                </MiniTable>
                <p className="text-sm text-tertiary">Approving sets Available to the counted quantity for every line.</p>
            </Section>
        </>
    );
};

const stateLabel = { available: "Available", inTransit: "In Transit", returns: "Returns", damaged: "Damaged" } as const;
const reasonLabel = { damaged: "Damaged", expired: "Expired", lost: "Lost", found: "Found", state_change: "State change", other: "Other" } as const;

export const AdjustmentDetail = ({ payload }: { payload: P<"adjustment"> }) => {
    const adj = useAppStore((s) => s.adjustments.find((a) => a.id === payload.adjustmentId));
    const stockLevels = useAppStore((s) => s.stockLevels);
    const stock = adj ? stockAt({ stockLevels }, adj.variantId, adj.locationId) : null;
    if (!adj || !stock) return <Callout tone="warning">This adjustment no longer exists.</Callout>;
    const move = adj.fromState && adj.toState;
    return (
        <>
            <VariantCell variantId={adj.variantId} />
            <FieldGrid>
                <Field label="Adjustment">{adj.number}</Field>
                <Field label="Location">
                    <LocationName id={adj.locationId} />
                </Field>
                <Field label="Reason">{reasonLabel[adj.reason]}</Field>
                <Field label="Change">
                    {move ? (
                        <span className="inline-flex items-center gap-1.5">
                            {pluralize(Math.abs(adj.quantity), "unit")}: {stateLabel[adj.fromState!]} <ArrowRight className="size-4 text-fg-quaternary" /> {stateLabel[adj.toState!]}
                        </span>
                    ) : (
                        <span className={adj.quantity < 0 ? "text-error-primary" : "text-success-primary"}>{formatSigned(adj.quantity)} Available</span>
                    )}
                </Field>
                <Field label="Requested by">
                    <EmployeeName id={adj.createdBy} />
                </Field>
                <Field label="Requested">{formatDateTime(adj.createdAt)}</Field>
                <Field label="Note" className="sm:col-span-2">
                    {adj.note || <span className="font-normal text-tertiary">No note</span>}
                </Field>
            </FieldGrid>
            <Section title="Current stock by state">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(stateLabel) as (keyof typeof stateLabel)[]).map((k) => (
                        <div key={k} className={cx("rounded-xl p-3 ring-1 ring-secondary", (adj.fromState === k || adj.toState === k || (!move && k === "available")) && "bg-secondary")}>
                            <p className="text-xs text-tertiary">{stateLabel[k]}</p>
                            <p className="mt-0.5 text-lg font-semibold text-primary tabular-nums">{formatNumber(stock[k])}</p>
                        </div>
                    ))}
                </div>
            </Section>
        </>
    );
};

export const UnexpectedDetail = ({ payload, linkTarget, onLinkTarget, editable }: { payload: P<"unexpected_item">; linkTarget: string | null; onLinkTarget: (id: string | null) => void; editable: boolean }) => {
    const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === payload.poId));
    const product = useAppStore((s) => s.products.find((p) => p.id === payload.productId));
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === po?.vendorId));
    return (
        <>
            <FieldGrid>
                <Field label="Purchase order">
                    {po ? (
                        <ScopedLink area="purchasing" href={`/purchasing/orders/view?id=${po.id}`} className="text-brand-secondary hover:underline">
                            {po.number}
                        </ScopedLink>
                    ) : (
                        "—"
                    )}
                    {vendor && <span className="block text-xs font-normal text-tertiary">{vendor.name}</span>}
                </Field>
                <Field label="Warehouse">
                    <LocationName id={po?.warehouseId} />
                </Field>
                <Field label="Barcode">
                    <span className="font-mono">{payload.barcode}</span>
                </Field>
                <Field label="Units received">{formatNumber(payload.units)}</Field>
                <Field label="Description" className="sm:col-span-2">
                    {payload.description || "—"}
                </Field>
            </FieldGrid>
            {product ? (
                <Section title="Draft product">
                    <div className="flex items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-secondary">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-primary">{product.name}</p>
                            <p className="text-xs text-tertiary">Created while receiving. Units are held on this draft.</p>
                        </div>
                        <StatusBadge status={product.status} size="sm" />
                    </div>
                    <Link href={`/catalog/products/view?id=${product.id}`} className="text-sm font-semibold text-brand-secondary hover:underline">
                        Edit this product
                    </Link>
                </Section>
            ) : (
                <Callout>The units were received. No draft product was created for this code.</Callout>
            )}
            {editable && (
                <Section title="Is this an item we already carry?">
                    {linkTarget ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-secondary">
                            <VariantCell variantId={linkTarget} link={false} />
                            <Button size="sm" color="link-gray" onPress={() => onLinkTarget(null)}>
                                Change
                            </Button>
                        </div>
                    ) : (
                        <VariantPicker businessUnitIds={po ? [po.businessUnitId] : []} filter={(id) => id !== product?.id && productOfDraftCheck(id, payload.productId)} onSelect={onLinkTarget} placeholder="Search existing items…" />
                    )}
                    <p className="text-xs text-tertiary">Linking moves the received units to that item and adds this barcode to it.</p>
                </Section>
            )}
        </>
    );
};

// Exclude the draft product's own variants from the picker.
const productOfDraftCheck = (variantId: string, draftProductId: string | null) => {
    if (!draftProductId) return true;
    const v = useAppStore.getState().variants.find((x) => x.id === variantId);
    return v?.productId !== draftProductId;
};

export const PartialPoDetail = ({ payload }: { payload: P<"partial_po"> }) => {
    const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === payload.poId));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const data = { products, variants };
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === po?.vendorId));
    if (!po) return <Callout tone="warning">This purchase order no longer exists.</Callout>;
    const lines = po.lines.map((l) => {
        const upp = productOf(data, l.variantId)?.uom.unitsPerPurchaseUnit ?? 1;
        const ordered = l.orderedQty * upp;
        return { ...l, ordered, short: Math.max(0, ordered - l.receivedUnits) };
    });
    const totalShort = lines.reduce((n, l) => n + l.short, 0);
    return (
        <>
            <FieldGrid>
                <Field label="Purchase order">
                    <ScopedLink area="purchasing" href={`/purchasing/orders/view?id=${po.id}`} className="text-brand-secondary hover:underline">
                        {po.number}
                    </ScopedLink>
                </Field>
                <Field label="Vendor">{vendor?.name ?? "—"}</Field>
                <Field label="Warehouse">
                    <LocationName id={po.warehouseId} />
                </Field>
                <Field label="Short">{pluralize(totalShort, "unit")}</Field>
            </FieldGrid>
            <Section title="Ordered vs received (units)">
                <MiniTable head={["Item", "Ordered", "Received", "Short"]}>
                    {lines.map((l) => (
                        <tr key={l.variantId} className={cx(l.short > 0 ? "bg-warning-primary/60" : "text-tertiary")}>
                            <td className="max-w-60 px-3 py-2.5">
                                <VariantCell variantId={l.variantId} link={false} />
                            </td>
                            <Num>{formatNumber(l.ordered)}</Num>
                            <Num>{formatNumber(l.receivedUnits)}</Num>
                            <Num className={cx("font-semibold", l.short > 0 && "text-error-primary")}>{l.short ? `−${formatNumber(l.short)}` : "0"}</Num>
                        </tr>
                    ))}
                </MiniTable>
            </Section>
            <Callout>Accepting closes the PO as Resolved. A backorder creates a new PO to the same vendor for the missing quantity.</Callout>
        </>
    );
};

const sourceLabel = { scheduled_pull: "Scheduled pull", manual_pull: "Manual pull", upload: "Uploaded export" } as const;

export const MismatchDetail = ({ payload }: { payload: P<"mismatch"> }) => {
    const m = useAppStore((s) => s.mismatches.find((x) => x.id === payload.mismatchId));
    const connection = useAppStore((s) => s.connections.find((c) => c.id === m?.connectionId));
    if (!m) return <Callout tone="warning">This mismatch no longer exists.</Callout>;
    const diff = m.reported - m.expected;
    return (
        <>
            <VariantCell variantId={m.variantId} />
            <FieldGrid>
                <Field label="Connection">
                    {connection ? (
                        <ScopedLink area="channels" href={`/channels/connections/view?id=${connection.id}`} className="hover:underline">
                            {connection.name}
                        </ScopedLink>
                    ) : (
                        "—"
                    )}
                </Field>
                <Field label="Location">
                    <LocationName id={m.locationId} />
                </Field>
                <Field label="Source">{sourceLabel[m.source]}</Field>
                <Field label="Detected">{formatDateTime(m.detectedAt)}</Field>
            </FieldGrid>
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: "We expect", value: formatNumber(m.expected) },
                    { label: "Channel reports", value: formatNumber(m.reported) },
                    { label: "Difference", value: formatSigned(diff), tone: diff < 0 ? "text-error-primary" : "text-success-primary" },
                ].map((x) => (
                    <div key={x.label} className="rounded-xl p-3 ring-1 ring-secondary">
                        <p className="text-xs text-tertiary">{x.label}</p>
                        <p className={cx("mt-0.5 text-xl font-semibold text-primary tabular-nums", x.tone)}>{x.value}</p>
                    </div>
                ))}
            </div>
            <Callout>
                <b>Keep our count</b> re-pushes our number to the channel. <b>Correct our stock</b> changes our Available by {formatSigned(diff)} to match the channel.
            </Callout>
        </>
    );
};

export const DuplicateDetail = ({ payload }: { payload: P<"import_duplicate"> }) => {
    const product = useAppStore((s) => s.products.find((p) => p.id === payload.matchProductId));
    const variant = useAppStore((s) => s.variants.find((v) => v.id === payload.matchVariantId));
    const siblings = useAppStore((s) => s.variants.filter((v) => v.productId === payload.matchProductId).length);
    const row = payload.importRow;
    const rows: { label: string; a: ReactNode; b: ReactNode }[] = [
        { label: "Brand", a: row.brand, b: product?.brand ?? "—" },
        { label: "Product line", a: row.productLine, b: product?.productLine ?? "—" },
        { label: "Type", a: row.productType, b: product?.productType ?? "—" },
        { label: "Variant", a: row.variant, b: variant?.name ?? <span className="text-tertiary">No close variant ({siblings} exist)</span> },
        { label: "SKU", a: <span className="font-mono">{row.sku || "—"}</span>, b: <span className="font-mono">{variant?.sku ?? "—"}</span> },
        { label: "UPC", a: <span className="font-mono">{row.upc || "—"}</span>, b: <span className="font-mono">{variant?.barcodes.map((b) => b.code).join(", ") || "—"}</span> },
        { label: "Price", a: formatCurrency(row.price), b: variant ? formatCurrency(variant.price) : "—" },
        { label: "Cost", a: formatCurrency(row.cost), b: variant ? formatCurrency(variant.cost) : "—" },
    ];
    return (
        <>
            <Callout>{payload.reason}</Callout>
            <div className="overflow-x-auto rounded-xl ring-1 ring-secondary">
                <table className="w-full min-w-[420px] text-sm">
                    <thead className="bg-secondary">
                        <tr>
                            <th className="w-28 px-3 py-2 text-left text-xs font-semibold text-quaternary" />
                            <th className="px-3 py-2 text-left text-xs font-semibold text-quaternary">Import row</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-quaternary">
                                Existing ·{" "}
                                {product ? (
                                    <Link href={`/catalog/products/view?id=${product.id}`} className="text-brand-secondary hover:underline">
                                        {product.name}
                                    </Link>
                                ) : (
                                    "—"
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary">
                        {rows.map((r) => (
                            <tr key={r.label}>
                                <td className="px-3 py-2 text-tertiary">{r.label}</td>
                                <td className="px-3 py-2 font-medium text-primary">{r.a}</td>
                                <td className="px-3 py-2 font-medium text-primary">{r.b}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-sm text-tertiary">
                Flavor, color, strength or size differences are a <b>new variant</b>. A different brand, model or product type is a <b>new product</b>. Not sure? Ask your manager.
            </p>
        </>
    );
};

export const SyncDetail = ({ approval, payload }: { approval: Approval; payload: P<"sync_failure"> }) => {
    const connection = useAppStore((s) => s.connections.find((c) => c.id === payload.connectionId));
    const labels = payload.variantIds.map((id) => ({ id }));
    return (
        <>
            <FieldGrid>
                <Field label="Connection">
                    {connection ? (
                        <ScopedLink area="channels" href={`/channels/connections/view?id=${connection.id}`} className="hover:underline">
                            {connection.name}
                        </ScopedLink>
                    ) : (
                        "—"
                    )}
                    {connection && <span className="block text-xs font-normal text-tertiary capitalize">{connection.channel}</span>}
                </Field>
                <Field label="Problem">
                    <StatusBadge status={payload.kind === "blocked" ? "blocked" : "failed"} label={payload.kind === "blocked" ? "Blocked by compliance" : "Sync failed"} size="sm" />
                </Field>
                <Field label="Reason" className="sm:col-span-2">
                    {payload.reason}
                </Field>
            </FieldGrid>
            {approval.status === "pending" && approval.decisionNote && <Callout tone="warning">{approval.decisionNote}</Callout>}
            <Section title={`Affected items (${labels.length})`}>
                {labels.length ? (
                    <ul className="divide-y divide-secondary rounded-xl ring-1 ring-secondary">
                        {labels.map((l) => (
                            <li key={l.id} className="px-3 py-2.5">
                                <VariantCell variantId={l.id} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-tertiary">The whole connection is affected, not specific items.</p>
                )}
            </Section>
            {payload.kind === "blocked" ? (
                <Callout>Retry only works after the product’s compliance flags are fixed. Otherwise choose not to sell these items on this channel.</Callout>
            ) : (
                <Callout>Fix the connection settings (re-connect or refresh the API key), then retry.</Callout>
            )}
        </>
    );
};

/* ------------------------------------------------------------------ */
/* Store transfer (store → store request)                              */
/* ------------------------------------------------------------------ */

export const TransferDetail = ({ payload }: { payload: P<"transfer_request"> }) => {
    const request = useAppStore((s) => s.storeRequests.find((r) => r.id === payload.requestId));
    const locations = useAppStore((s) => s.locations);
    const stockLevels = useAppStore((s) => s.stockLevels);
    if (!request) return <Callout tone="warning">This request no longer exists.</Callout>;
    const store = locations.find((l) => l.id === request.storeId);
    const warehouse = locations.find((l) => l.businessUnitId === store?.businessUnitId && l.type === "warehouse");
    return (
        <>
            <FieldGrid>
                <Field label="Request">
                    <Link href={`/replenishment/requests/view?id=${request.id}`} className="hover:underline">
                        {request.number}
                    </Link>
                </Field>
                <Field label="Status">
                    <StatusBadge status={request.status} size="sm" />
                </Field>
                <Field label="From (sending store)">
                    <LocationName id={request.sourceId} />
                </Field>
                <Field label="To (requesting store)">
                    <LocationName id={request.storeId} />
                </Field>
                <Field label="Requested by">
                    <EmployeeName id={request.createdBy} />
                </Field>
                <Field label="Requested">{formatDateTime(request.createdAt)}</Field>
            </FieldGrid>
            {request.note && <Callout tone="info">{request.note}</Callout>}
            <Section title="Items">
                <MiniTable head={["Item", "Qty", "At sender", warehouse ? "At warehouse" : ""]}>
                    {request.lines.map((l) => {
                        const atSource = stockAt({ stockLevels }, l.variantId, request.sourceId).available;
                        const atWarehouse = warehouse ? stockAt({ stockLevels }, l.variantId, warehouse.id).available : null;
                        return (
                            <tr key={l.variantId}>
                                <td className="max-w-60 px-3 py-2.5">
                                    <VariantCell variantId={l.variantId} link={false} />
                                </td>
                                <td className="px-3 py-2.5 text-right font-medium text-primary">{formatNumber(l.requestedQty)}</td>
                                <td className={cx("px-3 py-2.5 text-right", atSource < l.requestedQty ? "font-semibold text-error-primary" : "text-secondary")}>
                                    {formatNumber(atSource)}
                                </td>
                                <td className="px-3 py-2.5 text-right text-secondary">{atWarehouse === null ? "" : formatNumber(atWarehouse)}</td>
                            </tr>
                        );
                    })}
                </MiniTable>
            </Section>
            <p className="text-sm text-tertiary">
                Approving lets <LocationName id={request.sourceId} /> pick, pack and ship. If the warehouse can cover it instead, reject and ask the store to request from the
                warehouse.
            </p>
        </>
    );
};
