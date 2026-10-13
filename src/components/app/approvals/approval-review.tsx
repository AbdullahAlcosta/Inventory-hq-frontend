"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Field } from "@/components/app/card";
import { EmployeeName, LocationName } from "@/components/app/item-cell";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { Approval } from "@/lib/types";
import { type ApprovalDecision, useAppStore } from "@/store/app-store";
import { approvalTypeMeta } from "./approval-meta";
import { AdjustmentDetail, CountDetail, DuplicateDetail, FieldGrid, MismatchDetail, PartialPoDetail, ReorderDetail, ScopedLink, Section, SyncDetail, UnexpectedDetail } from "./approval-details";

interface ApprovalReviewProps {
    approvalId: string | null;
    onClose: () => void;
    /** Called after a reorder is approved with the created PO ids. */
    onPosCreated?: (poIds: string[]) => void;
}

/** Right-side review panel for one approval, like the check verification slideout. */
export const ApprovalReview = ({ approvalId, onClose, onPosCreated }: ApprovalReviewProps) => {
    const approval = useAppStore((s) => s.approvals.find((a) => a.id === approvalId));
    return (
        <SlideoutMenu isOpen={!!approval} onOpenChange={(open) => !open && onClose()} isDismissable className="z-50 *:max-w-140" dialogClassName="gap-0">
            {approval && <ReviewBody key={approval.id} approval={approval} onClose={onClose} onPosCreated={onPosCreated} />}
        </SlideoutMenu>
    );
};

const ReviewBody = ({ approval, onClose, onPosCreated }: { approval: Approval; onClose: () => void; onPosCreated?: (ids: string[]) => void }) => {
    const decideApproval = useAppStore((s) => s.decideApproval);
    const approveReorders = useAppStore((s) => s.approveReorders);
    const businessUnit = useAppStore((s) => s.businessUnits.find((b) => b.id === approval.businessUnitId));
    const purchaseOrders = useAppStore((s) => s.purchaseOrders);
    const vendors = useAppStore((s) => s.vendors);

    const [note, setNote] = useState("");
    const [quantity, setQuantity] = useState(approval.payload.type === "reorder" ? approval.payload.suggestedQty : 0);
    const [linkTarget, setLinkTarget] = useState<string | null>(null);
    const pending = approval.status === "pending";
    const meta = approvalTypeMeta[approval.type];
    const p = approval.payload;
    const vendorOk = p.type !== "reorder" || vendors.some((v) => v.id === p.vendorId);

    useEffect(() => {
        setNote("");
    }, [approval.id]);

    const decide = (decision: ApprovalDecision, success?: string) => {
        decideApproval(approval.id, decision, note.trim() || undefined);
        const after = useAppStore.getState().approvals.find((a) => a.id === approval.id);
        if (after?.status === "pending") {
            toast.warning("Still needs attention", after.decisionNote);
            return;
        }
        toast.success(success ?? after?.decision ?? "Decision saved", approval.title);
        onClose();
    };

    const approveReorder = () => {
        const ids = approveReorders([{ approvalId: approval.id, quantity }]);
        const po = useAppStore.getState().purchaseOrders.find((x) => x.id === ids[0]);
        if (!po) {
            toast.error("No PO created", "This item needs a default vendor first.");
            return;
        }
        toast.success(`${po.number} created`, "Find it under Purchase Orders. Review and send it to the vendor.");
        onPosCreated?.(ids);
        onClose();
    };

    let detail: ReactNode = null;
    let actions: ReactNode = null;
    switch (p.type) {
        case "reorder":
            detail = <ReorderDetail payload={p} quantity={quantity} onQuantity={setQuantity} editable={pending} />;
            actions = (
                <>
                    <Button color="secondary" size="lg" onPress={() => decide({ action: "dismiss" }, "Suggestion dismissed")}>
                        Dismiss
                    </Button>
                    <Button size="lg" isDisabled={!vendorOk || quantity < 1} onPress={approveReorder}>
                        Approve & create PO
                    </Button>
                </>
            );
            break;
        case "count_variance":
        case "adjustment":
            detail = p.type === "count_variance" ? <CountDetail payload={p} /> : <AdjustmentDetail payload={p} />;
            actions = (
                <>
                    <Button color="secondary-destructive" size="lg" onPress={() => decide({ action: "reject" }, "Rejected — stock unchanged")}>
                        Reject
                    </Button>
                    <Button size="lg" onPress={() => decide({ action: "approve" })}>
                        Approve
                    </Button>
                </>
            );
            break;
        case "unexpected_item":
            detail = <UnexpectedDetail payload={p} linkTarget={linkTarget} onLinkTarget={setLinkTarget} editable={pending} />;
            actions = (
                <>
                    <Button color="secondary" size="lg" isDisabled={!linkTarget} onPress={() => linkTarget && decide({ action: "link_variant", variantId: linkTarget })}>
                        Link to existing item
                    </Button>
                    <Button size="lg" onPress={() => decide({ action: "create_product" })}>
                        Keep as new product
                    </Button>
                </>
            );
            break;
        case "partial_po":
            detail = <PartialPoDetail payload={p} />;
            actions = (
                <>
                    <Button color="secondary" size="lg" onPress={() => decide({ action: "accept_shortage" })}>
                        Accept shortage
                    </Button>
                    <Button size="lg" onPress={() => decide({ action: "backorder" })}>
                        Create backorder PO
                    </Button>
                </>
            );
            break;
        case "mismatch":
            detail = (
                <>
                    <MismatchDetail payload={p} />
                    <p className="-mt-2 text-sm text-tertiary">
                        Already sorted out?{" "}
                        <Button color="link-gray" size="sm" className="font-semibold underline" onPress={() => decide({ action: "approve" }, "Marked handled")}>
                            Mark handled
                        </Button>
                    </p>
                </>
            );
            actions = (
                <>
                    <Button color="secondary" size="lg" onPress={() => decide({ action: "trust_channel" })}>
                        Correct our stock to match channel
                    </Button>
                    <Button size="lg" onPress={() => decide({ action: "keep_ours" })}>
                        Keep our count & re-push
                    </Button>
                </>
            );
            break;
        case "import_duplicate":
            detail = <DuplicateDetail payload={p} />;
            actions = (
                <>
                    <Button color="secondary" size="lg" onPress={() => decide({ action: "new_product" })}>
                        New product
                    </Button>
                    <Button color={p.matchVariantId ? "secondary" : "primary"} size="lg" onPress={() => decide({ action: "new_variant" })}>
                        New variant
                    </Button>
                    {p.matchVariantId && (
                        <Button size="lg" onPress={() => decide({ action: "same_item" })}>
                            Same item
                        </Button>
                    )}
                </>
            );
            break;
        case "sync_failure":
            detail = <SyncDetail approval={approval} payload={p} />;
            actions = (
                <>
                    {p.kind === "blocked" && (
                        <Button color="secondary-destructive" size="lg" onPress={() => decide({ action: "unlist" })}>
                            Don’t sell on this channel
                        </Button>
                    )}
                    <Button size="lg" onPress={() => decide({ action: "retry" })}>
                        Retry
                    </Button>
                </>
            );
            break;
    }

    // A reorder that became a PO: show a link to it.
    const createdPo =
        approval.type === "reorder" && approval.status === "approved" ? purchaseOrders.find((po) => approval.decision?.includes(po.number)) : undefined;

    return (
        <>
            <SlideoutMenu.Header onClose={onClose} className="border-b border-secondary pb-5">
                <div className="flex items-center gap-3 pr-10">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                        <meta.icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm text-tertiary">{meta.label}</p>
                        <h2 className="text-lg font-semibold text-primary">{approval.title}</h2>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={approval.status} />
                    <span className="text-sm text-tertiary">
                        {approval.locationId ? <LocationName id={approval.locationId} /> : businessUnit?.name} · {timeAgo(approval.createdAt)}
                    </span>
                </div>
            </SlideoutMenu.Header>

            <SlideoutMenu.Content className="gap-6 py-6">
                <p className="text-md text-secondary">{approval.summary}</p>
                {detail}

                {!pending && (
                    <Section title="Decision" className="rounded-xl bg-secondary p-4">
                        <FieldGrid>
                            <Field label="Decision">{approval.decision ?? "—"}</Field>
                            <Field label="Decided by">
                                <EmployeeName id={approval.decidedBy} />
                            </Field>
                            <Field label="Decided at">{approval.decidedAt ? formatDateTime(approval.decidedAt) : "—"}</Field>
                            {createdPo && (
                                <Field label="Purchase order">
                                    <ScopedLink area="purchasing" href={`/purchasing/orders/view?id=${createdPo.id}`} className="text-brand-secondary hover:underline">
                                        {createdPo.number}
                                    </ScopedLink>
                                </Field>
                            )}
                            <Field label="Note" className="sm:col-span-2">
                                {approval.decisionNote || <span className="font-normal text-tertiary">No note</span>}
                            </Field>
                        </FieldGrid>
                    </Section>
                )}

                {pending && <TextArea label="Internal note" placeholder="Optional — saved with the decision" rows={3} value={note} onChange={setNote} />}
            </SlideoutMenu.Content>

            <SlideoutMenu.Footer className="sticky bottom-0 bg-primary">
                {pending ? (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div>
                ) : (
                    <div className="flex justify-end">
                        <Button color="secondary" size="lg" onPress={onClose}>
                            Close
                        </Button>
                    </div>
                )}
            </SlideoutMenu.Footer>
        </>
    );
};
