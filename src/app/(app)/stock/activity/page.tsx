"use client";

import { useMemo, useState } from "react";
import { ClockRewind, Download01, SearchLg } from "@untitledui/icons";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { signedClass } from "@/components/app/stock/stock-utils";
import { downloadCsv, useActiveContextName } from "@/components/app/stock/use-stock-page";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatSigned, timeAgo } from "@/lib/format";
import { normalize } from "@/lib/selectors";
import type { ActivityKind } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Filter = "all" | ActivityKind;

const kindLabels: Record<ActivityKind, string> = {
    stock: "Stock",
    count: "Counts",
    adjustment: "Adjustments",
    receiving: "Receiving",
    store_request: "Transfers",
    purchase_order: "Purchasing",
    channel: "Channels",
    catalog: "Catalog",
    approval: "Approvals",
    setup: "Setup",
};

const filterKinds: ActivityKind[] = ["stock", "count", "adjustment", "receiving", "store_request", "purchase_order", "channel", "catalog", "approval"];
const PAGE = 100;

export default function ActivityPage() {
    const scope = useRequiredScope();
    const eyebrow = useActiveContextName();
    const activity = useAppStore((s) => s.activity);
    const employees = useAppStore((s) => s.employees);
    const locations = useAppStore((s) => s.locations);
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [limit, setLimit] = useState(PAGE);

    const nameOf = (id: string) => (id === "system" ? "System" : (employees.find((e) => e.id === id)?.name ?? id));
    const locName = (id: string | null) => (id ? (locations.find((l) => l.id === id)?.name ?? "") : "");

    const searched = useMemo(() => {
        const q = normalize(query);
        return activity
            .filter((a) => a.locationId === null || scope.activeLocationIds.includes(a.locationId))
            .filter((a) => !q || normalize(`${a.message} ${a.reason ?? ""} ${nameOf(a.by)} ${locName(a.locationId)}`).includes(q))
            .sort((a, b) => b.at.localeCompare(a.at));
    }, [activity, scope.activeLocationIds, query, employees, locations]);

    const visible = filter === "all" ? searched : searched.filter((a) => a.kind === filter);
    const shown = visible.slice(0, limit);

    const exportCsv = () => {
        downloadCsv(`activity-log-${new Date().toISOString().slice(0, 10)}.csv`, [
            ["When", "Who", "Type", "What", "Location", "Qty change", "Reason"],
            ...visible.map((a) => [a.at, nameOf(a.by), kindLabels[a.kind], a.message, locName(a.locationId), a.quantity ?? "", a.reason ?? ""]),
        ]);
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow={eyebrow}
                title="Activity Log"
                description="Permanent record of who did what, when and why. Entries can’t be edited or deleted."
                className="mb-0"
                actions={
                    <Button size="lg" color="secondary" iconLeading={Download01} onPress={exportCsv} isDisabled={!visible.length}>
                        Export CSV
                    </Button>
                }
            />

            <div className="flex flex-col gap-3">
                <Input
                    aria-label="Search"
                    placeholder="Search activity, person or location"
                    icon={SearchLg}
                    value={query}
                    onChange={setQuery}
                    className="md:w-96"
                />
                <FilterPills<Filter>
                    value={filter}
                    onChange={(f) => {
                        setFilter(f);
                        setLimit(PAGE);
                    }}
                    options={[
                        { id: "all", label: "All", count: searched.length },
                        ...filterKinds.map((k) => ({ id: k, label: kindLabels[k], count: searched.filter((a) => a.kind === k).length })),
                    ]}
                />
            </div>

            <TableCard.Root size="sm">
                {shown.length === 0 ? (
                    <Empty icon={ClockRewind} title="No activity" description="Nothing matches this filter yet." />
                ) : (
                    <Table aria-label="Activity log" className="min-w-[960px]">
                        <Table.Header>
                            <Table.Head label="When" isRowHeader />
                            <Table.Head label="Who" />
                            <Table.Head label="What" />
                            <Table.Head label="Location" />
                            <Table.Head label="Qty change" />
                        </Table.Header>
                        <Table.Body items={shown}>
                            {(a) => (
                                <Table.Row id={a.id}>
                                    <Table.Cell className="whitespace-nowrap">
                                        <span className="block text-primary">{formatDateTime(a.at)}</span>
                                        <span className="block text-xs text-quaternary">{timeAgo(a.at)}</span>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-primary">
                                        <EmployeeName id={a.by} />
                                    </Table.Cell>
                                    <Table.Cell className="max-w-[460px]">
                                        <div className="flex items-start gap-2">
                                            <Badge type="color" color="gray" size="sm" className="mt-0.5 shrink-0">
                                                {kindLabels[a.kind]}
                                            </Badge>
                                            <span className="text-primary">
                                                {a.message}
                                                {a.reason && <span className="text-tertiary"> · {a.reason.replace("_", " ")}</span>}
                                            </span>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        {a.locationId ? <LocationName id={a.locationId} /> : <span className="text-quaternary">Company-wide</span>}
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        {a.quantity !== undefined && a.quantity !== null ? (
                                            <span className={`font-semibold tabular-nums ${signedClass(a.quantity)}`}>{formatSigned(a.quantity)}</span>
                                        ) : (
                                            <span className="text-quaternary">—</span>
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
                {visible.length > shown.length && (
                    <div className="flex justify-center border-t border-secondary p-4">
                        <Button size="md" color="secondary" onPress={() => setLimit((l) => l + PAGE)}>
                            Show more ({visible.length - shown.length} left)
                        </Button>
                    </div>
                )}
            </TableCard.Root>
        </div>
    );
}
