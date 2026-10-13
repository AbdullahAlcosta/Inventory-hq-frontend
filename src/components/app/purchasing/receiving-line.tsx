"use client";

import { useState } from "react";
import { Check, Edit05 } from "@untitledui/icons";
import { VariantCell } from "@/components/app/item-cell";
import { formatNumber } from "@/lib/format";
import type { POLine, Product } from "@/lib/types";
import { cx } from "@/utils/cx";
import { UnitsProgress } from "./flow-ui";

interface ReceivingLineProps {
    line: POLine;
    product?: Product;
    expected: number;
    highlighted?: boolean;
    disabled?: boolean;
    /** Adds (or removes, if negative) units on this line. */
    onAdjust: (delta: number) => void;
}

const chip =
    "flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-secondary ring-1 ring-primary ring-inset select-none hover:bg-primary_hover active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

/** One PO line on the receiving screen: live progress plus manual +/- / set fallback. Touch-sized. */
export const ReceivingLine = ({ line, product, expected, highlighted, disabled, onAdjust }: ReceivingLineProps) => {
    const [setting, setSetting] = useState(false);
    const [value, setValue] = useState("");
    const upp = product?.uom.unitsPerPurchaseUnit ?? 1;
    const remaining = expected - line.receivedUnits;
    const done = remaining <= 0;
    const over = remaining < 0;

    const applySet = () => {
        const target = parseInt(value, 10);
        if (!Number.isNaN(target) && target >= 0) onAdjust(target - line.receivedUnits);
        setSetting(false);
    };

    return (
        <li className={cx("flex flex-col gap-3 px-4 py-4 transition-colors duration-700 md:px-6", highlighted && "bg-green-50")}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <VariantCell variantId={line.variantId} link={false} />
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-xl font-semibold text-primary tabular-nums">
                        {formatNumber(line.receivedUnits)}
                        <span className="text-md font-medium text-tertiary"> / {formatNumber(expected)}</span>
                    </p>
                    <p className={cx("text-xs font-medium", over ? "text-orange-600" : done ? "text-green-600" : "text-tertiary")}>
                        {over ? `${formatNumber(-remaining)} over` : done ? (
                            <span className="inline-flex items-center gap-1">
                                <Check className="size-3.5" /> Received
                            </span>
                        ) : (
                            `${formatNumber(remaining)} to go`
                        )}
                    </p>
                </div>
            </div>
            <UnitsProgress value={line.receivedUnits} max={expected} />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-tertiary">
                    Ordered {line.orderedQty} {product?.uom.purchaseUnit} · 1 {product?.uom.purchaseUnit} = {upp} {product?.uom.sellingUnit}
                </p>
                {!disabled &&
                    (setting ? (
                        <form
                            className="flex items-center gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                applySet();
                            }}
                        >
                            <input
                                autoFocus
                                type="number"
                                inputMode="numeric"
                                min={0}
                                aria-label="Units received"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="h-11 w-24 rounded-lg bg-primary px-3 text-center text-md font-semibold text-primary tabular-nums shadow-xs ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-gray-900"
                            />
                            <button type="submit" className={cx(chip, "bg-gray-950 text-white ring-gray-950 hover:bg-gray-800")}>
                                Set
                            </button>
                            <button type="button" className={chip} onClick={() => setSetting(false)}>
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button type="button" className={chip} aria-label="Remove one unit" disabled={line.receivedUnits <= 0} onClick={() => onAdjust(-1)}>
                                −1
                            </button>
                            <button type="button" className={chip} aria-label="Add one unit" onClick={() => onAdjust(1)}>
                                +1
                            </button>
                            {upp > 1 && (
                                <button type="button" className={chip} onClick={() => onAdjust(upp)}>
                                    +1 {product?.uom.purchaseUnit}
                                </button>
                            )}
                            <button
                                type="button"
                                className={chip}
                                aria-label="Set units received"
                                onClick={() => {
                                    setValue(String(line.receivedUnits));
                                    setSetting(true);
                                }}
                            >
                                <Edit05 className="size-4" />
                            </button>
                        </div>
                    ))}
            </div>
        </li>
    );
};
