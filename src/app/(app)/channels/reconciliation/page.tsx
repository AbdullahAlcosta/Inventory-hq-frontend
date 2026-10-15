"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, ClockRefresh, RefreshCw01, Upload01 } from "@untitledui/icons";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { LocationName, VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { ChannelLogo } from "@/components/app/channels/channel-logo";
import { sourceLabel, syncLabel, useEyebrow, useScopedConnections } from "@/components/app/channels/channel-utils";
import { UploadExportModal } from "@/components/app/channels/upload-export-modal";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatSigned, timeAgo } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export default function ReconciliationPage() {
    const scope = useRequiredScope();
    const eyebrow = useEyebrow(scope);
    const connections = useScopedConnections(scope);
    const mismatches = useAppStore((s) => s.mismatches);
    const approvals = useAppStore((s) => s.approvals);
    const pullFromChannel = useAppStore((s) => s.pullFromChannel);

    const [filter, setFilter] = useState<"open" | "handled">("open");
    const [uploadOpen, setUploadOpen] = useState(false);

    const ids = useMemo(() => new Set(connections.map((c) => c.id)), [connections]);
    const scoped = useMemo(() => mismatches.filter((m) => ids.has(m.connectionId)), [mismatches, ids]);
    const approvalFor = (mismatchId: string) => approvals.find((a) => a.payload.type === "mismatch" && a.payload.mismatchId === mismatchId);

    const open = scoped.filter((m) => m.status === "open");
    const handledThisWeek = scoped.filter((m) => {
        if (m.status !== "handled") return false;
        const at = approvalFor(m.id)?.decidedAt ?? m.detectedAt;
        return Date.now() - new Date(at).getTime() <= WEEK;
    });
    const errors = connections.filter((c) => c.status === "error");
    const lastPull = connections
        .map((c) => c.lastSyncAt)
        .filter(Boolean)
        .sort()
        .at(-1);

    const rows = scoped.filter((m) => m.status === filter).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

    const pull = (id: string) => {
        const c = connections.find((x) => x.id === id)!;
        const r = pullFromChannel(id);
        if (c.status === "error") toast.error("Pull failed", `${c.name} rejected our credentials. A sync failure was added to Approvals.`);
        else if (r.mismatches) toast.warning(`${r.mismatches} mismatch${r.mismatches === 1 ? "" : "es"} found`, `${c.name} — each one is waiting in Approvals.`);
        else toast.success("Pulled sales & stock", `${c.name} matches what we expect.`);
    };

    return (
        <>
            <PageHeader
                eyebrow={eyebrow}
                title="Reconciliation"
                description="Quickvee is pulled twice daily per store; Shopify and WooCommerce per brand. Any mismatch is flagged, no minimum."
                actions={
                    <Button color="primary" iconLeading={Upload01} onPress={() => setUploadOpen(true)} isDisabled={!connections.length}>
                        Upload export
                    </Button>
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Open mismatches" value={open.length} icon={AlertTriangle} tone={open.length ? "warning" : "default"} href="/approvals" hint="Waiting in Approvals" />
                <StatCard label="Handled this week" value={handledThisWeek.length} icon={CheckCircle} tone="success" />
                <StatCard label="Connections with errors" value={errors.length} icon={AlertTriangle} tone={errors.length ? "error" : "default"} hint={errors[0]?.name} />
                <StatCard label="Last pull" value={lastPull ? timeAgo(lastPull) : "Never"} icon={ClockRefresh} hint={lastPull ? formatDateTime(lastPull) : undefined} />
            </div>

            <TableCard.Root className="mt-6 rounded-2xl">
                <TableCard.Header title="Connections" description="Expected vs reported, per connection." />
                {connections.length === 0 ? (
                    <Empty title="No connections" description="Connect a sales channel to start reconciling." />
                ) : (
                    <Table aria-label="Connections" size="sm">
                        <Table.Header>
                            <Table.Head label="Connection" isRowHeader />
                            <Table.Head label="Status" />
                            <Table.Head label="Schedule" />
                            <Table.Head label="Last sync" />
                            <Table.Head label="Open mismatches" />
                            <Table.Head label="" />
                        </Table.Header>
                        <Table.Body items={connections}>
                            {(c) => {
                                const count = open.filter((m) => m.connectionId === c.id).length;
                                return (
                                    <Table.Row id={c.id}>
                                        <Table.Cell>
                                            <span className="flex items-center gap-3">
                                                <ChannelLogo channel={c.channel} size="sm" />
                                                <span className="font-medium whitespace-nowrap text-primary">{c.name}</span>
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <StatusBadge status={c.status} size="sm" />
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{syncLabel(c)}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{c.lastSyncAt ? timeAgo(c.lastSyncAt) : "Never"}</Table.Cell>
                                        <Table.Cell className={cx("font-semibold tabular-nums", count ? "text-warning-primary" : "text-primary")}>{count}</Table.Cell>
                                        <Table.Cell>
                                            <Button size="xs" color="secondary" iconLeading={RefreshCw01} onPress={() => pull(c.id)}>
                                                Pull now
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <TableCard.Root className="mt-6 rounded-2xl">
                <div className="flex flex-col gap-3 border-b border-secondary px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <div>
                        <h2 className="text-md font-semibold text-primary">Mismatch report</h2>
                        <p className="text-sm text-tertiary">Where a channel reports a different number than we expect it to show.</p>
                    </div>
                    <FilterPills
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { id: "open", label: "Open", count: open.length },
                            { id: "handled", label: "Handled", count: scoped.length - open.length },
                        ]}
                    />
                </div>
                {rows.length === 0 ? (
                    <Empty icon={CheckCircle} title={filter === "open" ? "No open mismatches" : "Nothing handled yet"} description="Pull from a channel or upload an export to compare." />
                ) : (
                    <Table aria-label="Mismatches" size="sm">
                        <Table.Header>
                            <Table.Head label="Connection" isRowHeader />
                            <Table.Head label="Location" />
                            <Table.Head label="Item" />
                            <Table.Head label="Expected" />
                            <Table.Head label="Reported" />
                            <Table.Head label="Difference" />
                            <Table.Head label="Source" />
                            <Table.Head label="Detected" />
                            <Table.Head label="Status" />
                            <Table.Head label="" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(m) => {
                                const c = connections.find((x) => x.id === m.connectionId)!;
                                const diff = m.reported - m.expected;
                                const approval = approvalFor(m.id);
                                return (
                                    <Table.Row id={m.id}>
                                        <Table.Cell>
                                            <span className="flex items-center gap-2 whitespace-nowrap">
                                                <ChannelLogo channel={c.channel} size="sm" />
                                                <span className="font-medium text-primary">{c.name.split(" · ")[0]}</span>
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            <LocationName id={m.locationId} />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <VariantCell variantId={m.variantId} />
                                        </Table.Cell>
                                        <Table.Cell className="tabular-nums">{m.expected}</Table.Cell>
                                        <Table.Cell className="tabular-nums">{m.reported}</Table.Cell>
                                        <Table.Cell className={cx("font-semibold tabular-nums", diff < 0 ? "text-error-primary" : "text-warning-primary")}>{formatSigned(diff)}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{sourceLabel[m.source]}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{timeAgo(m.detectedAt)}</Table.Cell>
                                        <Table.Cell>
                                            <StatusBadge status={m.status} size="sm" />
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Button size="xs" color="secondary" href={approval ? `/approvals?id=${approval.id}` : "/approvals"}>
                                                Review
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <UploadExportModal isOpen={uploadOpen} onOpenChange={setUploadOpen} connections={connections} />
        </>
    );
}
