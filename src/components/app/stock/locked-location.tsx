"use client";

import { LocationIcon } from "@/components/app/sidebar";

/** Read-only "Location" field for modals that work on the location picked in the sidebar. */
export const LockedLocation = ({ name, type }: { name: string; type: "store" | "warehouse" }) => (
    <div>
        <p className="mb-1.5 text-sm font-medium text-secondary">Location</p>
        <div className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-fg-secondary ring-1 ring-secondary">
                <LocationIcon type={type} className="size-4" />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-primary">{name}</span>
                <span className="block text-xs text-tertiary">{type === "store" ? "Store" : "Warehouse"} · from the location switcher</span>
            </span>
        </div>
    </div>
);
