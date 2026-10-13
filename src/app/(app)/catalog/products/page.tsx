"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, SearchLg, Upload01 } from "@untitledui/icons";
import type { Key } from "react-aria-components";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { ComplianceChips } from "@/components/app/catalog/compliance-chips";
import { priceRange, productSearchText } from "@/components/app/catalog/catalog-utils";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { ProductSwatch } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

type StatusFilter = "all" | Product["status"];

export default function ProductsPage() {
    const scope = useRequiredScope();
    const router = useRouter();
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const businessUnits = useAppStore((s) => s.businessUnits);

    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusFilter>("active");
    const [buFilter, setBuFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");

    const activeBus = businessUnits.filter((b) => scope.activeBusinessUnitIds.includes(b.id));

    const rows = useMemo(() => {
        const locIds = new Set(scope.activeLocationIds);
        return products
            .filter((p) => scope.activeBusinessUnitIds.includes(p.businessUnitId))
            .map((p) => {
                const vs = variants.filter((v) => v.productId === p.id);
                const vIds = new Set(vs.map((v) => v.id));
                const available = stockLevels.filter((s) => vIds.has(s.variantId) && locIds.has(s.locationId)).reduce((a, s) => a + s.available, 0);
                return { id: p.id, product: p, variants: vs, available, range: priceRange(vs), search: productSearchText(p, vs) };
            });
    }, [products, variants, stockLevels, scope.activeBusinessUnitIds, scope.activeLocationIds]);

    const scoped = rows.filter((r) => (buFilter === "all" || r.product.businessUnitId === buFilter) && (typeFilter === "all" || r.product.productType === typeFilter));
    const q = query.trim().toLowerCase();
    const searched = q ? scoped.filter((r) => q.split(/\s+/).every((t) => r.search.includes(t))) : scoped;
    const visible = searched.filter((r) => status === "all" || r.product.status === status);

    const count = (s: StatusFilter) => searched.filter((r) => s === "all" || r.product.status === s).length;
    const types = Array.from(new Set(rows.filter((r) => buFilter === "all" || r.product.businessUnitId === buFilter).map((r) => r.product.productType))).sort();

    const eyebrow = activeBus.length === 1 ? activeBus[0].name : "Catalog";

    return (
        <>
            <PageHeader
                eyebrow={eyebrow}
                title="Products"
                description="One record per product. Flavors, colors, strengths and sizes are variants."
                actions={
                    scope.canManage && (
                        <>
                            <Button color="secondary" size="md" iconLeading={Upload01} href="/catalog/import">
                                Bulk import
                            </Button>
                            <Button color="primary" size="md" iconLeading={Plus} href="/catalog/products/new">
                                New product
                            </Button>
                        </>
                    )
                }
            />

            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <FilterPills<StatusFilter>
                    value={status}
                    onChange={setStatus}
                    options={[
                        { id: "active", label: "Active", count: count("active") },
                        { id: "draft", label: "Draft", count: count("draft") },
                        { id: "archived", label: "Archived", count: count("archived") },
                        { id: "all", label: "All", count: count("all") },
                    ]}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        aria-label="Search products"
                        icon={SearchLg}
                        placeholder="Name, brand, SKU or barcode"
                        value={query}
                        onChange={setQuery}
                        size="sm"
                        className="sm:w-64"
                    />
                    {activeBus.length > 1 && (
                        <Select
                            aria-label="Business unit"
                            size="sm"
                            className="sm:w-44"
                            items={[{ id: "all", label: "All business units" }, ...activeBus.map((b) => ({ id: b.id, label: b.name }))]}
                            selectedKey={buFilter}
                            onSelectionChange={(k: Key | null) => {
                                setBuFilter(String(k ?? "all"));
                                setTypeFilter("all");
                            }}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    )}
                    <Select
                        aria-label="Product type"
                        size="sm"
                            className="sm:w-44"
                        items={[{ id: "all", label: "All product types" }, ...types.map((t) => ({ id: t, label: t }))]}
                        selectedKey={typeFilter}
                        onSelectionChange={(k: Key | null) => setTypeFilter(String(k ?? "all"))}
                    >
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>
                </div>
            </div>

            <TableCard.Root size="sm" className="rounded-2xl">
                {visible.length === 0 ? (
                    <Empty
                        icon={Package}
                        title={q ? "No products match your search" : "No products here yet"}
                        description={q ? "Try a brand, SKU or scan a barcode." : scope.canManage ? "Create a product or import a list from your POS." : "Ask your manager to add products."}
                        action={
                            scope.canManage && !q ? (
                                <Button color="primary" size="md" iconLeading={Plus} href="/catalog/products/new">
                                    New product
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <Table aria-label="Products" size="sm" onRowAction={(key) => router.push(`/catalog/products/${key}`)}>
                        <Table.Header>
                            <Table.Head label="Product" isRowHeader />
                            <Table.Head label="Business unit" />
                            <Table.Head label="Variants" />
                            <Table.Head label="Price" />
                            <Table.Head label="Available" tooltip="Sellable units across your locations" />
                            <Table.Head label="Compliance" />
                            <Table.Head label="Status" />
                        </Table.Header>
                        <Table.Body items={visible}>
                            {(r) => {
                                const bu = businessUnits.find((b) => b.id === r.product.businessUnitId);
                                return (
                                    <Table.Row id={r.id} className="cursor-pointer">
                                        <Table.Cell>
                                            <div className="flex min-w-52 items-center gap-3">
                                                <ProductSwatch color={r.product.imageColor} name={r.product.brand} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-primary">{r.product.name}</p>
                                                    <p className="text-xs text-tertiary">{r.product.productType}</p>
                                                </div>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <BusinessUnitAvatar unit={bu} size="sm" />
                                                <span className="text-secondary">{bu?.name}</span>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell className="tabular-nums">{r.variants.length}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap tabular-nums">
                                            {r.range ? (r.range.min === r.range.max ? formatCurrency(r.range.min) : `${formatCurrency(r.range.min)} – ${formatCurrency(r.range.max)}`) : "—"}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className={cx("font-semibold tabular-nums", r.available === 0 ? "text-error-primary" : "text-primary")}>{formatNumber(r.available)}</span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="min-w-32">
                                                <ComplianceChips flags={r.product.complianceFlags} max={1} />
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <StatusBadge status={r.product.status} size="sm" />
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>
            {visible.length > 0 && (
                <p className="mt-3 text-sm text-tertiary">
                    Showing {visible.length} of {rows.length} products · Available counts {scope.activeLocationIds.length} location{scope.activeLocationIds.length === 1 ? "" : "s"}
                </p>
            )}
        </>
    );
}
