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
 * Sidebar Location switcher: "All locations", a whole business unit, or one store/warehouse.
 * People assigned to a single location are locked to it.
 */
export const LocationSwitcher = ({ scope }: { scope: Scope }) => {
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const setContext = useAppStore((s) => s.setContext);
    const company = useAppStore((s) => s.companies.find((c) => c.id === scope.companyId));

    const myLocations = locations.filter((l) => scope.locationIds.includes(l.id));
    const groups = businessUnits
        .filter((b) => scope.businessUnitIds.includes(b.id))
        .map((b) => ({ unit: b, locations: myLocations.filter((l) => l.businessUnitId === b.id).sort((a, c) => a.type.localeCompare(c.type) * -1 || a.name.localeCompare(c.name)) }))
        .filter((g) => g.locations.length);
    const locked = myLocations.length <= 1;

    const activeBu = scope.context.startsWith("bu:") ? businessUnits.find((b) => `bu:${b.id}` === scope.context) : undefined;
    const active = scope.activeLocation;
    const activeUnit = active ? businessUnits.find((b) => b.id === active.businessUnitId) : activeBu;
    const title = active ? active.name : activeBu ? `All ${activeBu.name}` : scope.isExecutive ? "All locations" : "All my locations";
    const subtitle = active ? `${active.type === "store" ? "Store" : "Warehouse"} · ${activeUnit?.name}` : activeBu ? "Business unit overview" : (company?.name ?? "");

    const trigger = (
        <>
            {active ? (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                    <LocationIcon type={active.type} className="size-5" />
                </span>
            ) : (
                <BusinessUnitAvatar unit={activeBu ?? null} />
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-gray-400">{subtitle}</span>
                <span className="block truncate text-md font-semibold text-white">{title}</span>
            </span>
        </>
    );

    if (locked) {
        return <div className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/15">{trigger}</div>;
    }

    return (
        <AriaDialogTrigger>
            <AriaButton className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left ring-1 ring-white/15 outline-hidden transition duration-100 ease-linear hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40">
                {trigger}
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
                                    selected={scope.context === "all"}
                                    onPress={() => pick("all")}
                                    label={scope.isExecutive ? "All locations" : "All my locations"}
                                    hint={scope.isExecutive ? `${company?.name} overview` : undefined}
                                    icon={<BusinessUnitAvatar unit={null} size="sm" />}
                                />
                                {groups.map((g) => (
                                    <div key={g.unit.id} className="mt-1 border-t border-secondary pt-1">
                                        {groups.length > 1 || g.locations.length > 1 ? (
                                            <SwitcherRow
                                                selected={scope.context === `bu:${g.unit.id}`}
                                                onPress={() => pick(`bu:${g.unit.id}`)}
                                                label={g.unit.name}
                                                hint="All locations in this business unit"
                                                icon={<BusinessUnitAvatar unit={g.unit} size="sm" />}
                                                strong
                                            />
                                        ) : null}
                                        {g.locations.map((l) => (
                                            <SwitcherRow
                                                key={l.id}
                                                selected={scope.context === `loc:${l.id}`}
                                                onPress={() => pick(`loc:${l.id}`)}
                                                label={l.name}
                                                hint={l.type === "store" ? "Store" : "Warehouse"}
                                                icon={
                                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-tertiary">
                                                        <LocationIcon type={l.type} className="size-3.5" />
                                                    </span>
                                                }
                                                indent
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );
                    }}
                </AriaDialog>
            </AriaPopover>
        </AriaDialogTrigger>
    );
};

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
