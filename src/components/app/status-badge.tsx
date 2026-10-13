import { BadgeWithDot } from "@/components/base/badges/badges";

type Color = "gray" | "brand" | "error" | "warning" | "success" | "blue" | "indigo" | "purple" | "orange";

const map: Record<string, { label: string; color: Color }> = {
    // Purchase orders (PRD §9.1)
    created: { label: "Created", color: "gray" },
    sent: { label: "Sent to Vendor", color: "blue" },
    receiving: { label: "Receiving", color: "indigo" },
    partial: { label: "Partial", color: "warning" },
    complete: { label: "Complete", color: "success" },
    resolved: { label: "Resolved", color: "success" },
    // Store requests (PRD §9.2)
    requested: { label: "Requested", color: "gray" },
    picked: { label: "Picked", color: "blue" },
    packed: { label: "Packed", color: "indigo" },
    shipped: { label: "Shipped · In Transit", color: "purple" },
    confirmed: { label: "Confirmed", color: "success" },
    // Approvals
    pending: { label: "Pending", color: "orange" },
    approved: { label: "Approved", color: "success" },
    rejected: { label: "Rejected", color: "error" },
    dismissed: { label: "Dismissed", color: "gray" },
    // Counts
    in_progress: { label: "In Progress", color: "blue" },
    submitted: { label: "Awaiting Approval", color: "orange" },
    // Channels
    connected: { label: "Connected", color: "success" },
    error: { label: "Error", color: "error" },
    disconnected: { label: "Disconnected", color: "gray" },
    synced: { label: "Synced", color: "success" },
    blocked: { label: "Blocked", color: "error" },
    failed: { label: "Failed", color: "error" },
    not_listed: { label: "Not listed", color: "gray" },
    open: { label: "Open", color: "orange" },
    handled: { label: "Handled", color: "success" },
    // People & catalog
    active: { label: "Active", color: "success" },
    invited: { label: "Invited", color: "blue" },
    disabled: { label: "Disabled", color: "gray" },
    draft: { label: "Draft", color: "warning" },
    archived: { label: "Archived", color: "gray" },
};

export const statusLabel = (status: string) => map[status]?.label ?? status;

export const StatusBadge = ({ status, label, size = "md" }: { status: string; label?: string; size?: "sm" | "md" | "lg" }) => {
    const entry = map[status] ?? { label: status, color: "gray" as Color };
    return (
        <BadgeWithDot type="pill-color" color={entry.color} size={size}>
            {label ?? entry.label}
        </BadgeWithDot>
    );
};
