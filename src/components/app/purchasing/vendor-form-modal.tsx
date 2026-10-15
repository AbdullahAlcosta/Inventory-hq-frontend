"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { useRequiredScope } from "@/hooks/use-session";
import type { Vendor } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

const blank = (buIds: string[]): Omit<Vendor, "id"> => ({ name: "", contactName: "", email: "", phone: "", businessUnitIds: buIds.length === 1 ? buIds : [], notes: "" });

/** Add or edit a vendor. Managers and executives only. */
export const VendorFormModal = ({ isOpen, onOpenChange, vendor, onSaved }: { isOpen: boolean; onOpenChange: (o: boolean) => void; vendor?: Vendor; onSaved?: (id: string) => void }) => {
    const scope = useRequiredScope();
    const businessUnits = useAppStore((s) => s.businessUnits);
    const addVendor = useAppStore((s) => s.addVendor);
    const updateVendor = useAppStore((s) => s.updateVendor);
    const [form, setForm] = useState<Omit<Vendor, "id">>(() => vendor ?? blank(scope.activeBusinessUnitIds));
    const [touched, setTouched] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setForm(vendor ? { ...vendor } : blank(scope.activeBusinessUnitIds));
            setTouched(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, vendor?.id]);

    const choosable = businessUnits.filter((b) => scope.businessUnitIds.includes(b.id));
    const set = <K extends keyof Omit<Vendor, "id">>(k: K, v: Omit<Vendor, "id">[K]) => setForm((f) => ({ ...f, [k]: v }));
    const errors = {
        name: !form.name.trim() ? "Vendor name is required." : undefined,
        bus: form.businessUnitIds.length === 0 ? "Pick at least one brand." : undefined,
        email: form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? "Enter a valid email." : undefined,
    };
    const valid = !errors.name && !errors.bus && !errors.email;

    const save = () => {
        setTouched(true);
        if (!valid) return;
        const clean = { ...form, name: form.name.trim(), contactName: form.contactName.trim(), email: form.email.trim(), phone: form.phone.trim() };
        if (vendor) {
            updateVendor(vendor.id, clean);
            toast.success("Vendor updated", clean.name);
            onSaved?.(vendor.id);
        } else {
            const id = addVendor(clean);
            toast.success("Vendor added", clean.name);
            onSaved?.(id);
        }
        onOpenChange(false);
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={vendor ? "Edit vendor" : "Add vendor"}
            description="Vendors supply products to your warehouses. Orders are placed with them outside Inventory HQ."
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="lg" onPress={save}>
                        {vendor ? "Save changes" : "Add vendor"}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <Input label="Vendor name" isRequired value={form.name} onChange={(v) => set("name", v)} isInvalid={touched && !!errors.name} hint={touched ? errors.name : undefined} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Contact name" value={form.contactName} onChange={(v) => set("contactName", v)} />
                    <Input label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone", v)} />
                </div>
                <Input label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} isInvalid={touched && !!errors.email} hint={touched ? errors.email : undefined} />
                <fieldset>
                    <legend className="mb-2 text-sm font-medium text-secondary">Brands *</legend>
                    <div className="flex flex-col gap-2.5">
                        {choosable.map((bu) => (
                            <Checkbox
                                key={bu.id}
                                label={bu.name}
                                isSelected={form.businessUnitIds.includes(bu.id)}
                                onChange={(on) => set("businessUnitIds", on ? [...form.businessUnitIds, bu.id] : form.businessUnitIds.filter((x) => x !== bu.id))}
                            />
                        ))}
                    </div>
                    {touched && errors.bus && <p className="mt-1.5 text-sm text-error-primary">{errors.bus}</p>}
                </fieldset>
                <TextArea label="Notes" placeholder="Terms, delivery days, minimums…" rows={3} value={form.notes} onChange={(v) => set("notes", v)} />
            </div>
        </ModalDialog>
    );
};
