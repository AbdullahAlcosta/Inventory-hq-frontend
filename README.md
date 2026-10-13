# Inventory HQ — Frontend (static MVP)

Back-office system for products, stock, prices, purchasing, store replenishment and sales-channel sync
across Alcosta's businesses (Smoke Shops, Apparel, Skates, Pokémon). Built with **Next.js (App Router)**,
**React 19**, **TypeScript**, **Tailwind CSS v4** and **Untitled UI React**.

> **No backend yet.** Every screen runs on demo data in the browser. Business rules from the PRD
> (approvals, stock states, receiving, allocation, compliance checks…) are implemented in a client-side
> store so the flows can be clicked through end to end. When the API is ready, the store actions are
> swapped for API calls — see [Connecting the backend](#connecting-the-backend).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

Sign in by picking a demo account. Each one shows the app through a different role and assignment:

| Account | Role | Sees |
| --- | --- | --- |
| Bilal Ahmed | Executive | Whole company, all Approvals, Setup, Executive report |
| Sara Khan | Store Manager | The three smoke shop stores |
| Daniel Ortiz | Warehouse Manager | Smoke Shops Warehouse (receiving, purchasing) |
| Priya Patel | Store Associate | Alcosta Shop (request stock, confirm deliveries, counts) |
| Marcus Lee | Warehouse Associate | Warehouse floor (receive, pick, pack, ship) |
| Lena Park | Executive, second company | Only Bayline data — shows company separation |

Use **Switch demo user** and **Reset demo data** in the account menu at the bottom of the sidebar.
Data changes are kept in `localStorage` until reset.

Barcode scanning: every scan field works with a USB/Bluetooth scanner (they type the code and press Enter).
Typing a code by hand is the fallback, and **Simulate scan** lists demo barcodes so flows can be shown without hardware.

## What's in the MVP

| Area (PRD) | Screens |
| --- | --- |
| Setup §5.1 | Locations (Company → Business Units → Stores/Warehouses), Employees (role + assignment), Companies |
| Catalog §5.2 | Products & variants, naming guidance (Appendix A), live duplicate check, units of measure, barcodes, compliance flags, bulk import with duplicate review |
| Sales channels §5.3 | Connections (Quickvee per store, Shopify/WooCommerce per BU), sync speed, safety buffer, blocked flags, push with compliance check, stock allocation (Shared / Dedicated / Hybrid) |
| Reconciliation §5.4 | Expected vs reported dashboard, pull now, upload export → mismatch report |
| Stock §5.5 | Inventory by state, product lookup across locations, opening & cycle counts (scan), adjustments with reasons, activity log |
| Purchasing §5.6 | Vendors, purchase orders and lifecycle, scan-based receiving (case → units, unexpected items, partial POs) |
| Replenishment §5.7 | Store requests: Requested → Picked → Packed → Shipped (In Transit) → Confirmed |
| Reordering §5.8 | Reorder points, sales speed, run-out projection, suggestions → Approvals → POs (one per vendor) |
| Approvals §5.9 | One list for every decision, with a review panel per type and bulk approve for reorders |
| Executive report §5.10 | Monthly sales, margins, inventory value by BU and location; CSV and print/PDF download |

## Project structure

```
src/
├── app/
│   ├── login/                 Mock sign-in (demo accounts)
│   └── (app)/                 Signed-in area; layout = AppShell (sidebar, header, access guard)
│       ├── dashboard/  approvals/  catalog/  stock/  purchasing/
│       ├── replenishment/  channels/  reports/  setup/
├── components/
│   ├── app/                   Inventory HQ components (shell, page header, scan input, status badge…)
│   ├── base/ application/     Untitled UI components
├── hooks/use-session.ts       Current user + scope (what they can see, from role + assignment)
├── lib/
│   ├── types.ts               Domain model (mirrors the PRD entities)
│   ├── selectors.ts           Pure business logic: stock, channel allocation, duplicates, barcode lookup, access
│   └── format.ts
├── mock/seed.ts               Deterministic demo data
└── store/app-store.ts         Zustand store; every action = a future API endpoint
```

## Connecting the backend

1. Keep `src/lib/types.ts` as the API contract (or generate it from the API schema).
2. Replace the seed with fetches (e.g. TanStack Query) per area; keep `selectors.ts` for client-side derivations
   that don't need the server.
3. Each action in `src/store/app-store.ts` maps to one endpoint (e.g. `receiveScan` → `POST /purchase-orders/:id/scans`,
   `decideApproval` → `POST /approvals/:id/decision`). The UI only calls these actions, so screens don't change.
4. Replace the mock login with real auth; `useScope()` should then read role and assignment from the session.

## Open items from the PRD (reflected as assumptions)

- Quickvee API access, channel retry behavior and SLAs are not defined — the UI shows failures in Approvals with Retry.
- Every count variance goes to Approvals (no threshold yet).
- Executive report contents/format are provisional (CSV + printable page).
- Three smoke shop locations are assumed; Pokémon singles are not modelled separately.
