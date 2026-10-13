"use client";

import { useCallback, useMemo, useState } from "react";
import { Trash01 } from "@untitledui/icons";
import { Empty } from "@/components/app/empty";
import { VariantCell } from "@/components/app/item-cell";
import { VariantPicker } from "@/components/app/variant-picker";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { formatCurrency } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import { LineTable, QtyStepper, Td } from "./flow-ui";
import { conversionText, poTotals, productForVariant, unitsPer } from "./po-utils";

export interface DraftLine {
    variantId: string;
    orderedQty: number;
    unitCost: number;
}

/** Edits PO lines: quantity in purchase units with conversion, unit cost per purchase unit, line total. */
export const POLinesEditor = ({ businessUnitId, vendorId, lines, onChange }: { businessUnitId: string | null; vendorId?: string | null; lines: DraftLine[]; onChange: (lines: DraftLine[]) => void }) => {
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const data = { products, variants };
    const vendorHasProducts = useMemo(
        () => !!vendorId && variants.some((v) => v.vendorId === vendorId && products.find((p) => p.id === v.productId)?.businessUnitId === businessUnitId),
        [vendorId, variants, products, businessUnitId],
    );
    const [onlyVendor, setOnlyVendor] = useState(true);
    const limitToVendor = onlyVendor && vendorHasProducts;
    const filter = useCallback((variantId: string) => !limitToVendor || variants.find((v) => v.id === variantId)?.vendorId === vendorId, [limitToVendor, variants, vendorId]);

    const add = (variantId: string) => {
        const v = variants.find((x) => x.id === variantId);
        if (!v) return;
        const restockCases = Math.max(1, Math.ceil(v.restockQty / unitsPer(data, variantId)));
        onChange([...lines, { variantId, orderedQty: restockCases, unitCost: +(v.cost * unitsPer(data, variantId)).toFixed(2) }]);
    };
    const update = (variantId: string, patch: Partial<DraftLine>) => onChange(lines.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));
    const remove = (variantId: string) => onChange(lines.filter((l) => l.variantId !== variantId));
    const totals = poTotals(data, { lines: lines.map((l) => ({ ...l, receivedUnits: 0 })) });

    return (
        <div>
            <div className="flex flex-col gap-3 border-b border-secondary px-5 py-4 md:px-6">
                {businessUnitId ? (
                    <>
                        <VariantPicker
                            businessUnitIds={[businessUnitId]}
                            exclude={lines.map((l) => l.variantId)}
                            filter={filter}
                            onSelect={add}
                            placeholder="Add a product — search name or SKU…"
                        />
                        {vendorHasProducts && <Checkbox label="Only show products this vendor supplies" isSelected={onlyVendor} onChange={setOnlyVendor} />}
                    </>
                ) : (
                    <p className="text-sm text-tertiary">Pick a vendor and destination warehouse first.</p>
                )}
            </div>
            {lines.length === 0 ? (
                <Empty title="No lines yet" description="Search above to add products to this order." />
            ) : (
                <LineTable
                    columns={[
                        { label: "Item" },
                        { label: "Quantity (purchase units)" },
                        { label: "Unit cost" },
                        { label: "Line total", className: "text-right" },
                        { label: <span className="sr-only">Remove</span> },
                    ]}
                >
                    {lines.map((l) => {
                        const p = productForVariant(data, l.variantId);
                        return (
                            <tr key={l.variantId}>
                                <Td className="min-w-64">
                                    <VariantCell variantId={l.variantId} link={false} />
                                </Td>
                                <Td>
                                    <QtyStepper label="Quantity" value={l.orderedQty} min={1} onChange={(v) => update(l.variantId, { orderedQty: v })} />
                                    <p className="mt-1 text-xs whitespace-nowrap text-tertiary">{conversionText(data, l.variantId, l.orderedQty)}</p>
                                </Td>
                                <Td>
                                    <div className="flex items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-gray-900">
                                        <span className="pl-3 text-tertiary">$</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="0.01"
                                            aria-label="Unit cost"
                                            value={l.unitCost}
                                            onChange={(e) => update(l.variantId, { unitCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                            className="h-9 w-24 bg-transparent px-2 text-sm text-primary tabular-nums outline-hidden"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs whitespace-nowrap text-tertiary">per {p?.uom.purchaseUnit.toLowerCase() ?? "unit"}</p>
                                </Td>
                                <Td className="text-right font-semibold whitespace-nowrap text-primary tabular-nums">{formatCurrency(l.orderedQty * l.unitCost)}</Td>
                                <Td className="w-12">
                                    <ButtonUtility icon={Trash01} tooltip="Remove line" size="xs" color="tertiary" onPress={() => remove(l.variantId)} />
                                </Td>
                            </tr>
                        );
                    })}
                    <tr className="bg-secondary">
                        <Td className="font-semibold text-primary">
                            {totals.lines} line{totals.lines === 1 ? "" : "s"}
                        </Td>
                        <Td className="font-medium text-primary">{totals.units.toLocaleString()} units</Td>
                        <Td />
                        <Td className="text-right text-md font-semibold whitespace-nowrap text-primary tabular-nums">{formatCurrency(totals.cost)}</Td>
                        <Td />
                    </tr>
                </LineTable>
            )}
        </div>
    );
};
