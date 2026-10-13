"use client";

import { Suspense, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle, ChevronDown, ClipboardCheck, Clock, Edit05, Plus, SearchLg, SwitchVertical01 } from "@untitledui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Field } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { EmployeeName, VariantCell } from "@/components/app/item-cell";
import { ModalDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { AdjustmentModal } from "@/components/app/stock/adjustment-modal";
import { StartCountModal } from "@/components/app/stock/start-count-modal";
import { reasonLabels, signedClass, stateLabels } from "@/components/app/stock/stock-utils";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, formatNumber, formatSigned, pluralize } from "@/lib/format";
import { normalize, variantLabel } from "@/lib/selectors";
import type { Adjustment, StockCount } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Filter = "all" | "counts" | "adjustments" | "awaiting" | "approved" | "rejected";
type RowStatus = "in_progress" | "awaiting" | "approved" | "rejected";

type Row =
    | { id: string; kind: "count"; at: string; number: string; by: string; status: RowStatus; rawStatus: string; search: string; count: StockCount }
    | { id: string; kind: "adjustment"; at: string; number: string; by: string; status: RowStatus; rawStatus: string; search: string; adjustment: Adjustment };

export default function StockControlPage() {
    return (
        <Suspense fallback={null}>
            <StockControl />
        </Suspense>
    );
}

const countNet = (c: StockCount) => c.lines.reduce((n, l) => n + (l.countedQty !== null ? l.countedQty - l.systemQty : 0), 0);
/** Change to total on-hand. State moves keep the total the same. */
const adjustmentNet = (a: Adjustment) => (a.fromState && a.toState ? 0 : a.quantity);

function StockControl() {
    const scope = useRequiredScope();
    // The shell (RequireLocation) guarantees a location here.
    const location = scope.activeLocation!;
    const counts = useAppStore((s) => s.counts);
    const adjustments = useAppStore((s) => s.adjustments);
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // ?start=1 opens the start-count modal, ?new=adjustment the adjustment modal (links from Dashboard, Inventory…).
    const [startOpen, setStartOpen] = useState(() => params.get("start") !== null);
    const [adjOpen, setAdjOpen] = useState(() => params.get("new") === "adjustment");
    const [detailId, setDetailId] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");

    const clearParams = () => {
        if (params.get("start") !== null || params.get("new") !== null) router.replace(pathname, { scroll: false });
    };

    const here = useMemo(() => counts.filter((c) => c.locationId === location.id), [counts, location.id]);
    const adjHere = useMemo(() => adjustments.filter((a) => a.locationId === location.id), [adjustments, location.id]);

    const rows = useMemo<Row[]>(() => {
        const countRows: Row[] = here.map((c) => ({
            id: c.id,
            kind: "count",
            at: c.submittedAt ?? c.createdAt,
            number: c.number,
            by: c.createdBy,
            status: c.status === "submitted" ? "awaiting" : c.status,
            rawStatus: c.status,
            search: normalize(`${c.number} ${c.kind === "opening" ? "opening count" : "cycle count"}`),
            count: c,
        }));
        const adjRows: Row[] = adjHere.map((a) => ({
            id: a.id,
            kind: "adjustment",
            at: a.createdAt,
            number: a.number,
            by: a.createdBy,
            status: a.status === "pending" ? "awaiting" : a.status,
            rawStatus: a.status,
            search: normalize(`${a.number} adjustment ${reasonLabels[a.reason] ?? a.reason} ${variantLabel({ products, variants }, a.variantId)} ${a.note}`),
            adjustment: a,
        }));
        return [...countRows, ...adjRows].sort((a, b) => b.at.localeCompare(a.at));
    }, [here, adjHere, products, variants]);

    const searched = useMemo(() => {
        const q = normalize(query);
        return q ? rows.filter((r) => r.search.includes(q)) : rows;
    }, [rows, query]);

    const matches = (r: Row, f: Filter) =>
        f === "all"
            ? true
            : f === "counts"
              ? r.kind === "count"
              : f === "adjustments"
                ? r.kind === "adjustment"
                : f === "awaiting"
                  ? r.status === "awaiting"
                  : r.status === f;
    const visible = searched.filter((r) => matches(r, filter));
    const n = (f: Filter) => searched.filter((r) => matches(r, f)).length;

    // Stats
    const monthStart = useMemo(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    }, []);
    const inProgress = here.filter((c) => c.status === "in_progress");
    const awaiting = here.filter((c) => c.status === "submitted").length + adjHere.filter((a) => a.status === "pending").length;
    const adjThisMonth = adjHere.filter((a) => a.createdAt >= monthStart).length;
    const netApproved =
        here.filter((c) => c.status === "approved" && (c.submittedAt ?? c.createdAt) >= monthStart).reduce((t, c) => t + countNet(c), 0) +
        adjHere.filter((a) => a.status === "approved" && a.createdAt >= monthStart).reduce((t, a) => t + adjustmentNet(a), 0);

    // Opening count notice
    const openingCount = here.find((c) => c.kind === "opening" && (c.status === "in_progress" || c.status === "submitted"));
    const needsOpening = !location.openingCountDone;

    const detail = adjHere.find((a) => a.id === detailId) ?? null;
    const typeLabel = location.type === "store" ? "Store" : "Warehouse";

    const newAction = (
        <Dropdown.Root>
            <Button size="lg" iconLeading={Plus} iconTrailing={ChevronDown}>
                New
            </Button>
            <Dropdown.Popover className="w-64" placement="bottom end">
                <Dropdown.Menu
                    onAction={(key) => {
                        if (key === "count") setStartOpen(true);
                        if (key === "adjustment") setAdjOpen(true);
                    }}
                >
                    <Dropdown.Item id="count" icon={ClipboardCheck}>
                        {needsOpening ? "Start opening count" : "Start a count"}
                    </Dropdown.Item>
                    <Dropdown.Item id="adjustment" icon={Edit05}>
                        New adjustment
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown.Root>
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow={`${location.name} · ${typeLabel}`}
                title="Stock Control"
                description={`Counts and adjustments for ${location.name}. Every change needs approval and is kept as a permanent record.`}
                className="mb-0"
                actions={newAction}
            />

            {needsOpening && (
                <div className="flex flex-col gap-3 rounded-2xl bg-orange-50 px-5 py-4 ring-1 ring-orange-200 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-600" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-semibold text-primary">{location.name} needs an opening count</p>
                            <p className="text-sm text-secondary">
                                {openingCount?.status === "submitted"
                                    ? `Opening count ${openingCount.number} is waiting for approval.`
                                    : openingCount
                                      ? `Opening count ${openingCount.number} is in progress.`
                                      : "Stock numbers here aren’t trusted until the opening count is approved."}
                            </p>
                        </div>
                    </div>
                    {openingCount ? (
                        <Button size="md" color="secondary" href={`/stock/control/count?id=${openingCount.id}`}>
                            {openingCount.status === "submitted" ? "View count" : `Continue ${openingCount.number}`}
                        </Button>
                    ) : (
                        <Button size="md" color="secondary" onPress={() => setStartOpen(true)}>
                            Start opening count
                        </Button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatCard
                    label="Counts in progress"
                    value={formatNumber(inProgress.length)}
                    hint={inProgress.length ? inProgress.map((c) => c.number).join(", ") : "None open"}
                    icon={ClipboardCheck}
                />
                <StatCard
                    label="Awaiting approval"
                    value={formatNumber(awaiting)}
                    hint="Counts and adjustments"
                    icon={Clock}
                    tone={awaiting ? "warning" : "default"}
                />
                <StatCard label="Adjustments this month" value={formatNumber(adjThisMonth)} hint="All statuses" icon={Edit05} />
                <StatCard
                    label="Net units changed"
                    value={<span className={signedClass(netApproved)}>{formatSigned(netApproved)}</span>}
                    hint="Approved this month"
                    icon={SwitchVertical01}
                    tone={netApproved < 0 ? "error" : netApproved > 0 ? "success" : "default"}
                />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <FilterPills<Filter>
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { id: "all", label: "All", count: n("all") },
                        { id: "counts", label: "Counts", count: n("counts") },
                        { id: "adjustments", label: "Adjustments", count: n("adjustments") },
                        { id: "awaiting", label: "Awaiting approval", count: n("awaiting") },
                        { id: "approved", label: "Approved", count: n("approved") },
                        { id: "rejected", label: "Rejected", count: n("rejected") },
                    ]}
                />
                <Input aria-label="Search" placeholder="Search number, item or note" icon={SearchLg} value={query} onChange={setQuery} className="lg:w-72" />
            </div>

            <TableCard.Root size="sm">
                {visible.length === 0 ? (
                    <Empty
                        icon={ClipboardCheck}
                        title={rows.length === 0 ? "Nothing recorded yet" : "Nothing matches"}
                        description={
                            rows.length === 0
                                ? `Start a count or record an adjustment for ${location.name}.`
                                : "Try another filter or search."
                        }
                        action={rows.length === 0 ? newAction : undefined}
                    />
                ) : (
                    <Table
                        aria-label="Stock control history"
                        className="min-w-[960px]"
                        onRowAction={(key) => {
                            const r = rows.find((x) => x.id === key);
                            if (!r) return;
                            if (r.kind === "count") router.push(`/stock/control/count?id=${r.id}`);
                            else setDetailId(r.id);
                        }}
                    >
                        <Table.Header>
                            <Table.Head label="Number" isRowHeader className="pr-3" />
                            <Table.Head label="Type" className="px-3" />
                            <Table.Head label="Item(s)" className="px-3" />
                            <Table.Head label="Change" className="px-3" />
                            <Table.Head label="By" className="px-3" />
                            <Table.Head label="When" className="px-3" />
                            <Table.Head label="Status" className="pl-3" />
                        </Table.Header>
                        <Table.Body items={visible}>
                            {(r) => (
                                <Table.Row id={r.id} className="cursor-pointer">
                                    <Table.Cell className="pr-3 font-semibold whitespace-nowrap text-primary">{r.number}</Table.Cell>
                                    <Table.Cell className="px-3 whitespace-nowrap">
                                        {r.kind === "count" ? (
                                            <Badge type="pill-color" size="sm" color={r.count.kind === "opening" ? "purple" : "blue"}>
                                                {r.count.kind === "opening" ? "Opening count" : "Cycle count"}
                                            </Badge>
                                        ) : (
                                            <Badge type="pill-color" size="sm" color="gray">
                                                Adjustment · {reasonLabels[r.adjustment.reason] ?? r.adjustment.reason}
                                            </Badge>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="max-w-[280px] px-3">
                                        {r.kind === "count" ? (
                                            <span className="text-primary">{pluralize(r.count.lines.length, "item")}</span>
                                        ) : (
                                            <VariantCell variantId={r.adjustment.variantId} link={false} />
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="px-3 whitespace-nowrap">
                                        {r.kind === "count" ? <CountChange count={r.count} /> : <AdjustmentChange adjustment={r.adjustment} />}
                                    </Table.Cell>
                                    <Table.Cell className="px-3 whitespace-nowrap">
                                        <EmployeeName id={r.by} />
                                    </Table.Cell>
                                    <Table.Cell className="px-3 whitespace-nowrap">{formatDateTime(r.at)}</Table.Cell>
                                    <Table.Cell className="pl-3">
                                        <StatusBadge status={r.rawStatus} size="sm" />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            <StartCountModal
                isOpen={startOpen}
                locationId={location.id}
                onOpenChange={(o) => {
                    setStartOpen(o);
                    if (!o) clearParams();
                }}
            />
            <AdjustmentModal
                isOpen={adjOpen}
                locationId={location.id}
                onOpenChange={(o) => {
                    setAdjOpen(o);
                    if (!o) clearParams();
                }}
                onCreated={() => setFilter("all")}
            />
            <AdjustmentDetail adjustment={detail} onClose={() => setDetailId(null)} />
        </div>
    );
}

const CountChange = ({ count }: { count: StockCount }) => {
    const counted = count.lines.filter((l) => l.countedQty !== null).length;
    if (count.status === "in_progress") {
        return (
            <span className="text-tertiary">
                {formatNumber(counted)} / {formatNumber(count.lines.length)} counted
            </span>
        );
    }
    const net = countNet(count);
    const variances = count.lines.filter((l) => l.countedQty !== null && l.countedQty !== l.systemQty).length;
    return (
        <span>
            <span className={`font-semibold ${signedClass(net)}`}>{net === 0 && !variances ? "Match" : formatSigned(net)}</span>
            {variances > 0 && <span className="ml-1.5 text-tertiary">· {pluralize(variances, "variance")}</span>}
        </span>
    );
};

const AdjustmentChange = ({ adjustment: a }: { adjustment: Adjustment }) =>
    a.fromState && a.toState ? (
        <span className="inline-flex items-center gap-1.5 text-primary">
            {stateLabels[a.fromState]}
            <ArrowRight className="size-3.5 text-fg-quaternary" aria-hidden="true" />
            {stateLabels[a.toState]}
            <span className="font-semibold">×{formatNumber(Math.abs(a.quantity))}</span>
        </span>
    ) : (
        <span className={`font-semibold ${signedClass(a.quantity)}`}>{formatSigned(a.quantity)} Available</span>
    );

const AdjustmentDetail = ({ adjustment: a, onClose }: { adjustment: Adjustment | null; onClose: () => void }) => {
    const approvals = useAppStore((s) => s.approvals);
    if (!a) return null;
    const approval = approvals.find((x) => x.payload.type === "adjustment" && x.payload.adjustmentId === a.id);
    return (
        <ModalDialog
            isOpen
            onOpenChange={(o) => !o && onClose()}
            title={
                <span className="flex flex-wrap items-center gap-3">
                    Adjustment {a.number}
                    <StatusBadge status={a.status} size="sm" />
                </span>
            }
            description="Adjustments are permanent records. To undo one, record a new adjustment."
            size="md"
            footer={
                <Button size="lg" color="secondary" onPress={onClose}>
                    Close
                </Button>
            }
        >
            <div className="flex flex-col gap-5">
                <div className="rounded-xl p-3 ring-1 ring-secondary">
                    <VariantCell variantId={a.variantId} />
                </div>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Reason">{reasonLabels[a.reason] ?? a.reason}</Field>
                    <Field label="Change">
                        <AdjustmentChange adjustment={a} />
                    </Field>
                    <Field label="Created by">
                        <EmployeeName id={a.createdBy} />
                    </Field>
                    <Field label="Created">{formatDateTime(a.createdAt)}</Field>
                    <Field label="Decision">
                        {approval?.decidedBy ? (
                            <span className="inline-flex items-center gap-1.5">
                                <CheckCircle className="size-4 text-fg-quaternary" aria-hidden="true" />
                                <EmployeeName id={approval.decidedBy} /> · {formatDateTime(approval.decidedAt!)}
                            </span>
                        ) : a.status === "pending" ? (
                            "Waiting for a manager"
                        ) : (
                            "—"
                        )}
                    </Field>
                    {approval?.decisionNote && <Field label="Decision note">{approval.decisionNote}</Field>}
                </dl>
                <div>
                    <p className="mb-1.5 text-sm font-medium text-secondary">Note</p>
                    <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-primary">{a.note || "—"}</p>
                </div>
            </div>
        </ModalDialog>
    );
};
