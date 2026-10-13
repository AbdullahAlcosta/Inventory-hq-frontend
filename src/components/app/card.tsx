import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface CardProps {
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
    bodyClassName?: string;
    /** Remove body padding — for tables and lists that run edge to edge. */
    flush?: boolean;
}

export const Card = ({ title, description, actions, children, className, bodyClassName, flush }: CardProps) => (
    <section className={cx("overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary", className)}>
        {(title || actions) && (
            <header className="flex flex-col gap-3 border-b border-secondary px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                <div className="min-w-0">
                    {title && <h2 className="text-lg font-semibold text-primary">{title}</h2>}
                    {description && <p className="mt-0.5 text-sm text-tertiary">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </header>
        )}
        <div className={cx(!flush && "px-5 py-5 md:px-6", bodyClassName)}>{children}</div>
    </section>
);

/** Label / value pair used in detail panels (like the check review slideout). */
export const Field = ({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) => (
    <div className={cx("min-w-0", className)}>
        <dt className="text-sm text-tertiary">{label}</dt>
        <dd className="mt-0.5 text-md font-medium text-primary">{children}</dd>
    </div>
);
