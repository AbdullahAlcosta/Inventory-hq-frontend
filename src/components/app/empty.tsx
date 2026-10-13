import type { FC, ReactNode } from "react";
import { SearchLg } from "@untitledui/icons";

export const Empty = ({ icon: Icon = SearchLg, title, description, action }: { icon?: FC<{ className?: string }>; title: string; description?: ReactNode; action?: ReactNode }) => (
    <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-600 ring-8 ring-gray-50">
            <Icon className="size-6" />
        </span>
        <p className="mt-4 text-md font-semibold text-primary">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-tertiary">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
    </div>
);
