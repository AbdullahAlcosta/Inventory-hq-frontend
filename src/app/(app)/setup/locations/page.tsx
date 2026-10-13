"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building02, Building07, Edit01, Home03, Link01, Plus, Users01 } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { PageHeader } from "@/components/app/page-header";
import { BusinessUnitModal } from "@/components/app/setup/business-unit-modal";
import { LocationModal } from "@/components/app/setup/location-modal";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { useRequiredScope } from "@/hooks/use-session";
import { pluralize } from "@/lib/format";
import type { BusinessUnit, Location } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

export default function LocationsSetupPage() {
    const scope = useRequiredScope();
    const companies = useAppStore((s) => s.companies);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const employees = useAppStore((s) => s.employees);
    const connections = useAppStore((s) => s.connections);

    const [buModal, setBuModal] = useState<{ open: boolean; unit: BusinessUnit | null }>({ open: false, unit: null });
    const [locModal, setLocModal] = useState<{ open: boolean; location: Location | null; buId?: string }>({ open: false, location: null });

    const company = companies.find((c) => c.id === scope.companyId);
    const companyBus = businessUnits.filter((b) => b.companyId === scope.companyId);
    // Company structure is a company-level page: always show every business unit.
    const visibleBus = companyBus;
    const companyLocations = locations.filter((l) => companyBus.some((b) => b.id === l.businessUnitId));
    const companyEmployees = employees.filter((e) => e.companyId === scope.companyId);
    const canEdit = scope.isExecutive;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                className="mb-0"
                eyebrow="Setup"
                title="Locations"
                description="Company → Business Units → Stores and Warehouses. Every product, stock level and person belongs somewhere in this tree."
                actions={
                    canEdit && (
                        <>
                            <Button color="secondary" size="md" iconLeading={Plus} onPress={() => setLocModal({ open: true, location: null })} isDisabled={!companyBus.length}>
                                Add location
                            </Button>
                            <Button color="primary" size="md" iconLeading={Plus} onPress={() => setBuModal({ open: true, unit: null })}>
                                Add business unit
                            </Button>
                        </>
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
                            {pluralize(companyBus.length, "business unit")} · {pluralize(companyLocations.filter((l) => l.type === "store").length, "store")} ·{" "}
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


            {visibleBus.length === 0 ? (
                <Card>
                    <Empty
                        icon={Building02}
                        title="No business units yet"
                        description="Add your first business unit (a brand or line of business), then its stores and warehouses."
                        action={
                            canEdit && (
                                <Button color="primary" iconLeading={Plus} onPress={() => setBuModal({ open: true, unit: null })}>
                                    Add business unit
                                </Button>
                            )
                        }
                    />
                </Card>
            ) : (
                <div className="relative flex flex-col gap-5 border-l-2 border-dashed border-gray-300 pl-4 md:ml-6 md:pl-8">
                    {visibleBus.map((bu) => {
                        const locs = locations.filter((l) => l.businessUnitId === bu.id).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "store" ? -1 : 1));
                        const buConnections = connections.filter((c) => c.businessUnitId === bu.id && c.level === "business_unit");
                        const buPeople = companyEmployees.filter((e) => e.businessUnitIds.includes(bu.id) || locs.some((l) => e.locationIds.includes(l.id)));
                        return (
                            <section key={bu.id} className="relative overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary">
                                <header className="flex flex-col gap-4 border-b border-secondary px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <BusinessUnitAvatar unit={bu} size="lg" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium tracking-wide text-tertiary uppercase">Business unit</p>
                                            <h3 className="text-lg font-semibold text-primary">{bu.name}</h3>
                                            <p className="text-sm text-tertiary">
                                                {pluralize(buPeople.length, "person", "people")} assigned · {pluralize(buConnections.length, "online channel")}
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
                                    </div>
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
                                {locs.length === 0 ? (
                                    <p className="px-5 py-6 text-sm text-tertiary md:px-6">No stores or warehouses yet.</p>
                                ) : (
                                    <ul className="divide-y divide-secondary">
                                        {locs.map((l) => {
                                            const people = companyEmployees.filter((e) => e.locationIds.includes(l.id) && e.status !== "disabled").length;
                                            const channels = connections.filter((c) => c.locationId === l.id).length;
                                            const Icon = l.type === "store" ? Home03 : Building02;
                                            return (
                                                <li key={l.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:px-6">
                                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                                                            <Icon className="size-5" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-semibold text-primary">{l.name}</span>
                                                                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-secondary">{l.code}</span>
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
                                                            <Link href="/stock/control" className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-brand">
                                                                <BadgeWithDot size="sm" type="pill-color" color="warning">
                                                                    Opening count needed →
                                                                </BadgeWithDot>
                                                            </Link>
                                                        )}
                                                        <span className="inline-flex items-center gap-1 text-sm text-tertiary" title="Employees assigned">
                                                            <Users01 className="size-4" /> {people}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-sm text-tertiary" title="Channel connections">
                                                            <Link01 className="size-4" /> {channels}
                                                        </span>
                                                        {canEdit && (
                                                            <ButtonUtility size="sm" color="tertiary" icon={Edit01} tooltip="Edit location" onPress={() => setLocModal({ open: true, location: l })} />
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            <BusinessUnitModal isOpen={buModal.open} onOpenChange={(open) => setBuModal((m) => ({ ...m, open }))} companyId={scope.companyId} unit={buModal.unit} />
            <LocationModal
                isOpen={locModal.open}
                onOpenChange={(open) => setLocModal((m) => ({ ...m, open }))}
                businessUnits={companyBus}
                location={locModal.location}
                defaultBusinessUnitId={locModal.buId}
            />
        </div>
    );
}
