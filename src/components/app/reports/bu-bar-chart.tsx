"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

export interface BuChartDatum {
    name: string;
    sales: number;
    margin: number;
}

/** Sales vs gross margin per Business Unit — black/orange palette. */
export const BuBarChart = ({ data }: { data: BuChartDatum[] }) => (
    <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="currentColor" className="text-gray-100" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} interval={0} className="text-xs" tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }} />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v: number) => formatCompactCurrency(v)}
                    tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
                />
                <Tooltip
                    cursor={{ fill: "var(--color-bg-secondary)" }}
                    content={<ChartTooltipContent />}
                    formatter={(value) => formatCurrency(Number(value))}
                />
                <Legend verticalAlign="top" align="right" height={32} content={<ChartLegendContent />} />
                <Bar dataKey="sales" name="Sales" fill="#171717" className="text-gray-900" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="margin" name="Gross margin" fill="#f97316" className="text-orange-500" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
        </ResponsiveContainer>
    </div>
);
