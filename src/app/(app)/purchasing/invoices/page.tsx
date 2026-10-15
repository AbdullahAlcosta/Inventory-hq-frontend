"use client";

import { useMemo, useState } from "react";
import { Camera01, File06, SearchLg } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceScan } from "@/components/app/purchasing/invoice-scan";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate } from "@/lib/format";
import { blockingIssues } from "@/lib/invoice";
import { normalize } from "@/lib/selectors";
import type { VendorInvoice } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Filter = "all" | VendorInvoice["status"];
const NO_PO = "__none";

export default function VendorInvoicesPage() {
    const scope = useRequiredScope();
    const invoices = useAppStore((s) => s.vendorInvoices);
    const vendors = useAppStore((s) => s.vendors);
    const locations = useAppStore((s) => s.locations);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [scanning, setScanning] = useState(false);
    const [vendorId, setVendorId] = useState<string | null>(null);
    const [destinationId, setDestinationId] = useState<string | null>(null);
    const [poId, setPoId] = useState<string | null>(null);
    const [started, setStarted] = useState(0);

    const visible = (inv: VendorInvoice) =>
        scope.canManagePurchasing ? scope.activeBusinessUnitIds.includes(inv.businessUnitId) && (scope.isExecutive || !scope.activeLocation || scope.activeLocationIds.includes(inv.destinationId) || scope.activeLocation.type === "warehouse") : scope.activeLocationIds.includes(inv.destinationId);
    const scoped = invoices.filter(visible);

    const rows = useMemo(() => {
        const q = normalize(query);
        return scoped
            .filter((i) => filter === "all" || i.status === filter)
            .filter((i) => !q || normalize(`${i.number} ${vendors.find((v) => v.id === i.vendorId)?.name ?? ""} ${purchaseOrders.find((p) => p.id === i.poId)?.number ?? ""}`).includes(q))
            .map((i) => ({ id: i.id, inv: i, vendor: vendors.find((v) => v.id === i.vendorId), po: purchaseOrders.find((p) => p.id === i.poId) }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scoped.length, invoices, filter, query, vendors, purchaseOrders]);

    const vendorOptions = vendors.filter((v) => v.businessUnitIds.some((b) => scope.activeBusinessUnitIds.includes(b))).map((v) => ({ id: v.id, label: v.name }));
    const destOptions = locations
        .filter((l) => scope.activeBusinessUnitIds.includes(l.businessUnitId) && (scope.canManagePurchasing || scope.locationIds.includes(l.id)))
        .map((l) => ({ id: l.id, label: l.name, supportingText: l.type === "store" ? "Store" : "Warehouse" }));
    const poOptions = [
        { id: NO_PO, label: "No PO — receive from the invoice" },
        ...purchaseOrders
            .filter((p) => p.vendorId === vendorId && p.warehouseId === destinationId && ["created", "sent", "receiving", "partial"].includes(p.status))
            .map((p) => ({ id: p.id, label: p.number, supportingText: p.status })),
    ];
    const po = poId && poId !== NO_PO ? purchaseOrders.find((p) => p.id === poId) : null;
    const ready = !!vendorId && !!destinationId && !!poId;

    const options = [
        { id: "all" as Filter, label: "All", count: scoped.length },
        { id: "issues" as Filter, label: "Issues", count: scoped.filter((i) => i.status === "issues").length },
        { id: "matched" as Filter, label: "Matched", count: scoped.filter((i) => i.status === "matched").length },
        { id: "resolved" as Filter, label: "Resolved", count: scoped.filter((i) => i.status === "resolved").length },
    ];

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                className="mb-0"
                eyebrow="Purchasing"
                title="Vendor Invoices"
                description="Invoices and sales receipts scanned at delivery, checked against the PO and what was received."
                actions={
                    !scanning && (
                        <Button size="lg" iconLeading={Camera01} onPress={() => setScanning(true)}>
                            Scan invoice
                        </Button>
                    )
                }
            />

            {scanning && (
                <Card
                    title="Scan vendor invoice"
                    description="Pick who it’s from and where it was delivered. Choose the PO, or none to receive straight from the invoice."
                    actions={
                        <Button color="secondary" size="md" onPress={() => { setScanning(false); setStarted(0); }}>
                            Close
                        </Button>
                    }
                >
                    <div className="grid gap-3 md:grid-cols-3">
                        <Select label="Vendor" size="sm" placeholder="Select vendor" items={vendorOptions} selectedKey={vendorId} onSelectionChange={(k) => { setVendorId(k as string); setPoId(null); setStarted(0); }}>
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <Select label="Delivered to" size="sm" placeholder="Select store or warehouse" items={destOptions} selectedKey={destinationId} onSelectionChange={(k) => { setDestinationId(k as string); setPoId(null); setStarted(0); }}>
                            {(item) => <Select.Item id={item.id} supportingText={item.supportingText}>{item.label}</Select.Item>}
                        </Select>
                        <Select label="Purchase order" size="sm" placeholder="Select PO" isDisabled={!vendorId || !destinationId} items={poOptions} selectedKey={poId} onSelectionChange={(k) => { setPoId(k as string); setStarted((n) => n + 1); }}>
                            {(item) => <Select.Item id={item.id} supportingText={item.supportingText}>{item.label}</Select.Item>}
                        </Select>
                    </div>
                    {ready && (
                        <div className="mt-5 border-t border-secondary pt-5">
                            <InvoiceScan key={`${vendorId}-${destinationId}-${poId}-${started}`} bare vendorId={vendorId!} destinationId={destinationId!} po={po} />
                        </div>
                    )}
                </Card>
            )}

            <FilterPills options={options} value={filter} onChange={setFilter} />

            <TableCard.Root className="rounded-2xl">
                <div className="flex flex-col gap-3 border-b border-secondary px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <p className="text-md font-semibold text-primary">
                        {rows.length} invoice{rows.length === 1 ? "" : "s"}
                    </p>
                    <Input aria-label="Search invoices" icon={SearchLg} placeholder="Search invoice #, vendor or PO" value={query} onChange={setQuery} className="md:max-w-xs" />
                </div>
                {rows.length === 0 ? (
                    <Empty icon={File06} title="No vendor invoices yet" description="Scan an invoice from a delivery — on the Receiving screen or with Scan invoice above." />
                ) : (
                    <Table aria-label="Vendor invoices">
                        <Table.Header>
                            <Table.Head label="Invoice #" isRowHeader />
                            <Table.Head label="Vendor" />
                            <Table.Head label="PO" />
                            <Table.Head label="Delivered to" />
                            <Table.Head label="Date" />
                            <Table.Head label="Total" />
                            <Table.Head label="Issues" />
                            <Table.Head label="Status" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(row) => (
                                <Table.Row id={row.id} href={`/purchasing/invoices/view?id=${row.id}`} className="cursor-pointer">
                                    <Table.Cell className="font-semibold whitespace-nowrap text-primary">#{row.inv.number}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-primary">{row.vendor?.name ?? "—"}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{row.po?.number ?? "—"}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <LocationName id={row.inv.destinationId} />
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{formatDate(row.inv.date + "T12:00:00")}</Table.Cell>
                                    <Table.Cell className="font-medium whitespace-nowrap text-primary tabular-nums">{formatCurrency(row.inv.total)}</Table.Cell>
                                    <Table.Cell className="tabular-nums">{blockingIssues(row.inv.issues).length || "—"}</Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge status={row.inv.status === "issues" ? "pending" : row.inv.status === "matched" ? "complete" : "resolved"} label={row.inv.status === "issues" ? (row.inv.disputeNote ? "Disputed" : "Issues") : row.inv.status === "matched" ? "Matched" : "Resolved"} size="sm" />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>
        </div>
    );
}
