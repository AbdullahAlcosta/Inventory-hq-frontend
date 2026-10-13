"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { LineTable, QtyStepper, Td } from "@/components/app/purchasing/flow-ui";
import { canCreateRequest } from "@/components/app/replenishment/request-utils";
import { toast } from "@/components/app/toast";
import { VariantPicker } from "@/components/app/variant-picker";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { useRequiredScope } from "@/hooks/use-session";
import { formatNumber } from "@/lib/format";
import { stockAt } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

export default function NewStoreRequestPage() {
    return (
        <Suspense>
            <NewStoreRequest />
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

    const prefill = params.get("variant");
    const prefillBu = products.find((p) => p.id === variants.find((v) => v.id === prefill)?.productId)?.businessUnitId;

    const stores = scope.stores;
    const [storeId, setStoreId] = useState<string | null>(() => {
        const fromParam = params.get("store");
        if (fromParam && stores.some((s) => s.id === fromParam)) return fromParam;
        // Prefer a store in the prefilled item's BU.
        const candidates = prefillBu ? stores.filter((s) => s.businessUnitId === prefillBu) : stores;
        return candidates.length === 1 ? candidates[0].id : stores.length === 1 ? stores[0].id : null;
    });
    const store = stores.find((s) => s.id === storeId);
    const warehouse = locations.find((l) => l.type === "warehouse" && l.businessUnitId === store?.businessUnitId);

    const [lines, setLines] = useState<Line[]>([]);
    const [note, setNote] = useState("");
    const [touched, setTouched] = useState(false);
    const prefilled = useRef(false);

    // ?variant=<id> from product lookup.
    useEffect(() => {
        if (prefilled.current || !prefill || !store) return;
        if (prefillBu === store.businessUnitId) {
            setLines([{ variantId: prefill, requestedQty: 1 }]);
            prefilled.current = true;
        }
    }, [prefill, prefillBu, store]);

    // Lines must stay in the store's BU.
    useEffect(() => {
        if (!store) return;
        setLines((ls) => ls.filter((l) => products.find((p) => p.id === variants.find((v) => v.id === l.variantId)?.productId)?.businessUnitId === store.businessUnitId));
    }, [store, products, variants]);

    const totalUnits = useMemo(() => lines.reduce((a, l) => a + l.requestedQty, 0), [lines]);

    if (!canCreateRequest(scope)) {
        return (
            <div>
                <PageHeader backHref="/replenishment/requests" backLabel="Store Requests" title="New store request" />
                <Card>
                    <p className="text-md text-tertiary">Store requests are opened by store staff, managers and executives.</p>
                </Card>
            </div>
        );
    }

    const errors = [!storeId && "Choose a store.", lines.length === 0 && "Add at least one item.", !warehouse && store && "This store’s business unit has no warehouse."].filter(Boolean) as string[];

    const submit = () => {
        setTouched(true);
        if (errors.length || !storeId) return;
        const id = createStoreRequest({ storeId, lines, note: note.trim() });
        toast.success("Request sent to the warehouse", `${lines.length} item${lines.length === 1 ? "" : "s"} · ${totalUnits} units`);
        router.push(`/replenishment/requests/view?id=${id}`);
    };

    return (
        <div className="flex flex-col gap-6 pb-24 md:pb-0">
            <PageHeader className="mb-0" backHref="/replenishment/requests" backLabel="Store Requests" eyebrow="Replenishment" title="New store request" description="Ask the warehouse for stock. They pick, pack and ship it to your store." />

            <Card title="Store">
                {stores.length === 1 ? (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                        <p className="text-md font-semibold text-primary">{stores[0].name}</p>
                        <p className="text-sm text-tertiary">Ships from {warehouse?.name ?? "—"}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 md:items-end">
                        <Select
                            label="Request for store"
                            isRequired
                            placeholder="Choose a store"
                            items={stores.map((s) => ({ id: s.id, label: s.name, supportingText: s.code }))}
                            selectedKey={storeId}
                            onSelectionChange={(k) => setStoreId(k ? String(k) : null)}
                            isInvalid={touched && !storeId}
                        >
                            {(item) => (
                                <Select.Item id={item.id} supportingText={item.supportingText}>
                                    {item.label}
                                </Select.Item>
                            )}
                        </Select>
                        {warehouse && <p className="pb-2.5 text-sm text-tertiary">Ships from {warehouse.name}</p>}
                    </div>
                )}
            </Card>

            <Card title="Items" flush>
                <div className="border-b border-secondary px-5 py-4 md:px-6">
                    {store ? (
                        <VariantPicker
                            businessUnitIds={[store.businessUnitId]}
                            exclude={lines.map((l) => l.variantId)}
                            onSelect={(variantId) => setLines((ls) => [...ls, { variantId, requestedQty: 1 }])}
                            placeholder="Add an item — search name or SKU…"
                        />
                    ) : (
                        <p className="text-sm text-tertiary">Choose a store first.</p>
                    )}
                </div>
                {lines.length === 0 ? (
                    <Empty title="No items yet" description="Search above to add what your store needs." />
                ) : (
                    <LineTable columns={[{ label: "Item" }, { label: "Store available" }, { label: "Warehouse available" }, { label: "Request" }, { label: <span className="sr-only">Remove</span> }]}>
                        {lines.map((l) => {
                            const atStore = store ? stockAt({ stockLevels }, l.variantId, store.id).available : 0;
                            const atWh = warehouse ? stockAt({ stockLevels }, l.variantId, warehouse.id).available : 0;
                            return (
                                <tr key={l.variantId}>
                                    <Td className="min-w-60">
                                        <VariantCell variantId={l.variantId} link={false} />
                                    </Td>
                                    <Td className="font-medium text-primary tabular-nums">{formatNumber(atStore)}</Td>
                                    <Td>
                                        <span className={cx("font-medium tabular-nums", atWh < l.requestedQty ? "text-orange-600" : "text-primary")}>{formatNumber(atWh)}</span>
                                        {atWh < l.requestedQty && <span className="block text-xs text-orange-600">May ship short</span>}
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

            <Card title="Note">
                <TextArea aria-label="Note" placeholder="Anything the warehouse should know (e.g. needed before the weekend)" rows={3} value={note} onChange={setNote} />
            </Card>

            {touched && errors.length > 0 && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 ring-inset">{errors.join(" ")}</div>}

            <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-secondary bg-primary px-4 py-3 md:static md:rounded-2xl md:px-6 md:py-4 md:ring-1 md:ring-secondary">
                <p className="text-sm text-tertiary">
                    <span className="font-semibold text-primary">{lines.length}</span> item{lines.length === 1 ? "" : "s"} · <span className="font-semibold text-primary">{formatNumber(totalUnits)}</span> unit{totalUnits === 1 ? "" : "s"}
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
