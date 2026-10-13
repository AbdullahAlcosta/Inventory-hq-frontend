"use client";

import { PageHeader } from "@/components/app/page-header";
import { useEyebrow } from "@/components/app/channels/channel-utils";
import { StoreAssociateHome, WarehouseAssociateHome } from "@/components/app/dashboard/associate-home";
import { ManagerHome } from "@/components/app/dashboard/manager-home";
import { useRequiredScope } from "@/hooks/use-session";

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function DashboardPage() {
    const scope = useRequiredScope();
    const eyebrow = useEyebrow(scope);
    const firstName = scope.user.name.split(" ")[0];

    const description = scope.isAssociate
        ? scope.isWarehouseLevel
            ? `Your queue at ${scope.warehouses.map((w) => w.name).join(", ") || "your warehouse"}.`
            : `Here's what's happening at ${scope.stores.map((s) => s.name).join(", ") || "your store"}.`
        : scope.isExecutive
          ? "Here's how the business is doing."
          : `Here's what's happening across your ${scope.locations.length === 1 ? "location" : `${scope.locations.length} locations`}.`;

    return (
        <>
            <PageHeader eyebrow={eyebrow} title={`${greeting()}, ${firstName}`} description={description} />
            {scope.isAssociate ? (
                scope.isWarehouseLevel ? (
                    <WarehouseAssociateHome scope={scope} />
                ) : (
                    <StoreAssociateHome scope={scope} />
                )
            ) : (
                <ManagerHome scope={scope} />
            )}
        </>
    );
}
