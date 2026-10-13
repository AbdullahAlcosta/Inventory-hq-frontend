const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const numberFmt = new Intl.NumberFormat("en-US");

export const formatCurrency = (n: number) => currencyFmt.format(n);
export const formatCompactCurrency = (n: number) => compactCurrencyFmt.format(n);
export const formatNumber = (n: number) => numberFmt.format(n);
export const formatSigned = (n: number) => (n > 0 ? `+${formatNumber(n)}` : formatNumber(n));

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(iso);
};

export const pluralize = (n: number, word: string, plural = `${word}s`) => `${formatNumber(n)} ${n === 1 ? word : plural}`;

export const initials = (name: string) =>
    name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
