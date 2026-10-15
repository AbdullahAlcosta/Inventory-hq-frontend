"use client";

import { Building02, Building07, CheckCircle, Home03 } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { ChipSelect } from "@/components/app/setup/chip-select";
import { capabilitiesFor, roleInfo } from "@/components/app/setup/role-info";
import { Input } from "@/components/base/input/input";
import type { BusinessUnit, Employee, Location, Role } from "@/lib/types";
import { cx } from "@/utils/cx";

export type EmployeeDraft = Omit<Employee, "id" | "companyId">;

export const emptyDraft = (): EmployeeDraft => ({ name: "", email: "", role: "associate", level: "store", businessUnitIds: [], locationIds: [], status: "invited" });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const draftErrors = (d: EmployeeDraft, others: Employee[]) => {
    const errors: Partial<Record<"name" | "email" | "assignment", string>> = {};
    if (!d.name.trim()) errors.name = "Required";
    if (!EMAIL_RE.test(d.email.trim())) errors.email = "Enter a valid email";
    else if (others.some((e) => e.email.toLowerCase() === d.email.trim().toLowerCase())) errors.email = "This email already belongs to someone";
    if (d.role !== "executive" && (d.businessUnitIds.length === 0 || d.locationIds.length === 0)) errors.assignment = "Pick at least one brand and one location";
    return errors;
};

/** Normalise a draft so level / BUs / locations always agree with the role. */
export const normalizeDraft = (d: EmployeeDraft, locations: Location[]): EmployeeDraft => {
    if (d.role === "executive") return { ...d, level: "company", businessUnitIds: [], locationIds: [] };
    const level = d.level === "company" ? "store" : d.level;
    const locationIds = d.locationIds.filter((id) => {
        const l = locations.find((x) => x.id === id);
        return l && l.type === level && d.businessUnitIds.includes(l.businessUnitId);
    });
    return { ...d, level, locationIds };
};

const RoleCard = ({ role, selected, onSelect }: { role: Role; selected: boolean; onSelect: () => void }) => (
    <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={cx(
            "relative flex flex-col gap-1 rounded-xl p-4 text-left ring-1 outline-hidden ring-inset focus-visible:ring-2 focus-visible:ring-brand",
            selected ? "bg-primary ring-2 ring-gray-900" : "ring-primary hover:bg-primary_hover",
        )}
    >
        <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-primary">{roleInfo[role].label}</span>
            <span className={cx("flex size-4 items-center justify-center rounded-full ring-1 ring-inset", selected ? "bg-gray-900 ring-gray-900" : "ring-primary")}>
                {selected && <span className="size-1.5 rounded-full bg-white" />}
            </span>
        </span>
        <span className="text-xs text-tertiary">{roleInfo[role].description}</span>
    </button>
);

export const EmployeeForm = ({
    draft,
    onChange,
    businessUnits,
    locations,
    errors,
    showStatus,
    lockRole,
}: {
    draft: EmployeeDraft;
    onChange: (d: EmployeeDraft) => void;
    businessUnits: BusinessUnit[];
    locations: Location[];
    errors?: ReturnType<typeof draftErrors>;
    showStatus?: boolean;
    /** Prevent editing your own role (so you can't lock yourself out). */
    lockRole?: boolean;
}) => {
    const set = (patch: Partial<EmployeeDraft>) => onChange(normalizeDraft({ ...draft, ...patch }, locations));
    const isExec = draft.role === "executive";
    const locOptions = locations.filter((l) => !isExec && ((l.type === draft.level && draft.businessUnitIds.includes(l.businessUnitId)) || draft.locationIds.includes(l.id)));
    const chosenLocations = locations.filter((l) => draft.locationIds.includes(l.id));
    const chosenBus = businessUnits.filter((b) => draft.businessUnitIds.includes(b.id));
    const caps = capabilitiesFor(
        draft.role,
        draft.level,
        chosenLocations.map((l) => l.name),
        chosenBus.map((b) => b.name),
    );

    return (
        <div className="@container flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                <Input label="Full name" isRequired placeholder="e.g. Priya Patel" value={draft.name} onChange={(name) => onChange({ ...draft, name })} hint={errors?.name && draft.name ? errors.name : undefined} />
                <Input
                    label="Email"
                    type="email"
                    isRequired
                    placeholder="name@company.com"
                    value={draft.email}
                    onChange={(email) => onChange({ ...draft, email })}
                    isInvalid={!!draft.email && !!errors?.email}
                    hint={draft.email && errors?.email ? errors.email : undefined}
                />
            </div>

            <div>
                <p className="mb-1.5 text-sm font-medium text-secondary">Role</p>
                <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3" role="radiogroup" aria-label="Role">
                    {(["executive", "manager", "associate"] as Role[]).map((r) => (
                        <RoleCard key={r} role={r} selected={draft.role === r} onSelect={() => !lockRole && set({ role: r })} />
                    ))}
                </div>
                {lockRole && <p className="mt-1.5 text-sm text-tertiary">You can't change your own role.</p>}
            </div>

            <div>
                <p className="mb-1.5 text-sm font-medium text-secondary">Level</p>
                {isExec ? (
                    <div className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary">
                        <Building07 className="size-5 text-fg-quaternary" />
                        Company-wide — executives see every brand and location.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Level">
                        {(
                            [
                                { id: "store", label: "Store-level", icon: Home03 },
                                { id: "warehouse", label: "Warehouse-level", icon: Building02 },
                            ] as const
                        ).map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                role="radio"
                                aria-checked={draft.level === o.id}
                                onClick={() => set({ level: o.id })}
                                className={cx(
                                    "flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold whitespace-nowrap text-primary ring-1 outline-hidden ring-inset focus-visible:ring-2 focus-visible:ring-brand",
                                    draft.level === o.id ? "ring-2 ring-gray-900" : "ring-primary hover:bg-primary_hover",
                                )}
                            >
                                <o.icon className="size-5 text-fg-secondary" />
                                {o.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {!isExec && (
                <>
                    <ChipSelect
                        label="Brands"
                        options={businessUnits.map((b) => ({ id: b.id, label: b.name, leading: <BusinessUnitAvatar unit={b} size="sm" className="!size-4 text-[9px]" /> }))}
                        value={draft.businessUnitIds}
                        onChange={(businessUnitIds) => set({ businessUnitIds })}
                        emptyText="Add a brand under Brands & Locations first."
                    />
                    <ChipSelect
                        label={draft.level === "warehouse" ? "Warehouses" : "Stores"}
                        options={locOptions.map((l) => ({ id: l.id, label: l.name, hint: l.code }))}
                        value={draft.locationIds}
                        onChange={(locationIds) => set({ locationIds })}
                        emptyText={draft.businessUnitIds.length ? `No ${draft.level === "warehouse" ? "warehouses" : "stores"} in the chosen brands.` : "Pick a brand first."}
                        hint={errors?.assignment && (draft.businessUnitIds.length > 0 || draft.locationIds.length > 0) ? <span className="text-error-primary">{errors.assignment}</span> : undefined}
                    />
                </>
            )}

            {showStatus && (
                <div>
                    <p className="mb-1.5 text-sm font-medium text-secondary">Status</p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status">
                        {(["active", "invited", "disabled"] as const).map((s) => (
                            <button
                                key={s}
                                type="button"
                                role="radio"
                                aria-checked={draft.status === s}
                                onClick={() => onChange({ ...draft, status: s })}
                                className={cx(
                                    "rounded-full px-4 py-2 text-sm font-semibold capitalize ring-1 outline-hidden ring-inset focus-visible:ring-2 focus-visible:ring-brand",
                                    draft.status === s ? "bg-gray-950 text-white ring-gray-950" : "bg-primary text-secondary ring-primary hover:bg-primary_hover",
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    {draft.status === "disabled" && <p className="mt-1.5 text-sm text-tertiary">Disabled people can't sign in. Their history stays on record.</p>}
                </div>
            )}

            <div className="rounded-xl bg-gray-950 p-4 text-white">
                <p className="text-sm font-semibold">What they can do</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                    {caps.map((c) => (
                        <li key={c} className="flex items-start gap-2 text-sm text-white/80">
                            <CheckCircle className="mt-0.5 size-4 shrink-0 text-orange-400" />
                            {c}
                        </li>
                    ))}
                </ul>
                <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/60">A person's access always comes from their assignment (role + Brand + Location).</p>
            </div>
        </div>
    );
};
