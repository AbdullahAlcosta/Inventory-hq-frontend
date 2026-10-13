"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InfoCircle } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { type DraftLine, POLinesEditor } from "@/components/app/purchasing/po-lines-editor";
import { poTotals } from "@/components/app/purchasing/po-utils";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

export default function NewPurchaseOrderPage() {
    return (
        <Suspense>
            <NewPurchaseOrder />
        </Suspense>
    );
}

function NewPurchaseOrder() {
    const scope = useRequiredScope();
    const router = useRouter();
    const params = useSearchParams();
    const vendors = useAppStore((s) => s.vendors);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const createPurchaseOrder = useAppStore((s) => s.createPurchaseOrder);

    const vendorOptions = useMemo(() => vendors.filter((v) => v.businessUnitIds.some((b) => scope.activeBusinessUnitIds.includes(b))).sort((a, b) => a.name.localeCompare(b.name)), [vendors, scope.activeBusinessUnitIds]);

    const [vendorId, setVendorId] = useState<string | null>(() => {
        const v = params.get("vendor");
        return v && vendorOptions.some((x) => x.id === v) ? v : null;
    });
    const vendor = vendors.find((v) => v.id === vendorId);
    const warehouseOptions = useMemo(() => scope.warehouses.filter((w) => vendor?.businessUnitIds.includes(w.businessUnitId)), [scope.warehouses, vendor]);
    const [warehouseId, setWarehouseId] = useState<string | null>(null);
    const warehouse = warehouseOptions.find((w) => w.id === warehouseId);
    const [lines, setLines] = useState<DraftLine[]>([]);
    const [notes, setNotes] = useState("");
    const [touched, setTouched] = useState(false);

    // Default the warehouse when there's only one choice; reset it if the vendor changes to a different BU.
    useEffect(() => {
        if (warehouseId && !warehouseOptions.some((w) => w.id === warehouseId)) setWarehouseId(null);
        if (!warehouseId && warehouseOptions.length === 1) setWarehouseId(warehouseOptions[0].id);
    }, [warehouseOptions, warehouseId]);

    // Lines must belong to the warehouse's BU.
    useEffect(() => {
        if (!warehouse) return;
        setLines((ls) => ls.filter((l) => products.find((p) => p.id === variants.find((v) => v.id === l.variantId)?.productId)?.businessUnitId === warehouse.businessUnitId));
    }, [warehouse, products, variants]);

    if (!scope.canManage) {
        return (
            <div>
                <PageHeader backHref="/purchasing/orders" backLabel="Purchase Orders" title="New purchase order" />
                <Card>
                    <p className="text-md text-tertiary">Only managers and executives can create purchase orders.</p>
                </Card>
            </div>
        );
    }

    const totals = poTotals({ products, variants }, { lines: lines.map((l) => ({ ...l, receivedUnits: 0 })) });
    const errors = [!vendorId && "Choose a vendor.", !warehouseId && "Choose a destination warehouse.", lines.length === 0 && "Add at least one line."].filter(Boolean) as string[];

    const save = () => {
        setTouched(true);
        if (errors.length || !vendorId || !warehouseId) return;
        const id = createPurchaseOrder({ vendorId, warehouseId, lines, notes: notes.trim() });
        toast.success("Purchase order created", "Mark it as sent once you’ve placed the order with the vendor.");
        router.push(`/purchasing/orders/view?id=${id}`);
    };

    return (
        <div className="flex flex-col gap-6 pb-24 md:pb-0">
            <PageHeader className="mb-0" backHref="/purchasing/orders" backLabel="Purchase Orders" eyebrow="Purchasing" title="New purchase order" />

            <div className="flex items-start gap-3 rounded-xl bg-primary px-4 py-3 ring-1 ring-secondary">
                <InfoCircle className="mt-0.5 size-5 shrink-0 text-fg-quaternary" />
                <p className="text-sm text-secondary">Placing the order with the vendor happens outside Inventory HQ. Create the PO here, send it to the vendor yourself, then mark it as sent.</p>
            </div>

            <Card title="Order details">
                <div className="grid gap-4 md:grid-cols-2">
                    <Select
                        label="Vendor"
                        isRequired
                        placeholder="Choose a vendor"
                        items={vendorOptions.map((v) => ({ id: v.id, label: v.name, supportingText: v.contactName }))}
                        selectedKey={vendorId}
                        onSelectionChange={(k) => setVendorId(k ? String(k) : null)}
                        isInvalid={touched && !vendorId}
                    >
                        {(item) => (
                            <Select.Item id={item.id} supportingText={item.supportingText}>
                                {item.label}
                            </Select.Item>
                        )}
                    </Select>
                    <Select
                        label="Destination warehouse"
                        isRequired
                        isDisabled={!vendor}
                        placeholder={vendor ? (warehouseOptions.length ? "Choose a warehouse" : "None of your warehouses match this vendor") : "Choose a vendor first"}
                        items={warehouseOptions.map((w) => ({ id: w.id, label: w.name, supportingText: w.code }))}
                        selectedKey={warehouseId}
                        onSelectionChange={(k) => setWarehouseId(k ? String(k) : null)}
                        isInvalid={touched && !warehouseId}
                    >
                        {(item) => (
                            <Select.Item id={item.id} supportingText={item.supportingText}>
                                {item.label}
                            </Select.Item>
                        )}
                    </Select>
                </div>
            </Card>

            <Card title="Lines" description="Order in purchase units (cases, boxes). Receiving converts them to selling units." flush>
                <POLinesEditor businessUnitId={warehouse?.businessUnitId ?? null} vendorId={vendorId} lines={lines} onChange={setLines} />
            </Card>

            <Card title="Notes">
                <TextArea aria-label="Notes" placeholder="Anything the receiving team should know" rows={3} value={notes} onChange={setNotes} />
            </Card>

            {touched && errors.length > 0 && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 ring-inset">{errors.join(" ")}</div>
            )}

            <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-secondary bg-primary px-4 py-3 md:static md:rounded-2xl md:px-6 md:py-4 md:ring-1 md:ring-secondary lg:ml-0">
                <div>
                    <p className="text-xs text-tertiary">
                        {totals.lines} line{totals.lines === 1 ? "" : "s"} · {formatNumber(totals.units)} units
                    </p>
                    <p className="text-lg font-semibold text-primary tabular-nums">{formatCurrency(totals.cost)}</p>
                </div>
                <div className="flex gap-3">
                    <Button color="secondary" size="lg" href="/purchasing/orders" className="hidden sm:inline-flex">
                        Cancel
                    </Button>
                    <Button size="lg" onPress={save}>
                        Create PO
                    </Button>
                </div>
            </div>
        </div>
    );
}
