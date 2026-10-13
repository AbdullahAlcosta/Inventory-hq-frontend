"use client";

import type { ReactNode } from "react";
import { Check } from "@untitledui/icons";
import { ToggleButton as AriaToggleButton } from "react-aria-components";
import { cx } from "@/utils/cx";

export interface ChipOption {
    id: string;
    label: string;
    hint?: string;
    leading?: ReactNode;
}

/** Multi-select as toggleable chips — used for business units and locations. */
export const ChipSelect = ({
    label,
    hint,
    options,
    value,
    onChange,
    emptyText = "Nothing to choose yet.",
}: {
    label: string;
    hint?: ReactNode;
    options: ChipOption[];
    value: string[];
    onChange: (ids: string[]) => void;
    emptyText?: string;
}) => (
    <div role="group" aria-label={label}>
        <p className="mb-1.5 text-sm font-medium text-secondary">{label}</p>
        {options.length === 0 ? (
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-tertiary">{emptyText}</p>
        ) : (
            <div className="flex flex-wrap gap-2">
                {options.map((o) => {
                    const selected = value.includes(o.id);
                    return (
                        <AriaToggleButton
                            key={o.id}
                            isSelected={selected}
                            onChange={(on) => onChange(on ? [...value, o.id] : value.filter((v) => v !== o.id))}
                            className={cx(
                                "flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 outline-hidden transition duration-100 ease-linear ring-inset focus-visible:ring-2 focus-visible:ring-brand",
                                selected ? "bg-gray-950 text-white ring-gray-950" : "bg-primary text-secondary ring-primary hover:bg-primary_hover",
                            )}
                        >
                            {selected ? <Check className="size-4" /> : o.leading}
                            <span>{o.label}</span>
                            {o.hint && <span className={cx("text-xs", selected ? "text-white/70" : "text-tertiary")}>{o.hint}</span>}
                        </AriaToggleButton>
                    );
                })}
            </div>
        )}
        {hint && <p className="mt-1.5 text-sm text-tertiary">{hint}</p>}
    </div>
);
