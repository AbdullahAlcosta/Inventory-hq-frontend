"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RefreshCw01, SearchLg, UploadCloud02 } from "@untitledui/icons";
import type { Selection } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { ChannelLogo, channelMeta } from "@/components/app/channels/channel-logo";
import { flagLabel, syncLabel, useScopedConnections } from "@/components/app/channels/channel-utils";
import { ModeBadge } from "@/components/app/channels/mode-badge";
import { SyncSettingsFields } from "@/components/app/channels/sync-settings-fields";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, timeAgo } from "@/lib/format";
import { allocationFor, blockedFlagsFor, channelAllocation, stockAt } from "@/lib/selectors";
import type { ChannelConnection, ComplianceFlag } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

const SettingsCard = ({ connection }: { connection: ChannelConnection }) => {
    const updateConnection = useAppStore((s) => s.updateConnection);
    const [syncMode, setSyncMode] = useState(connection.syncMode);
    const [schedule, setSchedule] = useState(connection.schedule);
    const [buffer, setBuffer] = useState(connection.safetyBuffer);
    const [flags, setFlags] = useState<ComplianceFlag[]>(connection.blockedFlags);
    const dirty =
        syncMode !== connection.syncMode ||
        (syncMode === "scheduled" && schedule !== connection.schedule) ||
        buffer !== connection.safetyBuffer ||
        flags.slice().sort().join() !== connection.blockedFlags.slice().sort().join();

    return (
        <Card
            title="Settings"
            description="Changes apply to this connection only."
            actions={
                <Button
                    size="sm"
                    color="primary"
                    isDisabled={!dirty}
                    onPress={() => {
                        updateConnection(connection.id, { syncMode, schedule: syncMode === "live" ? "Live" : schedule, safetyBuffer: buffer, blockedFlags: flags });
                        toast.success("Settings saved", `${connection.name} will use the new settings on its next sync.`);
                    }}
                >
                    Save
                </Button>
            }
        >
            <SyncSettingsFields
                wide
                syncMode={syncMode}
                schedule={schedule}
                buffer={buffer}
                flags={flags}
                onSyncMode={setSyncMode}
                onSchedule={setSchedule}
                onBuffer={setBuffer}
                onFlags={setFlags}
            />
        </Card>
    );
};

export default function ConnectionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const scope = useRequiredScope();
    const scoped = useScopedConnections(scope);
    const connection = scoped.find((c) => c.id === id);

    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const allocations = useAppStore((s) => s.allocations);
    const listings = useAppStore((s) => s.listings);
    const locations = useAppStore((s) => s.locations);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const pushToChannel = useAppStore((s) => s.pushToChannel);
    const pullFromChannel = useAppStore((s) => s.pullFromChannel);
    const updateConnection = useAppStore((s) => s.updateConnection);

    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Selection>(new Set());
    const [lastPush, setLastPush] = useState<{ pushed: number; blocked: number } | null>(null);

    const rows = useMemo(() => {
        if (!connection) return [];
        const q = query.trim().toLowerCase();
        return variants
            .map((v) => ({ v, p: products.find((p) => p.id === v.productId)! }))
            .filter(({ p }) => p && p.businessUnitId === connection.businessUnitId && p.status !== "archived")
            .filter(({ v, p }) => !q || `${p.name} ${v.name} ${v.sku}`.toLowerCase().includes(q))
            .map(({ v, p }) => {
                const data = { stockLevels, allocations };
                const alloc = allocationFor(data, v.id, connection.locationId ?? "");
                const { allocated, sellable } = channelAllocation(data, v.id, connection);
                return {
                    id: v.id,
                    blocked: blockedFlagsFor(p, connection),
                    available: connection.locationId ? stockAt(data, v.id, connection.locationId).available : 0,
                    mode: alloc.mode,
                    allocated,
                    sellable,
                    listing: listings.find((l) => l.connectionId === connection.id && l.variantId === v.id),
                };
            });
    }, [connection, variants, products, stockLevels, allocations, listings, query]);

    if (!connection) {
        return (
            <>
                <PageHeader backHref="/channels/connections" backLabel="Connections" title="Connection not found" />
                <div className="rounded-2xl bg-primary ring-1 ring-secondary">
                    <Empty title="Not available" description="This connection doesn't exist or isn't in your business units." />
                </div>
            </>
        );
    }

    const store = locations.find((l) => l.id === connection.locationId);
    const bu = businessUnits.find((b) => b.id === connection.businessUnitId);
    const selectedIds = selected === "all" ? rows.map((r) => r.id) : rows.filter((r) => selected.has(r.id)).map((r) => r.id);

    const push = (ids: string[]) => {
        const result = pushToChannel(connection.id, ids);
        setSelected(new Set());
        setLastPush(result);
        if (result.blocked) {
            toast.warning(
                `Pushed ${result.pushed}, blocked ${result.blocked}`,
                "Blocked items failed the compliance check and were sent to Approvals.",
            );
        } else if (connection.status === "error") {
            toast.error("Push failed", "This connection has an error. Reconnect it, then push again.");
        } else {
            toast.success(`Pushed ${result.pushed} item${result.pushed === 1 ? "" : "s"}`, `${connection.name} now shows the new sellable quantities.`);
        }
    };

    return (
        <>
            <PageHeader
                backHref="/channels/connections"
                backLabel="Connections"
                eyebrow={bu?.name}
                title={
                    <span className="flex items-center gap-3">
                        <ChannelLogo channel={connection.channel} />
                        <span className="min-w-0 truncate">{connection.name}</span>
                    </span>
                }
                description={
                    <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={connection.status} size="sm" />
                        <span>
                            {channelMeta[connection.channel].label} · {connection.level === "store" ? `Store: ${store?.name}` : `${bu?.name} · fulfilled by ${store?.name}`} · Sync{" "}
                            {syncLabel(connection)} · Last sync {connection.lastSyncAt ? timeAgo(connection.lastSyncAt) : "never"}
                        </span>
                    </span>
                }
                actions={
                    <>
                        {connection.status === "error" && (
                            <Button
                                color="secondary"
                                onPress={() => {
                                    updateConnection(connection.id, { status: "connected" });
                                    toast.success("Reconnected", `${connection.name} is connected again.`);
                                }}
                            >
                                Reconnect
                            </Button>
                        )}
                        <Button
                            color="secondary"
                            iconLeading={RefreshCw01}
                            onPress={() => {
                                if (connection.status === "error") {
                                    pullFromChannel(connection.id);
                                    toast.error("Pull failed", "The channel rejected our credentials. A sync failure was added to Approvals.");
                                    return;
                                }
                                const r = pullFromChannel(connection.id);
                                if (r.mismatches) toast.warning(`Pulled · ${r.mismatches} mismatch${r.mismatches === 1 ? "" : "es"}`, "Each one is waiting in Approvals.");
                                else toast.success("Pulled sales & stock", "Everything matches.");
                            }}
                        >
                            Pull sales & stock now
                        </Button>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <SettingsCard key={`${connection.id}-${connection.syncMode}-${connection.safetyBuffer}-${connection.blockedFlags.join()}-${connection.schedule}`} connection={connection} />
                <div className="min-w-0">
                    <TableCard.Root className="rounded-2xl">
                        <div className="flex flex-col gap-3 border-b border-secondary px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                            <div>
                                <h2 className="text-md font-semibold text-primary">Products</h2>
                                <p className="text-sm text-tertiary">A push affects this connection only. The compliance check runs first.</p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Input aria-label="Search" icon={SearchLg} size="sm" placeholder="Search item or SKU" value={query} onChange={setQuery} />
                                <Button size="sm" color="primary" iconLeading={UploadCloud02} isDisabled={!selectedIds.length} onPress={() => push(selectedIds)}>
                                    Push selected{selectedIds.length ? ` (${selectedIds.length})` : ""}
                                </Button>
                            </div>
                        </div>
                        {lastPush && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-secondary bg-secondary px-5 py-3 text-sm md:px-6">
                                <span className="font-medium text-primary">
                                    Last push: {lastPush.pushed} pushed · {lastPush.blocked} blocked
                                </span>
                                {lastPush.blocked > 0 && (
                                    <Link href="/approvals" className="font-semibold text-primary underline underline-offset-2">
                                        Review blocked items in Approvals
                                    </Link>
                                )}
                            </div>
                        )}
                        {rows.length === 0 ? (
                            <Empty title="No products" description="Nothing in this business unit matches." />
                        ) : (
                            <Table aria-label="Products for this connection" size="sm" selectionMode="multiple" selectionBehavior="toggle" selectedKeys={selected} onSelectionChange={setSelected}>
                                <Table.Header>
                                    <Table.Head label="Item" isRowHeader />
                                    <Table.Head label="Compliance" />
                                    <Table.Head label="Available" />
                                    <Table.Head label="Mode" />
                                    <Table.Head label="Allocated" />
                                    <Table.Head label="Buffer" />
                                    <Table.Head label="Sellable" tooltip="What the channel is told it can sell: allocated minus the safety buffer." />
                                    <Table.Head label="Listing" />
                                    <Table.Head label="Channel ID" />
                                    <Table.Head label="Last pushed" />
                                    <Table.Head label="" />
                                </Table.Header>
                                <Table.Body items={rows}>
                                    {(r) => (
                                        <Table.Row id={r.id}>
                                            <Table.Cell>
                                                <VariantCell variantId={r.id} />
                                            </Table.Cell>
                                            <Table.Cell>
                                                {r.blocked.length ? (
                                                    <span className="font-medium whitespace-nowrap text-error-primary">Blocked: {r.blocked.map(flagLabel).join(", ")}</span>
                                                ) : (
                                                    <span className="font-medium text-success-primary">OK</span>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell className="tabular-nums">{r.available}</Table.Cell>
                                            <Table.Cell>
                                                <ModeBadge mode={r.mode} />
                                            </Table.Cell>
                                            <Table.Cell className="tabular-nums">{r.allocated}</Table.Cell>
                                            <Table.Cell className="tabular-nums">−{connection.safetyBuffer}</Table.Cell>
                                            <Table.Cell className="font-semibold text-primary tabular-nums">{r.sellable}</Table.Cell>
                                            <Table.Cell>
                                                <span title={r.listing?.message}>
                                                    <StatusBadge status={r.listing?.status ?? "not_listed"} size="sm" />
                                                </span>
                                            </Table.Cell>
                                            <Table.Cell className="font-mono text-xs whitespace-nowrap">{r.listing?.externalId ?? "—"}</Table.Cell>
                                            <Table.Cell className="whitespace-nowrap">
                                                {r.listing?.lastPushedAt ? (
                                                    <>
                                                        <span className="block text-primary">{r.listing.lastPushedQty ?? "—"} units</span>
                                                        <span className="block text-xs">{formatDateTime(r.listing.lastPushedAt)}</span>
                                                    </>
                                                ) : (
                                                    "—"
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Button size="xs" color="secondary" onPress={() => push([r.id])}>
                                                    Push
                                                </Button>
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        )}
                    </TableCard.Root>
                </div>
            </div>
        </>
    );
}
