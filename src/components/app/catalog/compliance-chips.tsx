"use client";

import { Check } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import type { ComplianceFlag } from "@/lib/types";
import { cx } from "@/utils/cx";
import { complianceFlags, flagLabel } from "./catalog-utils";

const flagColor: Record<ComplianceFlag, "orange" | "error" | "purple" | "gray" | "success" | "blue"> = {
    nicotine: "orange",
    tobacco: "orange",
    vape: "purple",
    age_21: "error",
    hemp: "success",
    lithium_battery: "blue",
};

/** Read-only compliance flag chips. */
export const ComplianceChips = ({ flags, size = "sm", max, emptyLabel = "—" }: { flags: ComplianceFlag[]; size?: "sm" | "md"; max?: number; emptyLabel?: string }) => {
    if (!flags.length) return <span className="text-sm text-quaternary">{emptyLabel}</span>;
    const shown = max ? flags.slice(0, max) : flags;
    const rest = flags.length - shown.length;
    return (
        <div className="flex flex-wrap gap-1">
            {shown.map((f) => (
                <Badge key={f} type="pill-color" color={flagColor[f]} size={size}>
                    {flagLabel(f)}
                </Badge>
            ))}
            {rest > 0 && (
                <Badge type="pill-color" color="gray" size={size}>
                    +{rest}
                </Badge>
            )}
        </div>
    );
};

/** Multi-select chips for compliance flags. */
export const ComplianceFlagPicker = ({ value, onChange }: { value: ComplianceFlag[]; onChange: (v: ComplianceFlag[]) => void }) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {complianceFlags.map((f) => {
            const on = value.includes(f.id);
            return (
                <AriaButton
                    key={f.id}
                    onPress={() => onChange(on ? value.filter((x) => x !== f.id) : [...value, f.id])}
                    aria-pressed={on}
                    className={cx(
                        "flex cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3 text-left ring-1 outline-hidden transition duration-100 ease-linear ring-inset focus-visible:ring-2 focus-visible:ring-brand",
                        on ? "bg-gray-950 text-white ring-gray-950" : "bg-primary ring-secondary hover:bg-primary_hover",
                    )}
                >
                    <span className={cx("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded ring-1 ring-inset", on ? "bg-white text-gray-950 ring-white" : "ring-primary")}>
                        {on && <Check className="size-3 stroke-[3px]" />}
                    </span>
                    <span className="min-w-0">
                        <span className={cx("block text-sm font-semibold", on ? "text-white" : "text-primary")}>{f.label}</span>
                        <span className={cx("block text-xs", on ? "text-white/70" : "text-tertiary")}>{f.hint}</span>
                    </span>
                </AriaButton>
            );
        })}
    </div>
);
