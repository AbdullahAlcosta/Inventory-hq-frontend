"use client";

import Link from "next/link";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

/** Product thumbnail swatch (we don't have images in the static build). */
export const ProductSwatch = ({ color, name, size = "md" }: { color?: string; name: string; size?: "sm" | "md" | "lg" }) => (
    <span
        className={cx(
            "flex shrink-0 items-center justify-center rounded-lg font-semibold text-white ring-1 ring-black/5",
            size === "sm" && "size-8 text-xs",
            size === "md" && "size-10 text-sm",
            size === "lg" && "size-14 text-lg",
        )}
        style={{ background: color ?? "#6b7280" }}
        aria-hidden="true"
    >
        {name.slice(0, 1)}
    </span>
);

/** Shows "Product — Variant" with SKU, linking to the product. */
export const VariantCell = ({ variantId, link = true, showSku = true }: { variantId: string; link?: boolean; showSku?: boolean }) => {
    const variant = useAppStore((s) => s.variants.find((v) => v.id === variantId));
    const product = useAppStore((s) => (variant ? s.products.find((p) => p.id === variant.productId) : undefined));
    if (!variant || !product) return <span className="text-tertiary">Unknown item</span>;
    const title = (
        <span className="block truncate text-sm font-medium text-primary">
            {product.name} <span className="text-tertiary">— {variant.name}</span>
        </span>
    );
    return (
        <div className="flex min-w-0 items-center gap-3">
            <ProductSwatch color={product.imageColor} name={product.brand} size="sm" />
            <div className="min-w-0">
                {link ? (
                    <Link href={`/catalog/products/view?id=${product.id}`} className="hover:underline">
                        {title}
                    </Link>
                ) : (
                    title
                )}
                {showSku && <span className="block font-mono text-xs text-tertiary">{variant.sku}</span>}
            </div>
        </div>
    );
};

export const LocationName = ({ id }: { id: string | null | undefined }) => {
    const location = useAppStore((s) => s.locations.find((l) => l.id === id));
    return <>{location?.name ?? "—"}</>;
};

export const EmployeeName = ({ id }: { id: string | null | undefined }) => {
    const e = useAppStore((s) => s.employees.find((x) => x.id === id));
    return <>{id === "system" ? "System" : (e?.name ?? "—")}</>;
};
