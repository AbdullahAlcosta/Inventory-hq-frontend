"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import type { Scope } from "@/hooks/use-session";
import type { ChannelType, ComplianceFlag } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";
import { ChannelLogo, channelMeta } from "./channel-logo";
import { SyncSettingsFields } from "./sync-settings-fields";

const channelTypes: ChannelType[] = ["quickvee", "shopify", "woocommerce"];

export const ConnectChannelModal = ({
    isOpen,
    onOpenChange,
    scope,
    presetStoreId,
    presetBusinessUnitId,
}: {
    isOpen: boolean;
    onOpenChange: (o: boolean) => void;
    scope: Scope;
    /** Open for this store (Quickvee here; Shopify/WooCommerce fulfilled from it). Brand and store are then fixed. */
    presetStoreId?: string;
    /** Open for this brand (store picker limited to its stores; brand is fixed). */
    presetBusinessUnitId?: string;
}) => {
    const businessUnits = useAppStore((s) => s.businessUnits);
    const allLocations = useAppStore((s) => s.locations);
    const addConnection = useAppStore((s) => s.addConnection);

    const [channel, setChannel] = useState<ChannelType>("quickvee");
    const [storeId, setStoreId] = useState<string | null>(null);
    const [buId, setBuId] = useState<string | null>(null);
    const [syncMode, setSyncMode] = useState<"live" | "scheduled">("scheduled");
    const [schedule, setSchedule] = useState("Twice daily · 6:00 AM & 6:00 PM");
    const [buffer, setBuffer] = useState(1);
    const [flags, setFlags] = useState<ComplianceFlag[]>([]);
    const [name, setName] = useState("");

    const level = channelMeta[channel].level;
    const presetStore = presetStoreId ? allLocations.find((l) => l.id === presetStoreId) : undefined;
    const presetBu = presetStore?.businessUnitId ?? presetBusinessUnitId;
    const isPreset = !!presetBu;
    // Setup can open this for any brand in the company, so don't narrow by the sidebar switcher then.
    const scopeStores = useMemo(
        () => (presetBu ? allLocations.filter((l) => l.type === "store" && l.businessUnitId === presetBu && (!presetStore || l.id === presetStore.id)) : scope.stores),
        [presetBu, presetStore, allLocations, scope.stores],
    );
    const bus = businessUnits.filter((b) => (presetBu ? b.id === presetBu : scope.activeBusinessUnitIds.includes(b.id)));
    const storesForBu = useMemo(() => scopeStores.filter((s) => !buId || s.businessUnitId === buId), [scopeStores, buId]);

    useEffect(() => {
        if (!isOpen) return;
        setChannel("quickvee");
        setStoreId(scopeStores[0]?.id ?? null);
        setBuId(presetBu ?? scope.activeBusinessUnitIds[0] ?? null);
        setSyncMode("scheduled");
        setSchedule("Twice daily · 6:00 AM & 6:00 PM");
        setBuffer(1);
        setFlags([]);
        setName("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, scope, presetBu]);

    // Sensible defaults per channel: slower channels get a bigger buffer.
    const pickChannel = (c: ChannelType) => {
        setChannel(c);
        if (c === "quickvee") {
            setSyncMode("scheduled");
            setSchedule("Twice daily · 6:00 AM & 6:00 PM");
            setBuffer(1);
        } else {
            setSyncMode(c === "shopify" ? "live" : "scheduled");
            setSchedule(c === "shopify" ? "Live" : "Every 30 minutes");
            setBuffer(c === "shopify" ? 2 : 4);
            if (buId && !scopeStores.some((s) => s.id === storeId && s.businessUnitId === buId)) setStoreId(scopeStores.find((s) => s.businessUnitId === buId)?.id ?? null);
        }
    };

    const store = scopeStores.find((s) => s.id === storeId);
    const bu = businessUnits.find((b) => b.id === (level === "store" ? store?.businessUnitId : buId));
    const defaultName = level === "store" ? `${channelMeta[channel].label} · ${store?.name ?? ""}` : `${channelMeta[channel].label} · ${bu?.name ?? ""} Online`;
    const fulfillingOk = level === "store" ? !!store : !!buId && !!store && store.businessUnitId === buId;

    const submit = () => {
        if (!fulfillingOk || !bu || !store) return;
        const finalName = name.trim() || defaultName;
        addConnection({
            channel,
            level,
            businessUnitId: bu.id,
            locationId: store.id,
            name: finalName,
            syncMode,
            schedule: syncMode === "live" ? "Live" : schedule,
            safetyBuffer: buffer,
            blockedFlags: flags,
        });
        toast.success("Channel connected", `${finalName} is ready. Push products from its page.`);
        onOpenChange(false);
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title="Connect a sales channel"
            description="Every channel plugs into the same connector, so adding a new one later works the same way."
            size="md"
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button color="primary" size="lg" isDisabled={!fulfillingOk} onPress={submit}>
                        Connect channel
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <div>
                    <p className="mb-1.5 text-sm font-medium text-secondary">Channel</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {channelTypes.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => pickChannel(c)}
                                className={cx(
                                    "flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition duration-100 ease-linear",
                                    channel === c ? "bg-primary ring-2 ring-gray-950" : "bg-primary ring-secondary hover:bg-primary_hover",
                                )}
                            >
                                <ChannelLogo channel={c} size="sm" />
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-primary">{channelMeta[c].label}</span>
                                    <span className="block text-xs text-tertiary">{channelMeta[c].level === "store" ? "Store level" : "Brand level"}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {isPreset && presetStore ? (
                    <div className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary">
                        {level === "store" ? (
                            <>
                                Connects <b>{presetStore.name}</b> and sells its stock.
                            </>
                        ) : (
                            <>
                                One online store for <b>{bu?.name}</b>, fulfilled from <b>{presetStore.name}</b>.
                            </>
                        )}
                    </div>
                ) : level === "store" ? (
                    <Select
                        label="Store"
                        hint="Quickvee connects one store at a time and sells that store's stock."
                        items={scopeStores.map((s) => ({ id: s.id, label: s.name }))}
                        selectedKey={storeId}
                        onSelectionChange={(k) => setStoreId(k as string)}
                        placeholder="Pick a store"
                    >
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Brand"
                            isDisabled={isPreset}
                            items={bus.map((b) => ({ id: b.id, label: b.name }))}
                            selectedKey={buId}
                            onSelectionChange={(k) => {
                                setBuId(k as string);
                                setStoreId(scopeStores.find((s) => s.businessUnitId === k)?.id ?? null);
                            }}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <Select
                            label="Fulfilling store"
                            hint="Online orders sell from this store's stock."
                            items={storesForBu.map((s) => ({ id: s.id, label: s.name }))}
                            selectedKey={storeId}
                            onSelectionChange={(k) => setStoreId(k as string)}
                            placeholder={storesForBu.length ? "Pick a store" : "No stores in this brand"}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>
                )}

                <Input label="Connection name" placeholder={defaultName} value={name} onChange={setName} hint="Leave blank to use the suggested name." />

                <SyncSettingsFields
                    syncMode={syncMode}
                    schedule={schedule}
                    buffer={buffer}
                    flags={flags}
                    onSyncMode={setSyncMode}
                    onSchedule={setSchedule}
                    onBuffer={setBuffer}
                    onFlags={setFlags}
                />
            </div>
        </ModalDialog>
    );
};
