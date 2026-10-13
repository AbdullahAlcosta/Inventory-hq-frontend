"use client";

import { type FC, useMemo, useState } from "react";
import Link from "next/link";
import { CheckDone01, ClipboardCheck, CoinsStacked01, Download01, LayersThree01, Printer, ShoppingCart01, Tag01, TrendUp01, Truck01 } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { PageHeader } from "@/components/app/page-header";
import { BuBarChart } from "@/components/app/reports/bu-bar-chart";
import { Delta } from "@/components/app/reports/delta";
import { buildReport, monthOptions, reportCsv } from "@/components/app/reports/report-data";
import { StatCard } from "@/components/app/stat-card";
import { toast } from "@/components/app/toast";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency, formatNumber, pluralize } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

const pct = (n: number) => `${n.toFixed(1)}%`;

const printCss = `
@media print {
  aside, header.sticky, [data-print-hide] { display: none !important; }
  .lg\\:pl-72 { padding-left: 0 !important; }
  main { padding: 0 !important; }
  body, .bg-secondary { background: #fff !important; }
  section, [data-print-avoid] { break-inside: avoid; }
  @page { margin: 14mm; }
}`;

export default function ExecutiveReportPage() {
    const scope = useRequiredScope();
    const store = useAppStore();
    const { companies, businessUnits, salesHistory } = store;
    const company = companies.find((c) => c.id === scope.companyId);

    const options = useMemo(() => monthOptions(salesHistory.map((r) => r.date)), [salesHistory]);
    const [periodId, setPeriodId] = useState<string>(() => options[1]?.id ?? options[0].id);
    const period = options.find((o) => o.id === periodId) ?? options[0];

    const report = useMemo(
        () => buildReport(store, scope.activeBusinessUnitIds, scope.activeLocationIds, period),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [store.salesHistory, store.stockLevels, store.variants, store.products, store.approvals, store.purchaseOrders, store.storeRequests, store.counts, store.locations, store.businessUnits, scope.activeBusinessUnitIds, scope.activeLocationIds, period],
    );

    if (!scope.isExecutive) {
        return <Empty title="Executives only" description="The monthly report is available to executives." />;
    }

    const activeBu = scope.activeBusinessUnitIds.length === 1 && scope.businessUnitIds.length > 1 ? businessUnits.find((b) => b.id === scope.activeBusinessUnitIds[0]) : undefined;
    const scopeLabel = activeBu ? activeBu.name : `${company?.name ?? "Company"} · all business units`;
    const stores = report.byLocation.filter((r) => r.location.type === "store");
    const warehouses = report.byLocation.filter((r) => r.location.type === "warehouse");

    const downloadCsv = () => {
        const csv = reportCsv(report, period.label, activeBu ? `${company?.name} — ${activeBu.name}` : (company?.name ?? ""));
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `executive-report-${period.id}${activeBu ? `-${activeBu.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("CSV downloaded", `${report.byBusinessUnit.length} business units, ${report.byLocation.length} locations`);
    };

    return (
        <div className="flex flex-col gap-6">
            <style>{printCss}</style>
            <PageHeader
                className="mb-0"
                eyebrow={scopeLabel}
                title="Executive Report"
                description={
                    <>
                        Sales, margins and inventory value for <span className="font-medium text-secondary">{period.label}</span>
                        {period.mtd ? ` (through ${new Date(period.end + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : ""}.
                    </>
                }
                actions={
                    <div data-print-hide className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <Select
                            aria-label="Report month"
                            className="sm:w-72"
                            items={options.map((o) => ({ id: o.id, label: o.label }))}
                            selectedKey={period.id}
                            onSelectionChange={(k) => k && setPeriodId(String(k))}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <Button color="secondary" size="md" iconLeading={Download01} onPress={downloadCsv}>
                            Download CSV
                        </Button>
                        <Button color="primary" size="md" iconLeading={Printer} onPress={() => window.print()}>
                            Download PDF
                        </Button>
                    </div>
                }
            />

            {report.byBusinessUnit.length === 0 ? (
                <Card>
                    <Empty title="Nothing to report yet" description="Add a business unit and locations under Setup to see the monthly report." />
                </Card>
            ) : (
                <>
                    {/* Headline numbers */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <StatCard
                            label="Sales"
                            icon={TrendUp01}
                            value={formatCurrency(report.total.sales)}
                            hint={<Delta current={report.total.sales} previous={report.prev.sales} label={period.prevLabel} available={report.prevComplete} />}
                        />
                        <StatCard
                            label="Gross margin"
                            icon={CoinsStacked01}
                            tone="warning"
                            value={
                                <span className="flex flex-wrap items-baseline gap-x-2">
                                    {formatCurrency(report.total.margin)}
                                    <span className="text-md font-medium text-tertiary">{pct(report.total.marginPct)}</span>
                                </span>
                            }
                            hint={<Delta current={report.total.marginPct} previous={report.prev.marginPct} label={period.prevLabel} points available={report.prevComplete && report.prev.sales > 0} />}
                        />
                        <StatCard
                            label="Units sold"
                            icon={ShoppingCart01}
                            value={formatNumber(report.total.units)}
                            hint={<Delta current={report.total.units} previous={report.prev.units} label={period.prevLabel} available={report.prevComplete} />}
                        />
                        <StatCard label="Inventory value at cost" icon={LayersThree01} value={formatCurrency(report.inventory.costAll)} hint="Snapshot today · all stock states" />
                        <StatCard label="Inventory value at retail" icon={Tag01} value={formatCurrency(report.inventory.retailAll)} hint={`${formatNumber(report.inventory.units)} units on hand`} />
                    </div>

                    {/* By business unit */}
                    <Card title="Sales & margin by Business Unit" description={`${period.label} · store sales from all connected channels`} flush>
                        <div className="px-4 pt-4 md:px-6">
                            <BuBarChart data={report.byBusinessUnit.map((b) => ({ name: b.businessUnit.name, sales: Math.round(b.sales), margin: Math.round(b.margin) }))} />
                        </div>
                        <div className="mt-4 border-t border-secondary">
                            <Table aria-label="Sales and margin by business unit" size="sm">
                                <Table.Header>
                                    <Table.Head label="Business Unit" isRowHeader />
                                    <Table.Head label="Sales" />
                                    <Table.Head label="Cost" />
                                    <Table.Head label="Gross margin" />
                                    <Table.Head label="Margin %" />
                                    <Table.Head label="Units" />
                                    <Table.Head label="Share of sales" />
                                </Table.Header>
                                <Table.Body items={[...report.byBusinessUnit.map((b) => ({ ...b, id: b.businessUnit.id, total: false })), { ...report.byBusinessUnit[0], ...report.total, id: "__total", total: true }]}>
                                    {(row) => (
                                        <Table.Row id={row.id} className={row.total ? "bg-secondary_subtle font-semibold" : undefined}>
                                            <Table.Cell>
                                                {row.total ? (
                                                    <span className="font-semibold text-primary">Total</span>
                                                ) : (
                                                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                                                        <BusinessUnitAvatar unit={row.businessUnit} size="sm" />
                                                        <span className="font-medium text-primary">{row.businessUnit.name}</span>
                                                    </span>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell className="text-primary tabular-nums">{formatCurrency(row.sales)}</Table.Cell>
                                            <Table.Cell className="tabular-nums">{formatCurrency(row.cost)}</Table.Cell>
                                            <Table.Cell className="text-primary tabular-nums">{formatCurrency(row.margin)}</Table.Cell>
                                            <Table.Cell className="tabular-nums">{pct(row.marginPct)}</Table.Cell>
                                            <Table.Cell className="tabular-nums">{formatNumber(row.units)}</Table.Cell>
                                            <Table.Cell>
                                                <ShareBar value={report.total.sales ? (row.sales / report.total.sales) * 100 : 0} />
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        </div>
                    </Card>

                    {/* By location */}
                    <TableCard.Root size="sm">
                        <TableCard.Header title="By location" description="Stores show sales and margin. Warehouses don't sell, so they show inventory value only." badge={`${report.byLocation.length} locations`} />
                        <Table aria-label="By location">
                            <Table.Header>
                                <Table.Head label="Location" isRowHeader />
                                <Table.Head label="Business Unit" />
                                <Table.Head label="Sales" />
                                <Table.Head label="Cost" />
                                <Table.Head label="Margin" />
                                <Table.Head label="Margin %" />
                                <Table.Head label="Units" />
                                <Table.Head label="Inventory at cost" />
                            </Table.Header>
                            <Table.Body items={[...stores, ...warehouses].map((r) => ({ ...r, id: r.location.id }))}>
                                {(row) => {
                                    const store = row.location.type === "store";
                                    const dash = <span className="text-quaternary">—</span>;
                                    return (
                                        <Table.Row id={row.id}>
                                            <Table.Cell>
                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                    <span className="font-medium text-primary">{row.location.name}</span>
                                                    <Badge size="sm" type="modern" color="gray">
                                                        {store ? "Store" : "Warehouse"}
                                                    </Badge>
                                                </div>
                                                <span className="text-xs text-tertiary">{row.location.code}</span>
                                            </Table.Cell>
                                            <Table.Cell className="whitespace-nowrap">{row.businessUnit.name}</Table.Cell>
                                            <Table.Cell className="text-primary tabular-nums">{store ? formatCurrency(row.sales) : dash}</Table.Cell>
                                            <Table.Cell className="tabular-nums">{store ? formatCurrency(row.cost) : dash}</Table.Cell>
                                            <Table.Cell className="text-primary tabular-nums">{store ? formatCurrency(row.margin) : dash}</Table.Cell>
                                            <Table.Cell className="tabular-nums">{store ? pct(row.marginPct) : dash}</Table.Cell>
                                            <Table.Cell className="tabular-nums">{store ? formatNumber(row.units) : dash}</Table.Cell>
                                            <Table.Cell className="tabular-nums">{formatCurrency(row.inventory.costAll)}</Table.Cell>
                                        </Table.Row>
                                    );
                                }}
                            </Table.Body>
                        </Table>
                    </TableCard.Root>

                    {/* Inventory value */}
                    <TableCard.Root size="sm">
                        <TableCard.Header
                            title="Inventory value by Business Unit and location"
                            description="Stock on hand today × variant cost / price. “All states” includes In Transit, Returns and Damaged; only Available is sellable."
                        />
                        <Table aria-label="Inventory value">
                            <Table.Header>
                                <Table.Head label="Business Unit / Location" isRowHeader />
                                <Table.Head label="Units (all states)" />
                                <Table.Head label="Available at cost" />
                                <Table.Head label="All states at cost" />
                                <Table.Head label="Available at retail" />
                                <Table.Head label="All states at retail" />
                            </Table.Header>
                            <Table.Body
                                items={report.byBusinessUnit.flatMap((b) => [
                                    { id: b.businessUnit.id, kind: "bu" as const, name: b.businessUnit.name, unit: b.businessUnit, sub: `${pluralize(b.stores, "store")} · ${pluralize(b.warehouses, "warehouse")}`, inv: b.inventory },
                                    ...report.byLocation
                                        .filter((l) => l.businessUnit.id === b.businessUnit.id)
                                        .map((l) => ({ id: `inv_${l.location.id}`, kind: "loc" as const, name: l.location.name, unit: b.businessUnit, sub: l.location.type === "store" ? "Store" : "Warehouse", inv: l.inventory })),
                                ])}
                            >
                                {(row) => (
                                    <Table.Row id={row.id} className={row.kind === "bu" ? "bg-secondary_subtle" : undefined}>
                                        <Table.Cell>
                                            {row.kind === "bu" ? (
                                                <span className="flex items-center gap-2.5 whitespace-nowrap">
                                                    <BusinessUnitAvatar unit={row.unit} size="sm" />
                                                    <span>
                                                        <span className="block font-semibold text-primary">{row.name}</span>
                                                        <span className="block text-xs text-tertiary">{row.sub}</span>
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="block pl-8 whitespace-nowrap">
                                                    <span className="text-secondary">{row.name}</span>
                                                    <span className="ml-2 text-xs text-tertiary">{row.sub}</span>
                                                </span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="tabular-nums">{formatNumber(row.inv.units)}</Table.Cell>
                                        <Table.Cell className="tabular-nums">{formatCurrency(row.inv.costAvailable)}</Table.Cell>
                                        <Table.Cell className={row.kind === "bu" ? "font-semibold text-primary tabular-nums" : "tabular-nums"}>{formatCurrency(row.inv.costAll)}</Table.Cell>
                                        <Table.Cell className="tabular-nums">{formatCurrency(row.inv.retailAvailable)}</Table.Cell>
                                        <Table.Cell className={row.kind === "bu" ? "font-semibold text-primary tabular-nums" : "tabular-nums"}>{formatCurrency(row.inv.retailAll)}</Table.Cell>
                                    </Table.Row>
                                )}
                            </Table.Body>
                        </Table>
                    </TableCard.Root>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                        {/* Top products */}
                        <TableCard.Root size="sm" className="xl:col-span-2">
                            <TableCard.Header
                                title="Top 10 products"
                                badge={
                                    <Badge size="sm" type="pill-color" color="warning">
                                        Estimate
                                    </Badge>
                                }
                                description="Estimated from each item's average daily sales × days in the period. Product-level sales history comes with the channel sync."
                            />
                            {report.topProducts.length === 0 ? (
                                <Empty title="No product sales yet" />
                            ) : (
                                <Table aria-label="Top products">
                                    <Table.Header>
                                        <Table.Head label="#" />
                                        <Table.Head label="Product" isRowHeader />
                                        <Table.Head label="Business Unit" />
                                        <Table.Head label="Est. units" />
                                        <Table.Head label="Est. sales" />
                                    </Table.Header>
                                    <Table.Body items={report.topProducts.map((p, i) => ({ ...p, id: p.productId, rank: i + 1 }))}>
                                        {(row) => (
                                            <Table.Row id={row.id}>
                                                <Table.Cell className="w-10 tabular-nums">{row.rank}</Table.Cell>
                                                <Table.Cell className="font-medium whitespace-nowrap text-primary">{row.name}</Table.Cell>
                                                <Table.Cell className="whitespace-nowrap">{row.businessUnit.name}</Table.Cell>
                                                <Table.Cell className="whitespace-nowrap tabular-nums">≈ {formatNumber(row.units)}</Table.Cell>
                                                <Table.Cell className="whitespace-nowrap tabular-nums text-primary">≈ {formatCurrency(Math.round(row.sales))}</Table.Cell>
                                            </Table.Row>
                                        )}
                                    </Table.Body>
                                </Table>
                            )}
                        </TableCard.Root>

                        {/* Operations */}
                        <Card title="Operational summary" description={`What happened in ${period.label}`} className="xl:col-span-1">
                            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                <OpsRow icon={CheckDone01} label="Approvals decided" value={report.ops.approvalsDecided} href="/approvals" />
                                <OpsRow icon={ShoppingCart01} label="Purchase orders received" value={report.ops.posReceived} href="/purchasing/orders" />
                                <OpsRow icon={Truck01} label="Store requests shipped" value={report.ops.requestsShipped} href="/replenishment/requests" />
                                <OpsRow
                                    icon={ClipboardCheck}
                                    label="Count variances"
                                    value={report.ops.countVariances}
                                    sub={report.ops.countsWithVariance ? `across ${report.ops.countsWithVariance} count${report.ops.countsWithVariance === 1 ? "" : "s"}` : undefined}
                                    href="/stock/control"
                                />
                            </dl>
                        </Card>
                    </div>
                </>
            )}

            <p className="rounded-xl border border-dashed border-primary px-4 py-3 text-sm text-tertiary">
                Contents and file format are an open item (PRD). This report shows {scopeLabel} only — every company's data is kept separate.
            </p>
        </div>
    );
}

const ShareBar = ({ value }: { value: number }) => (
    <div className="flex min-w-32 items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gray-900" style={{ width: `${Math.min(100, value)}%` }} />
        </div>
        <span className="w-12 text-right text-xs text-tertiary tabular-nums">{value.toFixed(1)}%</span>
    </div>
);

const OpsRow = ({ icon: Icon, label, value, sub, href }: { icon: FC<{ className?: string }>; label: string; value: number; sub?: string; href: string }) => (
    <Link href={href} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-secondary transition hover:bg-primary_hover">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
            <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
            <dt className="text-sm text-tertiary">{label}</dt>
            {sub && <span className="block text-xs text-quaternary">{sub}</span>}
        </span>
        <dd className="text-display-xs font-semibold text-primary tabular-nums">{formatNumber(value)}</dd>
    </Link>
);
