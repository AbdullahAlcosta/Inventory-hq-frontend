"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CurrencyDollar, LayersThree01, RefreshCcw01, SearchLg, Truck01, XCircle } from "@untitledui/icons";
import type { Key } from "react-aria-components";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { LocationName, VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { AdjustmentModal } from "@/components/app/stock/adjustment-modal";
import { coverAt, formatCover, isLowStock, locationItems } from "@/components/app/stock/stock-utils";
import { useActiveBuName } from "@/components/app/stock/use-stock-page";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatNumber } from "@/lib/format";
import { normalize } from "@/lib/selectors";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

type Filter = "all" | "low" | "issues";

export default function InventoryPage() {
    const scope = useRequiredScope();
    const eyebrow = useActiveBuName();
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const allLocations = useAppStore((s) => s.locations);
    const counts = useAppStore((s) => s.counts);

    const [locationId, setLocationId] = useState<string>("all");
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [adjust, setAdjust] = useState<{ locationId: string; variantId: string } | null>(null);
    const [newAdjOpen, setNewAdjOpen] = useState(false);

    const selectedLocations = locationId === "all" ? scope.locations : scope.locations.filter((l) => l.id === locationId);

    const rows = useMemo(() => {
        const locIds = new Set(selectedLocations.map((l) => l.id));
        const storesPerBu = (buId: string) => allLocations.filter((l) => l.businessUnitId === buId && l.type === "store").length;
        return stockLevels
            .filter((s) => locIds.has(s.locationId))
            .map((s) => {
                const variant = variants.find((v) => v.id === s.variantId);
                const product = variant && products.find((p) => p.id === variant.productId);
                const location = selectedLocations.find((l) => l.id === s.locationId)!;
                if (!variant || !product || product.status === "archived" || product.businessUnitId !== location.businessUnitId) return null;
                const stores = storesPerBu(location.businessUnitId);
                return {
                    id: `${s.variantId}@${s.locationId}`,
                    stock: s,
                    variant,
                    product,
                    location,
                    low: isLowStock(variant, location, s.available, stores),
                    cover: coverAt(variant, location, s.available, stores),
                    search: normalize(`${product.name} ${variant.name} ${variant.sku} ${variant.barcodes.map((b) => b.code).join(" ")}`),
                };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .sort(
                (a, b) =>
                    a.product.name.localeCompare(b.product.name) ||
                    a.variant.name.localeCompare(b.variant.name) ||
                    a.location.name.localeCompare(b.location.name),
            );
    }, [selectedLocations, stockLevels, variants, products, allLocations]);

    const searched = useMemo(() => {
        const q = normalize(query);
        return q ? rows.filter((r) => r.search.includes(q)) : rows;
    }, [rows, query]);

    const lowCount = searched.filter((r) => r.low).length;
    const issueCount = searched.filter((r) => r.stock.returns > 0 || r.stock.damaged > 0).length;
    const visible = searched.filter((r) => (filter === "low" ? r.low : filter === "issues" ? r.stock.returns > 0 || r.stock.damaged > 0 : true));

    const totals = searched.reduce(
        (t, r) => ({
            available: t.available + r.stock.available,
            inTransit: t.inTransit + r.stock.inTransit,
            returns: t.returns + r.stock.returns,
            damaged: t.damaged + r.stock.damaged,
            value: t.value + (r.stock.available + r.stock.inTransit + r.stock.returns) * r.variant.cost,
        }),
        { available: 0, inTransit: 0, returns: 0, damaged: 0, value: 0 },
    );

    const pendingOpening = selectedLocations.filter((l) => !l.openingCountDone);
    const showLocation = locationId === "all" && scope.locations.length > 1;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow={eyebrow}
                title="Inventory"
                description="Stock by location in each state. Only Available is sellable."
                className="mb-0"
                actions={
                    <Button size="lg" onPress={() => setNewAdjOpen(true)}>
                        New adjustment
                    </Button>
                }
            />

            {pendingOpening.map((l) => {
                const open = counts.find((c) => c.locationId === l.id && c.kind === "opening" && (c.status === "in_progress" || c.status === "submitted"));
                return (
                    <div
                        key={l.id}
                        className="flex flex-col gap-3 rounded-2xl bg-orange-50 px-5 py-4 ring-1 ring-orange-200 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-600" />
                            <div>
                                <p className="text-sm font-semibold text-primary">{l.name} needs an opening count</p>
                                <p className="text-sm text-secondary">
                                    {open?.status === "submitted"
                                        ? `Opening count ${open.number} is waiting for approval.`
                                        : "Stock numbers here aren’t trusted until the opening count is approved."}
                                </p>
                            </div>
                        </div>
                        <Button size="md" color="secondary" href={open ? `/stock/counts/${open.id}` : `/stock/counts?start=${l.id}`}>
                            {open ? (open.status === "submitted" ? "View count" : `Continue ${open.number}`) : "Start opening count"}
                        </Button>
                    </div>
                );
            })}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard label="Available" value={formatNumber(totals.available)} hint="Sellable units" icon={LayersThree01} tone="success" />
                <StatCard label="In Transit" value={formatNumber(totals.inTransit)} hint="Shipped, not received" icon={Truck01} />
                <StatCard
                    label="Returns"
                    value={formatNumber(totals.returns)}
                    hint="Waiting on a decision"
                    icon={RefreshCcw01}
                    tone={totals.returns ? "warning" : "default"}
                />
                <StatCard label="Damaged" value={formatNumber(totals.damaged)} hint="Not sellable" icon={XCircle} tone={totals.damaged ? "error" : "default"} />
                <StatCard label="Value at cost" value={formatCurrency(totals.value)} hint="Excludes damaged" icon={CurrencyDollar} />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <FilterPills<Filter>
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { id: "all", label: "All", count: searched.length },
                        { id: "low", label: "Low stock", count: lowCount },
                        { id: "issues", label: "Has returns or damaged", count: issueCount },
                    ]}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                    <Select
                        aria-label="Location"
                        className="sm:w-64"
                        items={[{ id: "all", label: "All my locations" }, ...locationItems(scope.locations)]}
                        selectedKey={locationId}
                        onSelectionChange={(k: Key | null) => k && setLocationId(String(k))}
                    >
                        {(item) => (
                            <Select.Item id={item.id} supportingText={item.supportingText}>
                                {item.label}
                            </Select.Item>
                        )}
                    </Select>
                    <Input
                        aria-label="Search"
                        placeholder="Search item, SKU or barcode"
                        icon={SearchLg}
                        value={query}
                        onChange={setQuery}
                        className="sm:w-72"
                    />
                </div>
            </div>

            <TableCard.Root size="sm">
                {visible.length === 0 ? (
                    <Empty
                        title={rows.length === 0 ? "No stock here yet" : "No items match"}
                        description={
                            rows.length === 0
                                ? "Stock appears once a purchase order is received or an opening count is approved."
                                : "Try another search or filter."
                        }
                    />
                ) : (
                    <Table aria-label="Inventory" className="min-w-[960px]">
                        <Table.Header>
                            <Table.Head label="Item" isRowHeader />
                            {showLocation && <Table.Head label="Location" className="px-3" />}
                            <Table.Head label="Available" className="px-3" />
                            <Table.Head label="In Transit" className="px-3" />
                            <Table.Head label="Returns" className="px-3" />
                            <Table.Head label="Damaged" className="px-3" />
                            <Table.Head label="Reorder" className="px-3" />
                            <Table.Head label="Days of cover" className="px-3" />
                            <Table.Head label="" className="pl-3" />
                        </Table.Header>
                        <Table.Body items={visible} dependencies={[showLocation]}>
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell className="max-w-[280px] pr-3">
                                        <VariantCell variantId={r.variant.id} />
                                    </Table.Cell>
                                    {showLocation && (
                                        <Table.Cell className="px-3">
                                            <LocationName id={r.location.id} />
                                        </Table.Cell>
                                    )}
                                    <Table.Cell className={cx("px-3 font-semibold", r.low ? "text-error-primary" : "text-primary")}>
                                        {formatNumber(r.stock.available)}
                                    </Table.Cell>
                                    <Table.Cell className="px-3">{qty(r.stock.inTransit)}</Table.Cell>
                                    <Table.Cell className="px-3">{qty(r.stock.returns, "text-warning-primary")}</Table.Cell>
                                    <Table.Cell className="px-3">{qty(r.stock.damaged, "text-error-primary")}</Table.Cell>
                                    <Table.Cell className="px-3 whitespace-nowrap">
                                        {r.low ? (
                                            <Badge type="pill-color" color="error" size="sm">
                                                Low stock
                                            </Badge>
                                        ) : (
                                            <span className="text-tertiary">{r.location.type === "warehouse" ? `ROP ${r.variant.reorderPoint}` : "OK"}</span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className={cx("px-3 whitespace-nowrap", r.cover < 3 && "font-medium text-error-primary")}>
                                        {formatCover(r.cover)}
                                    </Table.Cell>
                                    <Table.Cell className="pl-3">
                                        <Button size="sm" color="secondary" onPress={() => setAdjust({ locationId: r.location.id, variantId: r.variant.id })}>
                                            Adjust
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <AdjustmentModal isOpen={!!adjust} onOpenChange={(o) => !o && setAdjust(null)} locationId={adjust?.locationId} variantId={adjust?.variantId} />
            <AdjustmentModal isOpen={newAdjOpen} onOpenChange={setNewAdjOpen} locationId={locationId !== "all" ? locationId : undefined} />
        </div>
    );
}

const qty = (n: number, tone?: string) => <span className={cx(n > 0 ? cx("font-medium", tone ?? "text-primary") : "text-quaternary")}>{formatNumber(n)}</span>;
