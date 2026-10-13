import type { FC } from "react";
import {
    BarChartSquare02,
    Building07,
    CheckDone01,
    ClipboardCheck,
    ClockRewind,
    HomeLine,
    LayersThree01,
    Link01,
    Package,
    PackageSearch,
    RefreshCw01,
    Repeat04,
    Scan,
    ShoppingCart01,
    SwitchHorizontal01,
    Truck01,
    Upload01,
    Users01,
} from "@untitledui/icons";
import type { Scope } from "@/hooks/use-session";

export interface NavItem {
    label: string;
    href: string;
    icon: FC<{ className?: string }>;
    /** Who sees this item. Access always comes from role + assignment (PRD §7). */
    visible: (scope: Scope) => boolean;
    badgeKey?: "approvals" | "requests" | "receiving";
}

export interface NavSection {
    title?: string;
    items: NavItem[];
}

const all = () => true;
const managers = (s: Scope) => s.canManage;
const executives = (s: Scope) => s.isExecutive;
const catalogManagers = (s: Scope) => s.canManageCatalog;
const purchasingManagers = (s: Scope) => s.canManagePurchasing;
const purchasingStaff = (s: Scope) => s.canSeePurchasing;
const channelManagers = (s: Scope) => s.canManageChannels;

export const navSections: NavSection[] = [
    {
        items: [
            { label: "Dashboard", href: "/dashboard", icon: HomeLine, visible: all },
            { label: "Approvals", href: "/approvals", icon: CheckDone01, visible: managers, badgeKey: "approvals" },
        ],
    },
    {
        // Day-to-day work at one store or warehouse (picked in the Location switcher).
        title: "Location",
        items: [
            { label: "Inventory", href: "/stock/inventory", icon: LayersThree01, visible: all },
            { label: "Stock Control", href: "/stock/control", icon: ClipboardCheck, visible: all },
            { label: "Store Requests", href: "/replenishment/requests", icon: Truck01, visible: all, badgeKey: "requests" },
            { label: "Receiving", href: "/purchasing/receiving", icon: Scan, visible: purchasingStaff, badgeKey: "receiving" },
            { label: "Activity Log", href: "/stock/activity", icon: ClockRewind, visible: managers },
        ],
    },
    {
        title: "Catalog",
        items: [
            { label: "Products", href: "/catalog/products", icon: Package, visible: all },
            { label: "Product Lookup", href: "/stock/lookup", icon: PackageSearch, visible: all },
            { label: "Bulk Import", href: "/catalog/import", icon: Upload01, visible: catalogManagers },
        ],
    },
    {
        title: "Purchasing",
        items: [
            { label: "Purchase Orders", href: "/purchasing/orders", icon: ShoppingCart01, visible: purchasingStaff },
            { label: "Vendors", href: "/purchasing/vendors", icon: Building07, visible: purchasingManagers },
            { label: "Reorder", href: "/purchasing/reorder", icon: Repeat04, visible: purchasingManagers },
        ],
    },
    {
        title: "Sales Channels",
        items: [
            { label: "Connections", href: "/channels/connections", icon: Link01, visible: channelManagers },
            { label: "Allocation", href: "/channels/allocation", icon: SwitchHorizontal01, visible: channelManagers },
            { label: "Reconciliation", href: "/channels/reconciliation", icon: RefreshCw01, visible: channelManagers },
        ],
    },
    {
        title: "Company",
        items: [
            { label: "Executive Report", href: "/reports/executive", icon: BarChartSquare02, visible: executives },
            { label: "Locations", href: "/setup/locations", icon: Building07, visible: executives },
            { label: "Employees", href: "/setup/employees", icon: Users01, visible: executives },
        ],
    },
];

/** Flattened list, used to guard routes the current user can't open. */
export const allNavItems = navSections.flatMap((s) => s.items);

/** Extra rules for pages that aren't in the menu (create/edit pages). */
const extraRules: { prefix: string; visible: (s: Scope) => boolean }[] = [
    { prefix: "/setup/companies", visible: executives },
    { prefix: "/catalog/products/new", visible: catalogManagers },
    { prefix: "/purchasing/orders/new", visible: purchasingManagers },
];

export const isPathAllowed = (pathname: string, scope: Scope) => {
    const path = pathname.replace(/\/$/, "") || "/";
    const extra = extraRules.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));
    if (extra) return extra.visible(scope);
    const match = allNavItems
        .filter((i) => path === i.href || path.startsWith(i.href + "/"))
        .sort((a, b) => b.href.length - a.href.length)[0];
    return match ? match.visible(scope) : true;
};

export type LocationRequirement = "any" | "store" | "warehouse";

/**
 * Pages that work on one store or warehouse at a time. When the switcher is on an
 * overview ("All…"), the shell asks the user to pick a location first.
 */
export const requiredLocation = (pathname: string): LocationRequirement | null => {
    const path = pathname.replace(/\/$/, "") || "/";
    const exact: Record<string, LocationRequirement> = {
        "/stock/inventory": "any",
        "/stock/control": "any",
        "/replenishment/requests": "any",
        "/replenishment/requests/new": "store",
        "/purchasing/receiving": "warehouse",
    };
    return exact[path] ?? null;
};
