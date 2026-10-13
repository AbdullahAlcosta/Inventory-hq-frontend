"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, CheckDone01, SearchLg, XClose } from "@untitledui/icons";
import type { Selection } from "react-aria-components";
import { ApprovalTypeCell, BulkReorderBar } from "@/components/app/approvals/approval-list-parts";
import { type ApprovalGroup, approvalGroups, inGroup } from "@/components/app/approvals/approval-meta";
import { ApprovalReview } from "@/components/app/approvals/approval-review";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDateTime, pluralize, timeAgo } from "@/lib/format";
import { canDecideApproval } from "@/lib/selectors";
import type { Approval } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

type View = "pending" | "decided";

export default function ApprovalsPage() {
    return (
        <Suspense fallback={null}>
            <ApprovalsView />
        </Suspense>
    );
}

function ApprovalsView() {
    const scope = useRequiredScope();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const approvals = useAppStore((s) => s.approvals);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);

    const initialGroup = approvalGroups.some((g) => g.id === params.get("type")) ? (params.get("type") as ApprovalGroup) : "all";
    const [view, setView] = useState<View>(params.get("view") === "decided" ? "decided" : "pending");
    const [group, setGroup] = useState<ApprovalGroup>(initialGroup);
    const [query, setQuery] = useState("");
    const [openId, setOpenId] = useState<string | null>(params.get("id"));
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [createdPoIds, setCreatedPoIds] = useState<string[]>([]);

    // Only what this user may decide, within the BU picked in the sidebar.
    const mine = useMemo(
        () =>
            approvals.filter(
                (a) =>
                    scope.activeBusinessUnitIds.includes(a.businessUnitId) &&
                    canDecideApproval(scope.user, a, { businessUnitIds: scope.businessUnitIds, locationIds: scope.locationIds }),
            ),
        [approvals, scope],
    );

    const inView = (a: Approval) => (view === "pending" ? a.status === "pending" : a.status !== "pending");
    const pendingCount = mine.filter((a) => a.status === "pending").length;
    const decidedCount = mine.length - pendingCount;
    const viewItems = mine.filter(inView);
    const q = query.trim().toLowerCase();
    const rows = viewItems
        .filter((a) => inGroup(group, a.type))
        .filter((a) => !q || `${a.title} ${a.summary}`.toLowerCase().includes(q))
        .sort((a, b) => (view === "pending" ? b.createdAt.localeCompare(a.createdAt) : (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "")));

    const selectable = view === "pending" ? rows.filter((a) => a.type === "reorder") : [];
    const selectedRows = selectable.filter((a) => selected.has(a.id));
    const disabledKeys = rows.filter((a) => a.type !== "reorder").map((a) => a.id);

    const onSelectionChange = (keys: Selection) => {
        if (keys === "all") setSelected(new Set(selectable.map((a) => a.id)));
        else setSelected(new Set(Array.from(keys).map(String).filter((k) => selectable.some((a) => a.id === k))));
    };

    const setOpen = (id: string | null) => {
        setOpenId(id);
        const next = new URLSearchParams(params.toString());
        if (id) next.set("id", id);
        else next.delete("id");
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    };

    const buName = (id: string) => businessUnits.find((b) => b.id === id)?.name ?? "—";
    const eyebrow = scope.activeBusinessUnitIds.length === 1 ? buName(scope.activeBusinessUnitIds[0]) : "All business units";
    const createdPos = purchaseOrders.filter((po) => createdPoIds.includes(po.id));

    return (
        <div className={cx(selectedRows.length > 0 && "pb-24")}>
            <PageHeader
                eyebrow={eyebrow}
                title="Approvals"
                description="Everything waiting on a decision for your locations. Each decision records who and when."
            />

            {createdPos.length > 0 && scope.canSeePurchasing && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
                    <CheckCircle className="mt-0.5 size-5 shrink-0 text-fg-success-primary" />
                    <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold text-primary">{pluralize(createdPos.length, "purchase order")} created</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-tertiary">
                            {createdPos.map((po) => (
                                <Link key={po.id} href={`/purchasing/orders/view?id=${po.id}`} className="font-semibold text-brand-secondary hover:underline">
                                    View {po.number}
                                </Link>
                            ))}
                            <span>Review them and send to the vendor.</span>
                        </p>
                    </div>
                    <button className="text-fg-quaternary hover:text-fg-secondary" aria-label="Dismiss" onClick={() => setCreatedPoIds([])}>
                        <XClose className="size-4" />
                    </button>
                </div>
            )}

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <FilterPills<View>
                    options={[
                        { id: "pending", label: "Pending", count: pendingCount },
                        { id: "decided", label: "Decided", count: decidedCount },
                    ]}
                    value={view}
                    onChange={(v) => {
                        setView(v);
                        setSelected(new Set());
                    }}
                />
                <Input aria-label="Search approvals" icon={SearchLg} placeholder="Search approvals" value={query} onChange={setQuery} className="lg:max-w-80" />
            </div>

            <div className="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0">
                <div className="flex w-max gap-2 md:w-auto md:flex-wrap">
                    {approvalGroups.map((g) => {
                        const count = viewItems.filter((a) => inGroup(g.id, a.type)).length;
                        const active = group === g.id;
                        return (
                            <button
                                key={g.id}
                                onClick={() => {
                                    setGroup(g.id);
                                    setSelected(new Set());
                                }}
                                className={cx(
                                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ring-1 transition duration-100 ease-linear ring-inset",
                                    active ? "bg-primary text-primary shadow-xs ring-gray-950" : "bg-transparent text-tertiary ring-secondary hover:bg-primary hover:text-secondary",
                                )}
                            >
                                {g.label}
                                <span className={cx("rounded-md px-1.5 text-xs", active ? "bg-gray-950 text-white" : "bg-gray-100 text-tertiary")}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <TableCard.Root size="sm">
                {rows.length === 0 ? (
                    view === "pending" && pendingCount === 0 ? (
                        <Empty icon={CheckDone01} title="You’re all caught up" description="Nothing is waiting on you. New counts, reorder suggestions and exceptions will show up here." />
                    ) : (
                        <Empty title="No approvals match" description="Try another type or clear the search." />
                    )
                ) : view === "pending" ? (
                    <Table
                        aria-label="Pending approvals"
                        selectionMode={selectable.length ? "multiple" : "none"}
                        selectionBehavior="toggle"
                        selectedKeys={selected}
                        onSelectionChange={onSelectionChange}
                        disabledKeys={disabledKeys}
                        disabledBehavior="selection"
                    >
                        <Table.Header>
                            <Table.Head label="Type" isRowHeader />
                            <Table.Head label="Title" />
                            <Table.Head label="Summary" />
                            <Table.Head label="Location" />
                            <Table.Head label="Created" />
                            <Table.Head label="Status" />
                            <Table.Head label="" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(a) => (
                                <Table.Row id={a.id}>
                                    <Table.Cell>
                                        <ApprovalTypeCell type={a.type} />
                                    </Table.Cell>
                                    <Table.Cell className="min-w-44 font-medium text-primary">{a.title}</Table.Cell>
                                    <Table.Cell className="max-w-72 min-w-48">
                                        <span className="line-clamp-2">{a.summary}</span>
                                    </Table.Cell>
                                    <Table.Cell className="min-w-32">{a.locationId ? <LocationName id={a.locationId} /> : buName(a.businessUnitId)}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{timeAgo(a.createdAt)}</Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge status={a.status} size="sm" />
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        <Button size="sm" onPress={() => setOpen(a.id)}>
                                            Review
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                ) : (
                    <Table aria-label="Decided approvals">
                        <Table.Header>
                            <Table.Head label="Type" isRowHeader />
                            <Table.Head label="Title" />
                            <Table.Head label="Location" />
                            <Table.Head label="Decision" />
                            <Table.Head label="Decided by" />
                            <Table.Head label="Decided at" />
                            <Table.Head label="Note" />
                            <Table.Head label="" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(a) => (
                                <Table.Row id={a.id}>
                                    <Table.Cell>
                                        <ApprovalTypeCell type={a.type} />
                                    </Table.Cell>
                                    <Table.Cell className="min-w-44 font-medium text-primary">{a.title}</Table.Cell>
                                    <Table.Cell className="min-w-32">{a.locationId ? <LocationName id={a.locationId} /> : buName(a.businessUnitId)}</Table.Cell>
                                    <Table.Cell className="min-w-48">
                                        <div className="flex flex-col items-start gap-1">
                                            <StatusBadge status={a.status} size="sm" />
                                            <span className="text-xs text-tertiary">{a.decision}</span>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <EmployeeName id={a.decidedBy} />
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{a.decidedAt ? formatDateTime(a.decidedAt) : "—"}</Table.Cell>
                                    <Table.Cell className="max-w-64 min-w-40">
                                        <span className="line-clamp-2">{a.decisionNote || "—"}</span>
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        <Button size="sm" color="secondary" onPress={() => setOpen(a.id)}>
                                            View
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                )}
            </TableCard.Root>

            {view === "pending" && (
                <BulkReorderBar
                    approvals={selectedRows}
                    onClear={() => setSelected(new Set())}
                    onDone={(ids) => {
                        setSelected(new Set());
                        setCreatedPoIds(ids);
                    }}
                />
            )}

            <ApprovalReview approvalId={openId} onClose={() => setOpen(null)} onPosCreated={setCreatedPoIds} />
        </div>
    );
}
