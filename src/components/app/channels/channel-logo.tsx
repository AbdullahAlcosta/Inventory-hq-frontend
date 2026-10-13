import type { ChannelType } from "@/lib/types";
import { cx } from "@/utils/cx";

export const channelMeta: Record<ChannelType, { label: string; short: string; bg: string; level: "store" | "business_unit" }> = {
    quickvee: { label: "Quickvee", short: "Q", bg: "#0d9488", level: "store" },
    shopify: { label: "Shopify", short: "S", bg: "#5a8e2c", level: "business_unit" },
    woocommerce: { label: "WooCommerce", short: "Woo", bg: "#7f54b3", level: "business_unit" },
};

/** Small colored mark for a sales channel (no brand assets in the static build). */
export const ChannelLogo = ({ channel, size = "md", className }: { channel: ChannelType; size?: "sm" | "md" | "lg"; className?: string }) => {
    const meta = channelMeta[channel];
    return (
        <span
            aria-label={meta.label}
            title={meta.label}
            className={cx(
                "flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight text-white ring-1 ring-black/5",
                size === "sm" && "size-7 text-[10px]",
                size === "md" && "size-10 text-xs",
                size === "lg" && "size-12 text-sm",
                className,
            )}
            style={{ background: meta.bg }}
        >
            {meta.short}
        </span>
    );
};
