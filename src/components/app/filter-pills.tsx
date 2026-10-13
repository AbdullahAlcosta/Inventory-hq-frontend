"use client";

import { Button as AriaButton } from "react-aria-components";
import { cx } from "@/utils/cx";

export interface PillOption<T extends string> {
    id: T;
    label: string;
    count?: number;
}

/** Black/white pill filters, matching the "Pending Verification / Approved / Rejected" pattern. */
export const FilterPills = <T extends string>({ options, value, onChange, className }: { options: PillOption<T>[]; value: T; onChange: (v: T) => void; className?: string }) => (
    <div className={cx("flex flex-wrap gap-2", className)} >
        {options.map((o) => {
            const active = o.id === value;
            return (
                <AriaButton
                    key={o.id}
                    onPress={() => onChange(o.id)}
                    className={cx(
                        "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 outline-hidden transition duration-100 ease-linear ring-inset focus-visible:ring-2 focus-visible:ring-brand",
                        active ? "bg-gray-950 text-white ring-gray-950" : "bg-primary text-secondary ring-secondary hover:bg-primary_hover",
                    )}
                >
                    {o.label}
                    {o.count !== undefined && (
                        <span className={cx("rounded-full px-1.5 text-xs", active ? "bg-white/20 text-white" : "bg-gray-100 text-tertiary")}>{o.count}</span>
                    )}
                </AriaButton>
            );
        })}
    </div>
);
