/**
 * Static demo data for Inventory HQ.
 *
 * Everything is generated deterministically so every reload (and every
 * teammate) sees the same numbers. When the backend lands, this file is
 * replaced by API calls; the shapes come from `@/lib/types`.
 */
import type {
    ActivityEntry,
    Adjustment,
    Allocation,
    Approval,
    BusinessUnit,
    ChannelConnection,
    ChannelListing,
    Company,
    ComplianceFlag,
    Employee,
    Location,
    Mismatch,
    Product,
    PurchaseOrder,
    StockCount,
    StockLevel,
    StoreRequest,
    Variant,
    Vendor,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let seed = 20261013;
const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const DAY = 24 * 60 * 60 * 1000;
export const daysAgo = (d: number, hour = 10) => {
    const date = new Date(Date.now() - d * DAY);
    date.setHours(hour, randInt(0, 59), 0, 0);
    return date.toISOString();
};
const upc = () => Array.from({ length: 12 }, () => randInt(0, 9)).join("");

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

export const companies: Company[] = [
    { id: "co_alcosta", name: "Alcosta Group", createdAt: daysAgo(400) },
    { id: "co_bayline", name: "Bayline Retail Co.", createdAt: daysAgo(30) },
];

export const businessUnits: BusinessUnit[] = [
    { id: "bu_smoke", companyId: "co_alcosta", name: "Smoke Shops", color: "orange", attributeKeys: ["Flavor", "Nicotine Strength", "Size", "Color"] },
    { id: "bu_apparel", companyId: "co_alcosta", name: "Apparel Brand", color: "purple", attributeKeys: ["Size", "Color", "Material"] },
    { id: "bu_skate", companyId: "co_alcosta", name: "Skates", color: "blue", attributeKeys: ["Width", "Size", "Color"] },
    { id: "bu_poke", companyId: "co_alcosta", name: "Pokémon", color: "green", attributeKeys: ["Set", "Language", "Condition"] },
    { id: "bu_bay", companyId: "co_bayline", name: "Bayline Grocery", color: "pink", attributeKeys: ["Size", "Roast"] },
];

export const locations: Location[] = [
    { id: "st_alcosta", businessUnitId: "bu_smoke", type: "store", name: "Alcosta Shop", code: "ALC", address: "9150 Alcosta Blvd, San Ramon, CA", openingCountDone: true },
    { id: "st_dublin", businessUnitId: "bu_smoke", type: "store", name: "Dublin Smoke Shop", code: "DUB", address: "7200 Amador Valley Blvd, Dublin, CA", openingCountDone: true },
    { id: "st_sanramon", businessUnitId: "bu_smoke", type: "store", name: "San Ramon Smoke Shop", code: "SRM", address: "2441 San Ramon Valley Blvd, San Ramon, CA", openingCountDone: false },
    { id: "wh_smoke", businessUnitId: "bu_smoke", type: "warehouse", name: "Smoke Shops Warehouse", code: "WH-S", address: "1650 Trinity Ave, Walnut Creek, CA", openingCountDone: true },
    { id: "st_apparel", businessUnitId: "bu_apparel", type: "store", name: "Apparel Flagship", code: "APF", address: "120 Market Pl, San Ramon, CA", openingCountDone: true },
    { id: "wh_apparel", businessUnitId: "bu_apparel", type: "warehouse", name: "Apparel Warehouse", code: "WH-A", address: "1650 Trinity Ave, Walnut Creek, CA", openingCountDone: true },
    { id: "st_skate", businessUnitId: "bu_skate", type: "store", name: "Skate Shop", code: "SKT", address: "18 Crow Canyon Ct, San Ramon, CA", openingCountDone: true },
    { id: "wh_skate", businessUnitId: "bu_skate", type: "warehouse", name: "Skates Stockroom", code: "WH-K", address: "18 Crow Canyon Ct (rear), San Ramon, CA", openingCountDone: true },
    { id: "st_poke", businessUnitId: "bu_poke", type: "store", name: "Card Shop", code: "PKM", address: "3141 Crow Canyon Pl, San Ramon, CA", openingCountDone: true },
    { id: "wh_poke", businessUnitId: "bu_poke", type: "warehouse", name: "Pokémon Stockroom", code: "WH-P", address: "3141 Crow Canyon Pl (rear), San Ramon, CA", openingCountDone: true },
    { id: "st_bay", businessUnitId: "bu_bay", type: "store", name: "Bayline Market", code: "BAY", address: "55 Harbor Way, Oakland, CA", openingCountDone: true },
    { id: "wh_bay", businessUnitId: "bu_bay", type: "warehouse", name: "Bayline DC", code: "WH-B", address: "80 Harbor Way, Oakland, CA", openingCountDone: true },
];

export const employees: Employee[] = [
    { id: "e_exec", companyId: "co_alcosta", name: "Bilal Ahmed", email: "bilal@alcosta.example", role: "executive", level: "company", businessUnitIds: [], locationIds: [], status: "active" },
    { id: "e_mgr_store", companyId: "co_alcosta", name: "Sara Khan", email: "sara@alcosta.example", role: "manager", level: "store", businessUnitIds: ["bu_smoke"], locationIds: ["st_alcosta", "st_dublin", "st_sanramon"], status: "active" },
    { id: "e_mgr_wh", companyId: "co_alcosta", name: "Daniel Ortiz", email: "daniel@alcosta.example", role: "manager", level: "warehouse", businessUnitIds: ["bu_smoke"], locationIds: ["wh_smoke"], status: "active" },
    { id: "e_assoc_store", companyId: "co_alcosta", name: "Priya Patel", email: "priya@alcosta.example", role: "associate", level: "store", businessUnitIds: ["bu_smoke"], locationIds: ["st_alcosta"], status: "active" },
    { id: "e_assoc_wh", companyId: "co_alcosta", name: "Marcus Lee", email: "marcus@alcosta.example", role: "associate", level: "warehouse", businessUnitIds: ["bu_smoke"], locationIds: ["wh_smoke"], status: "active" },
    { id: "e_mgr_apparel", companyId: "co_alcosta", name: "Jenna Brooks", email: "jenna@alcosta.example", role: "manager", level: "store", businessUnitIds: ["bu_apparel"], locationIds: ["st_apparel", "wh_apparel"], status: "active" },
    { id: "e_assoc_poke", companyId: "co_alcosta", name: "Kevin Tran", email: "kevin@alcosta.example", role: "associate", level: "store", businessUnitIds: ["bu_poke"], locationIds: ["st_poke"], status: "active" },
    { id: "e_assoc_skate", companyId: "co_alcosta", name: "Tyler Nguyen", email: "tyler@alcosta.example", role: "associate", level: "store", businessUnitIds: ["bu_skate"], locationIds: ["st_skate"], status: "invited" },
    { id: "e_bay_exec", companyId: "co_bayline", name: "Lena Park", email: "lena@bayline.example", role: "executive", level: "company", businessUnitIds: [], locationIds: [], status: "active" },
];

/** Accounts offered on the mock login screen. */
export const demoAccounts: { employeeId: string; headline: string }[] = [
    { employeeId: "e_exec", headline: "Sees everything, decides Approvals, adds employees, gets the monthly report." },
    { employeeId: "e_mgr_store", headline: "Manages the three smoke shop stores. Approvals, vendors and POs in scope." },
    { employeeId: "e_mgr_wh", headline: "Manages the Smoke Shops Warehouse: receiving, picking, purchasing." },
    { employeeId: "e_assoc_store", headline: "Works at Alcosta Shop. Requests stock and confirms deliveries." },
    { employeeId: "e_assoc_wh", headline: "Works the warehouse floor. Receives POs, picks, packs and ships." },
    { employeeId: "e_bay_exec", headline: "Executive of a second company — shows strict company separation." },
];

/* ------------------------------------------------------------------ */
/* Vendors                                                             */
/* ------------------------------------------------------------------ */

export const vendors: Vendor[] = [
    { id: "v_vape", name: "Bay Area Vape Distributors", contactName: "Omar Haddad", email: "orders@bavd.example", phone: "(925) 555-0142", businessUnitIds: ["bu_smoke"], notes: "Net 15. Delivers Tue/Fri." },
    { id: "v_smoke", name: "West Coast Smoke Supply", contactName: "Linda Chu", email: "linda@wcss.example", phone: "(510) 555-0188", businessUnitIds: ["bu_smoke"], notes: "Cigars, shisha, lighters." },
    { id: "v_paper", name: "Pacific Paper Goods", contactName: "Ray Alvarez", email: "ray@pacificpaper.example", phone: "(408) 555-0119", businessUnitIds: ["bu_smoke"], notes: "Papers & cones. MOQ 10 cases." },
    { id: "v_thread", name: "Threadline Apparel Mfg", contactName: "Nadia Rossi", email: "nadia@threadline.example", phone: "(213) 555-0177", businessUnitIds: ["bu_apparel"], notes: "Blank + print. 3 week lead time." },
    { id: "v_deck", name: "Deckhouse Skate Supply", contactName: "Chris Bell", email: "chris@deckhouse.example", phone: "(619) 555-0102", businessUnitIds: ["bu_skate"], notes: "" },
    { id: "v_cards", name: "Card Vault Wholesale", contactName: "Amy Sato", email: "amy@cardvault.example", phone: "(206) 555-0163", businessUnitIds: ["bu_poke"], notes: "Allocation-based on new sets." },
    { id: "v_bay", name: "Golden Bean Roasters", contactName: "Ivan Cole", email: "ivan@goldenbean.example", phone: "(510) 555-0100", businessUnitIds: ["bu_bay"], notes: "" },
];

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

interface ProductSpec {
    id: string;
    bu: string;
    brand: string;
    line: string;
    type: string;
    description: string;
    flags: ComplianceFlag[];
    uom: [string, string, number];
    vendor: string;
    leadTime: number;
    attrKey: string;
    variants: { name: string; price: number; cost: number; daily: number; attrs?: Record<string, string> }[];
    color: string;
}

const productSpecs: ProductSpec[] = [
    {
        id: "p_geek", bu: "bu_smoke", brand: "Geek Bar", line: "Pulse X", type: "Disposable Vape",
        description: "25,000 puff disposable with dual-mesh coil and full screen display.",
        flags: ["nicotine", "vape", "age_21", "lithium_battery"], uom: ["Case", "Each", 10], vendor: "v_vape", leadTime: 4, attrKey: "Flavor", color: "#0ea5e9",
        variants: [
            { name: "Blue Razz Ice", price: 24.99, cost: 11.5, daily: 9 },
            { name: "Watermelon Ice", price: 24.99, cost: 11.5, daily: 7 },
            { name: "Sour Apple Ice", price: 24.99, cost: 11.5, daily: 4 },
            { name: "Miami Mint", price: 24.99, cost: 11.5, daily: 5 },
        ],
    },
    {
        id: "p_elf", bu: "bu_smoke", brand: "Elf Bar", line: "BC5000", type: "Disposable Vape",
        description: "5,000 puff rechargeable disposable, 5% nicotine.",
        flags: ["nicotine", "vape", "age_21", "lithium_battery"], uom: ["Case", "Each", 10], vendor: "v_vape", leadTime: 4, attrKey: "Flavor", color: "#a855f7",
        variants: [
            { name: "Strawberry Kiwi", price: 19.99, cost: 8.75, daily: 4 },
            { name: "Blue Razz Ice", price: 19.99, cost: 8.75, daily: 3 },
        ],
    },
    {
        id: "p_nord", bu: "bu_smoke", brand: "SMOK", line: "Nord 5 Kit", type: "Pod System",
        description: "80W pod system with 2000mAh battery.",
        flags: ["vape", "age_21", "lithium_battery"], uom: ["Case", "Each", 5], vendor: "v_vape", leadTime: 7, attrKey: "Color", color: "#111827",
        variants: [
            { name: "Black", price: 49.99, cost: 26, daily: 1 },
            { name: "Silver", price: 49.99, cost: 26, daily: 0.6 },
        ],
    },
    {
        id: "p_raw", bu: "bu_smoke", brand: "RAW", line: "Classic Rolling Papers", type: "Rolling Papers",
        description: "Unrefined, natural rolling papers.",
        flags: [], uom: ["Box", "Booklet", 24], vendor: "v_paper", leadTime: 5, attrKey: "Size", color: "#d97706",
        variants: [
            { name: "1¼", price: 2.49, cost: 0.85, daily: 12 },
            { name: "King Size Slim", price: 2.99, cost: 1.05, daily: 10 },
        ],
    },
    {
        id: "p_zigzag", bu: "bu_smoke", brand: "Zig-Zag", line: "Pre-Rolled Cones", type: "Cones",
        description: "Ultra thin pre-rolled cones, 6 pack.",
        flags: [], uom: ["Box", "Pack", 24], vendor: "v_paper", leadTime: 5, attrKey: "Size", color: "#f97316",
        variants: [{ name: "King Size", price: 4.99, cost: 1.9, daily: 6 }],
    },
    {
        id: "p_backwoods", bu: "bu_smoke", brand: "Backwoods", line: "Cigars 5 Pack", type: "Cigars",
        description: "All natural wild leaf cigars.",
        flags: ["tobacco", "age_21"], uom: ["Carton", "Pack", 8], vendor: "v_smoke", leadTime: 6, attrKey: "Flavor", color: "#78350f",
        variants: [
            { name: "Honey", price: 11.99, cost: 6.4, daily: 5 },
            { name: "Russian Cream", price: 11.99, cost: 6.4, daily: 3 },
            { name: "Sweet Aromatic", price: 11.99, cost: 6.4, daily: 2 },
        ],
    },
    {
        id: "p_alfakher", bu: "bu_smoke", brand: "Al Fakher", line: "Shisha 250g", type: "Hookah Tobacco",
        description: "Molasses hookah tobacco, 250g tin.",
        flags: ["tobacco", "age_21"], uom: ["Case", "Tin", 12], vendor: "v_smoke", leadTime: 10, attrKey: "Flavor", color: "#16a34a",
        variants: [
            { name: "Double Apple", price: 17.99, cost: 9.2, daily: 1.5 },
            { name: "Mint", price: 17.99, cost: 9.2, daily: 1.2 },
        ],
    },
    {
        id: "p_clipper", bu: "bu_smoke", brand: "Clipper", line: "Refillable Lighter", type: "Lighter",
        description: "Refillable butane lighter with removable flint.",
        flags: [], uom: ["Tray", "Each", 48], vendor: "v_smoke", leadTime: 6, attrKey: "Color", color: "#ef4444",
        variants: [{ name: "Assorted", price: 2.99, cost: 0.9, daily: 8 }],
    },
    {
        id: "p_gummies", bu: "bu_smoke", brand: "Hemp Wellness", line: "CBD Gummies 25mg", type: "Edible",
        description: "Broad spectrum CBD gummies, 20 count.",
        flags: ["hemp", "age_21"], uom: ["Case", "Jar", 12], vendor: "v_smoke", leadTime: 8, attrKey: "Flavor", color: "#ec4899",
        variants: [{ name: "Mixed Berry", price: 29.99, cost: 13, daily: 1 }],
    },
    {
        id: "p_tee", bu: "bu_apparel", brand: "Alcosta", line: "Classic Logo Tee", type: "T-Shirt",
        description: "Heavy cotton tee with chest logo.",
        flags: [], uom: ["Pack", "Each", 12], vendor: "v_thread", leadTime: 21, attrKey: "Size", color: "#18181b",
        variants: [
            { name: "S / Black", price: 32, cost: 9, daily: 1, attrs: { Size: "S", Color: "Black" } },
            { name: "M / Black", price: 32, cost: 9, daily: 2, attrs: { Size: "M", Color: "Black" } },
            { name: "L / Black", price: 32, cost: 9, daily: 1.5, attrs: { Size: "L", Color: "Black" } },
            { name: "M / White", price: 32, cost: 9, daily: 1, attrs: { Size: "M", Color: "White" } },
        ],
    },
    {
        id: "p_hoodie", bu: "bu_apparel", brand: "Alcosta", line: "Heavyweight Hoodie", type: "Hoodie",
        description: "14oz fleece hoodie.",
        flags: [], uom: ["Pack", "Each", 6], vendor: "v_thread", leadTime: 21, attrKey: "Size", color: "#6b7280",
        variants: [
            { name: "M / Heather Grey", price: 68, cost: 22, daily: 0.8, attrs: { Size: "M", Color: "Heather Grey" } },
            { name: "L / Heather Grey", price: 68, cost: 22, daily: 0.7, attrs: { Size: "L", Color: "Heather Grey" } },
        ],
    },
    {
        id: "p_cap", bu: "bu_apparel", brand: "Alcosta", line: "Snapback Cap", type: "Hat",
        description: "Structured snapback with embroidered logo.",
        flags: [], uom: ["Pack", "Each", 12], vendor: "v_thread", leadTime: 14, attrKey: "Color", color: "#0f172a",
        variants: [{ name: "Black", price: 28, cost: 7.5, daily: 0.6 }],
    },
    {
        id: "p_deck", bu: "bu_skate", brand: "Element", line: "Section Complete Skateboard", type: "Complete Skateboard",
        description: "7-ply maple complete with Element trucks and wheels.",
        flags: [], uom: ["Box", "Each", 5], vendor: "v_deck", leadTime: 10, attrKey: "Width", color: "#22c55e",
        variants: [
            { name: '8.0"', price: 89.99, cost: 48, daily: 0.4 },
            { name: '8.25"', price: 89.99, cost: 48, daily: 0.3 },
        ],
    },
    {
        id: "p_bearings", bu: "bu_skate", brand: "Bones", line: "Reds Bearings", type: "Bearings",
        description: "Skate rated bearings, set of 8.",
        flags: [], uom: ["Box", "Set", 20], vendor: "v_deck", leadTime: 10, attrKey: "Size", color: "#dc2626",
        variants: [{ name: "Standard", price: 22, cost: 9, daily: 0.9 }],
    },
    {
        id: "p_trucks", bu: "bu_skate", brand: "Independent", line: "Stage 11 Trucks", type: "Trucks",
        description: "Standard trucks, sold as a pair.",
        flags: [], uom: ["Box", "Pair", 6], vendor: "v_deck", leadTime: 10, attrKey: "Size", color: "#64748b",
        variants: [
            { name: "139", price: 64, cost: 34, daily: 0.3 },
            { name: "144", price: 64, cost: 34, daily: 0.3 },
        ],
    },
    {
        id: "p_boosterbox", bu: "bu_poke", brand: "Pokémon TCG", line: "Scarlet & Violet Booster Box", type: "Booster Box",
        description: "36 booster packs.",
        flags: [], uom: ["Case", "Box", 6], vendor: "v_cards", leadTime: 14, attrKey: "Set", color: "#facc15",
        variants: [
            { name: "Surging Sparks", price: 159.99, cost: 105, daily: 0.5 },
            { name: "Prismatic Evolutions", price: 189.99, cost: 128, daily: 0.7 },
        ],
    },
    {
        id: "p_etb", bu: "bu_poke", brand: "Pokémon TCG", line: "Elite Trainer Box", type: "Elite Trainer Box",
        description: "9 booster packs plus accessories.",
        flags: [], uom: ["Case", "Box", 10], vendor: "v_cards", leadTime: 14, attrKey: "Set", color: "#3b82f6",
        variants: [{ name: "Surging Sparks", price: 54.99, cost: 34, daily: 0.8 }],
    },
    {
        id: "p_pack", bu: "bu_poke", brand: "Pokémon TCG", line: "Booster Pack", type: "Booster Pack",
        description: "Single booster pack, 10 cards.",
        flags: [], uom: ["Box", "Pack", 36], vendor: "v_cards", leadTime: 14, attrKey: "Set", color: "#f43f5e",
        variants: [
            { name: "Surging Sparks", price: 4.99, cost: 3.1, daily: 6 },
            { name: "Prismatic Evolutions", price: 6.99, cost: 4.4, daily: 5 },
        ],
    },
    {
        id: "p_coffee", bu: "bu_bay", brand: "Golden Bean", line: "Organic Coffee 12oz", type: "Coffee",
        description: "Whole bean organic coffee.",
        flags: [], uom: ["Case", "Bag", 12], vendor: "v_bay", leadTime: 5, attrKey: "Roast", color: "#92400e",
        variants: [
            { name: "Medium Roast", price: 14.99, cost: 7, daily: 3 },
            { name: "Dark Roast", price: 14.99, cost: 7, daily: 2 },
        ],
    },
];

const skuCode = (s: string) =>
    s
        .replace(/[^A-Za-z0-9 ]/g, "")
        .split(" ")
        .filter(Boolean)
        .map((w) => w.slice(0, 3).toUpperCase())
        .join("")
        .slice(0, 6);

export const products: Product[] = [];
export const variants: Variant[] = [];

productSpecs.forEach((spec, pi) => {
    products.push({
        id: spec.id,
        businessUnitId: spec.bu,
        brand: spec.brand,
        productLine: spec.line,
        productType: spec.type,
        name: `${spec.brand} ${spec.line}`,
        description: spec.description,
        attributes: { Brand: spec.brand, "Product Type": spec.type },
        complianceFlags: spec.flags,
        uom: { purchaseUnit: spec.uom[0], sellingUnit: spec.uom[1], unitsPerPurchaseUnit: spec.uom[2] },
        status: "active",
        createdAt: daysAgo(200 - pi * 5),
        imageColor: spec.color,
    });
    spec.variants.forEach((v, vi) => {
        const daily = v.daily;
        variants.push({
            id: `${spec.id}_v${vi + 1}`,
            productId: spec.id,
            name: v.name,
            sku: `${skuCode(spec.brand)}-${skuCode(spec.line)}-${skuCode(v.name) || "STD"}`,
            barcodes: [
                { code: upc(), unit: "selling" },
                { code: upc(), unit: "purchase" },
            ],
            price: v.price,
            cost: v.cost,
            attributes: v.attrs ?? { [spec.attrKey]: v.name },
            reorderPoint: Math.max(6, Math.round(daily * (spec.leadTime + 7))),
            restockQty: Math.max(spec.uom[2], Math.ceil((daily * 30) / spec.uom[2]) * spec.uom[2]),
            leadTimeDays: spec.leadTime,
            vendorId: spec.vendor,
            dailySales: daily,
        });
    });
});

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

export const stockLevels: StockLevel[] = [];

variants.forEach((v) => {
    const product = products.find((p) => p.id === v.productId)!;
    locations
        .filter((l) => l.businessUnitId === product.businessUnitId)
        .forEach((l) => {
            const isWarehouse = l.type === "warehouse";
            // Make a few warehouse items deliberately low so reorder suggestions appear.
            const low = isWarehouse && rand() < 0.3;
            const available = isWarehouse
                ? low
                    ? randInt(0, Math.max(2, Math.round(v.reorderPoint * 0.8)))
                    : randInt(v.reorderPoint + 10, v.reorderPoint * 4 + 40)
                : randInt(2, Math.max(8, Math.round(v.dailySales * 10)));
            stockLevels.push({
                variantId: v.id,
                locationId: l.id,
                available,
                inTransit: 0,
                returns: !isWarehouse && rand() < 0.12 ? randInt(1, 3) : 0,
                damaged: rand() < 0.08 ? randInt(1, 2) : 0,
            });
        });
});

/* ------------------------------------------------------------------ */
/* Channels                                                            */
/* ------------------------------------------------------------------ */

export const connections: ChannelConnection[] = [
    { id: "cn_qv_alc", channel: "quickvee", level: "store", businessUnitId: "bu_smoke", locationId: "st_alcosta", name: "Quickvee · Alcosta Shop", status: "connected", syncMode: "scheduled", schedule: "Twice daily · 6:00 AM & 6:00 PM", safetyBuffer: 1, blockedFlags: [], lastSyncAt: daysAgo(0, 6) },
    { id: "cn_qv_dub", channel: "quickvee", level: "store", businessUnitId: "bu_smoke", locationId: "st_dublin", name: "Quickvee · Dublin Smoke Shop", status: "connected", syncMode: "scheduled", schedule: "Twice daily · 6:00 AM & 6:00 PM", safetyBuffer: 1, blockedFlags: [], lastSyncAt: daysAgo(0, 6) },
    { id: "cn_qv_srm", channel: "quickvee", level: "store", businessUnitId: "bu_smoke", locationId: "st_sanramon", name: "Quickvee · San Ramon Smoke Shop", status: "connected", syncMode: "scheduled", schedule: "Twice daily · 6:00 AM & 6:00 PM", safetyBuffer: 1, blockedFlags: [], lastSyncAt: daysAgo(0, 6) },
    { id: "cn_qv_skt", channel: "quickvee", level: "store", businessUnitId: "bu_skate", locationId: "st_skate", name: "Quickvee · Skate Shop", status: "connected", syncMode: "scheduled", schedule: "Twice daily · 6:00 AM & 6:00 PM", safetyBuffer: 0, blockedFlags: [], lastSyncAt: daysAgo(0, 6) },
    { id: "cn_qv_pkm", channel: "quickvee", level: "store", businessUnitId: "bu_poke", locationId: "st_poke", name: "Quickvee · Card Shop", status: "connected", syncMode: "scheduled", schedule: "Twice daily · 6:00 AM & 6:00 PM", safetyBuffer: 0, blockedFlags: [], lastSyncAt: daysAgo(0, 6) },
    { id: "cn_sh_smoke", channel: "shopify", level: "business_unit", businessUnitId: "bu_smoke", locationId: "st_alcosta", name: "Shopify · Smoke Shops Online", status: "connected", syncMode: "live", schedule: "Live", safetyBuffer: 3, blockedFlags: ["nicotine", "vape", "tobacco"], lastSyncAt: daysAgo(0, 9) },
    { id: "cn_sh_apparel", channel: "shopify", level: "business_unit", businessUnitId: "bu_apparel", locationId: "st_apparel", name: "Shopify · Alcosta Apparel", status: "connected", syncMode: "live", schedule: "Live", safetyBuffer: 2, blockedFlags: [], lastSyncAt: daysAgo(0, 9) },
    { id: "cn_sh_poke", channel: "shopify", level: "business_unit", businessUnitId: "bu_poke", locationId: "st_poke", name: "Shopify · Card Shop Online", status: "connected", syncMode: "live", schedule: "Live", safetyBuffer: 2, blockedFlags: [], lastSyncAt: daysAgo(0, 9) },
    { id: "cn_woo_skate", channel: "woocommerce", level: "business_unit", businessUnitId: "bu_skate", locationId: "st_skate", name: "WooCommerce · Skates Online", status: "error", syncMode: "scheduled", schedule: "Every 30 minutes", safetyBuffer: 4, blockedFlags: [], lastSyncAt: daysAgo(1, 14) },
    { id: "cn_qv_bay", channel: "quickvee", level: "store", businessUnitId: "bu_bay", locationId: "st_bay", name: "Quickvee · Bayline Market", status: "connected", syncMode: "scheduled", schedule: "Twice daily · 6:00 AM & 6:00 PM", safetyBuffer: 1, blockedFlags: [], lastSyncAt: daysAgo(0, 6) },
];

export const allocations: Allocation[] = [];
export const listings: ChannelListing[] = [];

connections.forEach((c) => {
    const buProducts = products.filter((p) => p.businessUnitId === c.businessUnitId).map((p) => p.id);
    variants
        .filter((v) => buProducts.includes(v.productId))
        .forEach((v) => {
            const product = products.find((p) => p.id === v.productId)!;
            const blocked = product.complianceFlags.find((f) => c.blockedFlags.includes(f));
            listings.push({
                variantId: v.id,
                connectionId: c.id,
                externalId: blocked ? null : `${c.channel.slice(0, 2).toUpperCase()}-${randInt(100000, 999999)}`,
                status: blocked ? "blocked" : c.status === "error" ? "failed" : "synced",
                lastPushedQty: null,
                lastPushedAt: blocked ? null : daysAgo(randInt(0, 3)),
                message: blocked ? `Has “${blocked}” flag — ${c.name.split(" · ")[0]} does not accept it.` : c.status === "error" ? "Authentication expired (401)." : undefined,
            });
        });
});

// A few explicit allocation rules to show each mode.
allocations.push(
    { variantId: "p_geek_v1", locationId: "st_alcosta", mode: "shared", reservedConnectionId: null, reservedQty: 0 },
    { variantId: "p_raw_v1", locationId: "st_alcosta", mode: "hybrid", reservedConnectionId: "cn_qv_alc", reservedQty: 20 },
    { variantId: "p_tee_v2", locationId: "st_apparel", mode: "dedicated", reservedConnectionId: "cn_sh_apparel", reservedQty: 10 },
    { variantId: "p_boosterbox_v2", locationId: "st_poke", mode: "hybrid", reservedConnectionId: "cn_qv_pkm", reservedQty: 4 },
);

export const mismatches: Mismatch[] = [
    { id: "mm_1", connectionId: "cn_qv_alc", locationId: "st_alcosta", variantId: "p_geek_v2", expected: 14, reported: 11, source: "scheduled_pull", detectedAt: daysAgo(0, 6), status: "open" },
    { id: "mm_2", connectionId: "cn_qv_dub", locationId: "st_dublin", variantId: "p_backwoods_v1", expected: 9, reported: 10, source: "scheduled_pull", detectedAt: daysAgo(0, 6), status: "open" },
    { id: "mm_3", connectionId: "cn_sh_apparel", locationId: "st_apparel", variantId: "p_tee_v3", expected: 6, reported: 4, source: "manual_pull", detectedAt: daysAgo(1, 15), status: "open" },
    { id: "mm_4", connectionId: "cn_qv_alc", locationId: "st_alcosta", variantId: "p_clipper_v1", expected: 40, reported: 39, source: "scheduled_pull", detectedAt: daysAgo(3, 6), status: "handled" },
];

/* ------------------------------------------------------------------ */
/* Purchasing                                                          */
/* ------------------------------------------------------------------ */

const poLine = (variantId: string, cases: number, receivedUnits = 0) => {
    const v = variants.find((x) => x.id === variantId)!;
    const p = products.find((x) => x.id === v.productId)!;
    return { variantId, orderedQty: cases, unitCost: +(v.cost * p.uom.unitsPerPurchaseUnit).toFixed(2), receivedUnits };
};

export const purchaseOrders: PurchaseOrder[] = [
    {
        id: "po_1", number: "PO-1042", vendorId: "v_vape", businessUnitId: "bu_smoke", warehouseId: "wh_smoke", status: "sent", source: "manual",
        lines: [poLine("p_geek_v1", 6), poLine("p_geek_v2", 4), poLine("p_elf_v1", 3)], unexpected: [], notes: "Weekly vape restock.",
        createdBy: "e_mgr_wh", createdAt: daysAgo(3), sentAt: daysAgo(3, 14),
        history: [{ status: "created", by: "e_mgr_wh", at: daysAgo(3) }, { status: "sent", by: "e_mgr_wh", at: daysAgo(3, 14) }],
    },
    {
        id: "po_2", number: "PO-1041", vendorId: "v_paper", businessUnitId: "bu_smoke", warehouseId: "wh_smoke", status: "receiving", source: "manual",
        lines: [poLine("p_raw_v1", 4, 48), poLine("p_raw_v2", 4, 0), poLine("p_zigzag_v1", 2, 24)], unexpected: [], notes: "",
        createdBy: "e_mgr_wh", createdAt: daysAgo(6), sentAt: daysAgo(6, 15),
        history: [{ status: "created", by: "e_mgr_wh", at: daysAgo(6) }, { status: "sent", by: "e_mgr_wh", at: daysAgo(6, 15) }, { status: "receiving", by: "e_assoc_wh", at: daysAgo(0, 9) }],
    },
    {
        id: "po_3", number: "PO-1038", vendorId: "v_smoke", businessUnitId: "bu_smoke", warehouseId: "wh_smoke", status: "partial", source: "manual",
        lines: [poLine("p_backwoods_v1", 5, 40), poLine("p_backwoods_v2", 3, 16), poLine("p_clipper_v1", 1, 48)],
        unexpected: [{ barcode: "860001234567", description: "Backwoods Cigars 5 Pack — Dark Stout", units: 8, productId: null }], notes: "",
        createdBy: "e_mgr_wh", createdAt: daysAgo(12), sentAt: daysAgo(12, 13), receivedAt: daysAgo(5, 11),
        history: [{ status: "created", by: "e_mgr_wh", at: daysAgo(12) }, { status: "sent", by: "e_mgr_wh", at: daysAgo(12, 13) }, { status: "receiving", by: "e_assoc_wh", at: daysAgo(5, 10) }, { status: "partial", by: "e_assoc_wh", at: daysAgo(5, 11), note: "1 line short: Russian Cream (8 of 24)." }],
    },
    {
        id: "po_4", number: "PO-1035", vendorId: "v_thread", businessUnitId: "bu_apparel", warehouseId: "wh_apparel", status: "complete", source: "manual",
        lines: [poLine("p_tee_v1", 2, 24), poLine("p_tee_v2", 3, 36), poLine("p_hoodie_v1", 2, 12)], unexpected: [], notes: "Fall drop.",
        createdBy: "e_mgr_apparel", createdAt: daysAgo(30), sentAt: daysAgo(30, 15), receivedAt: daysAgo(9, 12),
        history: [{ status: "created", by: "e_mgr_apparel", at: daysAgo(30) }, { status: "sent", by: "e_mgr_apparel", at: daysAgo(30, 15) }, { status: "receiving", by: "e_mgr_apparel", at: daysAgo(9, 11) }, { status: "complete", by: "e_mgr_apparel", at: daysAgo(9, 12) }],
    },
    {
        id: "po_5", number: "PO-1043", vendorId: "v_cards", businessUnitId: "bu_poke", warehouseId: "wh_poke", status: "created", source: "manual",
        lines: [poLine("p_boosterbox_v2", 1), poLine("p_pack_v2", 2)], unexpected: [], notes: "Waiting on allocation confirmation.",
        createdBy: "e_exec", createdAt: daysAgo(1), history: [{ status: "created", by: "e_exec", at: daysAgo(1) }],
    },
    {
        id: "po_6", number: "PO-1030", vendorId: "v_deck", businessUnitId: "bu_skate", warehouseId: "wh_skate", status: "resolved", source: "reorder",
        lines: [poLine("p_bearings_v1", 2, 40), poLine("p_deck_v1", 2, 8)], unexpected: [], notes: "",
        createdBy: "e_exec", createdAt: daysAgo(45), sentAt: daysAgo(45), receivedAt: daysAgo(33),
        history: [{ status: "created", by: "e_exec", at: daysAgo(45) }, { status: "sent", by: "e_exec", at: daysAgo(45) }, { status: "receiving", by: "e_exec", at: daysAgo(33) }, { status: "partial", by: "e_exec", at: daysAgo(33) }, { status: "resolved", by: "e_exec", at: daysAgo(31), note: "Vendor credited 2 decks." }],
    },
];

/* ------------------------------------------------------------------ */
/* Store replenishment                                                 */
/* ------------------------------------------------------------------ */

export const storeRequests: StoreRequest[] = [
    {
        id: "sr_1", number: "SR-2207", storeId: "st_alcosta", warehouseId: "wh_smoke", status: "requested", note: "Running low before the weekend.",
        lines: [{ variantId: "p_geek_v1", requestedQty: 20, shippedQty: 0, receivedQty: 0 }, { variantId: "p_raw_v2", requestedQty: 24, shippedQty: 0, receivedQty: 0 }],
        createdBy: "e_assoc_store", createdAt: daysAgo(0, 8), history: [{ status: "requested", by: "e_assoc_store", at: daysAgo(0, 8) }],
    },
    {
        id: "sr_2", number: "SR-2206", storeId: "st_dublin", warehouseId: "wh_smoke", status: "picked", note: "",
        lines: [{ variantId: "p_backwoods_v1", requestedQty: 16, shippedQty: 16, receivedQty: 0 }, { variantId: "p_clipper_v1", requestedQty: 48, shippedQty: 48, receivedQty: 0 }],
        createdBy: "e_mgr_store", createdAt: daysAgo(1), history: [{ status: "requested", by: "e_mgr_store", at: daysAgo(1) }, { status: "picked", by: "e_assoc_wh", at: daysAgo(0, 9) }],
    },
    {
        id: "sr_3", number: "SR-2205", storeId: "st_alcosta", warehouseId: "wh_smoke", status: "shipped", note: "",
        lines: [{ variantId: "p_elf_v1", requestedQty: 10, shippedQty: 10, receivedQty: 0 }, { variantId: "p_zigzag_v1", requestedQty: 12, shippedQty: 12, receivedQty: 0 }],
        createdBy: "e_assoc_store", createdAt: daysAgo(2),
        history: [{ status: "requested", by: "e_assoc_store", at: daysAgo(2) }, { status: "picked", by: "e_assoc_wh", at: daysAgo(1, 9) }, { status: "packed", by: "e_assoc_wh", at: daysAgo(1, 11) }, { status: "shipped", by: "e_assoc_wh", at: daysAgo(1, 14) }],
    },
    {
        id: "sr_4", number: "SR-2201", storeId: "st_sanramon", warehouseId: "wh_smoke", status: "confirmed", note: "",
        lines: [{ variantId: "p_geek_v3", requestedQty: 10, shippedQty: 10, receivedQty: 10 }],
        createdBy: "e_mgr_store", createdAt: daysAgo(6),
        history: [{ status: "requested", by: "e_mgr_store", at: daysAgo(6) }, { status: "picked", by: "e_assoc_wh", at: daysAgo(5) }, { status: "packed", by: "e_assoc_wh", at: daysAgo(5, 12) }, { status: "shipped", by: "e_assoc_wh", at: daysAgo(5, 15) }, { status: "confirmed", by: "e_mgr_store", at: daysAgo(4) }],
    },
    {
        id: "sr_5", number: "SR-2208", storeId: "st_apparel", warehouseId: "wh_apparel", status: "packed", note: "",
        lines: [{ variantId: "p_hoodie_v2", requestedQty: 6, shippedQty: 6, receivedQty: 0 }],
        createdBy: "e_mgr_apparel", createdAt: daysAgo(1), history: [{ status: "requested", by: "e_mgr_apparel", at: daysAgo(1) }, { status: "picked", by: "e_mgr_apparel", at: daysAgo(0, 9) }, { status: "packed", by: "e_mgr_apparel", at: daysAgo(0, 10) }],
    },
];

// Stock that is already shipped sits in the store's In Transit bucket.
storeRequests
    .filter((r) => r.status === "shipped")
    .forEach((r) =>
        r.lines.forEach((l) => {
            const s = stockLevels.find((x) => x.variantId === l.variantId && x.locationId === r.storeId);
            if (s) s.inTransit += l.shippedQty;
        }),
    );

/* ------------------------------------------------------------------ */
/* Counts & adjustments                                                */
/* ------------------------------------------------------------------ */

const stockOf = (variantId: string, locationId: string) => stockLevels.find((s) => s.variantId === variantId && s.locationId === locationId)?.available ?? 0;

export const counts: StockCount[] = [
    {
        id: "ct_1", number: "CC-0312", locationId: "st_alcosta", kind: "cycle", status: "submitted", createdBy: "e_assoc_store", createdAt: daysAgo(0, 7), submittedAt: daysAgo(0, 8),
        lines: [
            { variantId: "p_geek_v1", systemQty: stockOf("p_geek_v1", "st_alcosta"), countedQty: Math.max(0, stockOf("p_geek_v1", "st_alcosta") - 3) },
            { variantId: "p_geek_v2", systemQty: stockOf("p_geek_v2", "st_alcosta"), countedQty: stockOf("p_geek_v2", "st_alcosta") },
            { variantId: "p_geek_v3", systemQty: stockOf("p_geek_v3", "st_alcosta"), countedQty: stockOf("p_geek_v3", "st_alcosta") + 1 },
        ],
    },
    {
        id: "ct_2", number: "CC-0305", locationId: "wh_smoke", kind: "cycle", status: "approved", createdBy: "e_assoc_wh", createdAt: daysAgo(8), submittedAt: daysAgo(8),
        lines: [{ variantId: "p_raw_v1", systemQty: 240, countedQty: 238 }, { variantId: "p_raw_v2", systemQty: 192, countedQty: 192 }],
    },
    {
        id: "ct_3", number: "OC-0001", locationId: "st_sanramon", kind: "opening", status: "in_progress", createdBy: "e_mgr_store", createdAt: daysAgo(0, 9),
        lines: variants
            .filter((v) => v.productId.startsWith("p_") && products.find((p) => p.id === v.productId)!.businessUnitId === "bu_smoke")
            .slice(0, 6)
            .map((v, i) => ({ variantId: v.id, systemQty: 0, countedQty: i < 2 ? randInt(5, 20) : null })),
    },
];

export const adjustments: Adjustment[] = [
    { id: "adj_1", number: "ADJ-0091", locationId: "st_dublin", variantId: "p_nord_v1", reason: "damaged", quantity: -1, fromState: "available", toState: "damaged", note: "Cracked tank out of the box.", status: "pending", createdBy: "e_mgr_store", createdAt: daysAgo(0, 11) },
    { id: "adj_2", number: "ADJ-0090", locationId: "wh_smoke", variantId: "p_gummies_v1", reason: "expired", quantity: -4, note: "Best-by date passed.", status: "approved", createdBy: "e_assoc_wh", createdAt: daysAgo(4) },
    { id: "adj_3", number: "ADJ-0089", locationId: "st_poke", variantId: "p_pack_v1", reason: "found", quantity: 6, note: "Found behind counter display.", status: "approved", createdBy: "e_assoc_poke", createdAt: daysAgo(7) },
];

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

const productName = (variantId: string) => {
    const v = variants.find((x) => x.id === variantId)!;
    const p = products.find((x) => x.id === v.productId)!;
    return `${p.name} — ${v.name}`;
};
const buOf = (locationId: string) => locations.find((l) => l.id === locationId)!.businessUnitId;

export const approvals: Approval[] = [];

// Reorder suggestions: warehouse stock at/below reorder point, or projected to run out before the vendor can deliver.
variants.forEach((v) => {
    const product = products.find((p) => p.id === v.productId)!;
    const warehouse = locations.find((l) => l.businessUnitId === product.businessUnitId && l.type === "warehouse");
    if (!warehouse) return;
    const stock = stockOf(v.id, warehouse.id);
    const daysLeft = v.dailySales > 0 ? stock / v.dailySales : Infinity;
    if (stock <= v.reorderPoint || daysLeft <= v.leadTimeDays) {
        const runOut = new Date(Date.now() + Math.max(0, daysLeft) * DAY).toISOString();
        approvals.push({
            id: `ap_ro_${v.id}`,
            type: "reorder",
            title: `Reorder ${productName(v.id)}`,
            summary: `${stock} on hand at ${warehouse.name}; reorder point is ${v.reorderPoint}.`,
            businessUnitId: product.businessUnitId,
            locationId: warehouse.id,
            status: "pending",
            payload: { type: "reorder", variantId: v.id, vendorId: v.vendorId, warehouseId: warehouse.id, currentStock: stock, dailySales: v.dailySales, runOutDate: runOut, suggestedQty: v.restockQty },
            createdAt: daysAgo(randInt(0, 2), 5),
        });
    }
});

approvals.push(
    {
        id: "ap_count_1", type: "count_variance", title: "Cycle count CC-0312 has variances", summary: "2 of 3 lines differ from system stock at Alcosta Shop.",
        businessUnitId: "bu_smoke", locationId: "st_alcosta", status: "pending", payload: { type: "count_variance", countId: "ct_1" }, createdAt: daysAgo(0, 8),
    },
    {
        id: "ap_adj_1", type: "adjustment", title: "Adjustment ADJ-0091 · Damaged", summary: `${productName("p_nord_v1")}: move 1 unit to Damaged at Dublin Smoke Shop.`,
        businessUnitId: "bu_smoke", locationId: "st_dublin", status: "pending", payload: { type: "adjustment", adjustmentId: "adj_1" }, createdAt: daysAgo(0, 11),
    },
    {
        id: "ap_unexp_1", type: "unexpected_item", title: "Unexpected item on PO-1038", summary: "Scanned 860001234567 — not on the PO. 8 units added as a draft product.",
        businessUnitId: "bu_smoke", locationId: "wh_smoke", status: "pending",
        payload: { type: "unexpected_item", poId: "po_3", barcode: "860001234567", productId: null, units: 8, description: "Backwoods Cigars 5 Pack — Dark Stout" }, createdAt: daysAgo(5, 11),
    },
    {
        id: "ap_partial_1", type: "partial_po", title: "PO-1038 received short", summary: "Russian Cream: 16 of 24 packs received.",
        businessUnitId: "bu_smoke", locationId: "wh_smoke", status: "pending", payload: { type: "partial_po", poId: "po_3" }, createdAt: daysAgo(5, 11),
    },
    ...mismatches
        .filter((m) => m.status === "open")
        .map<Approval>((m) => ({
            id: `ap_mm_${m.id}`, type: "mismatch", title: `Stock mismatch · ${productName(m.variantId)}`,
            summary: `${connections.find((c) => c.id === m.connectionId)!.name}: expected ${m.expected}, channel reports ${m.reported}.`,
            businessUnitId: m.locationId ? buOf(m.locationId) : "bu_smoke", locationId: m.locationId, status: "pending", payload: { type: "mismatch", mismatchId: m.id }, createdAt: m.detectedAt,
        })),
    {
        id: "ap_dup_1", type: "import_duplicate", title: "Possible duplicate from import", summary: "“Geek Bar Pulse X Blue Razz” looks like the existing Geek Bar Pulse X — Blue Razz Ice.",
        businessUnitId: "bu_smoke", locationId: null, status: "pending",
        payload: {
            type: "import_duplicate", matchProductId: "p_geek", matchVariantId: "p_geek_v1", reason: "Same brand and product line; variant name 87% similar.",
            importRow: { brand: "Geek Bar", productLine: "Pulse X", productType: "Disposable Vape", variant: "Blue Razz", sku: "GB-PX-BR", upc: "850012345678", price: 24.99, cost: 11.5 },
        },
        createdAt: daysAgo(1, 16),
    },
    {
        id: "ap_dup_2", type: "import_duplicate", title: "Possible duplicate from import", summary: "“Geek Bar Pulse X Strawberry Banana” matches the Geek Bar Pulse X product — new flavor?",
        businessUnitId: "bu_smoke", locationId: null, status: "pending",
        payload: {
            type: "import_duplicate", matchProductId: "p_geek", matchVariantId: null, reason: "Same brand and product line; flavor not found among variants.",
            importRow: { brand: "Geek Bar", productLine: "Pulse X", productType: "Disposable Vape", variant: "Strawberry Banana", sku: "GB-PX-SB", upc: "850012345692", price: 24.99, cost: 11.5 },
        },
        createdAt: daysAgo(1, 16),
    },
    {
        id: "ap_sync_1", type: "sync_failure", title: "Push blocked · Shopify · Smoke Shops Online", summary: "4 Geek Bar Pulse X variants carry the nicotine/vape flag, which this channel prohibits.",
        businessUnitId: "bu_smoke", locationId: "st_alcosta", status: "pending",
        payload: { type: "sync_failure", connectionId: "cn_sh_smoke", variantIds: ["p_geek_v1", "p_geek_v2", "p_geek_v3", "p_geek_v4"], reason: "Compliance: nicotine, vape not accepted by this channel.", kind: "blocked" },
        createdAt: daysAgo(2, 13),
    },
    {
        id: "ap_sync_2", type: "sync_failure", title: "Sync failed · WooCommerce · Skates Online", summary: "Stock pull failed: authentication expired (401).",
        businessUnitId: "bu_skate", locationId: "st_skate", status: "pending",
        payload: { type: "sync_failure", connectionId: "cn_woo_skate", variantIds: [], reason: "Authentication expired (401). Re-connect the store or refresh the API key.", kind: "failed" },
        createdAt: daysAgo(1, 14),
    },
    {
        id: "ap_hist_1", type: "adjustment", title: "Adjustment ADJ-0090 · Expired", summary: `${productName("p_gummies_v1")}: remove 4 units at Smoke Shops Warehouse.`,
        businessUnitId: "bu_smoke", locationId: "wh_smoke", status: "approved", payload: { type: "adjustment", adjustmentId: "adj_2" }, createdAt: daysAgo(4),
        decidedBy: "e_mgr_wh", decidedAt: daysAgo(4, 15), decision: "Approved",
    },
    {
        id: "ap_hist_2", type: "mismatch", title: `Stock mismatch · ${productName("p_clipper_v1")}`, summary: "Quickvee · Alcosta Shop: expected 40, channel reports 39.",
        businessUnitId: "bu_smoke", locationId: "st_alcosta", status: "resolved", payload: { type: "mismatch", mismatchId: "mm_4" }, createdAt: daysAgo(3, 6),
        decidedBy: "e_mgr_store", decidedAt: daysAgo(3, 12), decision: "Marked handled", decisionNote: "Sold one before sync, register caught up.",
    },
);

/* ------------------------------------------------------------------ */
/* Sales history (for dashboards and the Executive report)             */
/* ------------------------------------------------------------------ */

export interface DailySales {
    date: string; // yyyy-mm-dd
    locationId: string;
    units: number;
    revenue: number;
    cost: number;
}

export const salesHistory: DailySales[] = [];
{
    const stores = locations.filter((l) => l.type === "store");
    for (let d = 179; d >= 0; d--) {
        const date = new Date(Date.now() - d * DAY);
        const dateKey = date.toISOString().slice(0, 10);
        const weekend = date.getDay() === 5 || date.getDay() === 6 ? 1.35 : 1;
        stores.forEach((store) => {
            const storeVariants = variants.filter((v) => products.find((p) => p.id === v.productId)!.businessUnitId === store.businessUnitId);
            const storeCount = stores.filter((s) => s.businessUnitId === store.businessUnitId).length;
            let units = 0;
            let revenue = 0;
            let cost = 0;
            storeVariants.forEach((v) => {
                const qty = Math.round(((v.dailySales / storeCount) * weekend * (0.6 + rand() * 0.8) + (rand() < 0.3 ? 1 : 0)) * (1 + (179 - d) / 900));
                units += qty;
                revenue += qty * v.price;
                cost += qty * v.cost;
            });
            salesHistory.push({ date: dateKey, locationId: store.id, units, revenue: +revenue.toFixed(2), cost: +cost.toFixed(2) });
        });
    }
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

export const activity: ActivityEntry[] = [
    { id: "ac_1", kind: "store_request", message: "SR-2206 picked (2 lines)", by: "e_assoc_wh", at: daysAgo(0, 9), locationId: "wh_smoke" },
    { id: "ac_2", kind: "count", message: "Cycle count CC-0312 submitted for approval", by: "e_assoc_store", at: daysAgo(0, 8), locationId: "st_alcosta" },
    { id: "ac_3", kind: "receiving", message: "Started receiving PO-1041", by: "e_assoc_wh", at: daysAgo(0, 9), locationId: "wh_smoke" },
    { id: "ac_4", kind: "channel", message: "Quickvee · Alcosta Shop pulled sales & stock — 1 mismatch", by: "system", at: daysAgo(0, 6), locationId: "st_alcosta" },
    { id: "ac_5", kind: "adjustment", message: "ADJ-0090 approved: −4 Hemp Wellness CBD Gummies 25mg — Mixed Berry (expired)", by: "e_mgr_wh", at: daysAgo(4, 15), locationId: "wh_smoke", variantId: "p_gummies_v1", quantity: -4, reason: "expired" },
    { id: "ac_6", kind: "store_request", message: "SR-2205 shipped — 22 units now In Transit to Alcosta Shop", by: "e_assoc_wh", at: daysAgo(1, 14), locationId: "wh_smoke" },
    { id: "ac_7", kind: "purchase_order", message: "PO-1038 marked Partial — sent to Approvals", by: "e_assoc_wh", at: daysAgo(5, 11), locationId: "wh_smoke" },
    { id: "ac_8", kind: "catalog", message: "Imported 14 products from quickvee-export.csv (2 sent to Approvals)", by: "e_mgr_store", at: daysAgo(1, 16), locationId: null },
    { id: "ac_9", kind: "count", message: "Cycle count CC-0305 approved — Smoke Shops Warehouse corrected by −2", by: "e_mgr_wh", at: daysAgo(8, 14), locationId: "wh_smoke", quantity: -2, reason: "cycle count" },
    { id: "ac_10", kind: "adjustment", message: "ADJ-0089 approved: +6 Pokémon TCG Booster Pack — Surging Sparks (found)", by: "e_exec", at: daysAgo(7, 12), locationId: "st_poke", variantId: "p_pack_v1", quantity: 6, reason: "found" },
];
