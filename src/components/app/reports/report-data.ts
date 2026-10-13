/**
 * Pure derivations for the Executive monthly report (PRD §5.10).
 * Takes app data + the visible BU/location ids so company separation is kept.
 */
import type { AppData } from "@/store/app-store";
import type { BusinessUnit, Location } from "@/lib/types";

export interface MonthOption {
    id: string;
    label: string;
    /** Inclusive yyyy-mm-dd range. */
    start: string;
    end: string;
    /** Previous comparable period. */
    prevStart: string;
    prevEnd: string;
    prevLabel: string;
    mtd: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthName = (y: number, m: number, style: "long" | "short" = "long") => new Date(y, m, 1).toLocaleDateString("en-US", { month: style, year: "numeric" });
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** "Month to date" + the last full months that have sales history (max 6). */
export const monthOptions = (salesDates: string[], today = new Date()): MonthOption[] => {
    const earliest = salesDates.reduce((min, d) => (d < min ? d : min), ymd(today));
    const y = today.getFullYear();
    const m = today.getMonth();
    const options: MonthOption[] = [];

    // Month to date vs the same days of last month.
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    const dayNum = Math.min(today.getDate(), lastDay(prevY, prevM));
    options.push({
        id: "mtd",
        label: `Month to date (${monthName(y, m, "short")})`,
        start: `${y}-${pad(m + 1)}-01`,
        end: ymd(today),
        prevStart: `${prevY}-${pad(prevM + 1)}-01`,
        prevEnd: `${prevY}-${pad(prevM + 1)}-${pad(dayNum)}`,
        prevLabel: `${new Date(prevY, prevM, 1).toLocaleDateString("en-US", { month: "short" })} 1–${dayNum}`,
        mtd: true,
    });

    for (let i = 1; options.length < 7; i++) {
        const d = new Date(y, m - i, 1);
        const p = new Date(y, m - i - 1, 1);
        const start = ymd(d);
        // Stop at the first month only partly covered by sales history.
        if (start < earliest) break;
        options.push({
            id: start.slice(0, 7),
            label: monthName(d.getFullYear(), d.getMonth()),
            start,
            end: `${start.slice(0, 8)}${pad(lastDay(d.getFullYear(), d.getMonth()))}`,
            prevStart: ymd(p),
            prevEnd: `${ymd(p).slice(0, 8)}${pad(lastDay(p.getFullYear(), p.getMonth()))}`,
            prevLabel: monthName(p.getFullYear(), p.getMonth(), "short"),
            mtd: false,
        });
    }
    return options;
};

export interface SalesTotals {
    sales: number;
    cost: number;
    units: number;
    margin: number;
    marginPct: number;
}

const totals = (sales: number, cost: number, units: number): SalesTotals => ({
    sales,
    cost,
    units,
    margin: sales - cost,
    marginPct: sales > 0 ? ((sales - cost) / sales) * 100 : 0,
});

export interface InventoryValue {
    costAll: number;
    costAvailable: number;
    retailAll: number;
    retailAvailable: number;
    units: number;
}

export interface LocationRow extends SalesTotals {
    location: Location;
    businessUnit: BusinessUnit;
    inventory: InventoryValue;
}

export interface BusinessUnitRow extends SalesTotals {
    businessUnit: BusinessUnit;
    inventory: InventoryValue;
    stores: number;
    warehouses: number;
}

export interface ReportData {
    total: SalesTotals;
    prev: SalesTotals;
    /** False when the previous period isn't fully covered by sales history. */
    prevComplete: boolean;
    inventory: InventoryValue;
    byBusinessUnit: BusinessUnitRow[];
    byLocation: LocationRow[];
    topProducts: { productId: string; name: string; businessUnit: BusinessUnit; units: number; sales: number }[];
    ops: { approvalsDecided: number; posReceived: number; requestsShipped: number; countVariances: number; countsWithVariance: number };
    days: number;
}

const inRange = (iso: string | undefined, start: string, end: string) => {
    if (!iso) return false;
    const d = iso.length > 10 ? ymd(new Date(iso)) : iso;
    return d >= start && d <= end;
};

const daysBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;

export const buildReport = (data: AppData, businessUnitIds: string[], locationIds: string[], period: MonthOption): ReportData => {
    const bus = data.businessUnits.filter((b) => businessUnitIds.includes(b.id));
    const locs = data.locations.filter((l) => locationIds.includes(l.id) && businessUnitIds.includes(l.businessUnitId));
    const locIds = new Set(locs.map((l) => l.id));
    const variantById = new Map(data.variants.map((v) => [v.id, v]));

    // Sales per location for current and previous period.
    const cur = new Map<string, { sales: number; cost: number; units: number }>();
    let prevSales = 0;
    let prevCost = 0;
    let prevUnits = 0;
    let earliest = "9999";
    data.salesHistory.forEach((r) => {
        if (r.date < earliest) earliest = r.date;
        if (!locIds.has(r.locationId)) return;
        if (r.date >= period.start && r.date <= period.end) {
            const acc = cur.get(r.locationId) ?? { sales: 0, cost: 0, units: 0 };
            acc.sales += r.revenue;
            acc.cost += r.cost;
            acc.units += r.units;
            cur.set(r.locationId, acc);
        } else if (r.date >= period.prevStart && r.date <= period.prevEnd) {
            prevSales += r.revenue;
            prevCost += r.cost;
            prevUnits += r.units;
        }
    });

    // Inventory value now, per location.
    const inv = new Map<string, InventoryValue>();
    data.stockLevels.forEach((s) => {
        if (!locIds.has(s.locationId)) return;
        const v = variantById.get(s.variantId);
        if (!v) return;
        const all = s.available + s.inTransit + s.returns + s.damaged;
        const acc = inv.get(s.locationId) ?? { costAll: 0, costAvailable: 0, retailAll: 0, retailAvailable: 0, units: 0 };
        acc.costAll += all * v.cost;
        acc.costAvailable += s.available * v.cost;
        acc.retailAll += all * v.price;
        acc.retailAvailable += s.available * v.price;
        acc.units += all;
        inv.set(s.locationId, acc);
    });
    const emptyInv = (): InventoryValue => ({ costAll: 0, costAvailable: 0, retailAll: 0, retailAvailable: 0, units: 0 });
    const addInv = (a: InventoryValue, b: InventoryValue) => {
        a.costAll += b.costAll;
        a.costAvailable += b.costAvailable;
        a.retailAll += b.retailAll;
        a.retailAvailable += b.retailAvailable;
        a.units += b.units;
    };

    const byLocation: LocationRow[] = locs
        .map((location) => {
            const s = cur.get(location.id) ?? { sales: 0, cost: 0, units: 0 };
            return {
                ...totals(s.sales, s.cost, s.units),
                location,
                businessUnit: bus.find((b) => b.id === location.businessUnitId)!,
                inventory: inv.get(location.id) ?? emptyInv(),
            };
        })
        .sort((a, b) => bus.indexOf(a.businessUnit) - bus.indexOf(b.businessUnit) || (a.location.type === b.location.type ? b.sales - a.sales : a.location.type === "store" ? -1 : 1));

    const byBusinessUnit: BusinessUnitRow[] = bus.map((businessUnit) => {
        const rows = byLocation.filter((r) => r.businessUnit.id === businessUnit.id);
        const inventory = emptyInv();
        rows.forEach((r) => addInv(inventory, r.inventory));
        return {
            ...totals(
                rows.reduce((n, r) => n + r.sales, 0),
                rows.reduce((n, r) => n + r.cost, 0),
                rows.reduce((n, r) => n + r.units, 0),
            ),
            businessUnit,
            inventory,
            stores: rows.filter((r) => r.location.type === "store").length,
            warehouses: rows.filter((r) => r.location.type === "warehouse").length,
        };
    });

    const inventory = emptyInv();
    byBusinessUnit.forEach((r) => addInv(inventory, r.inventory));

    const total = totals(
        byBusinessUnit.reduce((n, r) => n + r.sales, 0),
        byBusinessUnit.reduce((n, r) => n + r.cost, 0),
        byBusinessUnit.reduce((n, r) => n + r.units, 0),
    );

    // Top products — estimated from each variant's average daily sales (no product-level history yet).
    const days = daysBetween(period.start, period.end);
    const topProducts = data.products
        .filter((p) => businessUnitIds.includes(p.businessUnitId) && p.status !== "archived")
        .map((p) => {
            const vs = data.variants.filter((v) => v.productId === p.id);
            const units = vs.reduce((n, v) => n + v.dailySales * days, 0);
            const sales = vs.reduce((n, v) => n + v.dailySales * days * v.price, 0);
            return { productId: p.id, name: p.name, businessUnit: bus.find((b) => b.id === p.businessUnitId)!, units: Math.round(units), sales };
        })
        .filter((p) => p.sales > 0)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

    // Operational summary.
    const approvalsDecided = data.approvals.filter(
        (a) => businessUnitIds.includes(a.businessUnitId) && (!a.locationId || locIds.has(a.locationId)) && a.status !== "pending" && inRange(a.decidedAt, period.start, period.end),
    ).length;
    const posReceived = data.purchaseOrders.filter((po) => locIds.has(po.warehouseId) && inRange(po.receivedAt, period.start, period.end)).length;
    const requestsShipped = data.storeRequests.filter(
        (r) => (locIds.has(r.storeId) || locIds.has(r.sourceId)) && r.history.some((h) => h.status === "shipped" && inRange(h.at, period.start, period.end)),
    ).length;
    let countVariances = 0;
    let countsWithVariance = 0;
    data.counts
        .filter((c) => locIds.has(c.locationId) && c.status !== "in_progress" && inRange(c.submittedAt ?? c.createdAt, period.start, period.end))
        .forEach((c) => {
            const n = c.lines.filter((l) => l.countedQty !== null && l.countedQty !== l.systemQty).length;
            countVariances += n;
            if (n) countsWithVariance++;
        });

    return {
        total,
        prev: totals(prevSales, prevCost, prevUnits),
        prevComplete: period.prevStart >= earliest,
        inventory,
        byBusinessUnit,
        byLocation,
        topProducts,
        ops: { approvalsDecided, posReceived, requestsShipped, countVariances, countsWithVariance },
        days,
    };
};

const csvCell = (v: string | number) => {
    const s = typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const reportCsv = (report: ReportData, periodLabel: string, companyName: string) => {
    const header = ["Level", "Business Unit", "Location", "Type", "Sales", "Cost", "Gross margin", "Margin %", "Units sold", "Inventory at cost", "Inventory at retail", "Available at cost"];
    const rows: (string | number)[][] = [header];
    rows.push(["Company", companyName, "", "", report.total.sales, report.total.cost, report.total.margin, report.total.marginPct, report.total.units, report.inventory.costAll, report.inventory.retailAll, report.inventory.costAvailable]);
    report.byBusinessUnit.forEach((b) =>
        rows.push(["Business Unit", b.businessUnit.name, "", "", b.sales, b.cost, b.margin, b.marginPct, b.units, b.inventory.costAll, b.inventory.retailAll, b.inventory.costAvailable]),
    );
    report.byLocation.forEach((l) => {
        const store = l.location.type === "store";
        rows.push([
            "Location",
            l.businessUnit.name,
            `${l.location.name} (${l.location.code})`,
            store ? "Store" : "Warehouse",
            store ? l.sales : "",
            store ? l.cost : "",
            store ? l.margin : "",
            store ? l.marginPct : "",
            store ? l.units : "",
            l.inventory.costAll,
            l.inventory.retailAll,
            l.inventory.costAvailable,
        ]);
    });
    return [`# Executive report — ${companyName} — ${periodLabel}`, ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
};
