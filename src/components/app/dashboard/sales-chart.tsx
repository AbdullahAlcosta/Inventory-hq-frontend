"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent } from "@/components/application/charts/charts-base";
import { Card } from "@/components/app/card";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const shortDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Last 30 days of revenue for the given stores, with the prior 30 days for comparison. */
export const SalesChart = ({ storeIds, description = "Revenue across your stores, last 30 days." }: { storeIds: string[]; description?: string }) => {
    const salesHistory = useAppStore((s) => s.salesHistory);

    const { data, total, previous, units } = useMemo(() => {
        const ids = new Set(storeIds);
        const byDay = new Map<string, number>();
        let prev = 0;
        let unitCount = 0;
        const today = new Date();
        const start = dayKey(new Date(today.getTime() - 29 * DAY));
        const prevStart = dayKey(new Date(today.getTime() - 59 * DAY));
        salesHistory.forEach((r) => {
            if (!ids.has(r.locationId)) return;
            if (r.date >= start) {
                byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.revenue);
                unitCount += r.units;
            } else if (r.date >= prevStart) prev += r.revenue;
        });
        const rows = Array.from({ length: 30 }, (_, i) => {
            const key = dayKey(new Date(today.getTime() - (29 - i) * DAY));
            return { date: key, revenue: Math.round(byDay.get(key) ?? 0) };
        });
        return { data: rows, total: rows.reduce((s, r) => s + r.revenue, 0), previous: prev, units: unitCount };
    }, [salesHistory, storeIds]);

    const change = previous > 0 ? ((total - previous) / previous) * 100 : null;

    return (
        <Card title="Sales" description={description}>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                    <p className="text-display-sm font-semibold text-primary tabular-nums">{formatCurrency(total)}</p>
                    <p className="text-sm text-tertiary">{units.toLocaleString("en-US")} units sold</p>
                </div>
                {change !== null && (
                    <span className={cx("mb-1 rounded-full px-2 py-0.5 text-sm font-medium", change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                        {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs prior 30 days
                    </span>
                )}
            </div>
            {total === 0 ? (
                <p className="mt-6 text-sm text-tertiary">No sales recorded for these stores yet.</p>
            ) : (
                <div className="mt-6 h-60">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
                            <CartesianGrid vertical={false} stroke="currentColor" className="text-gray-100" />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                interval={6}
                                tickFormatter={shortDate}
                                tick={{ fontSize: 12, fill: "#737373" }}
                                tickMargin={8}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={52}
                                tickFormatter={(v: number) => formatCompactCurrency(v)}
                                tick={{ fontSize: 12, fill: "#737373" }}
                            />
                            <Tooltip
                                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                                content={<ChartTooltipContent />}
                                formatter={(value) => formatCurrency(Number(value))}
                                labelFormatter={(label) => shortDate(String(label))}
                            />
                            <Bar dataKey="revenue" name="Revenue" fill="#171717" radius={[4, 4, 0, 0]} activeBar={{ fill: "#f97316" }} isAnimationActive={false} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Card>
    );
};
