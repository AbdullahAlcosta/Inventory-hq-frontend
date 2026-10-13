import type { FC } from "react";
import {
    BarChartSquare02,
    Building07,
    CheckDone01,
    ClipboardCheck,
    ClockRewind,
    Edit05,
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
const warehouseOrManager = (s: Scope) => s.canManage || s.isWarehouseLevel;

export const navSections: NavSection[] = [
    {
        items: [
            { label: "Dashboard", href: "/dashboard", icon: HomeLine, visible: all },
            { label: "Approvals", href: "/approvals", icon: CheckDone01, visible: managers, badgeKey: "approvals" },
        ],
    },
    {
        title: "Catalog",
        items: [
            { label: "Products", href: "/catalog/products", icon: Package, visible: all },
            { label: "Bulk Import", href: "/catalog/import", icon: Upload01, visible: managers },
        ],
    },
    {
        title: "Stock",
        items: [
            { label: "Inventory", href: "/stock/inventory", icon: LayersThree01, visible: all },
            { label: "Product Lookup", href: "/stock/lookup", icon: PackageSearch, visible: all },
            { label: "Counts", href: "/stock/counts", icon: ClipboardCheck, visible: all },
            { label: "Adjustments", href: "/stock/adjustments", icon: Edit05, visible: all },
            { label: "Activity Log", href: "/stock/activity", icon: ClockRewind, visible: managers },
        ],
    },
    {
        title: "Purchasing",
        items: [
            { label: "Vendors", href: "/purchasing/vendors", icon: Building07, visible: managers },
            { label: "Purchase Orders", href: "/purchasing/orders", icon: ShoppingCart01, visible: warehouseOrManager },
            { label: "Receiving", href: "/purchasing/receiving", icon: Scan, visible: warehouseOrManager, badgeKey: "receiving" },
            { label: "Reorder", href: "/purchasing/reorder", icon: Repeat04, visible: managers },
        ],
    },
    {
        title: "Replenishment",
        items: [{ label: "Store Requests", href: "/replenishment/requests", icon: Truck01, visible: all, badgeKey: "requests" }],
    },
    {
        title: "Sales Channels",
        items: [
            { label: "Connections", href: "/channels/connections", icon: Link01, visible: managers },
            { label: "Allocation", href: "/channels/allocation", icon: SwitchHorizontal01, visible: managers },
            { label: "Reconciliation", href: "/channels/reconciliation", icon: RefreshCw01, visible: managers },
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

export const isPathAllowed = (pathname: string, scope: Scope) => {
    const match = allNavItems
        .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
        .sort((a, b) => b.href.length - a.href.length)[0];
    if (pathname.startsWith("/setup/companies")) return scope.isExecutive;
    return match ? match.visible(scope) : true;
};
