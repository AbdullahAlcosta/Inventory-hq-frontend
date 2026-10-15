"use client";

import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";
import type { Scope } from "@/hooks/use-session";
import { useAppStore } from "@/store/app-store";
import { BusinessUnitAvatar } from "./bu-avatar";
import type { LocationRequirement } from "./nav-config";
import { LocationIcon } from "./sidebar";

const kindLabel = { any: "store or warehouse", store: "store", warehouse: "warehouse" } as const;

/**
 * Gate for pages that work on one location at a time. If the Location switcher is on an
 * overview, list the locations this person can pick; picking one sets the switcher.
 */
export const RequireLocation = ({ scope, requirement, children }: { scope: Scope; requirement: LocationRequirement; children: ReactNode }) => {
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const setContext = useAppStore((s) => s.setContext);

    const fits = (type: "store" | "warehouse") => requirement === "any" || requirement === type;
    if (scope.activeLocation && fits(scope.activeLocation.type)) return <>{children}</>;

    // Offer locations inside the current overview first (e.g. a brand), else everything in scope.
    const pool = locations.filter((l) => scope.locationIds.includes(l.id) && fits(l.type));
    const narrowed = pool.filter((l) => scope.activeLocationIds.includes(l.id));
    const options = narrowed.length ? narrowed : pool;
    const groups = businessUnits.map((b) => ({ unit: b, locations: options.filter((l) => l.businessUnitId === b.id) })).filter((g) => g.locations.length);

    return (
        <div className="mx-auto mt-6 max-w-2xl">
            <div className="rounded-2xl bg-primary p-6 shadow-xs ring-1 ring-secondary md:p-8">
                <h1 className="text-display-xs font-semibold text-primary">Choose a {kindLabel[requirement]}</h1>
                <p className="mt-1 text-md text-tertiary">
                    {options.length
                        ? `This page works on one ${kindLabel[requirement]} at a time. Pick one here, or choose a brand and location in the sidebar.`
                        : `This page is for ${kindLabel[requirement]} staff, and you aren’t assigned to a ${kindLabel[requirement]}.`}
                </p>
                <div className="mt-6 flex flex-col gap-5">
                    {groups.map((g) => (
                        <div key={g.unit.id}>
                            <div className="mb-2 flex items-center gap-2">
                                <BusinessUnitAvatar unit={g.unit} size="sm" />
                                <p className="text-sm font-semibold text-secondary">{g.unit.name}</p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {g.locations.map((l) => (
                                    <AriaButton
                                        key={l.id}
                                        onPress={() => setContext(`loc:${l.id}`)}
                                        className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 ring-secondary outline-hidden transition duration-100 ease-linear hover:bg-primary_hover hover:ring-primary focus-visible:ring-2 focus-visible:ring-brand"
                                    >
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-secondary">
                                            <LocationIcon type={l.type} className="size-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-primary">{l.name}</span>
                                            <span className="block truncate text-xs text-tertiary">
                                                {l.type === "store" ? "Store" : "Warehouse"} · {l.code}
                                            </span>
                                        </span>
                                    </AriaButton>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
