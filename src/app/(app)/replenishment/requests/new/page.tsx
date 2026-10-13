"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { Trash01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { LineTable, QtyStepper, Td } from "@/components/app/purchasing/flow-ui";
import { canCreateRequest } from "@/components/app/replenishment/request-utils";
import { LocationIcon } from "@/components/app/sidebar";
import { toast } from "@/components/app/toast";
import { VariantPicker } from "@/components/app/variant-picker";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { TextArea } from "@/components/base/textarea/textarea";
import { useRequiredScope } from "@/hooks/use-session";
import { formatNumber } from "@/lib/format";
import { stockAt } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

export default function NewStoreRequestPage() {
    const scope = useRequiredScope();
    return (
        <Suspense>
            {/* Start over when the Location switcher changes store. */}
            <NewStoreRequest key={scope.activeLocation?.id ?? "none"} />
        </Suspense>
    );
}

interface Line {
    variantId: string;
    requestedQty: number;
}

function NewStoreRequest() {
    const scope = useRequiredScope();
    const router = useRouter();
    const params = useSearchParams();
    const locations = useAppStore((s) => s.locations);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const createStoreRequest = useAppStore((s) => s.createStoreRequest);

    // Gated to a store by the app shell.
    const store = scope.activeLocation!;

    // Where stock can come from: the business unit's warehouse first, then the other stores in the same business unit.
    const sources = useMemo(
        () =>
            locations
                .filter((l) => l.businessUnitId === store.businessUnitId && l.id !== store.id)
                .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "warehouse" ? -1 : 1)),
        [locations, store],
    );
    const [sourceId, setSourceId] = useState<string | null>(() => {
        const fromParam = params.get("source");
        if (fromParam && sources.some((s) => s.id === fromParam)) return fromParam;
        return sources.find((s) => s.type === "warehouse")?.id ?? sources[0]?.id ?? null;
    });
    const source = sources.find((s) => s.id === sourceId);

    const prefill = params.get("variant");
    const prefillBu = products.find((p) => p.id === variants.find((v) => v.id === prefill)?.productId)?.businessUnitId;

    const [lines, setLines] = useState<Line[]>([]);
    const [note, setNote] = useState("");
    const [touched, setTouched] = useState(false);
    const prefilled = useRef(false);

    // ?variant=<id> from product lookup / stock pages.
    useEffect(() => {
        if (prefilled.current || !prefill) return;
        prefilled.current = true;
        if (prefillBu === store.businessUnitId) setLines([{ variantId: prefill, requestedQty: 1 }]);
    }, [prefill, prefillBu, store]);

    const totalUnits = useMemo(() => lines.reduce((a, l) => a + l.requestedQty, 0), [lines]);
    const availableAt = (variantId: string, locationId: string) => stockAt({ stockLevels }, variantId, locationId).available;

    if (!canCreateRequest(scope)) {
        return (
            <div>
                <PageHeader backHref="/replenishment/requests" backLabel="Store Requests" title="New store request" />
                <Card>
                    <p className="text-md text-tertiary">Store requests are opened by the staff of a store. Pick one of your stores in the location switcher.</p>
                </Card>
            </div>
        );
    }

    const shortLines = source ? lines.filter((l) => availableAt(l.variantId, source.id) < l.requestedQty) : [];
    const errors = [lines.length === 0 && "Add at least one item.", !source && "Choose where the stock comes from."].filter(Boolean) as string[];

    const submit = () => {
        setTouched(true);
        if (errors.length || !source) return;
        const id = createStoreRequest({ storeId: store.id, sourceId: source.id, lines, note: note.trim() });
        if (source.type === "store") toast.success("Transfer sent for warehouse approval", `${source.name} can ship once the warehouse manager approves.`);
        else toast.success(`Request sent to ${source.name}`, `${lines.length} item${lines.length === 1 ? "" : "s"} · ${totalUnits} units`);
        router.push(`/replenishment/requests/view?id=${id}`);
    };

    return (
        <div className="flex flex-col gap-6 pb-24 md:pb-0">
            <PageHeader
                className="mb-0"
                backHref="/replenishment/requests"
                backLabel="Store Requests"
                eyebrow={store.name}
                title="New store request"
                description={`Ask the warehouse or another store for stock. They pick, pack and ship it to ${store.name}.`}
            />

            <Card
                title="Get stock from"
                description={`${lines.length ? "Available units of the items below at each location." : "Add items below to see what each location has."} Requests to another store need the warehouse manager’s approval first.`}
            >
                {sources.length === 0 ? (
                    <p className="text-sm text-tertiary">There is no warehouse or other store in this business unit to request from.</p>
                ) : (
                    <AriaRadioGroup aria-label="Get stock from" value={sourceId} onChange={setSourceId} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sources.map((s) => {
                            const units = lines.reduce((a, l) => a + Math.min(availableAt(l.variantId, s.id), l.requestedQty), 0);
                            const covered = lines.filter((l) => availableAt(l.variantId, s.id) >= l.requestedQty).length;
                            const totalAvailable = lines.reduce((a, l) => a + availableAt(l.variantId, s.id), 0);
                            return (
                                <AriaRadio
                                    key={s.id}
                                    value={s.id}
                                    className={({ isSelected, isFocusVisible }) =>
                                        cx(
                                            "flex cursor-pointer flex-col gap-3 rounded-xl p-4 ring-1 outline-hidden transition duration-100 ease-linear ring-inset",
                                            isSelected ? "bg-primary ring-2 ring-gray-950" : "bg-primary ring-secondary hover:bg-primary_hover",
                                            isFocusVisible && "ring-2 ring-brand",
                                        )
                                    }
                                >
                                    {({ isSelected }) => (
                                        <>
                                            <div className="flex items-start gap-3">
                                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-secondary">
                                                    <LocationIcon type={s.type} className="size-4" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-primary">{s.name}</span>
                                                    <span className="block truncate text-xs text-tertiary">
                                                        {s.type === "warehouse" ? "Warehouse" : "Store"} · {s.code}
                                                    </span>
                                                </span>
                                                <span
                                                    className={cx(
                                                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                                                        isSelected ? "bg-gray-950 ring-gray-950" : "ring-primary",
                                                    )}
                                                    aria-hidden="true"
                                                >
                                                    {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                                                </span>
                                            </div>
                                            {s.type === "warehouse" ? (
                                                <Badge type="pill-color" color="gray" size="sm" className="self-start">
                                                    Default
                                                </Badge>
                                            ) : (
                                                <Badge type="pill-color" color="blue" size="sm" className="self-start">
                                                    Store → store
                                                </Badge>
                                            )}
                                            {lines.length > 0 && (
                                                <div className="border-t border-secondary pt-3 text-sm">
                                                    <p className="text-tertiary">
                                                        <span className="font-semibold text-primary tabular-nums">{formatNumber(totalAvailable)}</span> available of these items
                                                    </p>
                                                    <p className={cx("text-xs", covered < lines.length ? "text-warning-primary" : "text-success-primary")}>
                                                        {covered === lines.length
                                                            ? "Can fill the whole request"
                                                            : `Can fill ${formatNumber(units)} of ${formatNumber(totalUnits)} units · ${covered}/${lines.length} lines in full`}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </AriaRadio>
                            );
                        })}
                    </AriaRadioGroup>
                )}
            </Card>

            <Card title="Items" flush>
                <div className="border-b border-secondary px-5 py-4 md:px-6">
                    <VariantPicker
                        businessUnitIds={[store.businessUnitId]}
                        exclude={lines.map((l) => l.variantId)}
                        onSelect={(variantId) => setLines((ls) => [...ls, { variantId, requestedQty: 1 }])}
                        placeholder="Add an item — search name or SKU…"
                    />
                </div>
                {lines.length === 0 ? (
                    <Empty title="No items yet" description="Search above to add what your store needs." />
                ) : (
                    <LineTable
                        columns={[
                            { label: "Item" },
                            { label: `Available at ${store.name}` },
                            { label: source ? `Available at ${source.name}` : "Available at source" },
                            { label: "Request" },
                            { label: <span className="sr-only">Remove</span> },
                        ]}
                    >
                        {lines.map((l) => {
                            const atStore = availableAt(l.variantId, store.id);
                            const atSource = source ? availableAt(l.variantId, source.id) : 0;
                            const short = atSource < l.requestedQty;
                            return (
                                <tr key={l.variantId}>
                                    <Td className="min-w-60">
                                        <VariantCell variantId={l.variantId} link={false} />
                                    </Td>
                                    <Td className="font-medium text-primary tabular-nums">{formatNumber(atStore)}</Td>
                                    <Td>
                                        <span className={cx("font-medium tabular-nums", short ? "text-warning-primary" : "text-primary")}>{formatNumber(atSource)}</span>
                                        {short && <span className="block text-xs text-warning-primary">{atSource === 0 ? "None available — will ship short" : "More than available — may ship short"}</span>}
                                    </Td>
                                    <Td>
                                        <QtyStepper label="Quantity" value={l.requestedQty} min={1} onChange={(v) => setLines((ls) => ls.map((x) => (x.variantId === l.variantId ? { ...x, requestedQty: v } : x)))} />
                                    </Td>
                                    <Td className="w-12">
                                        <ButtonUtility icon={Trash01} tooltip="Remove" size="xs" color="tertiary" onPress={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))} />
                                    </Td>
                                </tr>
                            );
                        })}
                    </LineTable>
                )}
            </Card>

            {source && shortLines.length > 0 && (
                <div className="rounded-xl bg-warning-primary px-4 py-3 text-sm text-warning-primary ring-1 ring-orange-200 ring-inset">
                    You’re asking for more than {source.name} has available on {shortLines.length} line{shortLines.length === 1 ? "" : "s"}. Anything they can’t pick ships short
                    {sources.length > 1 ? " — or choose another location above." : "."}
                </div>
            )}

            <Card title="Note">
                <TextArea aria-label="Note" placeholder={`Anything ${source?.name ?? "the sender"} should know (e.g. needed before the weekend)`} rows={3} value={note} onChange={setNote} />
            </Card>

            {touched && errors.length > 0 && <div className="rounded-xl bg-error-primary px-4 py-3 text-sm text-error-primary ring-1 ring-red-200 ring-inset">{errors.join(" ")}</div>}

            <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-secondary bg-primary px-4 py-3 md:static md:rounded-2xl md:px-6 md:py-4 md:ring-1 md:ring-secondary">
                <p className="text-sm text-tertiary">
                    <span className="font-semibold text-primary">{lines.length}</span> item{lines.length === 1 ? "" : "s"} · <span className="font-semibold text-primary">{formatNumber(totalUnits)}</span> unit{totalUnits === 1 ? "" : "s"}
                    {source && <span className="hidden sm:inline"> · from {source.name}</span>}
                </p>
                <div className="flex gap-3">
                    <Button color="secondary" size="lg" href="/replenishment/requests" className="hidden sm:inline-flex">
                        Cancel
                    </Button>
                    <Button size="lg" onPress={submit}>
                        Send request
                    </Button>
                </div>
            </div>
        </div>
    );
}
