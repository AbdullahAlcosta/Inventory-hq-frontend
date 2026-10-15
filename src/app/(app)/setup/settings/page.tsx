"use client";

import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { Toggle } from "@/components/base/toggle/toggle";
import { useRequiredScope } from "@/hooks/use-session";
import { useAppStore } from "@/store/app-store";

/** Company-wide feature switches. Each company decides which optional workflows it uses. */
export default function CompanySettingsPage() {
    const scope = useRequiredScope();
    const company = useAppStore((s) => s.companies.find((c) => c.id === scope.companyId));
    const allocationCount = useAppStore(
        (s) =>
            s.allocations.filter(
                (a) => a.mode !== "shared" && s.locations.some((l) => l.id === a.locationId && scope.businessUnitIds.includes(l.businessUnitId)),
            ).length,
    );
    const updateCompanySettings = useAppStore((s) => s.updateCompanySettings);

    return (
        <>
            <PageHeader eyebrow={company?.name} title="Company settings" description="Turn optional features on or off for your whole company." />

            <Card title="Sales channels">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-md font-semibold text-primary">Channel allocation</p>
                        <p className="mt-1 text-sm text-tertiary">
                            Split a store’s stock between its sales channels — keep some for in-store only (Dedicated), reserve part for one channel and share
                            the rest (Hybrid), or let every channel sell everything (Shared).
                        </p>
                        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-secondary">
                            <li>
                                <b>On:</b> Catalog → Allocation and the product Allocation tab are available; each channel is told its allocation minus its
                                safety buffer.
                            </li>
                            <li>
                                <b>Off:</b> every channel sells from the store’s full Available stock, minus its safety buffer. Allocation screens are hidden.
                                {allocationCount > 0 &&
                                    ` Your ${allocationCount} saved split${allocationCount === 1 ? " is" : "s are"} kept and come back if you turn it on again.`}
                            </li>
                        </ul>
                    </div>
                    <Toggle
                        aria-label="Channel allocation"
                        size="md"
                        isSelected={company?.settings?.channelAllocation ?? true}
                        isDisabled={!scope.isExecutive}
                        onChange={(on) => {
                            updateCompanySettings(scope.companyId, { channelAllocation: on });
                            toast.success(
                                on ? "Channel allocation is on" : "Channel allocation is off",
                                on ? "Find it under Catalog → Allocation." : "Channels now sell from full Available stock.",
                            );
                        }}
                    />
                </div>
            </Card>
        </>
    );
}
