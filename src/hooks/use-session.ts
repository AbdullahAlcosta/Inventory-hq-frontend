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
    /** Everything this user may access. */
    businessUnitIds: string[];
    locationIds: string[];
    /** Narrowed by the sidebar Business Unit switcher. Use these to filter lists. */
    activeBusinessUnitIds: string[];
    activeLocationIds: string[];
    locations: Location[];
    stores: Location[];
    warehouses: Location[];
    isExecutive: boolean;
    isManager: boolean;
    isAssociate: boolean;
    isStoreLevel: boolean;
    isWarehouseLevel: boolean;
    /** Managers and executives can decide approvals and manage vendors/POs. */
    canManage: boolean;
}

/**
 * What the signed-in user can see, from their role + assignment (PRD §4),
 * narrowed by the Business Unit picked in the sidebar.
 */
export const useScope = (): Scope | null => {
    const user = useCurrentUser();
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const activeBu = useAppStore((s) => s.session.businessUnitId);

    return useMemo(() => {
        if (!user) return null;
        const scope = scopeFor({ businessUnits, locations }, user);
        const activeBusinessUnitIds = activeBu !== "all" && scope.businessUnitIds.includes(activeBu) ? [activeBu] : scope.businessUnitIds;
        const activeLocations = locations.filter((l) => scope.locationIds.includes(l.id) && activeBusinessUnitIds.includes(l.businessUnitId));
        return {
            user,
            companyId: user.companyId,
            businessUnitIds: scope.businessUnitIds,
            locationIds: scope.locationIds,
            activeBusinessUnitIds,
            activeLocationIds: activeLocations.map((l) => l.id),
            locations: activeLocations,
            stores: activeLocations.filter((l) => l.type === "store"),
            warehouses: activeLocations.filter((l) => l.type === "warehouse"),
            isExecutive: user.role === "executive",
            isManager: user.role === "manager",
            isAssociate: user.role === "associate",
            isStoreLevel: user.level === "store",
            isWarehouseLevel: user.level === "warehouse",
            canManage: user.role !== "associate",
        };
    }, [user, businessUnits, locations, activeBu]);
};

/** Same as useScope but asserts a signed-in user (pages inside the app shell). */
export const useRequiredScope = (): Scope => {
    const scope = useScope();
    if (!scope) throw new Error("useRequiredScope used outside the signed-in app shell");
    return scope;
};
