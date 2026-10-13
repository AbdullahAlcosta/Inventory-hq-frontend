import { Badge } from "@/components/base/badges/badges";
import type { AllocationMode } from "@/lib/types";

export const modeMeta: Record<AllocationMode, { label: string; color: "gray" | "blue" | "purple" }> = {
    shared: { label: "Shared", color: "gray" },
    dedicated: { label: "Dedicated", color: "blue" },
    hybrid: { label: "Hybrid", color: "purple" },
};

export const ModeBadge = ({ mode }: { mode: AllocationMode }) => (
    <Badge type="pill-color" color={modeMeta[mode].color} size="sm">
        {modeMeta[mode].label}
    </Badge>
);
