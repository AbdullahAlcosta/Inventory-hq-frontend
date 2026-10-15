import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface PageHeaderProps {
    /** Small line above the title — usually the brand or parent page. */
    eyebrow?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    backHref?: string;
    backLabel?: string;
    className?: string;
}

export const PageHeader = ({ eyebrow, title, description, actions, backHref, backLabel = "Back", className }: PageHeaderProps) => (
    <div className={cx("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
        <div className="min-w-0">
            {backHref && (
                <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-tertiary hover:text-primary">
                    <ChevronLeft className="size-4" />
                    {backLabel}
                </Link>
            )}
            {eyebrow && <p className="text-md text-tertiary">{eyebrow}</p>}
            <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-md text-tertiary">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
);
