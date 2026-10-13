"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, InfoCircle, XCircle } from "@untitledui/icons";
import { ProductSwatch } from "@/components/app/item-cell";
import type { DuplicateMatch } from "@/lib/selectors";
import { cx } from "@/utils/cx";

export const matchKindLabel: Record<DuplicateMatch["kind"], string> = {
    exact_code: "Exact UPC / SKU match",
    same_variant: "Same variant",
    same_product: "Same product",
};

interface DuplicateListProps {
    matches: DuplicateMatch[];
    title?: ReactNode;
    description?: ReactNode;
    /** Extra actions rendered on each match row. */
    renderActions?: (m: DuplicateMatch) => ReactNode;
    /** Show a softer, informational style instead of an error. */
    tone?: "error" | "warning" | "info";
    children?: ReactNode;
    className?: string;
}

const tones = {
    error: { box: "bg-error-primary ring-error_subtle", icon: XCircle, iconCls: "text-fg-error-primary", title: "text-error-primary" },
    warning: { box: "bg-warning-primary ring-orange-200", icon: AlertTriangle, iconCls: "text-fg-warning-primary", title: "text-warning-primary" },
    info: { box: "bg-secondary ring-secondary", icon: InfoCircle, iconCls: "text-fg-quaternary", title: "text-primary" },
};

/** Live duplicate check results (Appendix A: never create a duplicate product). */
export const DuplicateList = ({ matches, title, description, renderActions, tone = "warning", children, className }: DuplicateListProps) => {
    if (!matches.length) return null;
    const t = tones[tone];
    const Icon = t.icon;
    return (
        <div className={cx("rounded-xl p-4 ring-1 ring-inset", t.box, className)} role="status">
            <div className="flex items-start gap-3">
                <Icon className={cx("mt-0.5 size-5 shrink-0", t.iconCls)} />
                <div className="min-w-0 flex-1">
                    {title && <p className={cx("text-sm font-semibold", t.title)}>{title}</p>}
                    {description && <p className="mt-0.5 text-sm text-secondary">{description}</p>}
                    <ul className="mt-3 flex flex-col gap-2">
                        {matches.map((m) => (
                            <li
                                key={`${m.kind}-${m.product.id}-${m.variant?.id ?? ""}`}
                                className="flex flex-wrap items-center gap-3 rounded-lg bg-primary p-3 ring-1 ring-secondary"
                            >
                                <div className="flex min-w-60 flex-1 items-center gap-3">
                                    <ProductSwatch color={m.product.imageColor} name={m.product.brand} size="sm" />
                                    <div className="min-w-0">
                                        <Link href={`/catalog/products/${m.product.id}`} className="block truncate text-sm font-semibold text-primary hover:underline">
                                            {m.product.name}
                                            {m.variant && <span className="font-normal text-tertiary"> — {m.variant.name}</span>}
                                        </Link>
                                        <p className="text-xs text-tertiary">
                                            <span className="font-medium text-secondary">{matchKindLabel[m.kind]}</span> · {m.reason}
                                            {m.variant && <span className="font-mono"> · {m.variant.sku}</span>}
                                        </p>
                                    </div>
                                </div>
                                {renderActions && <div className="flex shrink-0 flex-wrap gap-2">{renderActions(m)}</div>}
                            </li>
                        ))}
                    </ul>
                    {children && <div className="mt-3">{children}</div>}
                </div>
            </div>
        </div>
    );
};
