"use client";

import { type ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building07, Check, ChevronSelectorVertical, Compass03, LogOut01, RefreshCw01, ShoppingBag01, SwitchHorizontal01 } from "@untitledui/icons";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import type { Scope } from "@/hooks/use-session";
import { initials } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { BusinessUnitAvatar } from "./bu-avatar";
import { Logo } from "./logo";
import { navSections } from "./nav-config";
import { useTour } from "./onboarding-tour";

const roleLabel = (scope: Scope) => {
    const role = scope.user.role[0].toUpperCase() + scope.user.role.slice(1);
    if (scope.isExecutive) return role;
    return `${scope.isWarehouseLevel ? "Warehouse" : "Store"} ${role}`;
};

const popoverClass =
    "w-(--trigger-width) min-w-64 rounded-xl bg-primary p-1.5 shadow-lg ring-1 ring-secondary outline-hidden entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out";

export const LocationIcon = ({ type, className }: { type: "store" | "warehouse"; className?: string }) =>
    type === "store" ? <ShoppingBag01 className={className} aria-hidden="true" /> : <Building07 className={className} aria-hidden="true" />;

/**
 * Sidebar switchers, stacked: a Brand picker ("All brands" or one brand) and, below it, a Location picker
 * limited to the picked brand. Values map to the session context: "all" | "bu:<id>" | "loc:<id>".
 * People assigned to a single location see both as static.
 */
export const LocationSwitcher = ({ scope }: { scope: Scope }) => {
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const setContext = useAppStore((s) => s.setContext);
    const company = useAppStore((s) => s.companies.find((c) => c.id === scope.companyId));

    const myLocations = locations.filter((l) => scope.locationIds.includes(l.id));
    const sortLocs = (ls: typeof myLocations) => [...ls].sort((a, c) => a.type.localeCompare(c.type) * -1 || a.name.localeCompare(c.name));
    const brands = businessUnits.filter((b) => scope.businessUnitIds.includes(b.id) && myLocations.some((l) => l.businessUnitId === b.id));
    const locked = myLocations.length <= 1;

    const active = scope.activeLocation;
    const selectedBrand = active
        ? businessUnits.find((b) => b.id === active.businessUnitId)
        : scope.context.startsWith("bu:")
          ? businessUnits.find((b) => `bu:${b.id}` === scope.context)
          : brands.length === 1
            ? brands[0]
            : undefined;
    const allLabel = scope.isExecutive ? "All brands" : "All my brands";

    const brandTrigger = (
        <>
            <BusinessUnitAvatar unit={selectedBrand ?? null} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-gray-400">Brand</span>
                <span className="block truncate text-md font-semibold text-white">{selectedBrand ? selectedBrand.name : allLabel}</span>
            </span>
        </>
    );
    const allInLabel = selectedBrand ? `All locations in ${selectedBrand.name}` : scope.isExecutive ? "All locations" : "All my locations";
    const locationTrigger = (
        <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                {active ? <LocationIcon type={active.type} className="size-5" /> : <Building07 className="size-5" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-gray-400">{active ? (active.type === "store" ? "Store" : "Warehouse") : "Location"}</span>
                <span className="block truncate text-md font-semibold text-white">{active ? active.name : allInLabel}</span>
            </span>
        </>
    );

    const boxClass = "flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/15";
    const buttonClass =
        "flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left ring-1 ring-white/15 outline-hidden transition duration-100 ease-linear hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40";

    if (locked) {
        return (
            <div className="flex flex-col gap-2">
                <div className={boxClass}>{brandTrigger}</div>
                <div className={boxClass}>{locationTrigger}</div>
            </div>
        );
    }

    const locIcon = (type: "store" | "warehouse") => (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-tertiary">
            <LocationIcon type={type} className="size-3.5" />
        </span>
    );
    const brandLocs = (id: string) => sortLocs(myLocations.filter((l) => l.businessUnitId === id));
    const locationRows = (ls: typeof myLocations, pick: (c: string) => void) => {
        const stores = ls.filter((l) => l.type === "store");
        const warehouses = ls.filter((l) => l.type === "warehouse");
        return [
            { title: "Stores", items: stores },
            { title: "Warehouses", items: warehouses },
        ]
            .filter((g) => g.items.length)
            .map((g) => (
                <div key={g.title} className="mt-1">
                    <p className="px-2.5 pt-1.5 pb-0.5 text-xs font-semibold text-quaternary uppercase">{g.title}</p>
                    {g.items.map((l) => (
                        <SwitcherRow key={l.id} selected={scope.context === `loc:${l.id}`} onPress={() => pick(`loc:${l.id}`)} label={l.name} hint={l.code} icon={locIcon(l.type)} />
                    ))}
                </div>
            ));
    };

    return (
        <div className="flex flex-col gap-2">
            {brands.length > 1 ? (
                <AriaDialogTrigger>
                    <AriaButton className={buttonClass} aria-label="Choose brand">
                        {brandTrigger}
                        <ChevronSelectorVertical className="size-4 shrink-0 text-gray-400" />
                    </AriaButton>
                    <AriaPopover placement="bottom start" offset={6} className={cx(popoverClass, "max-h-[70vh] overflow-y-auto")}>
                        <AriaDialog className="outline-hidden" aria-label="Choose brand">
                            {({ close }) => (
                                <div className="flex flex-col">
                                    <SwitcherRow
                                        selected={!selectedBrand}
                                        onPress={() => {
                                            setContext("all");
                                            close();
                                        }}
                                        label={allLabel}
                                        hint={scope.isExecutive ? `${company?.name ?? "Company"} overview` : undefined}
                                        icon={<BusinessUnitAvatar unit={null} size="sm" />}
                                        strong
                                    />
                                    <div className="my-1 h-px bg-border-secondary" />
                                    {brands.map((b) => (
                                        <SwitcherRow
                                            key={b.id}
                                            selected={selectedBrand?.id === b.id}
                                            onPress={() => {
                                                setContext(`bu:${b.id}`);
                                                close();
                                            }}
                                            label={b.name}
                                            hint={pluralLoc(brandLocs(b.id).length)}
                                            icon={<BusinessUnitAvatar unit={b} size="sm" />}
                                        />
                                    ))}
                                </div>
                            )}
                        </AriaDialog>
                    </AriaPopover>
                </AriaDialogTrigger>
            ) : (
                <div className={boxClass}>{brandTrigger}</div>
            )}

            <AriaDialogTrigger>
                <AriaButton className={buttonClass} aria-label="Choose location">
                    {locationTrigger}
                    <ChevronSelectorVertical className="size-4 shrink-0 text-gray-400" />
                </AriaButton>
                <AriaPopover placement="bottom start" offset={6} className={cx(popoverClass, "max-h-[70vh] overflow-y-auto")}>
                    <AriaDialog className="outline-hidden" aria-label="Choose location">
                        {({ close }) => {
                            const pick = (context: string) => {
                                setContext(context);
                                close();
                            };
                            return (
                                <div className="flex flex-col">
                                    <SwitcherRow
                                        selected={!active}
                                        onPress={() => pick(selectedBrand && brands.length > 1 ? `bu:${selectedBrand.id}` : "all")}
                                        label={allInLabel}
                                        icon={<BusinessUnitAvatar unit={selectedBrand ?? null} size="sm" />}
                                        strong
                                    />
                                    {selectedBrand
                                        ? locationRows(brandLocs(selectedBrand.id), pick)
                                        : brands.map((b) => (
                                              <div key={b.id} className="mt-1 border-t border-secondary pt-1">
                                                  <div className="flex items-center gap-2 px-2.5 pt-1.5">
                                                      <BusinessUnitAvatar unit={b} size="sm" />
                                                      <span className="text-sm font-semibold text-secondary">{b.name}</span>
                                                  </div>
                                                  {locationRows(brandLocs(b.id), pick)}
                                              </div>
                                          ))}
                                </div>
                            );
                        }}
                    </AriaDialog>
                </AriaPopover>
            </AriaDialogTrigger>
        </div>
    );
};

const pluralLoc = (n: number) => `${n} location${n === 1 ? "" : "s"}`;

const SwitcherRow = ({
    selected,
    onPress,
    label,
    hint,
    icon,
    indent,
    strong,
}: {
    selected: boolean;
    onPress: () => void;
    label: string;
    hint?: string;
    icon: ReactNode;
    indent?: boolean;
    strong?: boolean;
}) => (
    <AriaButton
        onPress={onPress}
        className={cx(
            "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-hidden hover:bg-primary_hover focus-visible:bg-primary_hover",
            indent && "pl-6",
        )}
    >
        {icon}
        <span className="min-w-0 flex-1">
            <span className={cx("block truncate text-sm text-secondary", strong ? "font-semibold" : "font-medium")}>{label}</span>
            {hint && <span className="block truncate text-xs text-tertiary">{hint}</span>}
        </span>
        {selected && <Check className="size-4 shrink-0 text-fg-brand-primary" />}
    </AriaButton>
);

export const Sidebar = ({ scope, badges, onNavigate }: { scope: Scope; badges: Record<string, number>; onNavigate?: () => void }) => {
    const pathname = usePathname();
    const router = useRouter();
    const logout = useAppStore((s) => s.logout);
    const resetDemo = useAppStore((s) => s.resetDemo);
    const sections = useMemo(
        () => navSections.map((s) => ({ ...s, items: s.items.filter((i) => i.visible(scope)) })).filter((s) => s.items.length),
        [scope],
    );

    return (
        <div className="flex h-full flex-col bg-[#161616] text-white">
            <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
                <Link href="/dashboard" onClick={onNavigate}>
                    <Logo />
                </Link>
            </div>

            <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 scrollbar-hide">
                <div data-tour="location">
                    <LocationSwitcher scope={scope} />
                </div>
                {sections.map((section, i) => (
                    <div key={section.title ?? i} className="flex flex-col gap-0.5">
                        {section.title && <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">{section.title}</p>}
                        {section.items.map((item) => {
                            const active = pathname === item.href || pathname.startsWith(item.href + "/");
                            const count = item.badgeKey ? badges[item.badgeKey] : 0;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    data-tour={`nav:${item.href}`}
                                    onClick={onNavigate}
                                    className={cx(
                                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-md font-medium outline-hidden transition duration-100 ease-linear focus-visible:ring-2 focus-visible:ring-white/40",
                                        active ? "bg-white/12 text-white" : "text-gray-300 hover:bg-white/6 hover:text-white",
                                    )}
                                >
                                    <item.icon className={cx("size-5 shrink-0", active ? "text-white" : "text-gray-400 group-hover:text-gray-200")} />
                                    <span className="flex-1 truncate">{item.label}</span>
                                    {count > 0 && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">{count}</span>}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="shrink-0 border-t border-white/10 p-4">
                <AriaDialogTrigger>
                    <AriaButton
                        data-tour="account"
                        className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left outline-hidden hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-semibold">{initials(scope.user.name)}</span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{scope.user.name}</span>
                            <span className="block truncate text-xs text-gray-400">{roleLabel(scope)}</span>
                        </span>
                        <ChevronSelectorVertical className="size-4 text-gray-400" />
                    </AriaButton>
                    <AriaPopover placement="top start" offset={6} className={popoverClass}>
                        <AriaDialog className="outline-hidden" aria-label="Account">
                            {({ close }) => (
                                <div className="flex flex-col">
                                    <div className="px-2.5 py-2">
                                        <p className="text-sm font-semibold text-primary">{scope.user.name}</p>
                                        <p className="text-xs text-tertiary">{scope.user.email}</p>
                                    </div>
                                    <div className="my-1 h-px bg-border-secondary" />
                                    <MenuButton
                                        icon={Compass03}
                                        label="Take the tour"
                                        onPress={() => {
                                            close();
                                            onNavigate?.();
                                            useTour.getState().start();
                                        }}
                                    />
                                    <MenuButton
                                        icon={SwitchHorizontal01}
                                        label="Switch demo user"
                                        onPress={() => {
                                            close();
                                            logout();
                                            router.push("/login");
                                        }}
                                    />
                                    <MenuButton
                                        icon={RefreshCw01}
                                        label="Reset demo data"
                                        onPress={() => {
                                            resetDemo();
                                            close();
                                        }}
                                    />
                                    <MenuButton
                                        icon={LogOut01}
                                        label="Log out"
                                        onPress={() => {
                                            close();
                                            logout();
                                            router.push("/login");
                                        }}
                                    />
                                </div>
                            )}
                        </AriaDialog>
                    </AriaPopover>
                </AriaDialogTrigger>
            </div>
        </div>
    );
};

const MenuButton = ({ icon: Icon, label, onPress }: { icon: typeof Check; label: string; onPress: () => void }) => (
    <AriaButton onPress={onPress} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-secondary outline-hidden hover:bg-primary_hover focus-visible:bg-primary_hover">
        <Icon className="size-4 text-fg-quaternary" />
        {label}
    </AriaButton>
);
