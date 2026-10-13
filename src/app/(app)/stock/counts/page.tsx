"use client";

import { Suspense, useMemo, useState } from "react";
import { ClipboardCheck, Plus } from "@untitledui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { StartCountModal } from "@/components/app/stock/start-count-modal";
import { useActiveBuName } from "@/components/app/stock/use-stock-page";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StockCount } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

export default function CountsPage() {
    return (
        <Suspense fallback={null}>
            <Counts />
        </Suspense>
    );
}

type Status = StockCount["status"];

function Counts() {
    const scope = useRequiredScope();
    const eyebrow = useActiveBuName();
    const counts = useAppStore((s) => s.counts);
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // /stock/counts?start=<locationId> opens the start modal (from the opening count notice).
    const startParam = params.get("start");
    const [modal, setModal] = useState<{ open: boolean; locationId?: string }>(() => ({ open: !!startParam, locationId: startParam ?? undefined }));
    const [status, setStatus] = useState<Status>("in_progress");

    const scoped = useMemo(() => counts.filter((c) => scope.activeLocationIds.includes(c.locationId)), [counts, scope.activeLocationIds]);
    const visible = scoped.filter((c) => c.status === status);
    const n = (s: Status) => scoped.filter((c) => c.status === s).length;

    const needsOpening = scope.locations.filter(
        (l) => !l.openingCountDone && !scoped.some((c) => c.locationId === l.id && c.kind === "opening" && c.status === "in_progress"),
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow={eyebrow}
                title="Counts"
                description="Opening and cycle counts. Variances go to Approvals; approval corrects stock."
                className="mb-0"
                actions={
                    <Button size="lg" iconLeading={Plus} onPress={() => setModal({ open: true })}>
                        Start count
                    </Button>
                }
            />

            {needsOpening.map((l) => (
                <div
                    key={l.id}
                    className="flex flex-col gap-3 rounded-2xl bg-orange-50 px-5 py-4 ring-1 ring-orange-200 sm:flex-row sm:items-center sm:justify-between"
                >
                    <p className="text-sm text-secondary">
                        <span className="font-semibold text-primary">{l.name}</span> hasn’t had its opening count yet.
                    </p>
                    <Button size="md" color="secondary" onPress={() => setModal({ open: true, locationId: l.id })}>
                        Start opening count
                    </Button>
                </div>
            ))}

            <FilterPills<Status>
                value={status}
                onChange={setStatus}
                options={[
                    { id: "in_progress", label: "In Progress", count: n("in_progress") },
                    { id: "submitted", label: "Awaiting Approval", count: n("submitted") },
                    { id: "approved", label: "Approved", count: n("approved") },
                    { id: "rejected", label: "Rejected", count: n("rejected") },
                ]}
            />

            <TableCard.Root size="sm">
                {visible.length === 0 ? (
                    <Empty
                        icon={ClipboardCheck}
                        title="No counts here"
                        description={status === "in_progress" ? "Start a count to check what’s on the shelf." : "Nothing in this status yet."}
                        action={
                            status === "in_progress" ? (
                                <Button size="md" iconLeading={Plus} onPress={() => setModal({ open: true })}>
                                    Start count
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <Table aria-label="Counts" className="min-w-[860px]">
                        <Table.Header>
                            <Table.Head label="Count" isRowHeader />
                            <Table.Head label="Location" />
                            <Table.Head label="Type" />
                            <Table.Head label="Counted" />
                            <Table.Head label="Variances" />
                            <Table.Head label="Started by" />
                            <Table.Head label="Started" />
                            <Table.Head label="Status" />
                        </Table.Header>
                        <Table.Body items={visible}>
                            {(c) => {
                                const counted = c.lines.filter((l) => l.countedQty !== null).length;
                                const variances = c.lines.filter((l) => l.countedQty !== null && l.countedQty !== l.systemQty).length;
                                return (
                                    <Table.Row id={c.id} href={`/stock/counts/${c.id}`} className="cursor-pointer">
                                        <Table.Cell className="font-semibold whitespace-nowrap text-primary">{c.number}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            <LocationName id={c.locationId} />
                                        </Table.Cell>
                                        <Table.Cell>{c.kind === "opening" ? "Opening" : "Cycle"}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            {formatNumber(counted)} / {formatNumber(c.lines.length)}
                                        </Table.Cell>
                                        <Table.Cell className={variances ? "font-medium text-warning-primary" : ""}>{formatNumber(variances)}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            <EmployeeName id={c.createdBy} />
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{formatDateTime(c.createdAt)}</Table.Cell>
                                        <Table.Cell>
                                            <StatusBadge status={c.status} size="sm" />
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <StartCountModal
                isOpen={modal.open}
                locationId={modal.locationId}
                onOpenChange={(o) => {
                    setModal({ open: o });
                    if (!o && startParam) router.replace(pathname, { scroll: false });
                }}
            />
        </div>
    );
}
