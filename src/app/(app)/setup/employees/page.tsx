"use client";

import { useMemo, useState } from "react";
import { Edit01, Plus, SearchLg, Users01 } from "@untitledui/icons";
import { BusinessUnitAvatar } from "@/components/app/bu-avatar";
import { Card } from "@/components/app/card";
import { Empty } from "@/components/app/empty";
import { FilterPills } from "@/components/app/filter-pills";
import { ModalDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { type EmployeeDraft, EmployeeForm, draftErrors, emptyDraft } from "@/components/app/setup/employee-form";
import { levelLabel, roleInfo } from "@/components/app/setup/role-info";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/app/toast";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { initials } from "@/lib/format";
import type { Employee, Role } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type RoleFilter = "all" | Role;

export default function EmployeesPage() {
    const scope = useRequiredScope();
    const allEmployees = useAppStore((s) => s.employees);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const addEmployee = useAppStore((s) => s.addEmployee);
    const updateEmployee = useAppStore((s) => s.updateEmployee);

    const [role, setRole] = useState<RoleFilter>("all");
    const [query, setQuery] = useState("");
    const [adding, setAdding] = useState(false);
    const [addDraft, setAddDraft] = useState<EmployeeDraft>(emptyDraft);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [editDraft, setEditDraft] = useState<EmployeeDraft>(emptyDraft);

    const companyBus = businessUnits.filter((b) => b.companyId === scope.companyId);
    const companyLocations = locations.filter((l) => companyBus.some((b) => b.id === l.businessUnitId));
    const companyEmployees = allEmployees.filter((e) => e.companyId === scope.companyId);

    // Narrow by the sidebar BU switcher; executives are company-wide so always shown.
    const inScope = companyEmployees.filter(
        (e) => e.role === "executive" || e.businessUnitIds.some((id) => scope.activeBusinessUnitIds.includes(id)) || e.locationIds.some((id) => scope.activeLocationIds.includes(id)),
    );
    const q = query.trim().toLowerCase();
    const searched = inScope.filter((e) => !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
    const rows = searched.filter((e) => role === "all" || e.role === role);
    const counts = useMemo(() => {
        const c = { all: searched.length, executive: 0, manager: 0, associate: 0 };
        searched.forEach((e) => c[e.role]++);
        return c;
    }, [searched]);

    const addErrors = draftErrors(addDraft, allEmployees);
    const editErrors = draftErrors(editDraft, allEmployees.filter((e) => e.id !== editing?.id));
    const valid = (errs: object) => Object.keys(errs).length === 0;

    if (!scope.isExecutive) return <Empty title="Executives only" description="Only executives add and edit employees." />;

    const openEdit = (e: Employee) => {
        setEditing(e);
        setEditDraft({ name: e.name, email: e.email, role: e.role, level: e.level, businessUnitIds: e.businessUnitIds, locationIds: e.locationIds, status: e.status });
    };

    const saveAdd = () => {
        if (!valid(addErrors)) return;
        addEmployee({ ...addDraft, name: addDraft.name.trim(), email: addDraft.email.trim(), status: "invited", companyId: scope.companyId });
        toast.success(`${addDraft.name.trim()} invited`, `${roleInfo[addDraft.role].label} · they can sign in from the login screen.`);
        setAdding(false);
        setAddDraft(emptyDraft());
    };

    const saveEdit = () => {
        if (!editing || !valid(editErrors)) return;
        updateEmployee(editing.id, { ...editDraft, name: editDraft.name.trim(), email: editDraft.email.trim() });
        toast.success("Employee updated", editDraft.name.trim());
        setEditing(null);
    };

    const buName = (id: string) => companyBus.find((b) => b.id === id);
    const locName = (id: string) => companyLocations.find((l) => l.id === id)?.name;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                className="mb-0"
                eyebrow="Setup"
                title="Employees"
                description="A person's access always comes from their assignment (role + Brand + Location)."
                actions={
                    <Button color="primary" size="md" iconLeading={Plus} onPress={() => setAdding(true)}>
                        Add employee
                    </Button>
                }
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <FilterPills<RoleFilter>
                    value={role}
                    onChange={setRole}
                    options={[
                        { id: "all", label: "All", count: counts.all },
                        { id: "executive", label: "Executives", count: counts.executive },
                        { id: "manager", label: "Managers", count: counts.manager },
                        { id: "associate", label: "Associates", count: counts.associate },
                    ]}
                />
                <Input aria-label="Search employees" icon={SearchLg} placeholder="Search name or email" value={query} onChange={setQuery} className="md:w-72" />
            </div>

            {rows.length === 0 ? (
                <Card>
                    <Empty icon={Users01} title="No employees match" description={q ? "Try a different name or email." : "Add your first employee to give them access."} />
                </Card>
            ) : (
                <TableCard.Root>
                    <Table aria-label="Employees">
                        <Table.Header>
                            <Table.Head label="Name" isRowHeader />
                            <Table.Head label="Role" />
                            <Table.Head label="Level" />
                            <Table.Head label="Brands" />
                            <Table.Head label="Locations" />
                            <Table.Head label="Status" />
                            <Table.Head label="" />
                        </Table.Header>
                        <Table.Body items={rows}>
                            {(e) => (
                                <Table.Row id={e.id} onAction={() => openEdit(e)} className="cursor-pointer">
                                    <Table.Cell>
                                        <div className="flex items-center gap-3 whitespace-nowrap">
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">{initials(e.name)}</span>
                                            <div>
                                                <p className="font-medium text-primary">
                                                    {e.name}
                                                    {e.id === scope.user.id && <span className="ml-1.5 text-xs font-normal text-tertiary">(you)</span>}
                                                </p>
                                                <p className="text-sm text-tertiary">{e.email}</p>
                                            </div>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Badge size="sm" type="pill-color" color={roleInfo[e.role].color}>
                                            {roleInfo[e.role].label}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">{levelLabel(e.level)}</Table.Cell>
                                    <Table.Cell>
                                        {e.role === "executive" ? (
                                            <span className="text-tertiary">All</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {e.businessUnitIds.map((id) => {
                                                    const b = buName(id);
                                                    return b ? (
                                                        <span key={id} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-secondary">
                                                            <BusinessUnitAvatar unit={b} size="sm" className="!size-5 text-[10px]" />
                                                            {b.name}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="max-w-64">
                                        {e.role === "executive" ? (
                                            <span className="text-tertiary">All</span>
                                        ) : e.locationIds.length ? (
                                            <span className="line-clamp-2 text-sm text-secondary">{e.locationIds.map(locName).filter(Boolean).join(", ")}</span>
                                        ) : (
                                            <span className="text-tertiary">None</span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge status={e.status} size="sm" />
                                    </Table.Cell>
                                    <Table.Cell className="w-12">
                                        <ButtonUtility size="xs" color="tertiary" icon={Edit01} tooltip="Edit" onPress={() => openEdit(e)} />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                </TableCard.Root>
            )}

            {/* Add */}
            <ModalDialog
                isOpen={adding}
                onOpenChange={(o) => {
                    setAdding(o);
                    if (!o) setAddDraft(emptyDraft());
                }}
                size="lg"
                title="Add employee"
                description="They'll be invited and can sign in from the login screen. Access comes from role + brand + location."
                footer={
                    <>
                        <Button color="secondary" size="lg" onPress={() => setAdding(false)}>
                            Cancel
                        </Button>
                        <Button color="primary" size="lg" isDisabled={!valid(addErrors)} onPress={saveAdd}>
                            Send invite
                        </Button>
                    </>
                }
            >
                <EmployeeForm draft={addDraft} onChange={setAddDraft} businessUnits={companyBus} locations={companyLocations} errors={addErrors} />
            </ModalDialog>

            {/* Edit */}
            <SlideoutMenu isOpen={!!editing} onOpenChange={(o) => !o && setEditing(null)} isDismissable className="z-50" dialogClassName="gap-0">
                {({ close }) =>
                    editing && (
                        <>
                            <SlideoutMenu.Header onClose={close} className="shrink-0 border-b border-secondary pb-5">
                                <div className="flex items-center gap-3 pr-8">
                                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-700">{initials(editing.name)}</span>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-semibold text-primary">{editing.name}</h2>
                                            <StatusBadge status={editing.status} size="sm" />
                                        </div>
                                        <p className="truncate text-sm text-tertiary">{editing.email}</p>
                                    </div>
                                </div>
                            </SlideoutMenu.Header>
                            <SlideoutMenu.Content className="h-auto min-h-0 flex-1 py-6">
                                <EmployeeForm
                                    draft={editDraft}
                                    onChange={setEditDraft}
                                    businessUnits={companyBus}
                                    locations={companyLocations}
                                    errors={editErrors}
                                    showStatus={editing.id !== scope.user.id}
                                    lockRole={editing.id === scope.user.id}
                                />
                            </SlideoutMenu.Content>
                            <SlideoutMenu.Footer className="flex shrink-0 justify-end gap-3">
                                <Button color="secondary" size="lg" onPress={close}>
                                    Cancel
                                </Button>
                                <Button color="primary" size="lg" isDisabled={!valid(editErrors)} onPress={saveEdit}>
                                    Save changes
                                </Button>
                            </SlideoutMenu.Footer>
                        </>
                    )
                }
            </SlideoutMenu>
        </div>
    );
}
