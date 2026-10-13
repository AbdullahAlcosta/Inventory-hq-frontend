"use client";

import { PageHeader } from "@/components/app/page-header";
import { StoreHome, WarehouseHome } from "@/components/app/dashboard/location-home";
import { OverviewHome } from "@/components/app/dashboard/overview-home";
import { useRequiredScope } from "@/hooks/use-session";
import { useAppStore } from "@/store/app-store";

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function DashboardPage() {
    const scope = useRequiredScope();
    const businessUnits = useAppStore((s) => s.businessUnits);
    const firstName = scope.user.name.split(" ")[0];
    const hello = `${greeting()}, ${firstName}.`;
    const location = scope.activeLocation;
    const buName = (id: string) => businessUnits.find((b) => b.id === id)?.name ?? "";

    if (location) {
        const isStore = location.type === "store";
        return (
            <>
                <PageHeader
                    eyebrow={`${isStore ? "Store" : "Warehouse"} · ${buName(location.businessUnitId)}`}
                    title={location.name}
                    description={isStore ? `${hello} Here's what's happening at this store.` : `${hello} Here's the queue at this warehouse.`}
                />
                {isStore ? <StoreHome scope={scope} store={location} /> : <WarehouseHome scope={scope} warehouse={location} />}
            </>
        );
    }

    const onBu = scope.context.startsWith("bu:");
    const title = onBu ? `${buName(scope.context.slice(3))} overview` : scope.isExecutive ? "Company overview" : "My locations";
    const eyebrow = onBu ? "Business unit" : scope.isExecutive ? "All locations" : `${scope.locations.length} locations`;

    return (
        <>
            <PageHeader
                eyebrow={eyebrow}
                title={title}
                description={scope.isExecutive ? `${hello} Here's how the business is doing.` : `${hello} Here's what's happening across your locations.`}
            />
            <OverviewHome scope={scope} />
        </>
    );
}
