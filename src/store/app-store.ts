"use client";

/**
 * Client-side store for the static MVP.
 *
 * Every action here stands in for a future API call: it takes the same input
 * the endpoint would and applies the business rules from the PRD locally.
 * State is persisted to localStorage so demos survive a reload; use
 * `resetDemo()` to go back to the seed data.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
    channelAllocation,
    emptyStock,
    findDuplicates,
    isAllocationEnabled,
    lookupCode,
    productOf,
    variantLabel,
} from "@/lib/selectors";
import type {
    ActivityEntry,
    ActivityKind,
    Adjustment,
    AdjustmentReason,
    Allocation,
    Approval,
    BusinessUnit,
    ChannelConnection,
    Company,
    CompanySettings,
    Employee,
    ImportRow,
    Location,
    Mismatch,
    POLine,
    Product,
    PurchaseOrder,
    StockCount,
    StockLevel,
    StockState,
    StoreRequest,
    Variant,
    Vendor,
} from "@/lib/types";
import * as seed from "@/mock/seed";

/* ------------------------------------------------------------------ */
/* State shape                                                         */
/* ------------------------------------------------------------------ */

export interface AppData {
    companies: Company[];
    businessUnits: BusinessUnit[];
    locations: Location[];
    employees: Employee[];
    vendors: Vendor[];
    products: Product[];
    variants: Variant[];
    stockLevels: StockLevel[];
    connections: ChannelConnection[];
    allocations: Allocation[];
    listings: typeof seed.listings;
    mismatches: Mismatch[];
    purchaseOrders: PurchaseOrder[];
    storeRequests: StoreRequest[];
    counts: StockCount[];
    adjustments: Adjustment[];
    approvals: Approval[];
    salesHistory: seed.DailySales[];
    activity: ActivityEntry[];
}

export interface Session {
    userId: string | null;
    /**
     * What the sidebar Location switcher points at:
     * "all" (whole company / all my locations), "bu:<businessUnitId>" or "loc:<locationId>".
     */
    context: string;
    /** Users who finished or skipped the onboarding tour (so it only auto-starts once per person). */
    toursCompleted?: string[];
}

export type ScanResult =
    | { kind: "matched"; variantId: string; units: number; label: string }
    | { kind: "unexpected"; variantId: string | null; units: number; label: string }
    | { kind: "unknown"; label: string };

export interface ImportSummary {
    created: number;
    sentToApprovals: number;
    skipped: number;
}

interface Actions {
    /* session */
    login: (userId: string) => void;
    logout: () => void;
    setContext: (context: string) => void;
    completeTour: (userId: string) => void;
    updateCompanySettings: (companyId: string, patch: Partial<CompanySettings>) => void;
    resetDemo: () => void;

    /* setup */
    addCompany: (input: { name: string; executiveName: string; executiveEmail: string }) => string;
    addBusinessUnit: (input: Omit<BusinessUnit, "id">) => string;
    updateBusinessUnit: (id: string, patch: Partial<BusinessUnit>) => void;
    addLocation: (input: Omit<Location, "id" | "openingCountDone">) => string;
    updateLocation: (id: string, patch: Partial<Location>) => void;
    addEmployee: (input: Omit<Employee, "id">) => string;
    updateEmployee: (id: string, patch: Partial<Employee>) => void;

    /* catalog */
    createProduct: (product: Omit<Product, "id" | "createdAt">, variants: Omit<Variant, "id" | "productId">[]) => string;
    updateProduct: (id: string, patch: Partial<Product>) => void;
    addVariant: (productId: string, variant: Omit<Variant, "id" | "productId">) => string;
    updateVariant: (id: string, patch: Partial<Variant>) => void;
    importProducts: (businessUnitId: string, rows: ImportRow[], fileName: string) => ImportSummary;

    /* stock */
    startCount: (locationId: string, variantIds: string[], kind: StockCount["kind"]) => string;
    updateCountLine: (countId: string, variantId: string, countedQty: number | null) => void;
    addCountLine: (countId: string, variantId: string) => void;
    submitCount: (countId: string) => { variances: number };
    createAdjustment: (input: { locationId: string; variantId: string; reason: AdjustmentReason; quantity: number; fromState?: StockState; toState?: StockState; note: string }) => string;

    /* channels */
    addConnection: (input: Omit<ChannelConnection, "id" | "lastSyncAt" | "status">) => string;
    updateConnection: (id: string, patch: Partial<ChannelConnection>) => void;
    setAllocation: (allocation: Allocation) => void;
    pushToChannel: (connectionId: string, variantIds: string[]) => { pushed: number; blocked: number };
    pullFromChannel: (connectionId: string) => { mismatches: number };
    reconcileUpload: (connectionId: string, rows: { sku: string; quantity: number }[], fileName: string) => { compared: number; mismatches: number; unknown: number };

    /* purchasing */
    addVendor: (input: Omit<Vendor, "id">) => string;
    updateVendor: (id: string, patch: Partial<Vendor>) => void;
    createPurchaseOrder: (input: { vendorId: string; warehouseId: string; lines: Omit<POLine, "receivedUnits">[]; notes: string; source?: PurchaseOrder["source"] }) => string;
    updatePurchaseOrder: (id: string, patch: Pick<PurchaseOrder, "lines" | "notes">) => void;
    markPOSent: (id: string) => void;
    startReceiving: (id: string) => void;
    receiveScan: (poId: string, code: string, quantity?: number) => ScanResult;
    receiveManual: (poId: string, variantId: string, units: number) => void;
    finishReceiving: (poId: string) => PurchaseOrder["status"];

    /* replenishment */
    /** sourceId defaults to the store's business-unit warehouse; it may also be another store in the same BU. */
    createStoreRequest: (input: { storeId: string; sourceId?: string; lines: { variantId: string; requestedQty: number }[]; note: string }) => string;
    pickRequest: (id: string, shipped: Record<string, number>) => void;
    packRequest: (id: string) => void;
    shipRequest: (id: string) => void;
    confirmRequest: (id: string, received: Record<string, number>) => void;

    /* approvals */
    approveReorders: (items: { approvalId: string; quantity: number }[]) => string[];
    decideApproval: (approvalId: string, decision: ApprovalDecision, note?: string) => void;
}

export type ApprovalDecision =
    | { action: "dismiss" }
    | { action: "reject" }
    | { action: "approve" }
    | { action: "create_product" }
    | { action: "link_variant"; variantId: string }
    | { action: "accept_shortage" }
    | { action: "backorder" }
    | { action: "trust_channel" }
    | { action: "keep_ours" }
    | { action: "same_item" }
    | { action: "new_variant" }
    | { action: "new_product" }
    | { action: "retry" }
    | { action: "unlist" };

export type AppState = AppData & { session: Session } & Actions;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const initialData = (): AppData =>
    structuredClone({
        companies: seed.companies,
        businessUnits: seed.businessUnits,
        locations: seed.locations,
        employees: seed.employees,
        vendors: seed.vendors,
        products: seed.products,
        variants: seed.variants,
        stockLevels: seed.stockLevels,
        connections: seed.connections,
        allocations: seed.allocations,
        listings: seed.listings,
        mismatches: seed.mismatches,
        purchaseOrders: seed.purchaseOrders,
        storeRequests: seed.storeRequests,
        counts: seed.counts,
        adjustments: seed.adjustments,
        approvals: seed.approvals,
        salesHistory: seed.salesHistory,
        activity: seed.activity,
    });

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

/** Next human-readable number like PO-1044, based on the highest existing one. */
const nextNumber = (prefix: string, existing: string[]) => {
    const max = existing
        .filter((n) => n.startsWith(prefix + "-"))
        .map((n) => parseInt(n.split("-").pop() ?? "0", 10))
        .reduce((a, b) => Math.max(a, b), 0);
    const width = existing.find((n) => n.startsWith(prefix + "-"))?.split("-").pop()?.length ?? 4;
    return `${prefix}-${String(max + 1).padStart(width, "0")}`;
};

type Draft = AppState;

const stockRow = (s: Draft, variantId: string, locationId: string) => {
    let row = s.stockLevels.find((x) => x.variantId === variantId && x.locationId === locationId);
    if (!row) {
        row = emptyStock(variantId, locationId);
        s.stockLevels.push(row);
    }
    return row;
};

const log = (s: Draft, kind: ActivityKind, message: string, extra: Partial<ActivityEntry> = {}) => {
    s.activity.unshift({ id: uid("ac"), kind, message, by: s.session.userId ?? "system", at: now(), locationId: null, ...extra });
};

const buOfLocation = (s: Draft, locationId: string) => s.locations.find((l) => l.id === locationId)?.businessUnitId ?? "";

const addApproval = (s: Draft, approval: Omit<Approval, "id" | "createdAt" | "status">) => {
    const id = uid("ap");
    s.approvals.unshift({ ...approval, id, status: "pending", createdAt: now() });
    return id;
};

const closeApproval = (s: Draft, approval: Approval, status: Approval["status"], decision: string, note?: string) => {
    approval.status = status;
    approval.decision = decision;
    approval.decisionNote = note;
    approval.decidedAt = now();
    approval.decidedBy = s.session.userId ?? undefined;
};

const createProductDraft = (s: Draft, product: Omit<Product, "id" | "createdAt">, variants: Omit<Variant, "id" | "productId">[]) => {
    const productId = uid("p");
    s.products.unshift({ ...product, id: productId, createdAt: now() });
    variants.forEach((v) => s.variants.push({ ...v, id: uid("v"), productId }));
    return productId;
};

const defaultVariant = (row: Partial<ImportRow> & { variant: string }, vendorId: string | null = null): Omit<Variant, "id" | "productId"> => ({
    name: row.variant || "Default",
    sku: row.sku || `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    barcodes: row.upc ? [{ code: row.upc, unit: "selling" }] : [],
    price: row.price ?? 0,
    cost: row.cost ?? 0,
    attributes: {},
    reorderPoint: 10,
    restockQty: 24,
    leadTimeDays: 7,
    vendorId,
    dailySales: 0,
});

/** Stock + allocations to use for a connection; allocations are ignored when the company has them switched off. */
const allocData = (s: Draft, connection: ChannelConnection) => ({
    stockLevels: s.stockLevels,
    allocations: isAllocationEnabled(s, connection.businessUnitId) ? s.allocations : [],
});

const applyStockDelta = (s: Draft, variantId: string, locationId: string, delta: number, state: StockState = "available") => {
    const row = stockRow(s, variantId, locationId);
    row[state] = Math.max(0, row[state] + delta);
};

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useAppStore = create<AppState>()(
    persist(
        immer((set, get) => ({
            ...initialData(),
            session: { userId: null, context: "all" },

            /* ---------------- session ---------------- */
            login: (userId) =>
                set((s) => {
                    s.session.userId = userId;
                    // People assigned to a single location start (and stay) there; others start on the overview.
                    const user = s.employees.find((e) => e.id === userId);
                    s.session.context = user && user.role !== "executive" && user.locationIds.length === 1 ? `loc:${user.locationIds[0]}` : "all";
                }),
            logout: () =>
                set((s) => {
                    s.session.userId = null;
                }),
            setContext: (context) =>
                set((s) => {
                    s.session.context = context;
                }),
            updateCompanySettings: (companyId, patch) =>
                set((s) => {
                    const c = s.companies.find((x) => x.id === companyId);
                    if (!c) return;
                    c.settings = { channelAllocation: true, ...c.settings, ...patch };
                    if (patch.channelAllocation !== undefined)
                        log(s, "setup", `Channel allocation turned ${patch.channelAllocation ? "on" : "off"} for ${c.name}`);
                }),
            completeTour: (userId) =>
                set((s) => {
                    const done = s.session.toursCompleted ?? [];
                    if (!done.includes(userId)) s.session.toursCompleted = [...done, userId];
                }),
            resetDemo: () => set((s) => ({ ...initialData(), session: { ...s.session } })),

            /* ---------------- setup ---------------- */
            addCompany: ({ name, executiveName, executiveEmail }) => {
                const id = uid("co");
                set((s) => {
                    s.companies.push({ id, name, createdAt: now(), settings: { channelAllocation: false } });
                    s.employees.push({ id: uid("e"), companyId: id, name: executiveName, email: executiveEmail, role: "executive", level: "company", businessUnitIds: [], locationIds: [], status: "invited" });
                    log(s, "setup", `Company “${name}” created; ${executiveName} invited as Executive`);
                });
                return id;
            },
            addBusinessUnit: (input) => {
                const id = uid("bu");
                set((s) => {
                    s.businessUnits.push({ ...input, id });
                    log(s, "setup", `Business Unit “${input.name}” added`);
                });
                return id;
            },
            updateBusinessUnit: (id, patch) =>
                set((s) => {
                    const bu = s.businessUnits.find((b) => b.id === id);
                    if (bu) Object.assign(bu, patch);
                }),
            addLocation: (input) => {
                const id = uid(input.type === "store" ? "st" : "wh");
                set((s) => {
                    s.locations.push({ ...input, id, openingCountDone: false });
                    log(s, "setup", `${input.type === "store" ? "Store" : "Warehouse"} “${input.name}” added — opening count required`, { locationId: id });
                });
                return id;
            },
            updateLocation: (id, patch) =>
                set((s) => {
                    const l = s.locations.find((x) => x.id === id);
                    if (l) Object.assign(l, patch);
                }),
            addEmployee: (input) => {
                const id = uid("e");
                set((s) => {
                    s.employees.push({ ...input, id });
                    log(s, "setup", `${input.name} added as ${input.role}`);
                });
                return id;
            },
            updateEmployee: (id, patch) =>
                set((s) => {
                    const e = s.employees.find((x) => x.id === id);
                    if (e) Object.assign(e, patch);
                    if (e) log(s, "setup", `Access updated for ${e.name}`);
                }),

            /* ---------------- catalog ---------------- */
            createProduct: (product, variants) => {
                let id = "";
                set((s) => {
                    id = createProductDraft(s, product, variants);
                    log(s, "catalog", `Product “${product.name}” created with ${variants.length} variant${variants.length === 1 ? "" : "s"}`);
                });
                return id;
            },
            updateProduct: (id, patch) =>
                set((s) => {
                    const p = s.products.find((x) => x.id === id);
                    if (p) Object.assign(p, patch, { name: `${patch.brand ?? p.brand} ${patch.productLine ?? p.productLine}` });
                }),
            addVariant: (productId, variant) => {
                const id = uid("v");
                set((s) => {
                    s.variants.push({ ...variant, id, productId });
                    log(s, "catalog", `Variant “${variant.name}” added to ${s.products.find((p) => p.id === productId)?.name}`, { variantId: id });
                });
                return id;
            },
            updateVariant: (id, patch) =>
                set((s) => {
                    const v = s.variants.find((x) => x.id === id);
                    if (v) Object.assign(v, patch);
                }),
            importProducts: (businessUnitId, rows, fileName) => {
                const summary: ImportSummary = { created: 0, sentToApprovals: 0, skipped: 0 };
                set((s) => {
                    // Products created by this import are grouped below, not flagged as duplicates of themselves.
                    const createdHere = new Set<string>();
                    rows.forEach((row) => {
                        if (!row.brand || !row.productLine) {
                            summary.skipped++;
                            return;
                        }
                        const existingData = { products: s.products.filter((p) => !createdHere.has(p.id)), variants: s.variants.filter((v) => !createdHere.has(v.productId)) };
                        const dupes = findDuplicates(existingData, { businessUnitId, brand: row.brand, productLine: row.productLine, variant: row.variant, sku: row.sku, upc: row.upc });
                        if (dupes.length) {
                            const d = dupes[0];
                            addApproval(s, {
                                type: "import_duplicate",
                                title: "Possible duplicate from import",
                                summary: `“${row.brand} ${row.productLine} ${row.variant}” looks like ${d.product.name}${d.variant ? ` — ${d.variant.name}` : ""}.`,
                                businessUnitId,
                                locationId: null,
                                payload: { type: "import_duplicate", importRow: row, matchProductId: d.product.id, matchVariantId: d.variant?.id ?? null, reason: d.reason },
                            });
                            summary.sentToApprovals++;
                            return;
                        }
                        // Group rows of the same brand + line created earlier in this import into one product.
                        const existing = s.products.find((p) => p.businessUnitId === businessUnitId && p.brand === row.brand && p.productLine === row.productLine);
                        if (existing) {
                            s.variants.push({ ...defaultVariant(row), id: uid("v"), productId: existing.id });
                        } else {
                            const newId = createProductDraft(
                                s,
                                {
                                    businessUnitId,
                                    brand: row.brand,
                                    productLine: row.productLine,
                                    productType: row.productType,
                                    name: `${row.brand} ${row.productLine}`,
                                    description: "",
                                    attributes: { Brand: row.brand, "Product Type": row.productType },
                                    complianceFlags: [],
                                    uom: { purchaseUnit: "Case", sellingUnit: "Each", unitsPerPurchaseUnit: 1 },
                                    status: "active",
                                },
                                [defaultVariant(row)],
                            );
                            createdHere.add(newId);
                        }
                        summary.created++;
                    });
                    log(s, "catalog", `Imported ${summary.created} item${summary.created === 1 ? "" : "s"} from ${fileName}${summary.sentToApprovals ? ` (${summary.sentToApprovals} sent to Approvals)` : ""}`);
                });
                return summary;
            },

            /* ---------------- stock ---------------- */
            startCount: (locationId, variantIds, kind) => {
                const id = uid("ct");
                set((s) => {
                    const number = nextNumber(kind === "opening" ? "OC" : "CC", s.counts.map((c) => c.number));
                    s.counts.unshift({
                        id,
                        number,
                        locationId,
                        kind,
                        status: "in_progress",
                        createdBy: s.session.userId ?? "system",
                        createdAt: now(),
                        lines: variantIds.map((variantId) => ({ variantId, systemQty: kind === "opening" ? 0 : stockRow(s, variantId, locationId).available, countedQty: null })),
                    });
                    log(s, "count", `${kind === "opening" ? "Opening" : "Cycle"} count ${number} started (${variantIds.length} items)`, { locationId });
                });
                return id;
            },
            updateCountLine: (countId, variantId, countedQty) =>
                set((s) => {
                    const line = s.counts.find((c) => c.id === countId)?.lines.find((l) => l.variantId === variantId);
                    if (line) line.countedQty = countedQty;
                }),
            addCountLine: (countId, variantId) =>
                set((s) => {
                    const count = s.counts.find((c) => c.id === countId);
                    if (!count || count.lines.some((l) => l.variantId === variantId)) return;
                    count.lines.push({ variantId, systemQty: count.kind === "opening" ? 0 : stockRow(s, variantId, count.locationId).available, countedQty: null });
                }),
            submitCount: (countId) => {
                let variances = 0;
                set((s) => {
                    const count = s.counts.find((c) => c.id === countId);
                    if (!count) return;
                    count.lines.forEach((l) => {
                        if (l.countedQty === null) l.countedQty = 0;
                    });
                    variances = count.lines.filter((l) => l.countedQty !== l.systemQty).length;
                    count.submittedAt = now();
                    const location = s.locations.find((l) => l.id === count.locationId)!;
                    if (variances === 0) {
                        count.status = "approved";
                        log(s, "count", `${count.number} submitted — no variances`, { locationId: count.locationId });
                        if (count.kind === "opening") location.openingCountDone = true;
                        return;
                    }
                    count.status = "submitted";
                    addApproval(s, {
                        type: "count_variance",
                        title: `${count.kind === "opening" ? "Opening" : "Cycle"} count ${count.number} has variances`,
                        summary: `${variances} of ${count.lines.length} lines differ from system stock at ${location.name}.`,
                        businessUnitId: location.businessUnitId,
                        locationId: count.locationId,
                        payload: { type: "count_variance", countId },
                    });
                    log(s, "count", `${count.number} submitted with ${variances} variance${variances === 1 ? "" : "s"} — sent to Approvals`, { locationId: count.locationId });
                });
                return { variances };
            },
            createAdjustment: (input) => {
                const id = uid("adj");
                set((s) => {
                    const number = nextNumber("ADJ", s.adjustments.map((a) => a.number));
                    s.adjustments.unshift({ ...input, id, number, status: "pending", createdBy: s.session.userId ?? "system", createdAt: now() });
                    const location = s.locations.find((l) => l.id === input.locationId)!;
                    const label = variantLabel(s, input.variantId);
                    const what =
                        input.fromState && input.toState
                            ? `move ${Math.abs(input.quantity)} from ${input.fromState} to ${input.toState}`
                            : `${input.quantity > 0 ? "add" : "remove"} ${Math.abs(input.quantity)}`;
                    addApproval(s, {
                        type: "adjustment",
                        title: `Adjustment ${number} · ${input.reason.replace("_", " ")}`,
                        summary: `${label}: ${what} at ${location.name}.`,
                        businessUnitId: location.businessUnitId,
                        locationId: input.locationId,
                        payload: { type: "adjustment", adjustmentId: id },
                    });
                    log(s, "adjustment", `${number} requested: ${what} — ${label}`, { locationId: input.locationId, variantId: input.variantId, reason: input.reason });
                });
                return id;
            },

            /* ---------------- channels ---------------- */
            addConnection: (input) => {
                const id = uid("cn");
                set((s) => {
                    s.connections.push({ ...input, id, status: "connected", lastSyncAt: null });
                    log(s, "channel", `Connected ${input.name}`, { locationId: input.locationId });
                });
                return id;
            },
            updateConnection: (id, patch) =>
                set((s) => {
                    const c = s.connections.find((x) => x.id === id);
                    if (!c) return;
                    Object.assign(c, patch);
                    log(s, "channel", `Settings updated for ${c.name}`, { locationId: c.locationId });
                }),
            setAllocation: (allocation) =>
                set((s) => {
                    const i = s.allocations.findIndex((a) => a.variantId === allocation.variantId && a.locationId === allocation.locationId);
                    if (i >= 0) s.allocations[i] = allocation;
                    else s.allocations.push(allocation);
                    log(s, "channel", `Allocation for ${variantLabel(s, allocation.variantId)} set to ${allocation.mode}${allocation.reservedQty ? ` (${allocation.reservedQty} reserved)` : ""}`, {
                        locationId: allocation.locationId,
                        variantId: allocation.variantId,
                    });
                }),
            pushToChannel: (connectionId, variantIds) => {
                const result = { pushed: 0, blocked: 0 };
                set((s) => {
                    const connection = s.connections.find((c) => c.id === connectionId);
                    if (!connection) return;
                    const blockedIds: string[] = [];
                    const blockedFlags = new Set<string>();
                    variantIds.forEach((variantId) => {
                        const product = productOf(s, variantId)!;
                        let listing = s.listings.find((l) => l.variantId === variantId && l.connectionId === connectionId);
                        if (!listing) {
                            listing = { variantId, connectionId, externalId: null, status: "pending", lastPushedQty: null, lastPushedAt: null };
                            s.listings.push(listing);
                        }
                        // Compliance check runs first (PRD §5.2/§5.3).
                        const conflicts = product.complianceFlags.filter((f) => connection.blockedFlags.includes(f));
                        if (conflicts.length) {
                            listing.status = "blocked";
                            listing.message = `Has “${conflicts.join(", ")}” flag — this channel does not accept it.`;
                            blockedIds.push(variantId);
                            conflicts.forEach((f) => blockedFlags.add(f));
                            result.blocked++;
                            return;
                        }
                        if (connection.status === "error") {
                            listing.status = "failed";
                            listing.message = "Channel connection has an error — fix it, then retry.";
                            return;
                        }
                        listing.status = "synced";
                        listing.message = undefined;
                        listing.externalId = listing.externalId ?? `${connection.channel.slice(0, 2).toUpperCase()}-${Math.floor(100000 + Math.random() * 899999)}`;
                        listing.lastPushedQty = channelAllocation(allocData(s, connection), variantId, connection).sellable;
                        listing.lastPushedAt = now();
                        result.pushed++;
                    });
                    if (blockedIds.length) {
                        addApproval(s, {
                            type: "sync_failure",
                            title: `Push blocked · ${connection.name}`,
                            summary: `${blockedIds.length} item${blockedIds.length === 1 ? "" : "s"} carry ${Array.from(blockedFlags).join(", ")}, which this channel prohibits.`,
                            businessUnitId: connection.businessUnitId,
                            locationId: connection.locationId,
                            payload: { type: "sync_failure", connectionId, variantIds: blockedIds, reason: `Compliance: ${Array.from(blockedFlags).join(", ")} not accepted by this channel.`, kind: "blocked" },
                        });
                    }
                    log(s, "channel", `Pushed ${result.pushed} item${result.pushed === 1 ? "" : "s"} to ${connection.name}${result.blocked ? ` · ${result.blocked} blocked` : ""}`, { locationId: connection.locationId });
                });
                return result;
            },
            pullFromChannel: (connectionId) => {
                let found = 0;
                set((s) => {
                    const connection = s.connections.find((c) => c.id === connectionId);
                    if (!connection) return;
                    if (connection.status === "error") {
                        addApproval(s, {
                            type: "sync_failure",
                            title: `Sync failed · ${connection.name}`,
                            summary: "Stock pull failed: the channel rejected our credentials.",
                            businessUnitId: connection.businessUnitId,
                            locationId: connection.locationId,
                            payload: { type: "sync_failure", connectionId, variantIds: [], reason: "Authentication expired (401).", kind: "failed" },
                        });
                        return;
                    }
                    connection.lastSyncAt = now();
                    s.listings
                        .filter((l) => l.connectionId === connectionId && l.status === "synced")
                        .forEach((l) => {
                            // Simulate the channel reporting a slightly different number now and then.
                            if (Math.random() > 0.12) return;
                            const expected = channelAllocation(allocData(s, connection), l.variantId, connection).sellable;
                            const reported = Math.max(0, expected + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3)));
                            const id = uid("mm");
                            s.mismatches.unshift({ id, connectionId, locationId: connection.locationId, variantId: l.variantId, expected, reported, source: "manual_pull", detectedAt: now(), status: "open" });
                            addApproval(s, {
                                type: "mismatch",
                                title: `Stock mismatch · ${variantLabel(s, l.variantId)}`,
                                summary: `${connection.name}: expected ${expected}, channel reports ${reported}.`,
                                businessUnitId: connection.businessUnitId,
                                locationId: connection.locationId,
                                payload: { type: "mismatch", mismatchId: id },
                            });
                            found++;
                        });
                    log(s, "channel", `${connection.name} pulled sales & stock — ${found} mismatch${found === 1 ? "" : "es"}`, { locationId: connection.locationId });
                });
                return { mismatches: found };
            },
            reconcileUpload: (connectionId, rows, fileName) => {
                const result = { compared: 0, mismatches: 0, unknown: 0 };
                set((s) => {
                    const connection = s.connections.find((c) => c.id === connectionId);
                    if (!connection) return;
                    rows.forEach((row) => {
                        const hit = lookupCode(s, row.sku);
                        if (!hit) {
                            result.unknown++;
                            return;
                        }
                        result.compared++;
                        const expected = channelAllocation(allocData(s, connection), hit.variant.id, connection).sellable;
                        if (expected === row.quantity) return;
                        const id = uid("mm");
                        s.mismatches.unshift({ id, connectionId, locationId: connection.locationId, variantId: hit.variant.id, expected, reported: row.quantity, source: "upload", detectedAt: now(), status: "open" });
                        addApproval(s, {
                            type: "mismatch",
                            title: `Stock mismatch · ${variantLabel(s, hit.variant.id)}`,
                            summary: `${connection.name} export (${fileName}): expected ${expected}, file says ${row.quantity}.`,
                            businessUnitId: connection.businessUnitId,
                            locationId: connection.locationId,
                            payload: { type: "mismatch", mismatchId: id },
                        });
                        result.mismatches++;
                    });
                    log(s, "channel", `Reconciled ${fileName} against ${connection.name}: ${result.mismatches} mismatch${result.mismatches === 1 ? "" : "es"}`, { locationId: connection.locationId });
                });
                return result;
            },

            /* ---------------- purchasing ---------------- */
            addVendor: (input) => {
                const id = uid("v");
                set((s) => {
                    s.vendors.push({ ...input, id });
                    log(s, "purchase_order", `Vendor “${input.name}” added`);
                });
                return id;
            },
            updateVendor: (id, patch) =>
                set((s) => {
                    const v = s.vendors.find((x) => x.id === id);
                    if (v) Object.assign(v, patch);
                }),
            createPurchaseOrder: ({ vendorId, warehouseId, lines, notes, source = "manual" }) => {
                const id = uid("po");
                set((s) => {
                    const number = nextNumber("PO", s.purchaseOrders.map((p) => p.number));
                    const by = s.session.userId ?? "system";
                    s.purchaseOrders.unshift({
                        id,
                        number,
                        vendorId,
                        businessUnitId: buOfLocation(s, warehouseId),
                        warehouseId,
                        status: "created",
                        lines: lines.map((l) => ({ ...l, receivedUnits: 0 })),
                        unexpected: [],
                        notes,
                        source,
                        createdBy: by,
                        createdAt: now(),
                        history: [{ status: "created", by, at: now() }],
                    });
                    log(s, "purchase_order", `${number} created for ${s.vendors.find((v) => v.id === vendorId)?.name}`, { locationId: warehouseId });
                });
                return id;
            },
            updatePurchaseOrder: (id, patch) =>
                set((s) => {
                    const po = s.purchaseOrders.find((p) => p.id === id);
                    if (po && po.status === "created") Object.assign(po, patch);
                }),
            markPOSent: (id) =>
                set((s) => {
                    const po = s.purchaseOrders.find((p) => p.id === id);
                    if (!po || po.status !== "created") return;
                    po.status = "sent";
                    po.sentAt = now();
                    po.history.push({ status: "sent", by: s.session.userId ?? "system", at: now(), note: "Order placed with vendor outside the system." });
                    log(s, "purchase_order", `${po.number} marked as sent to vendor`, { locationId: po.warehouseId });
                }),
            startReceiving: (id) =>
                set((s) => {
                    const po = s.purchaseOrders.find((p) => p.id === id);
                    if (!po || (po.status !== "sent" && po.status !== "created")) return;
                    po.status = "receiving";
                    po.history.push({ status: "receiving", by: s.session.userId ?? "system", at: now() });
                    log(s, "receiving", `Started receiving ${po.number}`, { locationId: po.warehouseId });
                }),
            receiveScan: (poId, code, quantity = 1) => {
                let result: ScanResult = { kind: "unknown", label: code };
                set((s) => {
                    const po = s.purchaseOrders.find((p) => p.id === poId);
                    if (!po) return;
                    if (po.status === "sent" || po.status === "created") {
                        po.status = "receiving";
                        po.history.push({ status: "receiving", by: s.session.userId ?? "system", at: now() });
                    }
                    const hit = lookupCode(s, code);
                    const line = hit ? po.lines.find((l) => l.variantId === hit.variant.id) : undefined;
                    if (hit && line) {
                        const units = hit.units * quantity;
                        line.receivedUnits += units;
                        applyStockDelta(s, hit.variant.id, po.warehouseId, units);
                        const label = variantLabel(s, hit.variant.id);
                        result = { kind: "matched", variantId: hit.variant.id, units, label };
                        log(s, "receiving", `${po.number}: +${units} ${label}${hit.unit === "purchase" ? ` (${quantity} ${hit.product.uom.purchaseUnit.toLowerCase()})` : ""}`, {
                            locationId: po.warehouseId,
                            variantId: hit.variant.id,
                            quantity: units,
                        });
                        return;
                    }
                    // Not on the PO — never block receiving. Record it and send to Approvals.
                    const existing = po.unexpected.find((u) => u.barcode === code);
                    let variantId: string | null = hit?.variant.id ?? null;
                    let productId: string | null = hit?.product.id ?? null;
                    const units = (hit?.units ?? 1) * quantity;
                    if (!hit && !existing) {
                        productId = createProductDraft(
                            s,
                            {
                                businessUnitId: po.businessUnitId,
                                brand: "Unknown",
                                productLine: `Item ${code}`,
                                productType: "Unreviewed",
                                name: `Unknown item ${code}`,
                                description: `Auto-created while receiving ${po.number}. Review in Approvals.`,
                                attributes: {},
                                complianceFlags: [],
                                uom: { purchaseUnit: "Each", sellingUnit: "Each", unitsPerPurchaseUnit: 1 },
                                status: "draft",
                            },
                            [{ ...defaultVariant({ variant: "Default", upc: code }), vendorId: po.vendorId }],
                        );
                        variantId = s.variants.find((v) => v.productId === productId)!.id;
                    } else if (existing) {
                        productId = existing.productId;
                        variantId = productId ? (s.variants.find((v) => v.productId === productId)?.id ?? null) : variantId;
                    }
                    const label = hit ? variantLabel(s, hit.variant.id) : `Unknown item ${code}`;
                    if (existing) existing.units += units;
                    else po.unexpected.push({ barcode: code, description: label, units, productId });
                    if (variantId) applyStockDelta(s, variantId, po.warehouseId, units);
                    const pending = s.approvals.find((a) => a.status === "pending" && a.payload.type === "unexpected_item" && a.payload.poId === poId && a.payload.barcode === code);
                    if (pending && pending.payload.type === "unexpected_item") {
                        pending.payload.units += units;
                        pending.summary = `Scanned ${code} — not on the PO. ${pending.payload.units} units received.`;
                    } else {
                        addApproval(s, {
                            type: "unexpected_item",
                            title: `Unexpected item on ${po.number}`,
                            summary: `Scanned ${code} — not on the PO. ${units} unit${units === 1 ? "" : "s"} received${hit ? "" : " and added as a draft product"}.`,
                            businessUnitId: po.businessUnitId,
                            locationId: po.warehouseId,
                            payload: { type: "unexpected_item", poId, barcode: code, productId, units, description: label },
                        });
                    }
                    log(s, "receiving", `${po.number}: unexpected item ${code} (+${units}) — sent to Approvals`, { locationId: po.warehouseId, variantId, quantity: units });
                    result = { kind: "unexpected", variantId, units, label };
                });
                return result;
            },
            receiveManual: (poId, variantId, units) =>
                set((s) => {
                    const po = s.purchaseOrders.find((p) => p.id === poId);
                    const line = po?.lines.find((l) => l.variantId === variantId);
                    if (!po || !line || units === 0) return;
                    if (po.status === "sent" || po.status === "created") {
                        po.status = "receiving";
                        po.history.push({ status: "receiving", by: s.session.userId ?? "system", at: now() });
                    }
                    const delta = Math.max(-line.receivedUnits, units);
                    line.receivedUnits += delta;
                    applyStockDelta(s, variantId, po.warehouseId, delta);
                    log(s, "receiving", `${po.number}: ${delta > 0 ? "+" : ""}${delta} ${variantLabel(s, variantId)} (manual entry)`, { locationId: po.warehouseId, variantId, quantity: delta });
                }),
            finishReceiving: (poId) => {
                let status: PurchaseOrder["status"] = "receiving";
                set((s) => {
                    const po = s.purchaseOrders.find((p) => p.id === poId);
                    if (!po) return;
                    const short = po.lines.filter((l) => {
                        const upp = productOf(s, l.variantId)?.uom.unitsPerPurchaseUnit ?? 1;
                        return l.receivedUnits < l.orderedQty * upp;
                    });
                    po.receivedAt = now();
                    if (short.length === 0) {
                        po.status = "complete";
                        po.history.push({ status: "complete", by: s.session.userId ?? "system", at: now() });
                        log(s, "purchase_order", `${po.number} received complete`, { locationId: po.warehouseId });
                    } else {
                        po.status = "partial";
                        const detail = short
                            .map((l) => {
                                const upp = productOf(s, l.variantId)?.uom.unitsPerPurchaseUnit ?? 1;
                                return `${s.variants.find((v) => v.id === l.variantId)?.name}: ${l.receivedUnits} of ${l.orderedQty * upp}`;
                            })
                            .join("; ");
                        po.history.push({ status: "partial", by: s.session.userId ?? "system", at: now(), note: `${short.length} line${short.length === 1 ? "" : "s"} short. ${detail}` });
                        addApproval(s, {
                            type: "partial_po",
                            title: `${po.number} received short`,
                            summary: detail,
                            businessUnitId: po.businessUnitId,
                            locationId: po.warehouseId,
                            payload: { type: "partial_po", poId },
                        });
                        log(s, "purchase_order", `${po.number} marked Partial — sent to Approvals`, { locationId: po.warehouseId });
                    }
                    status = po.status;
                });
                return status;
            },

            /* ---------------- replenishment ---------------- */
            createStoreRequest: ({ storeId, sourceId, lines, note }) => {
                const id = uid("sr");
                set((s) => {
                    const store = s.locations.find((l) => l.id === storeId)!;
                    const source =
                        s.locations.find((l) => l.id === sourceId && l.businessUnitId === store.businessUnitId && l.id !== storeId) ??
                        s.locations.find((l) => l.businessUnitId === store.businessUnitId && l.type === "warehouse");
                    const transfer = source?.type === "store";
                    const number = nextNumber("SR", s.storeRequests.map((r) => r.number));
                    const by = s.session.userId ?? "system";
                    s.storeRequests.unshift({
                        id,
                        number,
                        storeId,
                        sourceId: source?.id ?? "",
                        // Store-to-store transfers need the warehouse manager's approval first.
                        status: transfer ? "pending_approval" : "requested",
                        lines: lines.map((l) => ({ ...l, shippedQty: 0, receivedQty: 0 })),
                        note,
                        createdBy: by,
                        createdAt: now(),
                        history: [{ status: transfer ? "pending_approval" : "requested", by, at: now() }],
                    });
                    if (transfer && source) {
                        const warehouse = s.locations.find((l) => l.businessUnitId === store.businessUnitId && l.type === "warehouse");
                        const units = lines.reduce((n, l) => n + l.requestedQty, 0);
                        addApproval(s, {
                            type: "transfer_request",
                            title: `Store transfer ${number}: ${source.name} → ${store.name}`,
                            summary: `${lines.length} item${lines.length === 1 ? "" : "s"}, ${units} unit${units === 1 ? "" : "s"}. Needs warehouse approval before ${source.name} ships.`,
                            businessUnitId: store.businessUnitId,
                            // Routed to the business unit's warehouse so its manager decides.
                            locationId: warehouse?.id ?? null,
                            payload: { type: "transfer_request", requestId: id },
                        });
                    }
                    log(s, "store_request", `${number} requested by ${store.name} from ${source?.name ?? "—"} (${lines.length} line${lines.length === 1 ? "" : "s"})`, { locationId: storeId });
                });
                return id;
            },
            pickRequest: (id, shipped) =>
                set((s) => {
                    const r = s.storeRequests.find((x) => x.id === id);
                    if (!r || r.status !== "requested") return;
                    r.lines.forEach((l) => (l.shippedQty = Math.max(0, shipped[l.variantId] ?? l.requestedQty)));
                    r.status = "picked";
                    r.history.push({ status: "picked", by: s.session.userId ?? "system", at: now() });
                    log(s, "store_request", `${r.number} picked`, { locationId: r.sourceId });
                }),
            packRequest: (id) =>
                set((s) => {
                    const r = s.storeRequests.find((x) => x.id === id);
                    if (!r || r.status !== "picked") return;
                    r.status = "packed";
                    r.history.push({ status: "packed", by: s.session.userId ?? "system", at: now() });
                    log(s, "store_request", `${r.number} packed`, { locationId: r.sourceId });
                }),
            shipRequest: (id) =>
                set((s) => {
                    const r = s.storeRequests.find((x) => x.id === id);
                    if (!r || r.status !== "packed") return;
                    let units = 0;
                    r.lines.forEach((l) => {
                        applyStockDelta(s, l.variantId, r.sourceId, -l.shippedQty);
                        applyStockDelta(s, l.variantId, r.storeId, l.shippedQty, "inTransit");
                        units += l.shippedQty;
                    });
                    r.status = "shipped";
                    r.history.push({ status: "shipped", by: s.session.userId ?? "system", at: now() });
                    const store = s.locations.find((l) => l.id === r.storeId)!;
                    log(s, "store_request", `${r.number} shipped — ${units} units now In Transit to ${store.name}`, { locationId: r.sourceId, quantity: -units });
                }),
            confirmRequest: (id, received) =>
                set((s) => {
                    const r = s.storeRequests.find((x) => x.id === id);
                    if (!r || r.status !== "shipped") return;
                    let units = 0;
                    r.lines.forEach((l) => {
                        const got = Math.max(0, received[l.variantId] ?? l.shippedQty);
                        l.receivedQty = got;
                        applyStockDelta(s, l.variantId, r.storeId, -l.shippedQty, "inTransit");
                        applyStockDelta(s, l.variantId, r.storeId, got);
                        units += got;
                        if (got < l.shippedQty) {
                            // Shortfall needs a person's decision, like any other stock change.
                            const adjId = uid("adj");
                            const number = nextNumber("ADJ", s.adjustments.map((a) => a.number));
                            const missing = l.shippedQty - got;
                            s.adjustments.unshift({
                                id: adjId,
                                number,
                                locationId: r.storeId,
                                variantId: l.variantId,
                                reason: "lost",
                                quantity: 0,
                                note: `${missing} unit${missing === 1 ? "" : "s"} shipped on ${r.number} but not received. Already excluded from store stock — approve to confirm the loss.`,
                                status: "pending",
                                createdBy: s.session.userId ?? "system",
                                createdAt: now(),
                            });
                            addApproval(s, {
                                type: "adjustment",
                                title: `Short delivery on ${r.number}`,
                                summary: `${variantLabel(s, l.variantId)}: shipped ${l.shippedQty}, received ${got}.`,
                                businessUnitId: buOfLocation(s, r.storeId),
                                locationId: r.storeId,
                                payload: { type: "adjustment", adjustmentId: adjId },
                            });
                        }
                    });
                    r.status = "confirmed";
                    r.history.push({ status: "confirmed", by: s.session.userId ?? "system", at: now() });
                    log(s, "store_request", `${r.number} receipt confirmed — ${units} units added to Available`, { locationId: r.storeId, quantity: units });
                }),

            /* ---------------- approvals ---------------- */
            approveReorders: (items) => {
                const created: string[] = [];
                const state = get();
                // Items from different vendors become separate POs (PRD §5.8).
                const groups = new Map<string, { vendorId: string; warehouseId: string; lines: Omit<POLine, "receivedUnits">[]; approvalIds: string[] }>();
                items.forEach(({ approvalId, quantity }) => {
                    const a = state.approvals.find((x) => x.id === approvalId);
                    if (!a || a.payload.type !== "reorder" || !a.payload.vendorId) return;
                    const payload = a.payload;
                    const key = `${payload.vendorId}|${payload.warehouseId}`;
                    const group = groups.get(key) ?? { vendorId: payload.vendorId!, warehouseId: payload.warehouseId, lines: [], approvalIds: [] };
                    const variant = state.variants.find((v) => v.id === payload.variantId)!;
                    const product = productOf(state, variant.id)!;
                    const cases = Math.max(1, Math.ceil(quantity / product.uom.unitsPerPurchaseUnit));
                    group.lines.push({ variantId: variant.id, orderedQty: cases, unitCost: +(variant.cost * product.uom.unitsPerPurchaseUnit).toFixed(2) });
                    group.approvalIds.push(approvalId);
                    groups.set(key, group);
                });
                groups.forEach((g) => {
                    const poId = get().createPurchaseOrder({ vendorId: g.vendorId, warehouseId: g.warehouseId, lines: g.lines, notes: "Created from reorder suggestion.", source: "reorder" });
                    created.push(poId);
                    set((s) => {
                        const po = s.purchaseOrders.find((p) => p.id === poId)!;
                        g.approvalIds.forEach((id) => {
                            const a = s.approvals.find((x) => x.id === id);
                            if (a) closeApproval(s, a, "approved", `PO ${po.number} created`);
                        });
                    });
                });
                return created;
            },
            decideApproval: (approvalId, decision, note) =>
                set((s) => {
                    const a = s.approvals.find((x) => x.id === approvalId);
                    if (!a || a.status !== "pending") return;
                    const p = a.payload;

                    if (decision.action === "dismiss") {
                        closeApproval(s, a, "dismissed", "Dismissed", note);
                    } else if (decision.action === "reject") {
                        closeApproval(s, a, "rejected", "Rejected", note);
                        if (p.type === "count_variance") {
                            const c = s.counts.find((x) => x.id === p.countId);
                            if (c) c.status = "rejected";
                        }
                        if (p.type === "adjustment") {
                            const adj = s.adjustments.find((x) => x.id === p.adjustmentId);
                            if (adj) adj.status = "rejected";
                        }
                    } else if (p.type === "count_variance" && decision.action === "approve") {
                        const c = s.counts.find((x) => x.id === p.countId);
                        if (c) {
                            let net = 0;
                            c.lines.forEach((l) => {
                                const row = stockRow(s, l.variantId, c.locationId);
                                const counted = l.countedQty ?? 0;
                                net += counted - row.available;
                                row.available = counted;
                            });
                            c.status = "approved";
                            if (c.kind === "opening") {
                                const loc = s.locations.find((l) => l.id === c.locationId);
                                if (loc) loc.openingCountDone = true;
                            }
                            log(s, "count", `${c.number} approved — stock corrected (net ${net >= 0 ? "+" : ""}${net})`, { locationId: c.locationId, quantity: net, reason: "count" });
                        }
                        closeApproval(s, a, "approved", "Approved — stock corrected", note);
                    } else if (p.type === "adjustment" && decision.action === "approve") {
                        const adj = s.adjustments.find((x) => x.id === p.adjustmentId);
                        if (adj) {
                            if (adj.fromState && adj.toState) {
                                const qty = Math.abs(adj.quantity);
                                applyStockDelta(s, adj.variantId, adj.locationId, -qty, adj.fromState);
                                applyStockDelta(s, adj.variantId, adj.locationId, qty, adj.toState);
                            } else {
                                applyStockDelta(s, adj.variantId, adj.locationId, adj.quantity);
                            }
                            adj.status = "approved";
                            log(s, "adjustment", `${adj.number} approved (${adj.reason})`, { locationId: adj.locationId, variantId: adj.variantId, quantity: adj.quantity, reason: adj.reason });
                        }
                        closeApproval(s, a, "approved", "Approved — stock updated", note);
                    } else if (p.type === "unexpected_item") {
                        const po = s.purchaseOrders.find((x) => x.id === p.poId);
                        if (decision.action === "create_product") {
                            const product = p.productId ? s.products.find((x) => x.id === p.productId) : undefined;
                            if (product) product.status = "active";
                            closeApproval(s, a, "resolved", product ? `Kept as product “${product.name}”` : "Accepted", note);
                        } else if (decision.action === "link_variant" && po) {
                            // Move the received units onto the chosen existing variant and keep the barcode.
                            const target = s.variants.find((v) => v.id === decision.variantId);
                            if (target) {
                                if (!target.barcodes.some((b) => b.code === p.barcode)) target.barcodes.push({ code: p.barcode, unit: "selling" });
                                if (p.productId) {
                                    const draftVariant = s.variants.find((v) => v.productId === p.productId);
                                    const product = s.products.find((x) => x.id === p.productId);
                                    if (draftVariant && product?.status === "draft") {
                                        applyStockDelta(s, draftVariant.id, po.warehouseId, -p.units);
                                        applyStockDelta(s, target.id, po.warehouseId, p.units);
                                        product.status = "archived";
                                    }
                                }
                                closeApproval(s, a, "resolved", `Linked to ${variantLabel(s, target.id)}`, note);
                            }
                        } else {
                            closeApproval(s, a, "approved", "Reviewed", note);
                        }
                    } else if (p.type === "partial_po") {
                        const po = s.purchaseOrders.find((x) => x.id === p.poId);
                        if (po) {
                            if (decision.action === "backorder") {
                                const missing = po.lines
                                    .map((l) => {
                                        const upp = productOf(s, l.variantId)?.uom.unitsPerPurchaseUnit ?? 1;
                                        const missingUnits = l.orderedQty * upp - l.receivedUnits;
                                        return { variantId: l.variantId, orderedQty: Math.ceil(missingUnits / upp), unitCost: l.unitCost };
                                    })
                                    .filter((l) => l.orderedQty > 0);
                                const number = nextNumber("PO", s.purchaseOrders.map((x) => x.number));
                                const by = s.session.userId ?? "system";
                                s.purchaseOrders.unshift({
                                    id: uid("po"),
                                    number,
                                    vendorId: po.vendorId,
                                    businessUnitId: po.businessUnitId,
                                    warehouseId: po.warehouseId,
                                    status: "created",
                                    lines: missing.map((l) => ({ ...l, receivedUnits: 0 })),
                                    unexpected: [],
                                    notes: `Backorder for ${po.number}.`,
                                    source: "manual",
                                    createdBy: by,
                                    createdAt: now(),
                                    history: [{ status: "created", by, at: now(), note: `Backorder of ${po.number}` }],
                                });
                                po.history.push({ status: "resolved", by, at: now(), note: `Shortage moved to backorder ${number}.` });
                                closeApproval(s, a, "resolved", `Backorder ${number} created`, note);
                            } else {
                                po.history.push({ status: "resolved", by: s.session.userId ?? "system", at: now(), note: note || "Shortage accepted." });
                                closeApproval(s, a, "resolved", "Shortage accepted", note);
                            }
                            po.status = "resolved";
                            log(s, "purchase_order", `${po.number} resolved`, { locationId: po.warehouseId });
                        }
                    } else if (p.type === "mismatch") {
                        const m = s.mismatches.find((x) => x.id === p.mismatchId);
                        if (m) {
                            m.status = "handled";
                            const connection = s.connections.find((c) => c.id === m.connectionId);
                            if (decision.action === "trust_channel" && m.locationId) {
                                const delta = m.reported - m.expected;
                                applyStockDelta(s, m.variantId, m.locationId, delta);
                                log(s, "stock", `Mismatch handled: ${variantLabel(s, m.variantId)} corrected by ${delta > 0 ? "+" : ""}${delta} to match ${connection?.name}`, {
                                    locationId: m.locationId,
                                    variantId: m.variantId,
                                    quantity: delta,
                                    reason: "reconciliation",
                                });
                                closeApproval(s, a, "resolved", "Corrected our stock to match the channel", note);
                            } else {
                                const listing = s.listings.find((l) => l.variantId === m.variantId && l.connectionId === m.connectionId);
                                if (listing && connection) {
                                    listing.lastPushedQty = channelAllocation(allocData(s, connection), m.variantId, connection).sellable;
                                    listing.lastPushedAt = now();
                                }
                                closeApproval(s, a, "resolved", decision.action === "keep_ours" ? "Kept our count and re-pushed it" : "Marked handled", note);
                            }
                        }
                    } else if (p.type === "import_duplicate") {
                        const row = p.importRow;
                        if (decision.action === "same_item" && p.matchVariantId) {
                            const v = s.variants.find((x) => x.id === p.matchVariantId);
                            if (v && row.upc && !v.barcodes.some((b) => b.code === row.upc)) v.barcodes.push({ code: row.upc, unit: "selling" });
                            closeApproval(s, a, "resolved", "Same item — merged codes into existing variant", note);
                        } else if (decision.action === "new_variant") {
                            s.variants.push({ ...defaultVariant(row), id: uid("v"), productId: p.matchProductId });
                            closeApproval(s, a, "resolved", `Added as a new variant of ${s.products.find((x) => x.id === p.matchProductId)?.name}`, note);
                        } else if (decision.action === "new_product") {
                            createProductDraft(
                                s,
                                {
                                    businessUnitId: a.businessUnitId,
                                    brand: row.brand,
                                    productLine: row.productLine,
                                    productType: row.productType,
                                    name: `${row.brand} ${row.productLine}`,
                                    description: "",
                                    attributes: { Brand: row.brand, "Product Type": row.productType },
                                    complianceFlags: [],
                                    uom: { purchaseUnit: "Case", sellingUnit: "Each", unitsPerPurchaseUnit: 1 },
                                    status: "active",
                                },
                                [defaultVariant(row)],
                            );
                            closeApproval(s, a, "resolved", "Created as a new product", note);
                        }
                        log(s, "catalog", `Import review: ${a.decision}`);
                    } else if (p.type === "sync_failure") {
                        const connection = s.connections.find((c) => c.id === p.connectionId);
                        if (decision.action === "retry" && connection) {
                            if (p.kind === "failed") connection.status = "connected";
                            connection.lastSyncAt = now();
                            let stillBlocked = 0;
                            p.variantIds.forEach((variantId) => {
                                const listing = s.listings.find((l) => l.variantId === variantId && l.connectionId === connection.id);
                                const product = productOf(s, variantId);
                                const conflicts = product?.complianceFlags.filter((f) => connection.blockedFlags.includes(f)) ?? [];
                                if (!listing) return;
                                if (conflicts.length) {
                                    stillBlocked++;
                                    return;
                                }
                                listing.status = "synced";
                                listing.message = undefined;
                                listing.lastPushedAt = now();
                                listing.lastPushedQty = channelAllocation(allocData(s, connection), variantId, connection).sellable;
                            });
                            if (p.kind === "failed") {
                                s.listings.filter((l) => l.connectionId === connection.id && l.status === "failed").forEach((l) => {
                                    l.status = "synced";
                                    l.message = undefined;
                                    l.lastPushedAt = now();
                                });
                            }
                            if (stillBlocked) {
                                a.decisionNote = `${stillBlocked} item(s) still conflict with the channel's compliance rules. Fix the flags or unlist them.`;
                                return;
                            }
                            closeApproval(s, a, "resolved", "Retried successfully", note);
                        } else if (decision.action === "unlist") {
                            p.variantIds.forEach((variantId) => {
                                const listing = s.listings.find((l) => l.variantId === variantId && l.connectionId === p.connectionId);
                                if (listing) {
                                    listing.status = "not_listed";
                                    listing.message = "Not sold on this channel.";
                                }
                            });
                            closeApproval(s, a, "resolved", "Items will not be sold on this channel", note);
                        }
                        log(s, "channel", `${a.title}: ${a.decision ?? "retry attempted"}`, { locationId: a.locationId });
                    }

                    if (p.type === "transfer_request") {
                        const r = s.storeRequests.find((x) => x.id === p.requestId);
                        const by = s.session.userId ?? "system";
                        if (r && r.status === "pending_approval") {
                            if (decision.action === "approve") {
                                r.status = "requested";
                                r.history.push({ status: "requested", by, at: now(), note: note || "Transfer approved by the warehouse." });
                                closeApproval(s, a, "approved", "Transfer approved", note);
                            } else if (decision.action === "reject" || decision.action === "dismiss") {
                                r.status = "rejected";
                                r.history.push({ status: "rejected", by, at: now(), note: note || "Transfer rejected by the warehouse." });
                            }
                            log(s, "store_request", `${r.number} transfer ${r.status === "rejected" ? "rejected" : "approved"}`, { locationId: r.storeId });
                        }
                    }

                    if (a.status !== "pending") log(s, "approval", `${a.title} — ${a.decision}`, { locationId: a.locationId });
                }),
        })),
        {
            name: "inventory-hq-demo",
            // Bump when the data shape changes; older saved demo data is replaced with fresh seed data.
            version: 2,
            migrate: () => ({ ...initialData(), session: { userId: null, context: "all" } }) as unknown as AppState,
            storage: createJSONStorage(() => localStorage),
        },
    ),
);
