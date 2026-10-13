"use client";

import { useMemo } from "react";
import { VariantCell } from "@/components/app/item-cell";
import { LineTable, QtyStepper, Td } from "@/components/app/purchasing/flow-ui";
import { ScanInput, type ScanFeedback, type SimulatedCode } from "@/components/app/scan-input";
import { Button } from "@/components/base/buttons/button";
import { lookupCode, variantLabel } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

interface EditorLine {
    variantId: string;
    /** What we expect (requested qty when picking, shipped qty when confirming). */
    target: number;
}

interface ScanQtyEditorProps {
    lines: EditorLine[];
    values: Record<string, number>;
    onChange: (values: Record<string, number>) => void;
    targetLabel: string;
    valueLabel: string;
    fillLabel: string;
}

/**
 * Per-line quantity entry with scanning (PRD §11): each scan adds units to the
 * matching line (a case barcode adds the whole case). Manual +/- is the fallback.
 */
export const ScanQtyEditor = ({ lines, values, onChange, targetLabel, valueLabel, fillLabel }: ScanQtyEditorProps) => {
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const data = useMemo(() => ({ products, variants }), [products, variants]);

    const simulate = useMemo<SimulatedCode[]>(() => {
        const codes: SimulatedCode[] = [];
        lines.forEach((l) => {
            const v = variants.find((x) => x.id === l.variantId);
            const p = products.find((x) => x.id === v?.productId);
            if (!v || !p) return;
            const selling = v.barcodes.find((b) => b.unit === "selling");
            const purchase = v.barcodes.find((b) => b.unit === "purchase");
            if (selling) codes.push({ code: selling.code, label: `${p.name} — ${v.name}`, hint: `1 ${p.uom.sellingUnit}` });
            if (purchase) codes.push({ code: purchase.code, label: `${p.name} — ${v.name}`, hint: `1 ${p.uom.purchaseUnit} = ${p.uom.unitsPerPurchaseUnit}` });
        });
        const onList = new Set(lines.map((l) => l.variantId));
        const bu = products.find((p) => p.id === variants.find((v) => v.id === lines[0]?.variantId)?.productId)?.businessUnitId;
        const other = variants.find((v) => !onList.has(v.id) && v.barcodes.length && products.find((p) => p.id === v.productId)?.businessUnitId === bu);
        if (other) codes.push({ code: other.barcodes[0].code, label: variantLabel(data, other.id), hint: "not on this request" });
        return codes;
    }, [lines, variants, products, data]);

    const onScan = (code: string, qty: number): ScanFeedback => {
        const hit = lookupCode(data, code);
        if (!hit) return { tone: "error", title: `${code} isn’t in the catalog`, description: "Check the item or enter quantities by hand." };
        const line = lines.find((l) => l.variantId === hit.variant.id);
        const label = `${hit.product.name} — ${hit.variant.name}`;
        if (!line) return { tone: "error", title: "Not on this request", description: `${label} — set it aside.` };
        const units = hit.units * qty;
        const next = (values[line.variantId] ?? 0) + units;
        onChange({ ...values, [line.variantId]: next });
        const conv = hit.unit === "purchase" ? ` (${qty} ${hit.product.uom.purchaseUnit} = ${units} ${hit.product.uom.sellingUnit})` : "";
        return {
            tone: next > line.target ? "warning" : "success",
            title: `+${units} ${label}${conv}`,
            description: `${next} of ${line.target}${next > line.target ? " — more than expected" : ""}`,
        };
    };

    const allDone = lines.every((l) => (values[l.variantId] ?? 0) === l.target);

    return (
        <div>
            <div className="border-b border-secondary px-5 py-4 md:px-6">
                <ScanInput onScan={onScan} simulate={simulate} withQuantity autoFocus={false} placeholder="Scan an item to count it" />
            </div>
            <LineTable columns={[{ label: "Item" }, { label: targetLabel }, { label: valueLabel }, { label: "" }]}>
                {lines.map((l) => {
                    const v = values[l.variantId] ?? 0;
                    return (
                        <tr key={l.variantId}>
                            <Td className="min-w-60">
                                <VariantCell variantId={l.variantId} link={false} />
                            </Td>
                            <Td className="font-medium text-primary tabular-nums">{l.target}</Td>
                            <Td>
                                <QtyStepper label={valueLabel} value={v} onChange={(n) => onChange({ ...values, [l.variantId]: n })} size="lg" />
                            </Td>
                            <Td className={cx("text-sm font-medium whitespace-nowrap", v < l.target ? "text-orange-600" : v > l.target ? "text-orange-600" : "text-green-600")}>
                                {v < l.target ? `${l.target - v} short` : v > l.target ? `${v - l.target} over` : "Matches"}
                            </Td>
                        </tr>
                    );
                })}
            </LineTable>
            {!allDone && (
                <div className="border-t border-secondary px-5 py-3 md:px-6">
                    <Button color="link-gray" onPress={() => onChange(Object.fromEntries(lines.map((l) => [l.variantId, l.target])))}>
                        {fillLabel}
                    </Button>
                </div>
            )}
        </div>
    );
};
