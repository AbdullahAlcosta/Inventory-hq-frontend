import { ArrowDown, ArrowUp } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/** "+4.2% vs Aug" style change line. `points` shows a difference in percentage points instead. */
export const Delta = ({ current, previous, label, points, available = true }: { current: number; previous: number; label: string; points?: boolean; available?: boolean }) => {
    if (!available || (!points && previous === 0)) return <span className="text-tertiary">No data for {label}</span>;
    const diff = points ? current - previous : ((current - previous) / Math.abs(previous)) * 100;
    const up = diff >= 0;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            <span className={cx("inline-flex items-center gap-0.5 font-medium", up ? "text-success-primary" : "text-error-primary")}>
                {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                {Math.abs(diff).toFixed(1)}
                {points ? " pts" : "%"}
            </span>
            <span className="text-tertiary">vs {label}</span>
        </span>
    );
};
