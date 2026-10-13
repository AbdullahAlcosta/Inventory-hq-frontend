"use client";

import { useState } from "react";
import Link from "next/link";
import { Link01, Plus } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Empty } from "@/components/app/empty";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ChannelLogo } from "@/components/app/channels/channel-logo";
import { flagLabel, syncLabel, useEyebrow, useScopedConnections } from "@/components/app/channels/channel-utils";
import { ConnectChannelModal } from "@/components/app/channels/connect-channel-modal";
import { useRequiredScope } from "@/hooks/use-session";
import { pluralize, timeAgo } from "@/lib/format";
import type { ChannelConnection } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

const ConnectionCard = ({ connection }: { connection: ChannelConnection }) => {
    const listings = useAppStore((s) => s.listings);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const mine = listings.filter((l) => l.connectionId === connection.id);
    const counts = {
        synced: mine.filter((l) => l.status === "synced").length,
        blocked: mine.filter((l) => l.status === "blocked").length,
        failed: mine.filter((l) => l.status === "failed").length,
    };
    const store = locations.find((l) => l.id === connection.locationId);
    const bu = businessUnits.find((b) => b.id === connection.businessUnitId);

    return (
        <Link
            href={`/channels/connections/view?id=${connection.id}`}
            className="group flex flex-col rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary outline-hidden transition duration-100 ease-linear hover:ring-gray-300 focus-visible:ring-2 focus-visible:ring-brand"
        >
            <div className="flex items-start gap-3">
                <ChannelLogo channel={connection.channel} />
                <div className="min-w-0 flex-1">
                    <p className="text-md font-semibold text-primary group-hover:underline">{connection.name}</p>
                    <p className="text-sm text-tertiary">{connection.level === "store" ? store?.name : `${bu?.name} · fulfilled by ${store?.name ?? "—"}`}</p>
                    <div className="mt-2">
                        <StatusBadge status={connection.status} size="sm" />
                    </div>
                </div>
            </div>
            <dl className="mt-5 mb-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                    <dt className="text-tertiary">Sync</dt>
                    <dd className="font-medium text-primary">{syncLabel(connection)}</dd>
                </div>
                <div>
                    <dt className="text-tertiary">Safety buffer</dt>
                    <dd className="font-medium text-primary">{pluralize(connection.safetyBuffer, "unit")}</dd>
                </div>
                <div>
                    <dt className="text-tertiary">Last sync</dt>
                    <dd className="font-medium text-primary">{connection.lastSyncAt ? timeAgo(connection.lastSyncAt) : "Never"}</dd>
                </div>
                <div>
                    <dt className="text-tertiary">Blocked flags</dt>
                    <dd className="font-medium text-primary">{connection.blockedFlags.length ? connection.blockedFlags.map(flagLabel).join(", ") : "None"}</dd>
                </div>
            </dl>
            <div className="mt-auto flex flex-wrap gap-2 border-t border-secondary pt-4 text-xs font-medium">
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">{counts.synced} synced</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{counts.blocked} blocked</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{counts.failed} failed</span>
            </div>
        </Link>
    );
};

export default function ConnectionsPage() {
    const scope = useRequiredScope();
    const eyebrow = useEyebrow(scope);
    const connections = useScopedConnections(scope);
    const [open, setOpen] = useState(false);

    const groups = [
        { title: "Store-level (Quickvee)", description: "One connection per store. Sells that store's stock.", items: connections.filter((c) => c.level === "store") },
        {
            title: "Business-unit level (Shopify, WooCommerce)",
            description: "One online store per business unit, fulfilled from one store's stock.",
            items: connections.filter((c) => c.level === "business_unit"),
        },
    ];

    return (
        <>
            <PageHeader
                eyebrow={eyebrow}
                title="Connections"
                description="Each channel plugs into the same connector: new channels are added the same way, without changing how stock works."
                actions={
                    scope.canManageChannels && (
                        <Button color="primary" size="md" iconLeading={Plus} onPress={() => setOpen(true)}>
                            Connect channel
                        </Button>
                    )
                }
            />
            {connections.length === 0 ? (
                <div className="rounded-2xl bg-primary ring-1 ring-secondary">
                    <Empty icon={Link01} title="No channels connected" description="Connect Quickvee, Shopify or WooCommerce to start selling this stock." />
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    {groups.map((g) =>
                        g.items.length ? (
                            <section key={g.title}>
                                <h2 className="text-lg font-semibold text-primary">{g.title}</h2>
                                <p className="mb-3 text-sm text-tertiary">{g.description}</p>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {g.items.map((c) => (
                                        <ConnectionCard key={c.id} connection={c} />
                                    ))}
                                </div>
                            </section>
                        ) : null,
                    )}
                </div>
            )}
            <ConnectChannelModal isOpen={open} onOpenChange={setOpen} scope={scope} />
        </>
    );
}
