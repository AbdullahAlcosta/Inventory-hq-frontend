import { cx } from "@/utils/cx";

/** Inventory HQ wordmark — same treatment as the SugrPay logo (white + orange). */
export const Logo = ({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) => (
    <div className={cx("flex items-center gap-2", className)}>
        <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
            <defs>
                <linearGradient id="ihq-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#FB923C" />
                    <stop offset="1" stopColor="#EA580C" />
                </linearGradient>
            </defs>
            <path d="M16 2.5 28 9v14l-12 6.5L4 23V9l12-6.5Z" fill="url(#ihq-g)" />
            <path d="M4.6 9.3 16 15.6l11.4-6.3M16 15.6V29" stroke="#fff" strokeOpacity=".85" strokeWidth="2" fill="none" strokeLinejoin="round" />
        </svg>
        <span className={cx("text-xl font-extrabold tracking-tight", tone === "dark" ? "text-white" : "text-gray-950")}>
            INVENTORY<span className="text-orange-500">HQ</span>
        </span>
    </div>
);
