"use client";

import { useMemo, useState } from "react";
import type { Key } from "react-aria-components";
import { VariantCell } from "@/components/app/item-cell";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { VariantPicker } from "@/components/app/variant-picker";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { InputNumber } from "@/components/base/input/input-number";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { useRequiredScope } from "@/hooks/use-session";
import { formatNumber } from "@/lib/format";
import { stockAt } from "@/lib/selectors";
import type { AdjustmentReason, StockState } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { LockedLocation } from "./locked-location";
import { locationItems, stateLabels } from "./stock-utils";

interface AdjustmentModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** Prefill (e.g. from the inventory row "Adjust" action). */
    locationId?: string;
    variantId?: string;
    onCreated?: (adjustmentId: string) => void;
}

type Mode = "quantity" | "state";
type QtyReason = Exclude<AdjustmentReason, "state_change">;

const qtyReasons: { id: QtyReason; label: string; direction: "remove" | "add" | "either" }[] = [
    { id: "damaged", label: "Damaged", direction: "remove" },
    { id: "expired", label: "Expired", direction: "remove" },
    { id: "lost", label: "Lost / missing", direction: "remove" },
    { id: "found", label: "Found extra", direction: "add" },
    { id: "other", label: "Other", direction: "either" },
];

const states: StockState[] = ["available", "inTransit", "returns", "damaged"];
const stateItems = states.map((s) => ({ id: s, label: stateLabels[s] }));

/** "New adjustment" — every adjustment needs a reason + note and goes to Approvals (PRD §5.5). */
export const AdjustmentModal = (props: AdjustmentModalProps) => {
    if (!props.isOpen) return null;
    return <AdjustmentForm key={`${props.locationId}-${props.variantId}`} {...props} />;
};

const AdjustmentForm = ({ isOpen, onOpenChange, locationId: initialLocation, variantId: initialVariant, onCreated }: AdjustmentModalProps) => {
    const scope = useRequiredScope();
    const locations = useAppStore((s) => s.locations);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const createAdjustment = useAppStore((s) => s.createAdjustment);

    const [locationId, setLocationId] = useState<string | null>(initialLocation ?? (scope.locations.length === 1 ? scope.locations[0].id : null));
    const [variantId, setVariantId] = useState<string | null>(initialVariant ?? null);
    const [mode, setMode] = useState<Mode>("quantity");
    const [reason, setReason] = useState<QtyReason | null>(null);
    const [direction, setDirection] = useState<"remove" | "add">("remove");
    const [moveToDamaged, setMoveToDamaged] = useState(true);
    const [fromState, setFromState] = useState<StockState>("available");
    const [toState, setToState] = useState<StockState>("returns");
    const [qty, setQty] = useState<number>(1);
    const [note, setNote] = useState("");
    const [tried, setTried] = useState(false);

    const location = locations.find((l) => l.id === locationId);
    const stock = locationId && variantId ? stockAt({ stockLevels }, variantId, locationId) : null;

    // Only items sold by this location's business unit.
    const buIds = useMemo(() => (location ? [location.businessUnitId] : scope.activeBusinessUnitIds), [location, scope.activeBusinessUnitIds]);
    const variantBu = useMemo(() => {
        const v = variants.find((x) => x.id === variantId);
        return v ? products.find((p) => p.id === v.productId)?.businessUnitId : undefined;
    }, [variantId, variants, products]);

    const reasonDef = qtyReasons.find((r) => r.id === reason);
    const effectiveDirection = reasonDef?.direction === "add" ? "add" : reasonDef?.direction === "remove" ? "remove" : direction;
    const isDamagedMove = mode === "quantity" && reason === "damaged" && moveToDamaged;

    // What the request will do.
    const sourceState: StockState | null = mode === "state" ? fromState : isDamagedMove ? "available" : effectiveDirection === "remove" ? "available" : null;
    const sourceQty = stock && sourceState ? stock[sourceState] : null;

    const errors = {
        location: !locationId ? "Pick a location." : null,
        item: !variantId
            ? "Pick an item."
            : location && variantBu && variantBu !== location.businessUnitId
              ? "This item isn’t sold by this location’s business unit."
              : null,
        reason: mode === "quantity" && !reason ? "Reason is required." : null,
        states: mode === "state" && fromState === toState ? "Pick two different states." : null,
        qty:
            !qty || qty < 1
                ? "Enter a quantity of 1 or more."
                : sourceQty !== null && qty > sourceQty
                  ? `Only ${formatNumber(sourceQty)} in ${stateLabels[sourceState!]}.`
                  : null,
        note: !note.trim() ? "A note is required — say what happened." : null,
    };
    const valid = Object.values(errors).every((e) => !e);

    const submit = () => {
        setTried(true);
        if (!valid || !locationId || !variantId) return;
        let input: Parameters<typeof createAdjustment>[0];
        if (mode === "state") {
            input = { locationId, variantId, reason: "state_change", quantity: qty, fromState, toState, note: note.trim() };
        } else if (isDamagedMove) {
            input = { locationId, variantId, reason: "damaged", quantity: qty, fromState: "available", toState: "damaged", note: note.trim() };
        } else {
            input = { locationId, variantId, reason: reason!, quantity: effectiveDirection === "add" ? qty : -qty, note: note.trim() };
        }
        const id = createAdjustment(input);
        const number = useAppStore.getState().adjustments.find((a) => a.id === id)?.number;
        toast.success("Sent to Approvals", `${number ?? "Adjustment"} will change stock once a manager approves it.`);
        onCreated?.(id);
        onOpenChange(false);
    };

    const err = (e: string | null) => (tried && e ? <p className="mt-1.5 text-sm text-error-primary">{e}</p> : null);

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title="New adjustment"
            description="Adjustments need a reason and a note. Stock changes only after approval."
            size="md"
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="lg" onPress={submit}>
                        Send to Approvals
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <div>
                    {initialLocation && location ? (
                        <LockedLocation name={location.name} type={location.type} />
                    ) : (
                        <Select
                            label="Location"
                            placeholder="Select a location"
                            items={locationItems(scope.locations)}
                            selectedKey={locationId}
                            onSelectionChange={(k: Key | null) => setLocationId(k ? String(k) : null)}
                        >
                            {(item) => (
                                <Select.Item id={item.id} supportingText={item.supportingText}>
                                    {item.label}
                                </Select.Item>
                            )}
                        </Select>
                    )}
                    {err(errors.location)}
                </div>

                <div>
                    <p className="mb-1.5 text-sm font-medium text-secondary">Item</p>
                    {variantId ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-secondary">
                            <VariantCell variantId={variantId} link={false} />
                            <Button size="sm" color="link-gray" onPress={() => setVariantId(null)}>
                                Change
                            </Button>
                        </div>
                    ) : (
                        <VariantPicker businessUnitIds={buIds} onSelect={setVariantId} />
                    )}
                    {err(errors.item)}
                </div>

                {stock && (
                    <div>
                        <p className="mb-1.5 text-sm font-medium text-secondary">Current stock at {location?.name}</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {states.map((s) => (
                                <div key={s} className={cx("rounded-xl bg-secondary px-3 py-2.5", sourceState === s && "ring-2 ring-gray-900")}>
                                    <p className="text-xs text-tertiary">{stateLabels[s]}</p>
                                    <p className="text-lg font-semibold text-primary">{formatNumber(stock[s])}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <p className="mb-1.5 text-sm font-medium text-secondary">Type</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(
                            [
                                { id: "quantity", title: "Change quantity", body: "Add or remove units — damaged, expired, lost, found." },
                                { id: "state", title: "Move between states", body: "e.g. Available → Returns, Returns → Damaged." },
                            ] as const
                        ).map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => setMode(o.id)}
                                className={cx(
                                    "rounded-xl p-3 text-left ring-1 transition duration-100 ease-linear ring-inset",
                                    mode === o.id ? "bg-primary ring-2 ring-gray-900" : "ring-secondary hover:bg-primary_hover",
                                )}
                            >
                                <p className="text-sm font-semibold text-primary">{o.title}</p>
                                <p className="mt-0.5 text-sm text-tertiary">{o.body}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {mode === "quantity" ? (
                    <>
                        <div>
                            <Select
                                label="Reason"
                                placeholder="Why is stock changing?"
                                items={qtyReasons.map((r) => ({ id: r.id, label: r.label }))}
                                selectedKey={reason}
                                onSelectionChange={(k: Key | null) => setReason(k ? (String(k) as QtyReason) : null)}
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                            {err(errors.reason)}
                        </div>
                        {reason === "damaged" && (
                            <Checkbox
                                isSelected={moveToDamaged}
                                onChange={setMoveToDamaged}
                                label="Move to Damaged state instead of removing"
                                hint="Keeps the units on record (e.g. for a vendor claim) but stops them being sold."
                            />
                        )}
                        {reason === "other" && (
                            <div className="flex gap-2">
                                {(["remove", "add"] as const).map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setDirection(d)}
                                        className={cx(
                                            "rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset",
                                            direction === d ? "bg-gray-950 text-white ring-gray-950" : "bg-primary text-secondary ring-secondary",
                                        )}
                                    >
                                        {d === "remove" ? "Remove units" : "Add units"}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Select
                                label="From"
                                items={stateItems}
                                selectedKey={fromState}
                                onSelectionChange={(k: Key | null) => k && setFromState(String(k) as StockState)}
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                            <Select
                                label="To"
                                items={stateItems}
                                selectedKey={toState}
                                onSelectionChange={(k: Key | null) => k && setToState(String(k) as StockState)}
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                        {err(errors.states)}
                    </div>
                )}

                <div>
                    <InputNumber
                        label={mode === "state" || isDamagedMove ? "Quantity to move" : effectiveDirection === "add" ? "Quantity to add" : "Quantity to remove"}
                        minValue={1}
                        value={qty}
                        onChange={(v) => setQty(Number.isNaN(v) ? 0 : v)}
                    />
                    {err(errors.qty)}
                </div>

                <div>
                    <TextArea
                        label="Note"
                        isRequired
                        placeholder="What happened? e.g. “Cracked tank out of the box.”"
                        rows={3}
                        value={note}
                        onChange={setNote}
                    />
                    {err(errors.note)}
                </div>
            </div>
        </ModalDialog>
    );
};
