"use client";

import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
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
            <div className="mt-6">
                <Card title="Purchasing">
                    <p className="text-md font-semibold text-primary">Automatic reorders</p>
                    <p className="mt-1 max-w-2xl text-sm text-tertiary">
                        For warehouse items at or below their minimum qty. Quantities come from the sales-speed forecast: sales/day × (lead time + cover days) +
                        minimum qty − available − already on open POs, rounded up to whole cases. Stores restock from their warehouse.
                    </p>
                    <RadioGroup
                        aria-label="Automatic reorders"
                        className="mt-4"
                        size="md"
                        isDisabled={!scope.isExecutive}
                        value={company?.settings?.autoPO ?? "suggest"}
                        onChange={(v) => {
                            const mode = v as "off" | "suggest" | "auto_draft";
                            updateCompanySettings(scope.companyId, { autoPO: mode });
                            toast.success(
                                { off: "Automatic reorders are off", suggest: "Reorders will be suggested", auto_draft: "Draft POs will be created automatically" }[mode],
                                { off: "The Reorder page still shows stock status.", suggest: "Suggestions land in Approvals.", auto_draft: "Run it now from Purchasing → Reorder, or it runs when a manager signs in." }[mode],
                            );
                        }}
                    >
                        <RadioButton value="off" label="Off" hint="Show reorder status only. Nobody gets suggestions; POs are created by hand." />
                        <RadioButton value="suggest" label="Suggest in Approvals (default)" hint="Items below minimum become reorder suggestions. Approving one creates a PO." />
                        <RadioButton
                            value="auto_draft"
                            label="Create draft POs automatically"
                            hint="One draft PO per vendor and warehouse. Drafts are never sent — a person reviews each one and marks it sent."
                        />
                    </RadioGroup>
                </Card>
            </div>
        </>
    );
}
