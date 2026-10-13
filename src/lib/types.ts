/**
 * Domain types for Inventory HQ.
 *
 * These mirror the entities in the PRD and are shaped so a backend API can
 * return them as-is later. All IDs are strings; all dates are ISO strings.
 */

export type ID = string;

/* ------------------------------------------------------------------ */
/* Setup: companies, business units, locations, people (PRD §5.1)      */
/* ------------------------------------------------------------------ */

export interface Company {
    id: ID;
    name: string;
    createdAt: string;
}

export interface BusinessUnit {
    id: ID;
    companyId: ID;
    name: string;
    /** Tailwind-friendly accent used for avatars/chips. */
    color: "orange" | "blue" | "green" | "purple" | "pink" | "gray";
    /** Attribute keys products in this BU are expected to carry (e.g. Flavor, Size). */
    attributeKeys: string[];
}

export type LocationType = "store" | "warehouse";

export interface Location {
    id: ID;
    businessUnitId: ID;
    type: LocationType;
    name: string;
    code: string;
    address: string;
    /** True once the opening count has been approved. */
    openingCountDone: boolean;
}

export type Role = "executive" | "manager" | "associate";

export interface Employee {
    id: ID;
    companyId: ID;
    name: string;
    email: string;
    role: Role;
    /** Store-level or warehouse-level staff. Executives are company-wide. */
    level: LocationType | "company";
    businessUnitIds: ID[];
    locationIds: ID[];
    status: "active" | "invited" | "disabled";
}

/* ------------------------------------------------------------------ */
/* Catalog (PRD §5.2, Appendix A)                                      */
/* ------------------------------------------------------------------ */

export type ComplianceFlag = "nicotine" | "tobacco" | "vape" | "age_21" | "hemp" | "lithium_battery";

export interface UnitOfMeasure {
    /** What we buy in (purchase orders, receiving). */
    purchaseUnit: string;
    /** What we sell and count in. */
    sellingUnit: string;
    /** How many selling units are in one purchase unit. */
    unitsPerPurchaseUnit: number;
}

export interface Barcode {
    code: string;
    /** Which unit this barcode identifies — scanning a case barcode converts to N units. */
    unit: "purchase" | "selling";
}

export interface Variant {
    id: ID;
    productId: ID;
    /** The variant label only, e.g. "Blue Razz" or "M / Black". */
    name: string;
    sku: string;
    barcodes: Barcode[];
    price: number;
    cost: number;
    attributes: Record<string, string>;
    /** Reordering (PRD §5.8) */
    reorderPoint: number;
    restockQty: number;
    leadTimeDays: number;
    vendorId: ID | null;
    /** Average units sold per day across all stores (drives run-out projection). */
    dailySales: number;
}

export interface Product {
    id: ID;
    businessUnitId: ID;
    brand: string;
    productLine: string;
    productType: string;
    /** Brand + Product Line / Model. Never includes the variant. */
    name: string;
    description: string;
    attributes: Record<string, string>;
    complianceFlags: ComplianceFlag[];
    uom: UnitOfMeasure;
    status: "active" | "draft" | "archived";
    createdAt: string;
    imageColor?: string;
}

/* ------------------------------------------------------------------ */
/* Stock (PRD §5.5)                                                    */
/* ------------------------------------------------------------------ */

export type StockState = "available" | "inTransit" | "returns" | "damaged";

export interface StockLevel {
    variantId: ID;
    locationId: ID;
    available: number;
    inTransit: number;
    returns: number;
    damaged: number;
}

export type AdjustmentReason = "damaged" | "expired" | "lost" | "found" | "state_change" | "other";

export interface Adjustment {
    id: ID;
    number: string;
    locationId: ID;
    variantId: ID;
    reason: AdjustmentReason;
    /** Positive adds stock, negative removes it. For state changes it's the qty moved. */
    quantity: number;
    fromState?: StockState;
    toState?: StockState;
    note: string;
    status: "pending" | "approved" | "rejected";
    createdBy: ID;
    createdAt: string;
}

export interface CountLine {
    variantId: ID;
    systemQty: number;
    countedQty: number | null;
}

export interface StockCount {
    id: ID;
    number: string;
    locationId: ID;
    kind: "opening" | "cycle";
    lines: CountLine[];
    status: "in_progress" | "submitted" | "approved" | "rejected";
    createdBy: ID;
    createdAt: string;
    submittedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Sales channels (PRD §5.3, §6)                                       */
/* ------------------------------------------------------------------ */

export type ChannelType = "quickvee" | "shopify" | "woocommerce";

export interface ChannelConnection {
    id: ID;
    channel: ChannelType;
    level: "store" | "business_unit";
    businessUnitId: ID;
    /** Only for store-level connections (Quickvee). */
    locationId: ID | null;
    name: string;
    status: "connected" | "error" | "disconnected";
    syncMode: "live" | "scheduled";
    /** Human-readable schedule for scheduled syncs. */
    schedule: string;
    safetyBuffer: number;
    /** Compliance flags this channel will not accept. */
    blockedFlags: ComplianceFlag[];
    lastSyncAt: string | null;
}

export type AllocationMode = "shared" | "dedicated" | "hybrid";

export interface Allocation {
    variantId: ID;
    locationId: ID;
    mode: AllocationMode;
    /** For dedicated/hybrid: the channel connection that gets the reserved amount. */
    reservedConnectionId: ID | null;
    reservedQty: number;
}

export interface ChannelListing {
    variantId: ID;
    connectionId: ID;
    /** The channel's own ID for this item. */
    externalId: string | null;
    status: "synced" | "pending" | "blocked" | "failed" | "not_listed";
    lastPushedQty: number | null;
    lastPushedAt: string | null;
    message?: string;
}

export interface Mismatch {
    id: ID;
    connectionId: ID;
    locationId: ID | null;
    variantId: ID;
    expected: number;
    reported: number;
    source: "scheduled_pull" | "manual_pull" | "upload";
    detectedAt: string;
    status: "open" | "handled";
}

export interface SalesRecord {
    id: ID;
    connectionId: ID;
    locationId: ID;
    variantId: ID;
    quantity: number;
    total: number;
    soldAt: string;
}

/* ------------------------------------------------------------------ */
/* Purchasing & receiving (PRD §5.6, §9.1)                             */
/* ------------------------------------------------------------------ */

export interface Vendor {
    id: ID;
    name: string;
    contactName: string;
    email: string;
    phone: string;
    businessUnitIds: ID[];
    notes: string;
}

export type POStatus = "created" | "sent" | "receiving" | "partial" | "complete" | "resolved";

export interface POLine {
    variantId: ID;
    /** Ordered in purchase units (e.g. cases). */
    orderedQty: number;
    unitCost: number;
    /** Received in selling units (each). */
    receivedUnits: number;
}

export interface UnexpectedItem {
    barcode: string;
    description: string;
    units: number;
    /** Product auto-created as a draft for review. */
    productId: ID | null;
}

export interface PurchaseOrder {
    id: ID;
    number: string;
    vendorId: ID;
    businessUnitId: ID;
    warehouseId: ID;
    status: POStatus;
    lines: POLine[];
    unexpected: UnexpectedItem[];
    notes: string;
    source: "manual" | "reorder";
    createdBy: ID;
    createdAt: string;
    sentAt?: string;
    receivedAt?: string;
    history: StatusEvent[];
}

/* ------------------------------------------------------------------ */
/* Store replenishment (PRD §5.7, §9.2)                                */
/* ------------------------------------------------------------------ */

/**
 * Store-to-store transfers start as "pending_approval" until the warehouse manager approves them
 * ("rejected" if they don't). Warehouse requests start at "requested".
 */
export type StoreRequestStatus = "pending_approval" | "rejected" | "requested" | "picked" | "packed" | "shipped" | "confirmed";

export interface StoreRequestLine {
    variantId: ID;
    requestedQty: number;
    shippedQty: number;
    receivedQty: number;
}

export interface StoreRequest {
    id: ID;
    number: string;
    /** The requesting store. */
    storeId: ID;
    /** Where the stock comes from: the business unit's warehouse or another store. */
    sourceId: ID;
    status: StoreRequestStatus;
    lines: StoreRequestLine[];
    note: string;
    createdBy: ID;
    createdAt: string;
    history: StatusEvent[];
}

export interface StatusEvent {
    status: string;
    by: ID;
    at: string;
    note?: string;
}

/* ------------------------------------------------------------------ */
/* Approvals (PRD §5.9)                                                */
/* ------------------------------------------------------------------ */

export type ApprovalType =
    | "reorder"
    | "count_variance"
    | "adjustment"
    | "unexpected_item"
    | "partial_po"
    | "mismatch"
    | "import_duplicate"
    | "sync_failure"
    | "transfer_request";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "dismissed" | "resolved";

export type ApprovalPayload =
    | { type: "reorder"; variantId: ID; vendorId: ID | null; warehouseId: ID; currentStock: number; dailySales: number; runOutDate: string; suggestedQty: number }
    | { type: "count_variance"; countId: ID }
    | { type: "adjustment"; adjustmentId: ID }
    | { type: "unexpected_item"; poId: ID; barcode: string; productId: ID | null; units: number; description: string }
    | { type: "partial_po"; poId: ID }
    | { type: "mismatch"; mismatchId: ID }
    | { type: "import_duplicate"; importRow: ImportRow; matchProductId: ID; matchVariantId: ID | null; reason: string }
    | { type: "sync_failure"; connectionId: ID; variantIds: ID[]; reason: string; kind: "blocked" | "failed" }
    | { type: "transfer_request"; requestId: ID };

export interface Approval {
    id: ID;
    type: ApprovalType;
    title: string;
    summary: string;
    businessUnitId: ID;
    locationId: ID | null;
    status: ApprovalStatus;
    payload: ApprovalPayload;
    createdAt: string;
    decidedBy?: ID;
    decidedAt?: string;
    decision?: string;
    decisionNote?: string;
}

export interface ImportRow {
    brand: string;
    productLine: string;
    productType: string;
    variant: string;
    sku: string;
    upc: string;
    price: number;
    cost: number;
}

/* ------------------------------------------------------------------ */
/* Audit trail (PRD §5.5 "permanent record")                           */
/* ------------------------------------------------------------------ */

export type ActivityKind =
    | "stock"
    | "count"
    | "adjustment"
    | "receiving"
    | "purchase_order"
    | "store_request"
    | "channel"
    | "catalog"
    | "approval"
    | "setup";

export interface ActivityEntry {
    id: ID;
    kind: ActivityKind;
    message: string;
    by: ID;
    at: string;
    locationId: ID | null;
    variantId?: ID | null;
    /** Signed quantity change, when the activity moved stock. */
    quantity?: number;
    reason?: string;
}
