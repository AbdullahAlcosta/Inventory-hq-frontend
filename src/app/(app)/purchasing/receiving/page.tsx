"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, PackageCheck, Scan } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { UnitsProgress } from "@/components/app/purchasing/flow-ui";
import { poTotals } from "@/components/app/purchasing/po-utils";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

export default function ReceivingPage() {
    const scope = useRequiredScope();
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const vendors = useAppStore((s) => s.vendors);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const data = { products, variants };

    const mine = useMemo(() => purchaseOrders.filter((p) => scope.activeLocationIds.includes(p.warehouseId)), [purchaseOrders, scope.activeLocationIds]);
    const ready = useMemo(
        () =>
            mine
                .filter((p) => p.status === "sent" || p.status === "receiving")
                // In-progress first, then oldest sent first.
                .sort((a, b) => (a.status === b.status ? (a.sentAt ?? a.createdAt).localeCompare(b.sentAt ?? b.createdAt) : a.status === "receiving" ? -1 : 1)),
        [mine],
    );
    const recent = useMemo(
        () =>
            mine
                .filter((p) => p.receivedAt && ["complete", "partial", "resolved"].includes(p.status))
                .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""))
                .slice(0, 8),
        [mine],
    );

    const buName = scope.activeBusinessUnitIds.length === 1 ? businessUnits.find((b) => b.id === scope.activeBusinessUnitIds[0])?.name : "Purchasing";

    return (
        <div className="flex flex-col gap-8">
            <PageHeader className="mb-0" eyebrow={buName} title="Receiving" description="Scan deliveries against their purchase order. Case barcodes count as the full case." />

            <section>
                <h2 className="mb-3 text-lg font-semibold text-primary">Ready to receive</h2>
                {ready.length === 0 ? (
                    <Card>
                        <Empty icon={PackageCheck} title="Nothing to receive" description="POs show up here once a manager marks them as sent to the vendor." />
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {ready.map((po) => {
                            const t = poTotals(data, po);
                            const vendor = vendors.find((v) => v.id === po.vendorId);
                            return (
                                <Link
                                    key={po.id}
                                    href={`/purchasing/receiving/view?id=${po.id}`}
                                    className="group flex flex-col gap-4 rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary transition hover:ring-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-hidden md:p-6"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xl font-semibold text-primary">{po.number}</p>
                                            <p className="truncate text-md text-secondary">{vendor?.name}</p>
                                        </div>
                                        <StatusBadge status={po.status} />
                                    </div>
                                    <dl className="grid grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <dt className="text-tertiary">Lines</dt>
                                            <dd className="font-semibold text-primary">{t.lines}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-tertiary">Units</dt>
                                            <dd className="font-semibold text-primary">{formatNumber(t.units)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-tertiary">Sent</dt>
                                            <dd className="font-semibold text-primary">{po.sentAt ? timeAgo(po.sentAt) : "—"}</dd>
                                        </div>
                                    </dl>
                                    {po.status === "receiving" && (
                                        <div>
                                            <p className="mb-1 text-xs text-tertiary">
                                                {formatNumber(t.received)} of {formatNumber(t.units)} units received
                                            </p>
                                            <UnitsProgress value={t.received} max={t.units} />
                                        </div>
                                    )}
                                    <div className="mt-auto flex items-center justify-between border-t border-secondary pt-4">
                                        <span className="text-sm text-tertiary">
                                            <LocationName id={po.warehouseId} />
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white">
                                            <Scan className="size-4" />
                                            {po.status === "receiving" ? "Continue" : "Start receiving"}
                                            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

            <section>
                <TableCard.Root className="rounded-2xl" size="sm">
                    <TableCard.Header title="Recently received" />
                    {recent.length === 0 ? (
                        <Empty icon={PackageCheck} title="No deliveries received yet" />
                    ) : (
                        <Table aria-label="Recently received">
                            <Table.Header>
                                <Table.Head label="PO" isRowHeader />
                                <Table.Head label="Vendor" />
                                <Table.Head label="Warehouse" />
                                <Table.Head label="Received" />
                                <Table.Head label="Units" />
                                <Table.Head label="Status" />
                            </Table.Header>
                            <Table.Body items={recent}>
                                {(po) => {
                                    const t = poTotals(data, po);
                                    return (
                                        <Table.Row id={po.id} href={`/purchasing/orders/view?id=${po.id}`} className="cursor-pointer">
                                            <Table.Cell className="font-semibold whitespace-nowrap text-primary">{po.number}</Table.Cell>
                                            <Table.Cell className="whitespace-nowrap">{vendors.find((v) => v.id === po.vendorId)?.name}</Table.Cell>
                                            <Table.Cell className="whitespace-nowrap">
                                                <LocationName id={po.warehouseId} />
                                            </Table.Cell>
                                            <Table.Cell className="whitespace-nowrap">{po.receivedAt ? formatDate(po.receivedAt) : "—"}</Table.Cell>
                                            <Table.Cell className="whitespace-nowrap tabular-nums">
                                                {formatNumber(t.received)} / {formatNumber(t.units)}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <StatusBadge status={po.status} size="sm" />
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                }}
                            </Table.Body>
                        </Table>
                    )}
                </TableCard.Root>
            </section>
        </div>
    );
}
