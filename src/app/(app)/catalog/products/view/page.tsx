"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Archive, Edit05, LinkExternal01, Package, Plus, RefreshCcw01 } from "@untitledui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Card, Field } from "@/components/app/card";
import { AllocationTable } from "@/components/app/catalog/allocation-table";
import { type VariantDraft, margin, priceRange } from "@/components/app/catalog/catalog-utils";
import { ComplianceChips } from "@/components/app/catalog/compliance-chips";
import { ProductEditModal } from "@/components/app/catalog/product-edit-modal";
import { UomSummary } from "@/components/app/catalog/product-fields";
import { ProductStockCard, useRequestFor } from "@/components/app/catalog/product-stock-grid";
import { VariantModal } from "@/components/app/catalog/variant-modal";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { ProductSwatch } from "@/components/app/item-cell";
import { ConfirmDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { Table, TableCard } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { type Scope, useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/format";
import { blockedFlagsFor, emptyStock } from "@/lib/selectors";
import type { Product, Variant } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

function ProductDetailPage() {
    return (
        <Suspense fallback={null}>
            <ProductDetail />
        </Suspense>
    );
}

function ProductDetail() {
    const scope = useRequiredScope();
    const id = useSearchParams().get("id") ?? "";
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const product = useAppStore((s) => s.products.find((p) => p.id === id));
    const allVariants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const bu = useAppStore((s) => s.businessUnits.find((b) => b.id === product?.businessUnitId));
    const updateProduct = useAppStore((s) => s.updateProduct);

    const variants = useMemo(() => allVariants.filter((v) => v.productId === id), [allVariants, id]);
    const [tab, setTab] = useState<string>(() => searchParams.get("tab") ?? (scope.canManageCatalog ? "overview" : "stock"));
    const [editOpen, setEditOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [variantModal, setVariantModal] = useState<{ open: boolean; variant: Variant | null; initial?: Partial<VariantDraft> }>({
        open: false,
        variant: null,
    });

    // "Add as variant of…" from the create form arrives with a prefilled add-variant dialog.
    useEffect(() => {
        if (searchParams.get("addVariant") !== "1" || !scope.canManageCatalog) return;
        const initial: Partial<VariantDraft> = {};
        const get = (k: string) => searchParams.get(k) ?? undefined;
        if (get("name")) initial.name = get("name");
        if (get("sku")) Object.assign(initial, { sku: get("sku"), skuTouched: true });
        if (get("upc")) initial.sellingBarcode = get("upc");
        if (get("caseUpc")) initial.caseBarcode = get("caseUpc");
        if (get("price")) initial.price = get("price");
        if (get("cost")) initial.cost = get("cost");
        setTab("variants");
        setVariantModal({ open: true, variant: null, initial });
        router.replace(`${pathname}?id=${id}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    if (!product || !scope.businessUnitIds.includes(product.businessUnitId)) {
        return (
            <>
                <PageHeader eyebrow="Catalog" title="Product not found" backHref="/catalog/products" backLabel="Products" />
                <Card>
                    <Empty
                        icon={Package}
                        title="This product doesn't exist or isn't in your business units"
                        action={<Button href="/catalog/products">Back to products</Button>}
                    />
                </Card>
            </>
        );
    }

    const locations = scope.locations.filter((l) => l.businessUnitId === product.businessUnitId);
    const locIds = new Set(locations.map((l) => l.id));
    const vIds = new Set(variants.map((v) => v.id));
    const available = stockLevels.filter((s) => vIds.has(s.variantId) && locIds.has(s.locationId)).reduce((a, s) => a + s.available, 0);
    const range = priceRange(variants);
    const avgMargin = variants.length ? variants.reduce((a, v) => a + margin(v.price, v.cost), 0) / variants.length : 0;
    const archived = product.status === "archived";

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "variants", label: "Variants", badge: variants.length },
        { id: "stock", label: "Stock" },
        ...(scope.canManageChannels ? [{ id: "channels", label: "Channels" }] : []),
        ...(scope.canManageChannels && scope.allocationEnabled ? [{ id: "allocation", label: "Allocation" }] : []),
    ];

    return (
        <>
            <PageHeader
                backHref="/catalog/products"
                backLabel="Products"
                title={
                    <span className="flex items-center gap-4">
                        <ProductSwatch color={product.imageColor} name={product.brand} size="lg" />
                        <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>{product.name}</span>
                                <StatusBadge status={product.status} />
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-md font-normal text-tertiary">
                                <BusinessUnitAvatar unit={bu} size="sm" />
                                {bu?.name} · {product.productType}
                            </span>
                        </span>
                    </span>
                }
                actions={
                    scope.canManageCatalog && (
                        <>
                            <Button color="secondary" size="md" iconLeading={archived ? RefreshCcw01 : Archive} onPress={() => setArchiveOpen(true)}>
                                {archived ? "Activate" : "Archive"}
                            </Button>
                            <Button color="secondary" size="md" iconLeading={Edit05} onPress={() => setEditOpen(true)}>
                                Edit product
                            </Button>
                            <Button color="primary" size="md" iconLeading={Plus} onPress={() => setVariantModal({ open: true, variant: null })}>
                                Add variant
                            </Button>
                        </>
                    )
                }
            />

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Variants" value={variants.length} hint={product.uom.sellingUnit + " level"} />
                <StatCard label="Available" value={formatNumber(available)} hint={`Across ${locations.length} location${locations.length === 1 ? "" : "s"}`} />
                <StatCard
                    label="Price"
                    value={range ? (range.min === range.max ? formatCurrency(range.min) : `${formatCurrency(range.min)}+`) : "—"}
                    hint={range && range.min !== range.max ? `Up to ${formatCurrency(range.max)}` : "Same for all variants"}
                />
                <StatCard label="Avg. margin" value={`${Math.round(avgMargin * 100)}%`} hint="Price vs cost" tone={avgMargin < 0.3 ? "warning" : "default"} />
            </div>

            <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
                <div className="overflow-x-auto">
                    <Tabs.List type="underline" size="md" items={tabs} className="min-w-max" />
                </div>
                <Tabs.Panel id="overview" className="pt-6">
                    <OverviewTab product={product} variants={variants} />
                </Tabs.Panel>
                <Tabs.Panel id="variants" className="pt-6">
                    <VariantsTab
                        product={product}
                        variants={variants}
                        canManage={scope.canManageCatalog}
                        onEdit={(v) => setVariantModal({ open: true, variant: v })}
                        onAdd={() => setVariantModal({ open: true, variant: null })}
                    />
                </Tabs.Panel>
                <Tabs.Panel id="stock" className="pt-6">
                    <StockTab product={product} variants={variants} scope={scope} highlight={searchParams.get("variant")} />
                </Tabs.Panel>
                {scope.canManageChannels && scope.allocationEnabled && (
                    <Tabs.Panel id="allocation" className="pt-6">
                        <AllocationTab product={product} variants={variants} />
                    </Tabs.Panel>
                )}
                {scope.canManageChannels && (
                    <Tabs.Panel id="channels" className="pt-6">
                        <ChannelsTab product={product} variants={variants} scope={scope} />
                    </Tabs.Panel>
                )}
            </Tabs>

            {scope.canManageCatalog && (
                <>
                    <ProductEditModal isOpen={editOpen} onOpenChange={setEditOpen} product={product} />
                    <VariantModal
                        isOpen={variantModal.open}
                        onOpenChange={(open) => setVariantModal((m) => ({ ...m, open }))}
                        product={product}
                        variant={variantModal.variant}
                        initial={variantModal.initial}
                    />
                    <ConfirmDialog
                        isOpen={archiveOpen}
                        onOpenChange={setArchiveOpen}
                        title={archived ? "Activate product?" : "Archive product?"}
                        description={
                            archived
                                ? `${product.name} will show up in pickers, counts and requests again.`
                                : `${product.name} will be hidden from pickers and new requests. Stock and history are kept.`
                        }
                        confirmLabel={archived ? "Activate" : "Archive"}
                        destructive={!archived}
                        onConfirm={() => {
                            updateProduct(product.id, { status: archived ? "active" : "archived" });
                            toast.success(archived ? "Product activated" : "Product archived", product.name);
                        }}
                    />
                </>
            )}
        </>
    );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

const OverviewTab = ({ product, variants }: { product: Product; variants: Variant[] }) => {
    const attrs = Object.entries(product.attributes).filter(([k]) => k !== "Brand" && k !== "Product Type");
    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
                <Card title="Details">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                        <Field label="Brand">{product.brand}</Field>
                        <Field label="Product line / model">{product.productLine}</Field>
                        <Field label="Product type">{product.productType}</Field>
                        <Field label="Created">{formatDate(product.createdAt)}</Field>
                        {attrs.map(([k, v]) => (
                            <Field key={k} label={k}>
                                {v}
                            </Field>
                        ))}
                        <Field label="Description" className="col-span-2">
                            <span className="font-normal text-secondary">{product.description || "No description yet."}</span>
                        </Field>
                    </dl>
                </Card>
                <Card title="Compliance" description="Channels that don't accept a flag will block pushes for this product.">
                    <ComplianceChips flags={product.complianceFlags} size="md" emptyLabel="No restricted flags." />
                </Card>
                <Card title="Units of measure">
                    <UomSummary purchaseUnit={product.uom.purchaseUnit} sellingUnit={product.uom.sellingUnit} units={product.uom.unitsPerPurchaseUnit} />
                </Card>
            </div>
            <Card
                className="lg:self-start"
                title="Barcodes"
                description={`Each variant has a ${product.uom.sellingUnit.toLowerCase()} barcode and a ${product.uom.purchaseUnit.toLowerCase()} barcode.`}
                flush
            >
                {variants.length === 0 ? (
                    <Empty title="No variants yet" />
                ) : (
                    <ul className="divide-y divide-secondary">
                        {variants.map((v) => (
                            <li key={v.id} className="px-5 py-4 md:px-6">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="truncate text-sm font-semibold text-primary">{v.name}</p>
                                    <span className="font-mono text-xs text-tertiary">{v.sku}</span>
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <BarcodeChip unit={`1 ${product.uom.sellingUnit}`} code={v.barcodes.find((b) => b.unit === "selling")?.code} />
                                    <BarcodeChip
                                        unit={`1 ${product.uom.purchaseUnit} = ${product.uom.unitsPerPurchaseUnit}`}
                                        code={v.barcodes.find((b) => b.unit === "purchase")?.code}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

const BarcodeChip = ({ unit, code }: { unit: string; code?: string }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2">
        <span className="text-xs font-medium text-tertiary">{unit}</span>
        <span className={cx("font-mono text-sm", code ? "text-primary" : "text-quaternary")}>{code ?? "Not set"}</span>
    </div>
);

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

const VariantsTab = ({
    product,
    variants,
    canManage,
    onEdit,
    onAdd,
}: {
    product: Product;
    variants: Variant[];
    canManage: boolean;
    onEdit: (v: Variant) => void;
    onAdd: () => void;
}) => {
    const vendors = useAppStore((s) => s.vendors);
    if (!variants.length)
        return (
            <Card>
                <Empty
                    title="No variants yet"
                    description="Add a variant for each flavor, color, strength or size."
                    action={
                        canManage && (
                            <Button iconLeading={Plus} onPress={onAdd}>
                                Add variant
                            </Button>
                        )
                    }
                />
            </Card>
        );
    return (
        <TableCard.Root size="sm" className="rounded-2xl">
            <Table aria-label="Variants" size="sm">
                <Table.Header>
                    <Table.Head label="Variant" isRowHeader />
                    <Table.Head label="SKU" />
                    <Table.Head label="Barcodes" />
                    <Table.Head label="Price" />
                    <Table.Head label="Cost" />
                    <Table.Head label="Margin" />
                    <Table.Head label="Reorder pt" />
                    <Table.Head label="Restock" />
                    <Table.Head label="Lead time" />
                    <Table.Head label="Vendor" />
                    <Table.Head label="Sales/day" />
                    <Table.Head label="" />
                </Table.Header>
                <Table.Body items={variants}>
                    {(v) => {
                        const m = margin(v.price, v.cost);
                        return (
                            <Table.Row id={v.id}>
                                <Table.Cell>
                                    <p className="min-w-40 text-sm font-semibold text-primary">{v.name}</p>
                                    <p className="text-xs text-tertiary">
                                        {product.name} {v.name}
                                    </p>
                                </Table.Cell>
                                <Table.Cell className="font-mono text-xs whitespace-nowrap">{v.sku}</Table.Cell>
                                <Table.Cell>
                                    <div className="flex flex-col gap-0.5 font-mono text-xs whitespace-nowrap">
                                        <span>
                                            <span className="text-quaternary">{product.uom.sellingUnit}:</span>{" "}
                                            {v.barcodes.find((b) => b.unit === "selling")?.code ?? "—"}
                                        </span>
                                        <span>
                                            <span className="text-quaternary">{product.uom.purchaseUnit}:</span>{" "}
                                            {v.barcodes.find((b) => b.unit === "purchase")?.code ?? "—"}
                                        </span>
                                    </div>
                                </Table.Cell>
                                <Table.Cell className="font-medium text-primary tabular-nums">{formatCurrency(v.price)}</Table.Cell>
                                <Table.Cell className="tabular-nums">{formatCurrency(v.cost)}</Table.Cell>
                                <Table.Cell>
                                    <Badge type="pill-color" size="sm" color={m >= 0.4 ? "success" : m >= 0.25 ? "gray" : "warning"}>
                                        {Math.round(m * 100)}%
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell className="tabular-nums">{v.reorderPoint}</Table.Cell>
                                <Table.Cell className="tabular-nums">{v.restockQty}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap tabular-nums">{v.leadTimeDays} days</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{vendors.find((x) => x.id === v.vendorId)?.name ?? "—"}</Table.Cell>
                                <Table.Cell className="tabular-nums">{v.dailySales}</Table.Cell>
                                <Table.Cell>
                                    {canManage && (
                                        <Button color="link-gray" size="sm" onPress={() => onEdit(v)}>
                                            Edit
                                        </Button>
                                    )}
                                </Table.Cell>
                            </Table.Row>
                        );
                    }}
                </Table.Body>
            </Table>
        </TableCard.Root>
    );
};

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

const StockTab = ({ product, variants, scope, highlight }: { product: Product; variants: Variant[]; scope: Scope; highlight: string | null }) => {
    const stockLevels = useAppStore((s) => s.stockLevels);
    const allLocations = useAppStore((s) => s.locations);
    const requestFor = useRequestFor(scope);
    const locations = scope.locations.filter((l) => l.businessUnitId === product.businessUnitId);
    const [loc, setLoc] = useState<string>("all");

    // Company-wide view: Available at every store and warehouse in the business unit, with request buttons for store staff.
    const everywhere = (
        <ProductStockCard
            title="Available at every location"
            product={product}
            variants={variants}
            highlight={highlight}
            locations={allLocations.filter((l) => l.businessUnitId === product.businessUnitId)}
            myLocationIds={scope.user.locationIds}
            stockLevels={stockLevels}
            requestFor={requestFor}
        />
    );

    if (!locations.length) return everywhere;

    const at = (variantId: string, locationId: string) =>
        stockLevels.find((s) => s.variantId === variantId && s.locationId === locationId) ?? emptyStock(variantId, locationId);
    const sum = (rows: { available: number; inTransit: number; returns: number; damaged: number }[]) =>
        rows.reduce(
            (a, s) => ({
                available: a.available + s.available,
                inTransit: a.inTransit + s.inTransit,
                returns: a.returns + s.returns,
                damaged: a.damaged + s.damaged,
            }),
            { available: 0, inTransit: 0, returns: 0, damaged: 0 },
        );

    const byLocation = locations.map((l) => ({ id: l.id, location: l, ...sum(variants.map((v) => at(v.id, l.id))) }));
    const shownLocs = loc === "all" ? locations : locations.filter((l) => l.id === loc);
    const byVariant = variants.map((v) => ({ id: v.id, variant: v, ...sum(shownLocs.map((l) => at(v.id, l.id))) }));

    const stateCells = (r: { available: number; inTransit: number; returns: number; damaged: number }) => (
        <>
            <Table.Cell className="font-semibold text-primary tabular-nums">{formatNumber(r.available)}</Table.Cell>
            <Table.Cell className="tabular-nums">{r.inTransit ? formatNumber(r.inTransit) : "—"}</Table.Cell>
            <Table.Cell className="tabular-nums">{r.returns ? formatNumber(r.returns) : "—"}</Table.Cell>
            <Table.Cell className={cx("tabular-nums", r.damaged > 0 && "text-error-primary")}>{r.damaged ? formatNumber(r.damaged) : "—"}</Table.Cell>
        </>
    );

    return (
        <div className="flex flex-col gap-6">
            {everywhere}
            {locations.length > 1 && (
                <TableCard.Root size="sm" className="rounded-2xl">
                    <TableCard.Header title="Your locations by stock state" description="Only Available is sellable." />
                    <Table aria-label="Stock by location" size="sm">
                        <Table.Header>
                            <Table.Head label="Location" isRowHeader />
                            <Table.Head label="Available" />
                            <Table.Head label="In Transit" />
                            <Table.Head label="Returns" />
                            <Table.Head label="Damaged" />
                        </Table.Header>
                        <Table.Body items={byLocation}>
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell>
                                        <div className="flex min-w-48 items-center gap-2">
                                            <span className="font-medium text-primary">{r.location.name}</span>
                                            <Badge type="pill-color" size="sm" color={r.location.type === "warehouse" ? "blue" : "gray"}>
                                                {r.location.type === "warehouse" ? "Warehouse" : "Store"}
                                            </Badge>
                                        </div>
                                    </Table.Cell>
                                    {stateCells(r)}
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                </TableCard.Root>
            )}

            <div className="flex flex-col gap-3">
                {locations.length > 1 ? (
                    <FilterPills
                        value={loc}
                        onChange={setLoc}
                        options={[{ id: "all", label: "All your locations" }, ...locations.map((l) => ({ id: l.id, label: l.name }))]}
                    />
                ) : (
                    <div>
                        <h3 className="text-md font-semibold text-primary">{locations[0].name} by stock state</h3>
                        <p className="text-sm text-tertiary">Only Available is sellable.</p>
                    </div>
                )}
                <TableCard.Root size="sm" className="rounded-2xl">
                    <Table aria-label="Stock by variant" size="sm">
                        <Table.Header>
                            <Table.Head label="Variant" isRowHeader />
                            <Table.Head label="Available" />
                            <Table.Head label="In Transit" />
                            <Table.Head label="Returns" />
                            <Table.Head label="Damaged" />
                        </Table.Header>
                        <Table.Body items={byVariant}>
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell>
                                        <p className="min-w-40 font-medium text-primary">{r.variant.name}</p>
                                        <p className="font-mono text-xs text-tertiary">{r.variant.sku}</p>
                                    </Table.Cell>
                                    {stateCells(r)}
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                </TableCard.Root>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Channels                                                            */
/* ------------------------------------------------------------------ */

const channelNames = { quickvee: "Quickvee", shopify: "Shopify", woocommerce: "WooCommerce" };

const ChannelsTab = ({ product, variants, scope }: { product: Product; variants: Variant[]; scope: Scope }) => {
    const connections = useAppStore((s) => s.connections);
    const listings = useAppStore((s) => s.listings);
    const visible = connections.filter(
        (c) =>
            c.businessUnitId === product.businessUnitId &&
            scope.activeBusinessUnitIds.includes(c.businessUnitId) &&
            (c.level === "business_unit" || !c.locationId || scope.locationIds.includes(c.locationId)),
    );

    if (!visible.length)
        return (
            <Card>
                <Empty
                    icon={LinkExternal01}
                    title="No sales channels for this business unit"
                    description="Connect Quickvee, Shopify or WooCommerce in Sales Channels."
                />
            </Card>
        );

    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm text-tertiary">
                Listing status per connection. To push products, open the connection — pushing is done one connection at a time with a compliance check first.
            </p>
            {visible.map((c) => {
                const blocked = blockedFlagsFor(product, c);
                return (
                    <Card
                        key={c.id}
                        flush
                        title={
                            <span className="flex flex-wrap items-center gap-2">
                                {c.name}
                                <StatusBadge status={c.status} size="sm" />
                            </span>
                        }
                        description={`${channelNames[c.channel]} · ${c.level === "store" ? "Store level" : "Business unit level"} · ${c.syncMode === "live" ? "Live sync" : c.schedule} · Buffer ${c.safetyBuffer}`}
                        actions={
                            <Button color="secondary" size="sm" iconTrailing={LinkExternal01} href={`/channels/connections/view?id=${c.id}`}>
                                Open connection
                            </Button>
                        }
                    >
                        {blocked.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 border-b border-secondary bg-error-primary px-5 py-3 text-sm text-error-primary md:px-6">
                                Not accepted by this channel: <ComplianceChips flags={blocked} />
                            </div>
                        )}
                        <ul className="divide-y divide-secondary">
                            {variants.map((v) => {
                                const l = listings.find((x) => x.variantId === v.id && x.connectionId === c.id);
                                return (
                                    <li key={v.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-primary">{v.name}</p>
                                            <p className="truncate text-xs text-tertiary">
                                                {l?.message ?? (l?.externalId ? `Channel ID ${l.externalId}` : "Not on this channel yet")}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3">
                                            {l?.lastPushedAt && (
                                                <span className="text-xs text-tertiary">
                                                    Pushed {timeAgo(l.lastPushedAt)}
                                                    {l.lastPushedQty != null ? ` · qty ${l.lastPushedQty}` : ""}
                                                </span>
                                            )}
                                            <StatusBadge status={l?.status ?? "not_listed"} size="sm" />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                );
            })}
        </div>
    );
};

export default function ProductDetailPageRoute() {
    return (
        <Suspense>
            <ProductDetailPage />
        </Suspense>
    );
}

/** How this product's stock at each store is split between the channels selling from that store. */
const AllocationTab = ({ product, variants }: { product: Product; variants: Variant[] }) => {
    const locations = useAppStore((s) => s.locations);
    const connections = useAppStore((s) => s.connections);
    const stores = locations.filter((l) => l.type === "store" && l.businessUnitId === product.businessUnitId && connections.some((c) => c.locationId === l.id));
    const variantIds = variants.map((v) => v.id);
    if (!stores.length)
        return (
            <Card>
                <Empty title="No channels sell this product yet" description="Connect a sales channel to a store in this business unit first." />
            </Card>
        );
    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm text-tertiary">
                Split each store’s Available stock between its channels: <b>Shared</b> (all channels sell everything), <b>Dedicated</b> (a fixed amount for one
                channel) or <b>Hybrid</b> (part reserved for one channel, the rest shared). Each channel is told its allocation minus its safety buffer.
            </p>
            {stores.map((store) => (
                <AllocationTable
                    key={store.id}
                    store={store}
                    connections={connections.filter((c) => c.locationId === store.id)}
                    variantIds={variantIds}
                    title={store.name}
                    description={connections
                        .filter((c) => c.locationId === store.id)
                        .map((c) => c.name)
                        .join(" · ")}
                />
            ))}
        </div>
    );
};
