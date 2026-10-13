"use client";

import type { ReactNode } from "react";
import { Check } from "@untitledui/icons";
import { EmployeeName } from "@/components/app/item-cell";
import { statusLabel } from "@/components/app/status-badge";
import { formatDateTime } from "@/lib/format";
import type { StatusEvent } from "@/lib/types";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ */
/* Lifecycle stepper (PO §9.1, store request §9.2)                     */
/* ------------------------------------------------------------------ */

export interface Step {
    id: string;
    label: string;
}

/** Horizontal stepper. Steps before `current` are done; the current one is highlighted. A final step that is current counts as done. */
export const Stepper = ({ steps, current, history = [] }: { steps: Step[]; current: string; history?: StatusEvent[] }) => {
    const currentIndex = Math.max(
        0,
        steps.findIndex((s) => s.id === current),
    );
    const finished = currentIndex === steps.length - 1;
    return (
        <ol className="flex w-full overflow-x-auto pb-1">
            {steps.map((step, i) => {
                const done = i < currentIndex || (finished && i === currentIndex);
                const active = i === currentIndex && !finished;
                const at = [...history].reverse().find((h) => h.status === step.id)?.at;
                return (
                    <li key={step.id} className="relative flex min-w-28 flex-1 flex-col items-center text-center">
                        {i > 0 && <span className={cx("absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2", i <= currentIndex ? "bg-gray-900" : "bg-gray-200")} aria-hidden="true" />}
                        <span
                            className={cx(
                                "relative z-1 flex size-8 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-primary",
                                done && "bg-gray-900 text-white",
                                active && "bg-primary text-primary ring-gray-900 outline-2 outline-gray-900",
                                !done && !active && "bg-gray-100 text-quaternary",
                            )}
                        >
                            {done ? <Check className="size-4" /> : i + 1}
                        </span>
                        <span className={cx("mt-2 px-1 text-sm font-semibold", done || active ? "text-primary" : "text-quaternary")}>{step.label}</span>
                        {at && (done || active) && <span className="text-xs text-tertiary">{formatDateTime(at)}</span>}
                    </li>
                );
            })}
        </ol>
    );
};

/* ------------------------------------------------------------------ */
/* History timeline                                                    */
/* ------------------------------------------------------------------ */

export const HistoryTimeline = ({ events, labelFor = statusLabel }: { events: StatusEvent[]; labelFor?: (status: string) => string }) => (
    <ol className="flex flex-col">
        {[...events].reverse().map((e, i, arr) => (
            <li key={`${e.status}-${e.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
                {i < arr.length - 1 && <span className="absolute top-3 left-[5px] h-full w-px bg-gray-200" aria-hidden="true" />}
                <span className={cx("relative mt-1.5 size-2.75 shrink-0 rounded-full ring-2 ring-primary", i === 0 ? "bg-gray-900" : "bg-gray-300")} />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">{labelFor(e.status)}</p>
                    <p className="text-sm text-tertiary">
                        <EmployeeName id={e.by} /> · {formatDateTime(e.at)}
                    </p>
                    {e.note && <p className="mt-1 text-sm text-secondary">{e.note}</p>}
                </div>
            </li>
        ))}
    </ol>
);

/* ------------------------------------------------------------------ */
/* Plain table for editable rows (inputs inside react-aria grids fight */
/* keyboard navigation, so line editors use a simple <table>).         */
/* ------------------------------------------------------------------ */

export interface Column {
    label: ReactNode;
    className?: string;
}

export const LineTable = ({ columns, children, className }: { columns: Column[]; children: ReactNode; className?: string }) => (
    <div className={cx("overflow-x-auto", className)}>
        <table className="w-full text-left text-sm">
            <thead className="border-b border-secondary bg-secondary">
                <tr>
                    {columns.map((c, i) => (
                        <th key={i} scope="col" className={cx("px-5 py-3 text-xs font-semibold whitespace-nowrap text-quaternary md:px-6", c.className)}>
                            {c.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-secondary">{children}</tbody>
        </table>
    </div>
);

export const Td = ({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) => (
    <td colSpan={colSpan} className={cx("px-5 py-3 align-middle text-tertiary md:px-6", className)}>
        {children}
    </td>
);

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export const UnitsProgress = ({ value, max, className }: { value: number; max: number; className?: string }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0;
    const over = value > max;
    const done = value >= max && max > 0;
    return (
        <div className={cx("flex min-w-32 items-center gap-3", className)}>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
                <div className={cx("h-full rounded-full transition-all duration-300", over ? "bg-orange-500" : done ? "bg-green-500" : "bg-gray-900")} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-medium text-tertiary tabular-nums">{Math.round(pct)}%</span>
        </div>
    );
};

/** Small +/- stepper for quantities, large touch targets. */
export const QtyStepper = ({
    value,
    onChange,
    min = 0,
    max,
    step = 1,
    label,
    size = "md",
}: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label: string;
    size?: "md" | "lg";
}) => {
    const clamp = (v: number) => Math.max(min, max === undefined ? v : Math.min(max, v));
    const btn = cx(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover disabled:cursor-not-allowed disabled:opacity-40",
        size === "lg" ? "size-11 text-lg" : "size-9 text-md",
    );
    return (
        <div className="flex items-center gap-1.5">
            <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
                −
            </button>
            <input
                type="number"
                inputMode="numeric"
                aria-label={label}
                value={Number.isFinite(value) ? value : 0}
                min={min}
                max={max}
                onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || 0))}
                onFocus={(e) => e.target.select()}
                className={cx(
                    "rounded-lg bg-primary text-center font-semibold text-primary tabular-nums shadow-xs ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-gray-900",
                    size === "lg" ? "h-11 w-20 text-md" : "h-9 w-16 text-sm",
                )}
            />
            <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={max !== undefined && value >= max} onClick={() => onChange(clamp(value + step))}>
                +
            </button>
        </div>
    );
};
