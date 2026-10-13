import type { BusinessUnit } from "@/lib/types";
import { cx } from "@/utils/cx";

const colors: Record<BusinessUnit["color"], string> = {
    orange: "bg-orange-500",
    blue: "bg-blue-500",
    green: "bg-green-600",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
    gray: "bg-gray-600",
};

export const BusinessUnitAvatar = ({ unit, size = "md", className }: { unit?: Pick<BusinessUnit, "name" | "color"> | null; size?: "sm" | "md" | "lg"; className?: string }) => (
    <span
        className={cx(
            "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
            unit ? colors[unit.color] : "bg-gray-700",
            size === "sm" && "size-6 text-xs",
            size === "md" && "size-9 text-sm",
            size === "lg" && "size-12 text-lg",
            className,
        )}
    >
        {unit ? unit.name[0] : "★"}
    </span>
);
