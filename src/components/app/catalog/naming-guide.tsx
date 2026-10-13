import { cx } from "@/utils/cx";

const rules: { change: string; example: string; result: "Variant" | "New product" | "Same product, add UPC" | "Ask your manager" }[] = [
    { change: "Flavor", example: "Blue Razz Ice → Watermelon Ice", result: "Variant" },
    { change: "Color", example: "Black → Silver", result: "Variant" },
    { change: "Nicotine strength", example: "3% → 5%", result: "Variant" },
    { change: "Weight / size", example: "1¼ → King Size", result: "Variant" },
    { change: "Brand", example: "Geek Bar → Lost Mary", result: "New product" },
    { change: "Device model / line", example: "Pulse X → Pulse", result: "New product" },
    { change: "Product type", example: "Disposable → Pod kit", result: "New product" },
    { change: "Only the UPC differs", example: "Same item, new packaging code", result: "Same product, add UPC" },
    { change: "Not sure", example: "", result: "Ask your manager" },
];

const tone = {
    Variant: "bg-blue-50 text-blue-700 ring-blue-200",
    "New product": "bg-gray-950 text-white ring-gray-950",
    "Same product, add UPC": "bg-green-50 text-green-700 ring-green-200",
    "Ask your manager": "bg-orange-50 text-orange-700 ring-orange-200",
};

/** Appendix A: "New product or variant?" helper. */
export const NamingGuide = ({ compact }: { compact?: boolean }) => (
    <div className="overflow-hidden rounded-xl ring-1 ring-secondary">
        <table className="w-full text-left text-sm">
            <thead className="bg-secondary">
                <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-quaternary">If it differs by…</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-quaternary">It's a…</th>
                </tr>
            </thead>
            <tbody>
                {rules.map((r) => (
                    <tr key={r.change} className="border-t border-secondary">
                        <td className="px-3 py-2">
                            <span className="block font-medium text-primary">{r.change}</span>
                            {!compact && r.example && <span className="block text-xs text-tertiary">{r.example}</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                            <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", tone[r.result])}>{r.result}</span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
