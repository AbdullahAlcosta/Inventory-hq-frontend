"use client";

import { useEffect, useMemo, useState } from "react";
import { scopeFor } from "@/lib/selectors";
import type { Employee, Location } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

/** True once the persisted store has loaded from localStorage. */
export const useHydrated = () => {
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => {
        const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
        if (useAppStore.persist.hasHydrated()) setHydrated(true);
        return unsub;
    }, []);
    return hydrated;
};

export const useCurrentUser = (): Employee | null => {
    const userId = useAppStore((s) => s.session.userId);
    const employees = useAppStore((s) => s.employees);
    return useMemo(() => employees.find((e) => e.id === userId) ?? null, [employees, userId]);
};

export interface Scope {
    user: Employee;
    companyId: string;
    /** Everything this user may access (role + assignment). */
    businessUnitIds: string[];
    locationIds: string[];
    /**
     * Narrowed by the sidebar Location switcher. Use these to filter lists.
     * "All locations" → everything in scope; a business unit → its locations; a location → just that one.
     */
    activeBusinessUnitIds: string[];
    activeLocationIds: string[];
    /** The single store/warehouse picked in the switcher, or null on an overview ("All…"). */
    activeLocation: Location | null;
    /** Raw switcher value: "all" | "bu:<id>" | "loc:<id>". */
    context: string;
    locations: Location[];
    stores: Location[];
    warehouses: Location[];
    isExecutive: boolean;
    isManager: boolean;
    isAssociate: boolean;
    isStoreLevel: boolean;
    isWarehouseLevel: boolean;
    /** Managers and executives: decide approvals (for their locations), see the activity log. */
    canManage: boolean;
    /** Create/edit products and bulk import: executives and warehouse managers. */
    canManageCatalog: boolean;
    /** Vendors, purchase orders, reorder settings: executives and warehouse managers. */
    canManagePurchasing: boolean;
    /** Purchase orders & receiving screens: executives and warehouse staff. */
    canSeePurchasing: boolean;
    /** Receiving screen: executives, warehouse staff, and store staff (for POs delivered to their store). */
    canReceive: boolean;
    /** Company setting: automatic reorders mode. */
    autoPO: "off" | "suggest" | "auto_draft";
    /** Sales channels (connections, allocation, reconciliation): executives only. */
    canManageChannels: boolean;
    /** Company setting: channel allocation switched on (Catalog → Allocation, product Allocation tab). */
    allocationEnabled: boolean;
}

const parseContext = (context: string) => {
    if (context.startsWith("bu:")) return { kind: "bu" as const, id: context.slice(3) };
    if (context.startsWith("loc:")) return { kind: "loc" as const, id: context.slice(4) };
    return { kind: "all" as const, id: "" };
};

/**
 * What the signed-in user can see, from their role + assignment (PRD §4),
 * narrowed by the location picked in the sidebar.
 */
export const useScope = (): Scope | null => {
    const user = useCurrentUser();
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const context = useAppStore((s) => s.session.context ?? "all");
    const companies = useAppStore((s) => s.companies);

    return useMemo(() => {
        if (!user) return null;
        const scope = scopeFor({ businessUnits, locations }, user);
        const scoped = locations.filter((l) => scope.locationIds.includes(l.id));
        const parsed = parseContext(context);

        let activeLocations = scoped;
        let activeLocation: Location | null = null;
        let activeContext = "all";
        if (parsed.kind === "loc" && scoped.some((l) => l.id === parsed.id)) {
            activeLocation = scoped.find((l) => l.id === parsed.id)!;
            activeLocations = [activeLocation];
            activeContext = context;
        } else if (parsed.kind === "bu" && scope.businessUnitIds.includes(parsed.id)) {
            activeLocations = scoped.filter((l) => l.businessUnitId === parsed.id);
            activeContext = context;
        } else if (scoped.length === 1 && user.role !== "executive") {
            activeLocation = scoped[0];
            activeLocations = scoped;
            activeContext = `loc:${scoped[0].id}`;
        }
        const activeBusinessUnitIds =
            parsed.kind === "all" || activeContext === "all"
                ? scope.businessUnitIds
                : Array.from(new Set(activeLocations.map((l) => l.businessUnitId))).filter((id) => scope.businessUnitIds.includes(id));

        const isExecutive = user.role === "executive";
        const isWarehouseManager = user.role === "manager" && user.level === "warehouse";
        return {
            user,
            companyId: user.companyId,
            businessUnitIds: scope.businessUnitIds,
            locationIds: scope.locationIds,
            activeBusinessUnitIds: activeBusinessUnitIds.length ? activeBusinessUnitIds : scope.businessUnitIds,
            activeLocationIds: activeLocations.map((l) => l.id),
            activeLocation,
            context: activeContext,
            locations: activeLocations,
            stores: activeLocations.filter((l) => l.type === "store"),
            warehouses: activeLocations.filter((l) => l.type === "warehouse"),
            isExecutive,
            isManager: user.role === "manager",
            isAssociate: user.role === "associate",
            isStoreLevel: user.level === "store",
            isWarehouseLevel: user.level === "warehouse",
            canManage: user.role !== "associate",
            canManageCatalog: isExecutive || isWarehouseManager,
            canManagePurchasing: isExecutive || isWarehouseManager,
            canSeePurchasing: isExecutive || user.level === "warehouse",
            canReceive: true,
            canManageChannels: isExecutive,
            autoPO: companies.find((c) => c.id === user.companyId)?.settings?.autoPO ?? "suggest",
            allocationEnabled: companies.find((c) => c.id === user.companyId)?.settings?.channelAllocation ?? true,
        };
    }, [user, businessUnits, locations, context, companies]);
};

/** Same as useScope but asserts a signed-in user (pages inside the app shell). */
export const useRequiredScope = (): Scope => {
    const scope = useScope();
    if (!scope) throw new Error("useRequiredScope used outside the signed-in app shell");
    return scope;
};
