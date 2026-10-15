"use client";

import { useEffect, useState } from "react";
import { VariantCell } from "@/components/app/item-cell";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { InputNumber } from "@/components/base/input/input-number";
import { Select } from "@/components/base/select/select";
import { productOf } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";

const NO_VENDOR = "__none";

/** Edit a variant's reorder settings (PRD §5.8): minimum qty, restock qty, cover days, lead time, default vendor. */
export const ReorderSettingsModal = ({ variantId, onClose }: { variantId: string | null; onClose: () => void }) => {
    const variant = useAppStore((s) => s.variants.find((v) => v.id === variantId));
    const product = useAppStore((s) => (variantId ? productOf(s, variantId) : undefined));
    const allVendors = useAppStore((s) => s.vendors);
    const updateVariant = useAppStore((s) => s.updateVariant);

    const [reorderPoint, setReorderPoint] = useState(0);
    const [restockQty, setRestockQty] = useState(0);
    const [leadTime, setLeadTime] = useState(0);
    const [coverDays, setCoverDays] = useState(14);
    const [vendorId, setVendorId] = useState<string>(NO_VENDOR);

    useEffect(() => {
        if (!variant) return;
        setReorderPoint(variant.reorderPoint);
        setRestockQty(variant.restockQty);
        setLeadTime(variant.leadTimeDays);
        setCoverDays(variant.coverDays ?? 14);
        setVendorId(variant.vendorId ?? NO_VENDOR);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantId]);

    const vendors = allVendors.filter((v) => !product || v.businessUnitIds.includes(product.businessUnitId) || v.id === variant?.vendorId);
    const upp = product?.uom.unitsPerPurchaseUnit ?? 1;
    const num = (n: number) => (Number.isNaN(n) ? 0 : Math.max(0, Math.round(n)));

    const save = () => {
        if (!variant) return;
        updateVariant(variant.id, { reorderPoint, restockQty, leadTimeDays: leadTime, coverDays, vendorId: vendorId === NO_VENDOR ? null : vendorId });
        toast.success("Reorder settings saved", product ? `${product.name} — ${variant.name}` : undefined);
        onClose();
    };

    return (
        <ModalDialog
            isOpen={!!variant}
            onOpenChange={(o) => !o && onClose()}
            title="Reorder settings"
            description="Used to forecast reorders: sales/day × (lead time + cover days) + minimum qty, minus stock and open POs."
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={onClose}>
                        Cancel
                    </Button>
                    <Button size="lg" onPress={save}>
                        Save
                    </Button>
                </>
            }
        >
            {variant && (
                <div className="flex flex-col gap-5">
                    <VariantCell variantId={variant.id} link={false} />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <InputNumber label="Minimum qty" hint="Reorder when stock (incl. open POs) is at or below this." minValue={0} value={reorderPoint} onChange={(n) => setReorderPoint(num(n))} />
                        <InputNumber
                            label="Restock quantity"
                            hint={upp > 1 ? `Units to order · ${Math.ceil(restockQty / upp)} ${product?.uom.purchaseUnit.toLowerCase()} of ${upp}` : "Units to order"}
                            minValue={0}
                            value={restockQty}
                            onChange={(n) => setRestockQty(num(n))}
                        />
                        <InputNumber label="Lead time (days)" hint="Days from order to delivery." minValue={0} value={leadTime} onChange={(n) => setLeadTime(num(n))} />
                        <InputNumber label="Cover days" hint="Days of stock to order beyond lead time." minValue={0} value={coverDays} onChange={(n) => setCoverDays(num(n))} />
                        <Select
                            label="Default vendor"
                            items={[{ id: NO_VENDOR, label: "No default vendor" }, ...vendors.map((v) => ({ id: v.id, label: v.name }))]}
                            selectedKey={vendorId}
                            onSelectionChange={(k) => k && setVendorId(String(k))}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>
                    <p className="text-sm text-tertiary">Sales speed: {variant.dailySales.toFixed(1)} units/day across stores.</p>
                </div>
            )}
        </ModalDialog>
    );
};
