"use client";

import { Checkbox } from "@/components/base/checkbox/checkbox";
import { InputNumber } from "@/components/base/input/input-number";
import { Select } from "@/components/base/select/select";
import type { ComplianceFlag } from "@/lib/types";
import { cx } from "@/utils/cx";
import { complianceFlags, scheduleOptions } from "./channel-utils";

interface Props {
    syncMode: "live" | "scheduled";
    schedule: string;
    buffer: number;
    flags: ComplianceFlag[];
    onSyncMode: (m: "live" | "scheduled") => void;
    onSchedule: (s: string) => void;
    onBuffer: (n: number) => void;
    onFlags: (f: ComplianceFlag[]) => void;
}

/** Sync speed, safety buffer and blocked compliance flags — shared by connect + edit. */
export const SyncSettingsFields = ({ syncMode, schedule, buffer, flags, onSyncMode, onSchedule, onBuffer, onFlags, wide }: Props & { wide?: boolean }) => {
    const schedules = scheduleOptions.includes(schedule) || schedule === "Live" ? scheduleOptions : [schedule, ...scheduleOptions];
    return (
        <div className={cx("grid grid-cols-1 gap-5", wide && "lg:grid-cols-3 lg:gap-8")}>
            <div className="flex flex-col gap-4">
                <div>
                <p className="mb-1.5 text-sm font-medium text-secondary">Sync speed</p>
                <div className="grid grid-cols-2 gap-2">
                    {(["live", "scheduled"] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => {
                                onSyncMode(m);
                                if (m === "scheduled" && (schedule === "Live" || !schedule)) onSchedule("Every 30 minutes");
                            }}
                            className={cx(
                                "rounded-xl p-3 text-left ring-1 transition duration-100 ease-linear",
                                syncMode === m ? "bg-primary ring-2 ring-gray-950" : "bg-primary ring-secondary hover:bg-primary_hover",
                            )}
                        >
                            <span className="block text-sm font-semibold text-primary">{m === "live" ? "Live" : "Scheduled"}</span>
                            <span className="block text-xs text-tertiary">{m === "live" ? "Stock updates as soon as it changes." : "Stock is sent on a timer."}</span>
                        </button>
                    ))}
                </div>
            </div>
            {syncMode === "scheduled" && (
                <Select label="Schedule" items={schedules.map((s) => ({ id: s, label: s }))} selectedKey={schedule} onSelectionChange={(k) => onSchedule(k as string)}>
                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
            )}
            </div>
            <InputNumber
                label="Safety buffer (units)"
                hint="Held back from what the channel is told it can sell. Slower channels get a bigger buffer."
                minValue={0}
                maxValue={99}
                value={buffer}
                onChange={(n) => onBuffer(Number.isNaN(n) ? 0 : n)}
            />
            <div>
                <p className="text-sm font-medium text-secondary">Blocked compliance flags</p>
                <p className="mb-2 text-sm text-tertiary">Products with these flags are never pushed to this channel.</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                    {complianceFlags.map((f) => (
                        <Checkbox
                            key={f.id}
                            label={f.label}
                            isSelected={flags.includes(f.id)}
                            onChange={(on) => onFlags(on ? [...flags, f.id] : flags.filter((x) => x !== f.id))}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
