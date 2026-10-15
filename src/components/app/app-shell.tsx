"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu01, SearchLg, XClose } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { useHydrated, useScope } from "@/hooks/use-session";
import { canDecideApproval } from "@/lib/selectors";
import { initials } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { isPathAllowed, requiredLocation } from "./nav-config";
import { RequireLocation } from "./require-location";
import { Sidebar } from "./sidebar";
import { OnboardingTour } from "./onboarding-tour";
import { Toaster } from "./toast";
import { useAutoReorderOnLoad } from "./purchasing/auto-reorder-panel";

export const AppShell = ({ children }: { children: ReactNode }) => {
    const hydrated = useHydrated();
    const scope = useScope();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [query, setQuery] = useState("");

    const approvals = useAppStore((s) => s.approvals);
    const storeRequests = useAppStore((s) => s.storeRequests);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    useAutoReorderOnLoad();

    useEffect(() => {
        if (hydrated && !scope) router.replace("/login");
    }, [hydrated, scope, router]);

    const badges = useMemo<Record<string, number>>(() => {
        if (!scope) return {} as Record<string, number>;
        return {
            approvals: approvals.filter((a) => a.status === "pending" && canDecideApproval(scope.user, a, scope) && scope.activeBusinessUnitIds.includes(a.businessUnitId)).length,
            // Requests waiting on this person's side of the hand-off: fulfilling (as the source) or confirming (as the store).
            requests: storeRequests.filter(
                (r) =>
                    (scope.activeLocationIds.includes(r.sourceId) && ["requested", "picked", "packed"].includes(r.status)) ||
                    (scope.activeLocationIds.includes(r.storeId) && r.status === "shipped"),
            ).length,
            receiving: purchaseOrders.filter((p) => scope.activeLocationIds.includes(p.warehouseId) && (p.status === "sent" || p.status === "receiving")).length,
        };
    }, [scope, approvals, storeRequests, purchaseOrders]);

    if (!hydrated || !scope) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-secondary">
                <LoadingIndicator type="line-spinner" size="md" />
            </div>
        );
    }

    const allowed = isPathAllowed(pathname, scope);
    const needsLocation = requiredLocation(pathname);

    return (
        <div className="flex min-h-dvh bg-secondary">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
                <Sidebar scope={scope} badges={badges} />
            </aside>

            {/* Mobile sidebar */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
                        <Sidebar scope={scope} badges={badges} onNavigate={() => setMobileOpen(false)} />
                    </aside>
                    <AriaButton aria-label="Close menu" onPress={() => setMobileOpen(false)} className="absolute top-4 right-4 rounded-lg bg-white/10 p-2 text-white">
                        <XClose className="size-5" />
                    </AriaButton>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
                <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-secondary bg-secondary/90 px-4 backdrop-blur md:px-8">
                    <AriaButton aria-label="Open menu" onPress={() => setMobileOpen(true)} className="rounded-lg p-2 text-fg-secondary hover:bg-primary_hover lg:hidden">
                        <Menu01 className="size-5" />
                    </AriaButton>
                    <form
                        className="relative w-full max-w-md"
                        onSubmit={(e) => {
                            e.preventDefault();
                            router.push(`/catalog/products?q=${encodeURIComponent(query)}`);
                        }}
                    >
                        <SearchLg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-quaternary" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search products, SKUs or scan a barcode"
                            className="w-full rounded-lg bg-gray-100 py-2 pr-3 pl-9 text-sm text-primary outline-hidden placeholder:text-placeholder focus:bg-primary focus:ring-2 focus:ring-brand"
                        />
                    </form>
                    <div className="ml-auto flex items-center gap-3">
                        <span className="hidden text-sm text-tertiary md:block">{scope.user.name}</span>
                        <span className="flex size-9 items-center justify-center rounded-full bg-purple-600 text-sm font-semibold text-white">{initials(scope.user.name)}</span>
                    </div>
                </header>

                <main className={cx("flex-1 px-4 py-6 md:px-8 md:py-8")}>
                    {allowed ? (
                        needsLocation ? (
                            <RequireLocation scope={scope} requirement={needsLocation}>
                                {children}
                            </RequireLocation>
                        ) : (
                            children
                        )
                    ) : (
                        <div className="mx-auto mt-20 max-w-md text-center">
                            <h1 className="text-display-xs font-semibold text-primary">No access</h1>
                            <p className="mt-2 text-md text-tertiary">Your role and assignment don’t include this page. Ask an Executive if you need access.</p>
                        </div>
                    )}
                </main>
            </div>
            <Toaster />
            <OnboardingTour scope={scope} />
        </div>
    );
};
