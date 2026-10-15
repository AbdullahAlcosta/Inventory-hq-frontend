"use client";

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, XClose } from "@untitledui/icons";
import { create } from "zustand";
import { Button } from "@/components/base/buttons/button";
import type { Scope } from "@/hooks/use-session";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { allNavItems } from "./nav-config";

/* ------------------------------------------------------------------ */
/* Open/close state (not persisted — "seen" is kept in the app store)  */
/* ------------------------------------------------------------------ */

export const useTour = create<{ open: boolean; step: number; start: () => void; stop: () => void; go: (step: number) => void }>((set) => ({
    open: false,
    step: 0,
    start: () => set({ open: true, step: 0 }),
    stop: () => set({ open: false, step: 0 }),
    go: (step) => set({ step }),
}));

/* ------------------------------------------------------------------ */
/* Steps per role                                                      */
/* ------------------------------------------------------------------ */

interface TourStep {
    /** `data-tour` value of the element to highlight. Omit for a centered card. */
    target?: string;
    title: string;
    body: ReactNode;
    cta?: { label: string; href: string };
}

const roleName = (scope: Scope) =>
    scope.isExecutive ? "Executive" : `${scope.isWarehouseLevel ? "Warehouse" : "Store"} ${scope.isManager ? "Manager" : "Associate"}`;

const buildSteps = (scope: Scope, locationName: string | null): TourStep[] => {
    const firstName = scope.user.name.split(" ")[0];
    const store = scope.isStoreLevel;
    const warehouse = scope.isWarehouseLevel;
    const nav = (href: string) => `nav:${href}`;

    const steps: (TourStep & { when?: boolean })[] = [
        {
            title: `Welcome, ${firstName}`,
            body: (
                <>
                    You’re signed in as <b>{roleName(scope)}</b>
                    {locationName ? (
                        <>
                            {" "}
                            at <b>{locationName}</b>
                        </>
                    ) : null}
                    . This quick tour shows where your work lives in Inventory HQ. It takes about a minute — you can skip it and replay it any time from your account menu.
                </>
            ),
        },
        {
            target: "location",
            title: scope.locationIds.length > 1 ? "Pick what you’re looking at" : "Your location",
            body:
                scope.locationIds.length > 1 ? (
                    <>
                        Choose <b>All locations</b> for an overview, a whole business unit, or one store or warehouse. Inventory, Stock Control, Store Requests and Receiving
                        always work on one location at a time.
                    </>
                ) : (
                    <>Everything you see is for {locationName ?? "your assigned location"}. Your access comes from your role and assignment.</>
                ),
        },
        {
            target: nav("/dashboard"),
            title: "Dashboard",
            body: scope.isExecutive
                ? "Company-wide sales, stock value, low stock and what needs a decision. Pick a single store or warehouse to see its own dashboard."
                : warehouse
                  ? "Your warehouse at a glance: POs to receive, store requests to pick, pack and ship, and items that need reordering."
                  : "Your store at a glance: stock, deliveries on the way, and the requests you’ve made.",
        },
        {
            target: nav("/approvals"),
            when: scope.canManage,
            title: "Approvals",
            body: scope.isExecutive
                ? "Everything that needs a person’s decision lands here — reorders, count variances, receiving issues, channel mismatches, import duplicates and store transfers. Every decision is recorded with who and when."
                : warehouse
                  ? "Decide reorder suggestions, receiving exceptions, warehouse counts and adjustments — and approve or reject store-to-store transfers."
                  : "Approve count variances, adjustments and short deliveries for your stores.",
        },
        {
            target: nav("/stock/inventory"),
            title: "Inventory",
            body: "Stock at one location by state — Available, In Transit, Returns and Damaged — with low-stock flags and days of cover. Only Available stock can be sold.",
        },
        {
            target: nav("/stock/control"),
            title: "Stock Control",
            body: "Counts and adjustments in one place. Scan to count, record damaged, expired, lost or found stock, and send every change for approval.",
        },
        {
            target: nav("/replenishment/requests"),
            title: "Store Requests",
            body: warehouse
                ? "Requests from your stores. Pick, pack and ship them — shipped stock moves to In Transit until the store confirms."
                : scope.isExecutive
                  ? "Stores request stock from the warehouse or from another store. Store-to-store transfers need warehouse approval first."
                  : "Ask the warehouse — or another store — for stock, then confirm deliveries by scanning when they arrive. Store-to-store transfers need warehouse approval.",
        },
        {
            target: nav("/purchasing/receiving"),
            when: scope.canSeePurchasing,
            title: "Receiving",
            body: "Scan purchase orders in at the warehouse. A case barcode adds the whole case; items not on the PO are added and sent to Approvals — receiving is never blocked.",
        },
        {
            target: nav("/catalog/products"),
            title: "Products",
            body: scope.canManageCatalog
                ? "Search or scan any item to see its stock at every store and warehouse. You also create products and variants here — with naming guidance and a live duplicate check — or bulk import a file."
                : store
                  ? "Search or scan any item to see how many every store and the warehouse have — and request it straight from there."
                  : "Search or scan any item to see its details and how many are Available at every store and warehouse.",
        },
        {
            target: nav("/purchasing/orders"),
            when: scope.canManagePurchasing,
            title: "Purchasing",
            body: "Vendors, purchase orders and reorder settings. Reorders are only ever suggested — a PO is created when someone approves it.",
        },
        {
            target: nav("/channels/connections"),
            when: scope.canManageChannels,
            title: "Sales channels",
            body: scope.allocationEnabled
                ? "Quickvee, Shopify and WooCommerce: sync speed, safety buffers, pushing products and reconciling what channels report. How each product's stock is split between channels lives under Catalog → Allocation."
                : "Quickvee, Shopify and WooCommerce: sync speed, safety buffers, pushing products and reconciling what channels report.",
        },
        {
            target: nav("/reports/executive"),
            when: scope.isExecutive,
            title: "Company",
            body: "The monthly Executive report, Locations and Employees — set up business units, stores and warehouses, and give each person a role and assignment — plus company Settings to switch optional features like channel allocation on or off.",
        },
        {
            target: "account",
            title: "Your account",
            body: "Replay this tour, switch to another demo user, or reset the demo data from here.",
        },
        {
            title: "You’re all set",
            body: scope.isExecutive
                ? "A good first stop: see what’s waiting for a decision in Approvals."
                : warehouse
                  ? "Try receiving a purchase order by scanning — use “Simulate scan” if you don’t have a scanner."
                  : scope.isManager
                    ? "Start with Approvals for your stores, or switch to one store to work its requests."
                    : "Try requesting stock for your store — from the warehouse or from another store.",
            cta: scope.isExecutive
                ? { label: "Open Approvals", href: "/approvals" }
                : warehouse
                  ? { label: "Go to Receiving", href: "/purchasing/receiving" }
                  : scope.isManager
                    ? { label: "Open Approvals", href: "/approvals" }
                    : { label: "Request stock", href: "/replenishment/requests/new" },
        },
    ];

    const navHrefs = new Set(allNavItems.filter((i) => i.visible(scope)).map((i) => i.href));
    return steps.filter((s) => s.when !== false && (!s.target?.startsWith("nav:") || navHrefs.has(s.target.slice(4))));
};

/* ------------------------------------------------------------------ */
/* Tour UI                                                             */
/* ------------------------------------------------------------------ */

const CARD_WIDTH = 360;
/** Stable empty list so the store selector doesn't return a new array every render. */
const NONE: string[] = [];
const GAP = 14;

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

/** Shows the tour automatically on a user's first visit; replay with `useTour.getState().start()`. */
export const OnboardingTour = ({ scope }: { scope: Scope }) => {
    const router = useRouter();
    const { open, step, start, stop, go } = useTour();
    const completed = useAppStore((s) => s.session.toursCompleted ?? NONE);
    const completeTour = useAppStore((s) => s.completeTour);
    const locations = useAppStore((s) => s.locations);

    const lockedLocation = scope.locationIds.length === 1 ? (locations.find((l) => l.id === scope.locationIds[0])?.name ?? null) : null;
    const steps = useMemo(() => buildSteps(scope, lockedLocation), [scope, lockedLocation]);
    const current = steps[Math.min(step, steps.length - 1)];

    // First visit for this user → start automatically.
    useEffect(() => {
        if (!completed.includes(scope.user.id)) start();
        // Only when the signed-in user changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope.user.id]);

    const finish = useCallback(() => {
        completeTour(scope.user.id);
        stop();
    }, [completeTour, scope.user.id, stop]);

    // Measure the highlighted element (desktop only — the sidebar is hidden on small screens).
    const [rect, setRect] = useState<Rect | null>(null);
    useLayoutEffect(() => {
        if (!open || !current?.target) return setRect(null);
        const measure = () => {
            const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
            if (!el || el.offsetParent === null) return setRect(null);
            el.scrollIntoView({ block: "nearest" });
            const r = el.getBoundingClientRect();
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [open, current]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") finish();
            if (e.key === "ArrowRight" && step < steps.length - 1) go(step + 1);
            if (e.key === "ArrowLeft" && step > 0) go(step - 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, step, steps.length, go, finish]);

    if (!open || !current) return null;

    const last = step === steps.length - 1;
    const pad = 6;

    // Card position: to the right of sidebar targets, otherwise below; centered when there's no target.
    let cardStyle: React.CSSProperties;
    if (rect) {
        const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
        const top = Math.max(16, Math.min(rect.top - 8, viewportH - 300));
        cardStyle = { top, left: rect.left + rect.width + GAP + pad, width: CARD_WIDTH };
    } else {
        cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(440px, calc(100vw - 32px))" };
    }

    return (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Product tour">
            {rect ? (
                <div
                    className="pointer-events-none absolute rounded-xl ring-2 ring-orange-400 transition-all duration-200 ease-out"
                    style={{
                        top: rect.top - pad,
                        left: rect.left - pad,
                        width: rect.width + pad * 2,
                        height: rect.height + pad * 2,
                        boxShadow: "0 0 0 9999px rgb(10 10 10 / 0.6)",
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-black/60" />
            )}

            <div className="absolute rounded-2xl bg-primary p-5 shadow-xl ring-1 ring-secondary duration-200 animate-in fade-in" style={cardStyle}>
                <button onClick={finish} className="absolute top-3 right-3 rounded-md p-1 text-fg-quaternary hover:bg-primary_hover hover:text-fg-secondary" aria-label="Skip tour">
                    <XClose className="size-4" />
                </button>
                <p className="text-xs font-semibold tracking-wide text-orange-600 uppercase">
                    {step === 0 ? "Quick tour" : `Step ${step} of ${steps.length - 1}`}
                </p>
                <h2 className="mt-1 pr-6 text-lg font-semibold text-primary">{current.title}</h2>
                <p className="mt-1.5 text-sm text-secondary">{current.body}</p>

                <div className="mt-4 flex items-center gap-1" aria-hidden="true">
                    {steps.map((_, i) => (
                        <span key={i} className={cx("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-gray-900" : "w-1.5 bg-gray-200")} />
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                    {step === 0 ? (
                        <Button color="link-gray" size="sm" onPress={finish}>
                            Skip tour
                        </Button>
                    ) : (
                        <Button color="secondary" size="sm" onPress={() => go(step - 1)}>
                            Back
                        </Button>
                    )}
                    <div className="flex gap-2">
                        {last && current.cta ? (
                            <>
                                <Button color="secondary" size="sm" onPress={finish}>
                                    Done
                                </Button>
                                <Button
                                    size="sm"
                                    iconTrailing={ArrowRight}
                                    onPress={() => {
                                        finish();
                                        router.push(current.cta!.href);
                                    }}
                                >
                                    {current.cta.label}
                                </Button>
                            </>
                        ) : (
                            <Button size="sm" iconTrailing={step === 0 ? ArrowRight : undefined} onPress={() => go(step + 1)}>
                                {step === 0 ? "Start tour" : "Next"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
