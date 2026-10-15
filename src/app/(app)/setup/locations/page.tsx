"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building02, Building07, ChevronDown, ClipboardCheck, Edit01, Home03, Link01, Plus, Users01 } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Card } from "@/components/app/card";
import { ChannelLogo } from "@/components/app/channels/channel-logo";
import { ConnectChannelModal } from "@/components/app/channels/connect-channel-modal";
import { Empty } from "@/components/app/empty";
import { ModalDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { BusinessUnitModal } from "@/components/app/setup/business-unit-modal";
import { LocationModal } from "@/components/app/setup/location-modal";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { useRequiredScope } from "@/hooks/use-session";
import { pluralize } from "@/lib/format";
import type { BusinessUnit, ChannelConnection, Location } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

/** A connector chip that links to the connection's page. */
const ConnectorChip = ({ c, note }: { c: ChannelConnection; note?: string }) => (
    <Link
        href={`/channels/connections/view?id=${c.id}`}
        className="inline-flex items-center gap-2 rounded-lg bg-primary py-1 pr-2.5 pl-1 text-sm ring-1 ring-secondary outline-hidden transition duration-100 ease-linear hover:bg-primary_hover focus-visible:ring-2 focus-visible:ring-brand"
    >
        <ChannelLogo channel={c.channel} size="sm" />
        <span className="min-w-0">
            <span className="block truncate font-medium text-primary">{c.name}</span>
            {note && <span className="block truncate text-xs text-tertiary">{note}</span>}
        </span>
        <span className={cx("size-2 shrink-0 rounded-full", c.status === "connected" ? "bg-success-solid" : c.status === "error" ? "bg-error-solid" : "bg-gray-400")} />
    </Link>
);

export default function LocationsSetupPage() {
    const scope = useRequiredScope();
    const router = useRouter();
    const companies = useAppStore((s) => s.companies);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const employees = useAppStore((s) => s.employees);
    const connections = useAppStore((s) => s.connections);
    const setContext = useAppStore((s) => s.setContext);

    const [buModal, setBuModal] = useState<{ open: boolean; unit: BusinessUnit | null }>({ open: false, unit: null });
    const [locModal, setLocModal] = useState<{ open: boolean; location: Location | null; buId?: string }>({ open: false, location: null });
    const [connect, setConnect] = useState<{ open: boolean; storeId?: string; buId?: string }>({ open: false });
    const [firstLocFor, setFirstLocFor] = useState<string | null>(null);
    const [nextStepsFor, setNextStepsFor] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const company = companies.find((c) => c.id === scope.companyId);
    const companyBus = businessUnits.filter((b) => b.companyId === scope.companyId);
    const companyLocations = locations.filter((l) => companyBus.some((b) => b.id === l.businessUnitId));
    const companyEmployees = employees.filter((e) => e.companyId === scope.companyId);
    const canEdit = scope.isExecutive;

    const firstLocBrand = companyBus.find((b) => b.id === firstLocFor);
    const nextLoc = locations.find((l) => l.id === nextStepsFor);

    const startOpeningCount = (l: Location) => {
        setContext(`loc:${l.id}`);
        router.push("/stock/control");
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                className="mb-0"
                eyebrow="Setup"
                title="Brands & Locations"
                description="Company → Brands → Stores and Warehouses → Sales channels. Every product, stock level and person belongs somewhere in this tree."
                actions={
                    canEdit && (
                        <Button color="primary" size="md" iconLeading={Plus} onPress={() => setBuModal({ open: true, unit: null })}>
                            Add brand
                        </Button>
                    )
                }
            />

            {/* Company root of the tree */}
            <section className="flex flex-col gap-4 rounded-2xl bg-gray-950 p-5 text-white shadow-xs md:flex-row md:items-center md:justify-between md:p-6">
                <div className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Building07 className="size-6" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm text-white/60">Company</p>
                        <h2 className="text-xl font-semibold">{company?.name}</h2>
                        <p className="mt-0.5 text-sm text-white/70">
                            {pluralize(companyBus.length, "brand")} · {pluralize(companyLocations.filter((l) => l.type === "store").length, "store")} ·{" "}
                            {pluralize(companyLocations.filter((l) => l.type === "warehouse").length, "warehouse")} · {pluralize(companyEmployees.length, "employee")}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button href="/setup/employees" color="secondary" size="sm" iconLeading={Users01}>
                        Employees
                    </Button>
                    <Button href="/setup/companies" color="secondary" size="sm" iconTrailing={ArrowRight}>
                        Companies
                    </Button>
                </div>
            </section>

            {companyBus.length === 0 ? (
                <Card>
                    <Empty
                        icon={Building02}
                        title="No brands yet"
                        description="Add your first brand (a line of business), then its stores, warehouses and sales channels."
                        action={
                            canEdit && (
                                <Button color="primary" iconLeading={Plus} onPress={() => setBuModal({ open: true, unit: null })}>
                                    Add brand
                                </Button>
                            )
                        }
                    />
                </Card>
            ) : (
                <div className="relative flex flex-col gap-5 border-l-2 border-dashed border-gray-300 pl-4 md:ml-6 md:pl-8">
                    {companyBus.map((bu) => {
                        const locs = locations.filter((l) => l.businessUnitId === bu.id).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "store" ? -1 : 1));
                        const buConnections = connections.filter((c) => c.businessUnitId === bu.id && c.level === "business_unit");
                        const buPeople = companyEmployees.filter((e) => e.businessUnitIds.includes(bu.id) || locs.some((l) => e.locationIds.includes(l.id)));
                        const hasStore = locs.some((l) => l.type === "store");
                        const open = !collapsed[bu.id];
                        return (
                            <section key={bu.id} className="relative overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary">
                                <header className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
                                    <button
                                        type="button"
                                        aria-expanded={open}
                                        onClick={() => setCollapsed((c) => ({ ...c, [bu.id]: open }))}
                                        className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg text-left outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
                                    >
                                        <BusinessUnitAvatar unit={bu} size="lg" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium tracking-wide text-tertiary uppercase">Brand</p>
                                            <h3 className="flex items-center gap-1.5 text-lg font-semibold text-primary">
                                                {bu.name}
                                                <ChevronDown className={cx("size-4 text-fg-quaternary transition duration-100 ease-linear", !open && "-rotate-90")} />
                                            </h3>
                                            <p className="text-sm text-tertiary">
                                                {pluralize(locs.length, "location")} · {pluralize(buPeople.length, "person", "people")} assigned · {pluralize(buConnections.length, "online store")}
                                            </p>
                                            {bu.attributeKeys.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {bu.attributeKeys.map((k) => (
                                                        <Badge key={k} size="sm" type="modern" color="gray">
                                                            {k}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                    {canEdit && (
                                        <div className="flex shrink-0 gap-2">
                                            <Button color="secondary" size="sm" iconLeading={Edit01} onPress={() => setBuModal({ open: true, unit: bu })}>
                                                Edit
                                            </Button>
                                            <Button color="secondary" size="sm" iconLeading={Plus} onPress={() => setLocModal({ open: true, location: null, buId: bu.id })}>
                                                Add location
                                            </Button>
                                        </div>
                                    )}
                                </header>

                                {open && (
                                    <>
                                        {/* Brand-level connectors (Shopify / WooCommerce) */}
                                        <div className="flex flex-col gap-3 border-t border-secondary bg-secondary px-5 py-4 md:flex-row md:items-center md:px-6">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-secondary">Online stores</p>
                                                <p className="text-xs text-tertiary">Shopify and WooCommerce connect once per brand and sell from one fulfilling store.</p>
                                                {buConnections.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {buConnections.map((c) => (
                                                            <ConnectorChip key={c.id} c={c} note={`Fulfilled by ${locations.find((l) => l.id === c.locationId)?.name ?? "—"}`} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {canEdit && (
                                                <Button
                                                    color="secondary"
                                                    size="sm"
                                                    iconLeading={Link01}
                                                    isDisabled={!hasStore}
                                                    onPress={() => setConnect({ open: true, buId: bu.id })}
                                                >
                                                    {hasStore ? "Connect online store" : "Add a store first"}
                                                </Button>
                                            )}
                                        </div>

                                        {locs.length === 0 ? (
                                            <div className="flex flex-col items-start gap-3 border-t border-secondary px-5 py-6 md:px-6">
                                                <p className="text-sm text-tertiary">No stores or warehouses yet.</p>
                                                {canEdit && (
                                                    <Button color="primary" size="sm" iconLeading={Plus} onPress={() => setLocModal({ open: true, location: null, buId: bu.id })}>
                                                        Add first location
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <ul className="divide-y divide-secondary border-t border-secondary">
                                                {locs.map((l) => {
                                                    const people = companyEmployees.filter((e) => e.locationIds.includes(l.id) && e.status !== "disabled").length;
                                                    const storeConns = connections.filter((c) => c.locationId === l.id && c.level === "store");
                                                    const fulfils = connections.filter((c) => c.locationId === l.id && c.level === "business_unit");
                                                    const Icon = l.type === "store" ? Home03 : Building02;
                                                    return (
                                                        <li key={l.id} className="flex flex-col gap-3 px-5 py-4 md:px-6">
                                                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-fg-secondary">
                                                                        <Icon className="size-5" />
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className="font-semibold text-primary">{l.name}</span>
                                                                            <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary">{l.code}</span>
                                                                            <Badge size="sm" type="pill-color" color={l.type === "store" ? "blue" : "purple"}>
                                                                                {l.type === "store" ? "Store" : "Warehouse"}
                                                                            </Badge>
                                                                        </div>
                                                                        <p className="mt-0.5 truncate text-sm text-tertiary">{l.address}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-13 md:pl-0">
                                                                    {l.openingCountDone ? (
                                                                        <BadgeWithDot size="sm" type="pill-color" color="success">
                                                                            Opening count done
                                                                        </BadgeWithDot>
                                                                    ) : (
                                                                        <button type="button" onClick={() => startOpeningCount(l)} className="cursor-pointer rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-brand">
                                                                            <BadgeWithDot size="sm" type="pill-color" color="warning">
                                                                                Opening count needed →
                                                                            </BadgeWithDot>
                                                                        </button>
                                                                    )}
                                                                    <span className="inline-flex items-center gap-1 text-sm text-tertiary" title="Employees assigned">
                                                                        <Users01 className="size-4" /> {people}
                                                                    </span>
                                                                    {canEdit && (
                                                                        <ButtonUtility size="sm" color="tertiary" icon={Edit01} tooltip="Edit location" onPress={() => setLocModal({ open: true, location: l })} />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {l.type === "store" && (
                                                                <div className="flex flex-wrap items-center gap-2 pl-13">
                                                                    {storeConns.map((c) => (
                                                                        <ConnectorChip key={c.id} c={c} note="Store channel" />
                                                                    ))}
                                                                    {fulfils.map((c) => (
                                                                        <ConnectorChip key={c.id} c={c} note="Fulfils online orders" />
                                                                    ))}
                                                                    {storeConns.length + fulfils.length === 0 && <span className="text-sm text-tertiary">No sales channels yet.</span>}
                                                                    {canEdit && (
                                                                        <Button color="link-gray" size="sm" iconLeading={Plus} onPress={() => setConnect({ open: true, storeId: l.id })}>
                                                                            Connect channel
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            <BusinessUnitModal
                isOpen={buModal.open}
                onOpenChange={(open) => setBuModal((m) => ({ ...m, open }))}
                companyId={scope.companyId}
                unit={buModal.unit}
                onCreated={(id) => setFirstLocFor(id)}
            />
            <LocationModal
                isOpen={locModal.open}
                onOpenChange={(open) => setLocModal((m) => ({ ...m, open }))}
                businessUnits={companyBus}
                location={locModal.location}
                defaultBusinessUnitId={locModal.buId}
                lockBusinessUnit={!!locModal.buId}
                onCreated={(id) => setNextStepsFor(id)}
            />
            <ConnectChannelModal
                isOpen={connect.open}
                onOpenChange={(open) => setConnect((c) => ({ ...c, open }))}
                scope={scope}
                presetStoreId={connect.storeId}
                presetBusinessUnitId={connect.buId}
            />

            {/* Wizard step: a brand was just added */}
            <ModalDialog
                isOpen={!!firstLocBrand}
                onOpenChange={(o) => !o && setFirstLocFor(null)}
                title={`Add the first location to ${firstLocBrand?.name ?? "the brand"}`}
                description="A brand needs at least one store or warehouse before it can hold stock or sell."
                size="sm"
                footer={
                    <>
                        <Button color="secondary" size="lg" onPress={() => setFirstLocFor(null)}>
                            Later
                        </Button>
                        <Button
                            color="primary"
                            size="lg"
                            iconLeading={Plus}
                            onPress={() => {
                                const id = firstLocFor!;
                                setFirstLocFor(null);
                                setLocModal({ open: true, location: null, buId: id });
                            }}
                        >
                            Add first location
                        </Button>
                    </>
                }
            >
                <div className="flex items-center gap-3">
                    <BusinessUnitAvatar unit={firstLocBrand} size="lg" />
                    <p className="text-sm text-tertiary">Next: stores, warehouses, then sales channels.</p>
                </div>
            </ModalDialog>

            {/* Wizard step: a location was just added */}
            <ModalDialog
                isOpen={!!nextLoc}
                onOpenChange={(o) => !o && setNextStepsFor(null)}
                title={`${nextLoc?.name ?? "Location"} is set up`}
                description="What's next? You can also do these later from this page."
                size="sm"
                footer={
                    <Button color="secondary" size="lg" onPress={() => setNextStepsFor(null)}>
                        Done for now
                    </Button>
                }
            >
                {nextLoc && (
                    <div className="flex flex-col gap-2">
                        {nextLoc.type === "store" && (
                            <Button
                                color="secondary"
                                size="lg"
                                iconLeading={Link01}
                                onPress={() => {
                                    setNextStepsFor(null);
                                    setConnect({ open: true, storeId: nextLoc.id });
                                }}
                            >
                                Connect a channel to {nextLoc.name}
                            </Button>
                        )}
                        <Button
                            color="secondary"
                            size="lg"
                            iconLeading={ClipboardCheck}
                            onPress={() => {
                                setNextStepsFor(null);
                                startOpeningCount(nextLoc);
                            }}
                        >
                            Start opening count
                        </Button>
                        <Button
                            color="tertiary"
                            size="lg"
                            iconLeading={Plus}
                            onPress={() => {
                                setNextStepsFor(null);
                                setLocModal({ open: true, location: null, buId: nextLoc.businessUnitId });
                            }}
                        >
                            Add another location
                        </Button>
                    </div>
                )}
            </ModalDialog>
        </div>
    );
}
