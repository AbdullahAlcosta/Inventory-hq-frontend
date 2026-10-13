"use client";

import { useSearchParams } from "next/navigation";

import { use, useState, Suspense } from "react";
import { AlertTriangle, CheckCircle, Package, PackageCheck, Truck01 } from "@untitledui/icons";
import { Card, Field } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { EmployeeName, LocationName, VariantCell } from "@/components/app/item-cell";
import { ConfirmDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { HistoryTimeline, LineTable, Stepper, Td } from "@/components/app/purchasing/flow-ui";
import { canWorkStore, canWorkWarehouse, requestStatusLabel, requestSteps } from "@/components/app/replenishment/request-utils";
import { ScanQtyEditor } from "@/components/app/replenishment/scan-qty-editor";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatNumber } from "@/lib/format";
import { variantLabel } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

type Mode = null | "pick" | "confirm";

function StoreRequestDetailPage() {
    const id = useSearchParams().get("id") ?? "";
    const scope = useRequiredScope();
    const r = useAppStore((s) => s.storeRequests.find((x) => x.id === id));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const pickRequest = useAppStore((s) => s.pickRequest);
    const packRequest = useAppStore((s) => s.packRequest);
    const shipRequest = useAppStore((s) => s.shipRequest);
    const confirmRequest = useAppStore((s) => s.confirmRequest);

    const [mode, setMode] = useState<Mode>(null);
    const [values, setValues] = useState<Record<string, number>>({});
    const [dialog, setDialog] = useState<null | "pick" | "ship" | "confirm">(null);

    if (!r || !(scope.locationIds.includes(r.storeId) || scope.locationIds.includes(r.warehouseId))) {
        return (
            <div>
                <PageHeader backHref="/replenishment/requests" backLabel="Store Requests" title="Request not found" />
                <Card>
                    <Empty title="This request doesn’t exist or isn’t for one of your locations." />
                </Card>
            </div>
        );
    }

    const warehouseSide = canWorkWarehouse(scope, r);
    const storeSide = canWorkStore(scope, r);
    const requestedUnits = r.lines.reduce((a, l) => a + l.requestedQty, 0);
    const shippedUnits = r.lines.reduce((a, l) => a + l.shippedQty, 0);
    const receivedUnits = r.lines.reduce((a, l) => a + l.receivedQty, 0);
    const showShipped = r.status !== "requested";
    const showReceived = r.status === "confirmed";

    const startMode = (m: Exclude<Mode, null>) => {
        setValues(Object.fromEntries(r.lines.map((l) => [l.variantId, 0])));
        setMode(m);
    };

    const pickShort = r.lines.filter((l) => (values[l.variantId] ?? 0) < l.requestedQty);
    const confirmShort = r.lines.filter((l) => (values[l.variantId] ?? 0) < l.shippedQty);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                className="mb-0"
                backHref="/replenishment/requests"
                backLabel="Store Requests"
                eyebrow={
                    <>
                        <LocationName id={r.warehouseId} /> → <LocationName id={r.storeId} />
                    </>
                }
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        {r.number}
                        <StatusBadge status={r.status} size="lg" />
                    </span>
                }
                actions={
                    mode === null && (
                        <>
                            {r.status === "requested" && warehouseSide && (
                                <Button size="lg" iconLeading={Package} onPress={() => startMode("pick")}>
                                    Pick
                                </Button>
                            )}
                            {r.status === "picked" && warehouseSide && (
                                <Button
                                    size="lg"
                                    iconLeading={PackageCheck}
                                    onPress={() => {
                                        packRequest(r.id);
                                        toast.success(`${r.number} packed`, "Ship it when it leaves the warehouse.");
                                    }}
                                >
                                    Mark packed
                                </Button>
                            )}
                            {r.status === "packed" && warehouseSide && (
                                <Button size="lg" iconLeading={Truck01} onPress={() => setDialog("ship")}>
                                    Ship
                                </Button>
                            )}
                            {r.status === "shipped" && storeSide && (
                                <Button size="lg" iconLeading={CheckCircle} onPress={() => startMode("confirm")}>
                                    Confirm receipt
                                </Button>
                            )}
                        </>
                    )
                }
            />

            <Card>
                <Stepper steps={requestSteps} current={r.status} history={r.history} />
            </Card>

            {r.status === "shipped" && !storeSide && (
                <p className="rounded-xl bg-primary px-4 py-3 text-sm text-secondary ring-1 ring-secondary">
                    On its way — {formatNumber(shippedUnits)} units are In Transit until <LocationName id={r.storeId} /> confirms receipt.
                </p>
            )}

            {mode === "pick" && (
                <Card
                    title="Pick items"
                    description="Scan each item as you pull it from the shelf, or enter quantities by hand. Anything short ships short."
                    flush
                    actions={
                        <>
                            <Button color="secondary" onPress={() => setMode(null)}>
                                Cancel
                            </Button>
                            <Button onPress={() => setDialog("pick")}>Save pick</Button>
                        </>
                    }
                >
                    <ScanQtyEditor
                        lines={r.lines.map((l) => ({ variantId: l.variantId, target: l.requestedQty }))}
                        values={values}
                        onChange={setValues}
                        targetLabel="Requested"
                        valueLabel="Picked"
                        fillLabel="Picked everything as requested"
                    />
                </Card>
            )}

            {mode === "confirm" && (
                <Card
                    title="Confirm receipt"
                    description="Scan items as you unpack them, or enter what arrived. Shortfalls go to Approvals."
                    flush
                    actions={
                        <>
                            <Button color="secondary" onPress={() => setMode(null)}>
                                Cancel
                            </Button>
                            <Button onPress={() => setDialog("confirm")}>Confirm receipt</Button>
                        </>
                    }
                >
                    <ScanQtyEditor
                        lines={r.lines.map((l) => ({ variantId: l.variantId, target: l.shippedQty }))}
                        values={values}
                        onChange={setValues}
                        targetLabel="Shipped"
                        valueLabel="Received"
                        fillLabel="Everything arrived as shipped"
                    />
                </Card>
            )}

            <Card>
                <dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                    <Field label="Store">
                        <LocationName id={r.storeId} />
                    </Field>
                    <Field label="Warehouse">
                        <LocationName id={r.warehouseId} />
                    </Field>
                    <Field label="Requested by">
                        <EmployeeName id={r.createdBy} />
                        <span className="block text-sm font-normal text-tertiary">{formatDateTime(r.createdAt)}</span>
                    </Field>
                    <Field label="Units">
                        {formatNumber(requestedUnits)} requested
                        {showShipped && <span className="block text-sm font-normal text-tertiary">{formatNumber(shippedUnits)} shipped{showReceived ? ` · ${formatNumber(receivedUnits)} received` : ""}</span>}
                    </Field>
                </dl>
                {r.note && (
                    <div className="mt-5 rounded-xl bg-secondary px-4 py-3">
                        <p className="text-xs font-semibold text-quaternary">Note</p>
                        <p className="mt-0.5 text-sm text-secondary">{r.note}</p>
                    </div>
                )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Lines" flush className="lg:col-span-2">
                    <LineTable columns={[{ label: "Item" }, { label: "Requested" }, { label: "Shipped" }, { label: "Received" }]}>
                        {r.lines.map((l) => (
                            <tr key={l.variantId}>
                                <Td className="min-w-60">
                                    <VariantCell variantId={l.variantId} />
                                </Td>
                                <Td className="font-medium text-primary tabular-nums">{l.requestedQty}</Td>
                                <Td className={cx("tabular-nums", showShipped && l.shippedQty < l.requestedQty && "font-semibold text-orange-600")}>{showShipped ? l.shippedQty : "—"}</Td>
                                <Td className={cx("tabular-nums", showReceived && l.receivedQty < l.shippedQty && "font-semibold text-orange-600")}>{showReceived ? l.receivedQty : "—"}</Td>
                            </tr>
                        ))}
                    </LineTable>
                </Card>
                <Card title="History">
                    <HistoryTimeline events={r.history} labelFor={requestStatusLabel} />
                </Card>
            </div>

            {/* Pick */}
            <ConfirmDialog
                isOpen={dialog === "pick"}
                onOpenChange={(o) => setDialog(o ? "pick" : null)}
                title={`Save pick for ${r.number}?`}
                description={pickShort.length ? "These lines are short and will ship short:" : "Everything was picked as requested."}
                confirmLabel="Save pick"
                onConfirm={() => {
                    pickRequest(r.id, values);
                    setMode(null);
                    toast.success(`${r.number} picked`, "Pack it next.");
                }}
            >
                {pickShort.length > 0 && <ShortList items={pickShort.map((l) => ({ id: l.variantId, label: variantLabel({ products, variants }, l.variantId), got: values[l.variantId] ?? 0, of: l.requestedQty }))} />}
            </ConfirmDialog>

            {/* Ship */}
            <ConfirmDialog
                isOpen={dialog === "ship"}
                onOpenChange={(o) => setDialog(o ? "ship" : null)}
                title={`Ship ${r.number}?`}
                description={`${formatNumber(shippedUnits)} units leave the warehouse. Stock moves to In Transit until the store confirms receipt.`}
                confirmLabel="Ship"
                onConfirm={() => {
                    shipRequest(r.id);
                    toast.success(`${r.number} shipped`, `${formatNumber(shippedUnits)} units now In Transit.`);
                }}
            />

            {/* Confirm receipt */}
            <ConfirmDialog
                isOpen={dialog === "confirm"}
                onOpenChange={(o) => setDialog(o ? "confirm" : null)}
                title={confirmShort.length ? "Confirm with items missing?" : "Confirm receipt?"}
                description={
                    confirmShort.length
                        ? "What arrived becomes Available. The missing units go to Approvals for a manager to review."
                        : "Everything arrived. It all becomes Available at the store."
                }
                confirmLabel="Confirm receipt"
                onConfirm={() => {
                    confirmRequest(r.id, values);
                    setMode(null);
                    if (confirmShort.length) toast.warning(`${r.number} confirmed`, "Shortfall sent to Approvals.");
                    else toast.success(`${r.number} confirmed`, "Stock is now Available at the store.");
                }}
            >
                {confirmShort.length > 0 && (
                    <ShortList items={confirmShort.map((l) => ({ id: l.variantId, label: variantLabel({ products, variants }, l.variantId), got: values[l.variantId] ?? 0, of: l.shippedQty }))} />
                )}
            </ConfirmDialog>
        </div>
    );
}

const ShortList = ({ items }: { items: { id: string; label: string; got: number; of: number }[] }) => (
    <ul className="flex flex-col divide-y divide-secondary rounded-xl ring-1 ring-secondary">
        {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-primary">
                    <AlertTriangle className="size-4 shrink-0 text-orange-500" />
                    <span className="truncate">{i.label}</span>
                </span>
                <span className="shrink-0 font-semibold text-orange-600 tabular-nums">
                    {i.got} of {i.of}
                </span>
            </li>
        ))}
    </ul>
);

export default function StoreRequestDetailPageRoute() {
    return (
        <Suspense>
            <StoreRequestDetailPage />
        </Suspense>
    );
}
