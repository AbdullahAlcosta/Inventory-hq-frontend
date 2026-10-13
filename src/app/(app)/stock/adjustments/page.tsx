"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Edit05, Plus, SearchLg } from "@untitledui/icons";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { EmployeeName, LocationName, VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { AdjustmentModal } from "@/components/app/stock/adjustment-modal";
import { reasonLabels, signedClass, stateLabels } from "@/components/app/stock/stock-utils";
import { useActiveBuName } from "@/components/app/stock/use-stock-page";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatNumber, formatSigned } from "@/lib/format";
import { normalize, variantLabel } from "@/lib/selectors";
import type { Adjustment } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Filter = "all" | Adjustment["status"];

export default function AdjustmentsPage() {
    const scope = useRequiredScope();
    const eyebrow = useActiveBuName();
    const adjustments = useAppStore((s) => s.adjustments);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const [filter, setFilter] = useState<Filter>("pending");
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    const scoped = useMemo(() => {
        const q = normalize(query);
        return adjustments
            .filter((a) => scope.activeLocationIds.includes(a.locationId))
            .filter((a) => !q || normalize(`${a.number} ${variantLabel({ products, variants }, a.variantId)} ${a.note}`).includes(q));
    }, [adjustments, scope.activeLocationIds, query, products, variants]);

    const visible = filter === "all" ? scoped : scoped.filter((a) => a.status === filter);
    const n = (s: Adjustment["status"]) => scoped.filter((a) => a.status === s).length;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow={eyebrow}
                title="Adjustments"
                description="Every change needs a reason and a note, and goes through Approvals. Records are permanent."
                className="mb-0"
                actions={
                    <Button size="lg" iconLeading={Plus} onPress={() => setOpen(true)}>
                        New adjustment
                    </Button>
                }
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <FilterPills<Filter>
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { id: "pending", label: "Pending", count: n("pending") },
                        { id: "approved", label: "Approved", count: n("approved") },
                        { id: "rejected", label: "Rejected", count: n("rejected") },
                        { id: "all", label: "All", count: scoped.length },
                    ]}
                />
                <Input aria-label="Search" placeholder="Search number, item or note" icon={SearchLg} value={query} onChange={setQuery} className="md:w-72" />
            </div>

            <TableCard.Root size="sm">
                {visible.length === 0 ? (
                    <Empty
                        icon={Edit05}
                        title="No adjustments"
                        description="Record damaged, expired, lost or found stock, or move units between states."
                        action={
                            <Button size="md" iconLeading={Plus} onPress={() => setOpen(true)}>
                                New adjustment
                            </Button>
                        }
                    />
                ) : (
                    <Table aria-label="Adjustments" className="min-w-[900px]">
                        <Table.Header>
                            <Table.Head label="Number" isRowHeader className="pr-3" />
                            <Table.Head label="Item" className="px-3" />
                            <Table.Head label="Location" className="px-3" />
                            <Table.Head label="Change" className="px-3" />
                            <Table.Head label="Reason & note" className="px-3" />
                            <Table.Head label="Created" className="px-3" />
                            <Table.Head label="Status" className="pl-3" />
                        </Table.Header>
                        <Table.Body items={visible}>
                            {(a) => (
                                <Table.Row id={a.id}>
                                    <Table.Cell className="pr-3 font-semibold whitespace-nowrap text-primary">{a.number}</Table.Cell>
                                    <Table.Cell className="max-w-[260px] px-3">
                                        <VariantCell variantId={a.variantId} />
                                    </Table.Cell>
                                    <Table.Cell className="px-3">
                                        <LocationName id={a.locationId} />
                                    </Table.Cell>
                                    <Table.Cell className="px-3 whitespace-nowrap">
                                        {a.fromState && a.toState ? (
                                            <span className="inline-flex items-center gap-1.5 text-primary">
                                                <span className="font-semibold">{formatNumber(Math.abs(a.quantity))}</span>
                                                {stateLabels[a.fromState]}
                                                <ArrowRight className="size-3.5 text-fg-quaternary" />
                                                {stateLabels[a.toState]}
                                            </span>
                                        ) : (
                                            <span className={`font-semibold ${signedClass(a.quantity)}`}>{formatSigned(a.quantity)} Available</span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="max-w-[260px] min-w-[180px] px-3">
                                        <span className="block font-medium text-primary">{reasonLabels[a.reason] ?? a.reason}</span>
                                        <span className="line-clamp-2">{a.note || "—"}</span>
                                    </Table.Cell>
                                    <Table.Cell className="px-3 whitespace-nowrap">
                                        <span className="block text-primary">
                                            <EmployeeName id={a.createdBy} />
                                        </span>
                                        <span className="block text-xs text-tertiary">{formatDateTime(a.createdAt)}</span>
                                    </Table.Cell>
                                    <Table.Cell className="pl-3">
                                        <StatusBadge status={a.status} size="sm" />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <AdjustmentModal isOpen={open} onOpenChange={setOpen} onCreated={() => setFilter("pending")} />
        </div>
    );
}
