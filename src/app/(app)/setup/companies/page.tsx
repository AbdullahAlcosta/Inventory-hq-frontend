"use client";

import { useState } from "react";
import { Building07, InfoCircle, Plus } from "@untitledui/icons";
import { Card } from "@/components/app/card";
import { ModalDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useRequiredScope } from "@/hooks/use-session";
import { formatDate, formatNumber, pluralize } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

const SEPARATION = "Each company is fully separate: its own brands, stores, products and users. The new executive can sign in from the login screen.";

export default function CompaniesPage() {
    const scope = useRequiredScope();
    const companies = useAppStore((s) => s.companies);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const locations = useAppStore((s) => s.locations);
    const employees = useAppStore((s) => s.employees);
    const addCompany = useAppStore((s) => s.addCompany);

    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [execName, setExecName] = useState("");
    const [execEmail, setExecEmail] = useState("");

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(execEmail.trim());
    const emailTaken = employees.some((e) => e.email.toLowerCase() === execEmail.trim().toLowerCase());
    const nameTaken = companies.some((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    const ready = name.trim() && execName.trim() && emailOk && !emailTaken && !nameTaken;

    const rows = companies.map((c) => {
        const buIds = businessUnits.filter((b) => b.companyId === c.id).map((b) => b.id);
        return {
            ...c,
            bus: buIds.length,
            stores: locations.filter((l) => buIds.includes(l.businessUnitId) && l.type === "store").length,
            warehouses: locations.filter((l) => buIds.includes(l.businessUnitId) && l.type === "warehouse").length,
            people: employees.filter((e) => e.companyId === c.id).length,
            executive: employees.find((e) => e.companyId === c.id && e.role === "executive"),
        };
    });

    const reset = () => {
        setName("");
        setExecName("");
        setExecEmail("");
    };

    const save = () => {
        if (!ready) return;
        addCompany({ name: name.trim(), executiveName: execName.trim(), executiveEmail: execEmail.trim() });
        toast.success("Company created", `${execName.trim()} was invited as Executive.`);
        reset();
        setOpen(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                className="mb-0"
                eyebrow="Setup"
                backHref="/setup/locations"
                backLabel="Locations"
                title="Companies"
                description="Admin view of every company on Inventory HQ."
                actions={
                    scope.isExecutive && (
                        <Button color="primary" size="md" iconLeading={Plus} onPress={() => setOpen(true)}>
                            Add company
                        </Button>
                    )
                }
            />

            <div className="flex items-start gap-3 rounded-xl bg-primary px-4 py-3 text-sm text-secondary ring-1 ring-secondary">
                <InfoCircle className="mt-0.5 size-5 shrink-0 text-fg-quaternary" />
                <p>{SEPARATION}</p>
            </div>

            <TableCard.Root>
                <TableCard.Header title="All companies" badge={`${companies.length}`} />
                <Table aria-label="Companies">
                    <Table.Header>
                        <Table.Head label="Company" isRowHeader />
                        <Table.Head label="Created" />
                        <Table.Head label="Business units" />
                        <Table.Head label="Locations" />
                        <Table.Head label="Employees" />
                    </Table.Header>
                    <Table.Body items={rows}>
                        {(row) => (
                            <Table.Row id={row.id}>
                                <Table.Cell>
                                    <div className="flex items-center gap-3 whitespace-nowrap">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white">
                                            <Building07 className="size-5" />
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-primary">{row.name}</span>
                                                {row.id === scope.companyId && (
                                                    <Badge size="sm" type="pill-color" color="orange">
                                                        Your company
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-sm text-tertiary">{row.executive ? `Executive: ${row.executive.name}` : "No executive"}</span>
                                        </div>
                                    </div>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{formatDate(row.createdAt)}</Table.Cell>
                                <Table.Cell className="tabular-nums">{formatNumber(row.bus)}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap tabular-nums">
                                    {row.stores + row.warehouses}
                                    <span className="ml-1 text-xs text-tertiary">
                                        ({pluralize(row.stores, "store")} · {pluralize(row.warehouses, "warehouse")})
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="tabular-nums">{formatNumber(row.people)}</Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </TableCard.Root>

            <ModalDialog
                isOpen={open}
                onOpenChange={(o) => {
                    if (!o) reset();
                    setOpen(o);
                }}
                title="Add company"
                description={SEPARATION}
                footer={
                    <>
                        <Button color="secondary" size="lg" onPress={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button color="primary" size="lg" isDisabled={!ready} onPress={save}>
                            Create company
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-5">
                    <Input
                        label="Company name"
                        isRequired
                        placeholder="e.g. Bayline Retail Co."
                        value={name}
                        onChange={setName}
                        isInvalid={nameTaken}
                        hint={nameTaken ? "A company with this name already exists" : undefined}
                        autoFocus
                    />
                    <Card className="bg-secondary_subtle shadow-none" bodyClassName="flex flex-col gap-4 !px-4 !py-4">
                        <p className="text-sm font-semibold text-primary">First Executive</p>
                        <Input label="Full name" isRequired placeholder="e.g. Lena Park" value={execName} onChange={setExecName} />
                        <Input
                            label="Email"
                            type="email"
                            isRequired
                            placeholder="name@company.com"
                            value={execEmail}
                            onChange={setExecEmail}
                            isInvalid={!!execEmail && (!emailOk || emailTaken)}
                            hint={execEmail && !emailOk ? "Enter a valid email" : emailTaken ? "This email already belongs to someone" : "They'll be invited and can add the rest of the team."}
                        />
                    </Card>
                </div>
            </ModalDialog>
        </div>
    );
}
