"use client";

import { type ReactNode, useMemo } from "react";
import { Truck01 } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { ProductSwatch } from "@/components/app/item-cell";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import type { Scope } from "@/hooks/use-session";
import { formatCurrency, formatNumber } from "@/lib/format";
import { stockAt } from "@/lib/selectors";
import type { Location, Product, Variant } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

export type RequestFor = { own: string[]; businessUnitId: string | null } | null;

/**
 * Store staff can ask for stock from the warehouse or from another store in the same brand.
 * Executives and warehouse staff don't raise store requests.
 */
export const useRequestFor = (scope: Scope): RequestFor =>
    useMemo(() => {
        if (scope.isExecutive || !scope.isStoreLevel) return null;
        const store = scope.activeLocation?.type === "store" ? scope.activeLocation : null;
        // Which stores count as "mine" (not a source): the picked store, or every store this person works at.
        const own = store ? [store.id] : scope.user.locationIds;
        return { own, businessUnitId: store?.businessUnitId ?? null };
    }, [scope]);

/** Available quantity of each variant at every store and warehouse in the product's brand. */
export function ProductStockCard({
    title,
    product,
    variants,
    highlight,
    locations,
    myLocationIds,
    stockLevels,
    requestFor,
}: {
    product: Product;
    variants: Variant[];
    highlight: string | null;
    locations: Location[];
    myLocationIds: string[];
    stockLevels: ReturnType<typeof useAppStore.getState>["stockLevels"];
    requestFor: RequestFor;
    /** Card title; defaults to the product name and type. */
    title?: ReactNode;
}) {
    const cols = [...locations].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "store" ? -1 : 1));
    const mine = (id: string) => myLocationIds.includes(id);
    const canRequest = !!requestFor && (!requestFor.businessUnitId || requestFor.businessUnitId === product.businessUnitId);
    const warehouse = cols.find((l) => l.type === "warehouse");
    const requestHref = (variantId: string, sourceId: string) => `/replenishment/requests/new?variant=${variantId}&source=${sourceId}`;

    return (
        <Card
            flush
            title={
                title ?? (
                    <span className="flex items-center gap-3">
                        <ProductSwatch color={product.imageColor} name={product.brand} />
                        <span className="min-w-0">
                            <span className="block truncate">{product.name}</span>
                            <span className="block text-sm font-normal text-tertiary">
                                {product.productType} · {product.uom.purchaseUnit} of {product.uom.unitsPerPurchaseUnit}
                            </span>
                        </span>
                    </span>
                )
            }
        >
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                    <thead>
                        <tr className="border-b border-secondary bg-secondary text-xs font-semibold text-tertiary">
                            <th className="sticky left-0 z-1 bg-secondary px-5 py-3 text-left md:px-6">Variant</th>
                            {cols.map((l) => (
                                <th key={l.id} className={cx("px-3 py-3 text-right whitespace-nowrap", mine(l.id) && "bg-gray-900 text-white")}>
                                    <span className="block">{l.name}</span>
                                    <span className={cx("block font-normal", mine(l.id) ? "text-gray-300" : "text-quaternary")}>
                                        {mine(l.id) ? "Your location" : l.type === "store" ? "Store" : "Warehouse"}
                                    </span>
                                </th>
                            ))}
                            {canRequest && (
                                <th className="px-5 py-3 text-right md:px-6">
                                    <span className="sr-only">Actions</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {variants.map((v) => {
                            const total = cols.reduce((n, l) => n + stockAt({ stockLevels }, v.id, l.id).available, 0);
                            return (
                                <tr key={v.id} className={cx("border-b border-secondary last:border-0", highlight === v.id && "bg-yellow-50")}>
                                    <td className={cx("sticky left-0 z-1 px-5 py-3 md:px-6", highlight === v.id ? "bg-yellow-50" : "bg-primary")}>
                                        <p className="font-medium text-primary">{v.name}</p>
                                        <p className="font-mono text-xs whitespace-nowrap text-tertiary">{v.sku}</p>
                                        <p className="text-xs whitespace-nowrap text-tertiary">
                                            {formatCurrency(v.price)} · {formatNumber(total)} available in total
                                        </p>
                                    </td>
                                    {cols.map((l) => {
                                        const qty = stockAt({ stockLevels }, v.id, l.id).available;
                                        return (
                                            <td key={l.id} className={cx("px-3 py-3 text-right tabular-nums", mine(l.id) && "bg-gray-50 font-semibold")}>
                                                {qty === 0 ? (
                                                    <Badge type="pill-color" color="gray" size="sm">
                                                        0
                                                    </Badge>
                                                ) : (
                                                    <span className={cx("text-md", qty <= 3 ? "text-error-primary" : "text-primary")}>{formatNumber(qty)}</span>
                                                )}
                                                {canRequest && qty > 0 && l.type === "store" && !requestFor!.own.includes(l.id) && (
                                                    <span className="mt-1 block">
                                                        <Button
                                                            size="sm"
                                                            color="link-gray"
                                                            href={requestHref(v.id, l.id)}
                                                            aria-label={`Request from ${l.name}`}
                                                            className="text-xs whitespace-nowrap underline"
                                                        >
                                                            Request
                                                        </Button>
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    {canRequest && (
                                        <td className="px-5 py-3 text-right md:px-6">
                                            {canRequest && warehouse && (
                                                <Button
                                                    size="sm"
                                                    color="secondary"
                                                    iconLeading={Truck01}
                                                    href={requestHref(v.id, warehouse.id)}
                                                    className="whitespace-nowrap"
                                                >
                                                    Request from warehouse
                                                </Button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
