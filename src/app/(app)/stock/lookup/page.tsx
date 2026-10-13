"use client";

import { Suspense, useMemo, useState } from "react";
import { PackageSearch, SearchLg, Truck01 } from "@untitledui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { ProductSwatch } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { type ScanFeedback, ScanInput } from "@/components/app/scan-input";
import { useActiveBuName } from "@/components/app/stock/use-stock-page";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatNumber } from "@/lib/format";
import { lookupCode, normalize, stockAt } from "@/lib/selectors";
import type { Location, Product, Variant } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

export default function LookupPage() {
    return (
        <Suspense fallback={null}>
            <Lookup />
        </Suspense>
    );
}

const MAX_PRODUCTS = 8;

function Lookup() {
    const scope = useRequiredScope();
    const eyebrow = useActiveBuName();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const locations = useAppStore((s) => s.locations);
    const stockLevels = useAppStore((s) => s.stockLevels);

    const [query, setQueryState] = useState(params.get("q") ?? "");
    const [scannedVariantId, setScannedVariantId] = useState<string | null>(null);

    // Keep ?q= in sync so the header search and back button work.
    const setQuery = (q: string) => {
        setQueryState(q);
        setScannedVariantId(null);
        const next = new URLSearchParams(params.toString());
        if (q) next.set("q", q);
        else next.delete("q");
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    };

    // React to header searches while already on this page.
    const urlQ = params.get("q") ?? "";
    const [lastUrlQ, setLastUrlQ] = useState(urlQ);
    if (urlQ !== lastUrlQ) {
        setLastUrlQ(urlQ);
        if (urlQ) {
            setQueryState(urlQ);
            setScannedVariantId(null);
        }
    }

    const buProducts = useMemo(
        () => products.filter((p) => scope.activeBusinessUnitIds.includes(p.businessUnitId) && p.status !== "archived"),
        [products, scope.activeBusinessUnitIds],
    );

    const results = useMemo(() => {
        if (scannedVariantId) {
            const v = variants.find((x) => x.id === scannedVariantId);
            const p = v && buProducts.find((x) => x.id === v.productId);
            return p ? [{ product: p, variants: variants.filter((x) => x.productId === p.id), highlight: scannedVariantId }] : [];
        }
        const q = normalize(query);
        if (!q) return [];
        const terms = q.split(" ");
        return buProducts
            .map((p) => {
                const own = variants.filter((v) => v.productId === p.id);
                const productTokens = normalize(`${p.name} ${p.productType}`).split(" ");
                // Each search word must start a word in the item (so "raw" doesn't match "strawberry").
                const matches = (tokens: string[]) => terms.every((t) => tokens.some((w) => w.startsWith(t)));
                const hits = own.filter((v) => matches([...productTokens, ...normalize(`${v.name} ${v.sku}`).split(" "), ...v.barcodes.map((b) => b.code)]));
                if (!hits.length) return null;
                // Whole product matched → show every variant; otherwise only the matching ones.
                const productMatch = matches(productTokens);
                return { product: p, variants: productMatch ? own : hits, highlight: null as string | null };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);
    }, [query, scannedVariantId, buProducts, variants]);

    const simulate = useMemo(() => {
        const picks = buProducts.slice(0, 4).flatMap((p, i) => {
            const v = variants.find((x) => x.productId === p.id);
            if (!v) return [];
            const b = v.barcodes.find((x) => x.unit === (i === 3 ? "purchase" : "selling"));
            return b ? [{ code: b.code, label: `${p.name} — ${v.name}`, hint: b.unit === "purchase" ? `${p.uom.purchaseUnit} barcode` : "Item barcode" }] : [];
        });
        return picks;
    }, [buProducts, variants]);

    const onScan = (code: string): ScanFeedback => {
        const hit = lookupCode({ products: buProducts, variants }, code);
        if (!hit) return { tone: "error", title: "No match", description: `Nothing in your business unit has barcode or SKU ${code}.` };
        setQueryState("");
        setScannedVariantId(hit.variant.id);
        if (params.get("q")) router.replace(pathname, { scroll: false });
        return {
            tone: "success",
            title: `${hit.product.name} — ${hit.variant.name}`,
            description: hit.unit === "purchase" ? `That’s a ${hit.product.uom.purchaseUnit.toLowerCase()} barcode (${hit.units} units).` : undefined,
        };
    };

    const examples = useMemo(() => {
        const list = buProducts.slice(0, 3).map((p) => p.brand);
        const sku = variants.find((v) => buProducts[0] && v.productId === buProducts[0].id)?.sku;
        return { brands: Array.from(new Set(list)), sku };
    }, [buProducts, variants]);

    const shown = results.slice(0, MAX_PRODUCTS);

    /**
     * Store staff can ask for stock from the warehouse or from another store in the same business unit.
     * Executives and warehouse staff don't raise store requests from here.
     */
    const requestFor = useMemo(() => {
        if (scope.isExecutive || !scope.isStoreLevel) return null;
        const store = scope.activeLocation?.type === "store" ? scope.activeLocation : null;
        // Which stores count as "mine" (not a source): the picked store, or every store this person works at.
        const own = store ? [store.id] : scope.user.locationIds;
        return { own, businessUnitId: store?.businessUnitId ?? null };
    }, [scope]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow={eyebrow}
                title="Product Lookup"
                description="Find an item and see how many are Available at every store and warehouse."
                className="mb-0"
            />

            <Card>
                <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                        <p className="mb-1.5 text-sm font-medium text-secondary">Search</p>
                        <Input
                            aria-label="Search products"
                            size="lg"
                            icon={SearchLg}
                            placeholder="Name, variant, SKU or barcode"
                            value={query}
                            onChange={setQuery}
                        />
                    </div>
                    <div>
                        <p className="mb-1.5 text-sm font-medium text-secondary">Or scan</p>
                        <ScanInput onScan={onScan} simulate={simulate} autoFocus={!query} placeholder="Scan a barcode" />
                    </div>
                </div>
            </Card>

            {!query && !scannedVariantId ? (
                <Card>
                    <Empty
                        icon={PackageSearch}
                        title="Look up any product"
                        description={
                            <>
                                Search by name, SKU or barcode, or scan the item. Try{" "}
                                {examples.brands.map((b, i) => (
                                    <span key={b}>
                                        <button type="button" className="font-semibold text-primary underline" onClick={() => setQuery(b)}>
                                            {b}
                                        </button>
                                        {i < examples.brands.length - 1 ? ", " : ""}
                                    </span>
                                ))}
                                {examples.sku && (
                                    <>
                                        {" "}
                                        or SKU{" "}
                                        <button
                                            type="button"
                                            className="font-mono font-semibold text-primary underline"
                                            onClick={() => setQuery(examples.sku!)}
                                        >
                                            {examples.sku}
                                        </button>
                                    </>
                                )}
                                .
                            </>
                        }
                    />
                </Card>
            ) : shown.length === 0 ? (
                <Card>
                    <Empty title="No products found" description={`Nothing matches “${query}”. Check the spelling, or try the brand name or SKU.`} />
                </Card>
            ) : (
                <>
                    {results.length > MAX_PRODUCTS && (
                        <p className="text-sm text-tertiary">
                            Showing {MAX_PRODUCTS} of {results.length} products. Narrow your search to see more.
                        </p>
                    )}
                    {shown.map((r) => (
                        <ProductStockCard
                            key={r.product.id}
                            product={r.product}
                            variants={r.variants}
                            highlight={r.highlight}
                            locations={locations.filter((l) => l.businessUnitId === r.product.businessUnitId)}
                            myLocationIds={scope.user.locationIds}
                            stockLevels={stockLevels}
                            requestFor={requestFor}
                        />
                    ))}
                </>
            )}
        </div>
    );
}

function ProductStockCard({
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
    requestFor: { own: string[]; businessUnitId: string | null } | null;
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
                <span className="flex items-center gap-3">
                    <ProductSwatch color={product.imageColor} name={product.brand} />
                    <span className="min-w-0">
                        <span className="block truncate">{product.name}</span>
                        <span className="block text-sm font-normal text-tertiary">
                            {product.productType} · {product.uom.purchaseUnit} of {product.uom.unitsPerPurchaseUnit}
                        </span>
                    </span>
                </span>
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
                            <th className="px-5 py-3 text-right md:px-6">
                                <span className="sr-only">Actions</span>
                            </th>
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
                                                        <Button size="sm" color="link-gray" href={requestHref(v.id, l.id)} className="text-xs whitespace-nowrap underline">
                                                            Request
                                                        </Button>
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
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
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
