"use client";

import { useSearchParams } from "next/navigation";

import { use, useMemo, useState, Suspense } from "react";
import { Edit05, Mail01, Package, Phone, Plus, ShoppingCart01, User01 } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { LocationName, VariantCell } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { poTotals } from "@/components/app/purchasing/po-utils";
import { VendorFormModal } from "@/components/app/purchasing/vendor-form-modal";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

function VendorDetailPage() {
    const id = useSearchParams().get("id") ?? "";
    const scope = useRequiredScope();
    const vendor = useAppStore((s) => s.vendors.find((v) => v.id === id));
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const [editing, setEditing] = useState(false);

    const supplied = useMemo(
        () =>
            variants
                .filter((v) => v.vendorId === id)
                .map((v) => ({ id: v.id, variant: v, product: products.find((p) => p.id === v.productId)! }))
                .filter((r) => r.product),
        [variants, products, id],
    );
    const pos = useMemo(
        () => purchaseOrders.filter((p) => p.vendorId === id && scope.businessUnitIds.includes(p.businessUnitId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        [purchaseOrders, id, scope.businessUnitIds],
    );

    if (!vendor || !vendor.businessUnitIds.some((b) => scope.businessUnitIds.includes(b))) {
        return (
            <div>
                <PageHeader backHref="/purchasing/vendors" backLabel="Vendors" title="Vendor not found" />
                <Card>
                    <Empty title="This vendor doesn’t exist or isn’t in your business units." />
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                className="mb-0"
                backHref="/purchasing/vendors"
                backLabel="Vendors"
                eyebrow="Vendor"
                title={vendor.name}
                actions={
                    scope.canManagePurchasing && (
                        <>
                            <Button color="secondary" size="lg" iconLeading={Edit05} onPress={() => setEditing(true)}>
                                Edit
                            </Button>
                            <Button size="lg" iconLeading={Plus} href={`/purchasing/orders/new?vendor=${vendor.id}`}>
                                New PO
                            </Button>
                        </>
                    )
                }
            />

            <Card title="Contact">
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <ContactField icon={User01} label="Contact" value={vendor.contactName} />
                    <ContactField icon={Mail01} label="Email" value={vendor.email} href={vendor.email ? `mailto:${vendor.email}` : undefined} />
                    <ContactField icon={Phone} label="Phone" value={vendor.phone} href={vendor.phone ? `tel:${vendor.phone}` : undefined} />
                    <div>
                        <dt className="text-sm text-tertiary">Business units</dt>
                        <dd className="mt-1 flex flex-wrap gap-1.5">
                            {vendor.businessUnitIds.map((b) => {
                                const bu = businessUnits.find((x) => x.id === b);
                                return (
                                    <span key={b} className="flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pr-2 pl-0.5 text-xs font-medium text-secondary">
                                        <BusinessUnitAvatar unit={bu} size="sm" className="size-5" />
                                        {bu?.name}
                                    </span>
                                );
                            })}
                        </dd>
                    </div>
                </dl>
                {vendor.notes && (
                    <div className="mt-5 rounded-xl bg-secondary px-4 py-3">
                        <p className="text-xs font-semibold text-quaternary">Notes</p>
                        <p className="mt-0.5 text-sm text-secondary">{vendor.notes}</p>
                    </div>
                )}
            </Card>

            <TableCard.Root className="rounded-2xl" size="sm">
                <TableCard.Header title="Products supplied" badge={String(supplied.length)} description="Variants that list this vendor as their default vendor." />
                {supplied.length === 0 ? (
                    <Empty icon={Package} title="No products yet" description="Set this vendor as the default vendor on a product variant." />
                ) : (
                    <Table aria-label="Products supplied">
                        <Table.Header>
                            <Table.Head label="Item" isRowHeader />
                            <Table.Head label="Unit" />
                            <Table.Head label="Cost" />
                            <Table.Head label="Reorder point" />
                            <Table.Head label="Lead time" />
                        </Table.Header>
                        <Table.Body items={supplied}>
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell>
                                        <VariantCell variantId={r.id} />
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        1 {r.product.uom.purchaseUnit} = {r.product.uom.unitsPerPurchaseUnit} {r.product.uom.sellingUnit}
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap tabular-nums">{formatCurrency(r.variant.cost)} / {r.product.uom.sellingUnit.toLowerCase()}</Table.Cell>
                                    <Table.Cell className="tabular-nums">{formatNumber(r.variant.reorderPoint)}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{r.variant.leadTimeDays} days</Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <TableCard.Root className="rounded-2xl" size="sm">
                <TableCard.Header title="Purchase order history" badge={String(pos.length)} />
                {pos.length === 0 ? (
                    <Empty icon={ShoppingCart01} title="No purchase orders yet" />
                ) : (
                    <Table aria-label="Purchase orders">
                        <Table.Header>
                            <Table.Head label="PO" isRowHeader />
                            <Table.Head label="Warehouse" />
                            <Table.Head label="Lines" />
                            <Table.Head label="Total cost" />
                            <Table.Head label="Created" />
                            <Table.Head label="Status" />
                        </Table.Header>
                        <Table.Body items={pos}>
                            {(po) => {
                                const t = poTotals({ products, variants }, po);
                                return (
                                    <Table.Row id={po.id} href={`/purchasing/orders/view?id=${po.id}`} className="cursor-pointer">
                                        <Table.Cell className="font-semibold whitespace-nowrap text-primary">{po.number}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            <LocationName id={po.warehouseId} />
                                        </Table.Cell>
                                        <Table.Cell>{t.lines}</Table.Cell>
                                        <Table.Cell className="tabular-nums">{formatCurrency(t.cost)}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">{formatDate(po.createdAt)}</Table.Cell>
                                        <Table.Cell>
                                            <StatusBadge status={po.status} size="sm" />
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <VendorFormModal isOpen={editing} onOpenChange={setEditing} vendor={vendor} />
        </div>
    );
}

const ContactField = ({ icon: Icon, label, value, href }: { icon: React.FC<{ className?: string }>; label: string; value: string; href?: string }) => (
    <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <Icon className="size-4" />
        </span>
        <div className="min-w-0">
            <dt className="text-sm text-tertiary">{label}</dt>
            <dd className="truncate text-md font-medium text-primary">
                {value ? (
                    href ? (
                        <a href={href} className="hover:underline">
                            {value}
                        </a>
                    ) : (
                        value
                    )
                ) : (
                    "—"
                )}
            </dd>
        </div>
    </div>
);

export default function VendorDetailPageRoute() {
    return (
        <Suspense>
            <VendorDetailPage />
        </Suspense>
    );
}
