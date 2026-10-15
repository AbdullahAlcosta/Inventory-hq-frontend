"use client";

import { useMemo, useState } from "react";
import { Building07, Plus, SearchLg } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Empty } from "@/components/app/empty";
import { PageHeader } from "@/components/app/page-header";
import { VendorFormModal } from "@/components/app/purchasing/vendor-form-modal";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDate } from "@/lib/format";
import { normalize } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";

export default function VendorsPage() {
    const scope = useRequiredScope();
    const vendors = useAppStore((s) => s.vendors);
    const variants = useAppStore((s) => s.variants);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const [query, setQuery] = useState("");
    const [adding, setAdding] = useState(false);

    const buName = scope.activeBusinessUnitIds.length === 1 ? businessUnits.find((b) => b.id === scope.activeBusinessUnitIds[0])?.name : "Purchasing";

    const rows = useMemo(() => {
        const q = normalize(query);
        return vendors
            .filter((v) => v.businessUnitIds.some((id) => scope.activeBusinessUnitIds.includes(id)))
            .filter((v) => !q || normalize(`${v.name} ${v.contactName} ${v.email}`).includes(q))
            .map((v) => {
                const pos = purchaseOrders.filter((p) => p.vendorId === v.id && scope.activeBusinessUnitIds.includes(p.businessUnitId));
                const last = pos.map((p) => p.createdAt).sort().pop();
                return {
                    id: v.id,
                    vendor: v,
                    products: variants.filter((x) => x.vendorId === v.id).length,
                    openPOs: pos.filter((p) => ["created", "sent", "receiving", "partial"].includes(p.status)).length,
                    lastPO: last,
                };
            })
            .sort((a, b) => a.vendor.name.localeCompare(b.vendor.name));
    }, [vendors, variants, purchaseOrders, scope.activeBusinessUnitIds, query]);

    return (
        <div>
            <PageHeader
                eyebrow={buName}
                title="Vendors"
                description="Who you buy from. Each vendor supplies one or more brands."
                actions={
                    scope.canManagePurchasing && (
                        <Button iconLeading={Plus} size="lg" onPress={() => setAdding(true)}>
                            Add vendor
                        </Button>
                    )
                }
            />

            <TableCard.Root className="rounded-2xl">
                <div className="flex flex-col gap-3 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <p className="text-md font-semibold text-primary">
                        {rows.length} vendor{rows.length === 1 ? "" : "s"}
                    </p>
                    <Input aria-label="Search vendors" icon={SearchLg} placeholder="Search vendors" value={query} onChange={setQuery} className="md:max-w-xs" />
                </div>
                {rows.length === 0 ? (
                    <Empty icon={Building07} title="No vendors" description={query ? "Nothing matches your search." : "Add the vendors you buy from to start creating purchase orders."} />
                ) : (
                    <Table aria-label="Vendors">
                        <Table.Header>
                            <Table.Head label="Vendor" isRowHeader />
                            <Table.Head label="Contact" />
                            <Table.Head label="Brands" />
                            <Table.Head label="Products" />
                            <Table.Head label="Open POs" />
                            <Table.Head label="Last PO" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(row) => (
                                <Table.Row id={row.id} href={`/purchasing/vendors/view?id=${row.id}`} className="cursor-pointer">
                                    <Table.Cell>
                                        <span className="block font-medium whitespace-nowrap text-primary">{row.vendor.name}</span>
                                        {row.vendor.notes && <span className="block max-w-xs truncate text-xs text-tertiary">{row.vendor.notes}</span>}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="block whitespace-nowrap text-primary">{row.vendor.contactName || "—"}</span>
                                        <span className="block text-xs whitespace-nowrap">{[row.vendor.email, row.vendor.phone].filter(Boolean).join(" · ") || "—"}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex flex-wrap gap-1.5">
                                            {row.vendor.businessUnitIds.map((id) => {
                                                const bu = businessUnits.find((b) => b.id === id);
                                                return (
                                                    <span key={id} className="flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pr-2 pl-0.5 text-xs font-medium whitespace-nowrap text-secondary">
                                                        <BusinessUnitAvatar unit={bu} size="sm" className="size-5" />
                                                        {bu?.name}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="tabular-nums">{row.products}</Table.Cell>
                                    <Table.Cell>
                                        <span className={row.openPOs ? "font-semibold text-primary" : ""}>{row.openPOs}</span>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{row.lastPO ? formatDate(row.lastPO) : "—"}</Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <VendorFormModal isOpen={adding} onOpenChange={setAdding} />
        </div>
    );
}
