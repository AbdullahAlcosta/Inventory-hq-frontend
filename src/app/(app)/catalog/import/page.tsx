"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Download01, File06, Lock01, PackagePlus, Upload01, XClose } from "@untitledui/icons";
import type { Key } from "react-aria-components";
import { Card } from "@/components/app/card";
import { downloadText, rowsFromCsv, rowsToCsv } from "@/components/app/catalog/catalog-utils";
import { NamingGuide } from "@/components/app/catalog/naming-guide";
import { Empty } from "@/components/app/empty";
import { ConfirmDialog } from "@/components/app/modal-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { toast } from "@/components/app/toast";
import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { useRequiredScope } from "@/hooks/use-session";
import { formatCurrency } from "@/lib/format";
import { findDuplicates } from "@/lib/selectors";
import type { ImportRow, Product, Variant } from "@/lib/types";
import { type ImportSummary, useAppStore } from "@/store/app-store";

type Outcome = "new_product" | "grouped" | "new_variant" | "duplicate" | "file_duplicate" | "skipped";

interface PreviewRow {
    id: string;
    index: number;
    row: ImportRow;
    outcome: Outcome;
    match?: { product: Product; variant: Variant | null };
    note: string;
}

const outcomeMeta: Record<Outcome, { label: string; color: "success" | "blue" | "orange" | "error" | "gray"; approvals: boolean }> = {
    new_product: { label: "New product", color: "success", approvals: false },
    grouped: { label: "New product · variant", color: "success", approvals: false },
    new_variant: { label: "New variant of", color: "blue", approvals: true },
    duplicate: { label: "Likely duplicate of", color: "orange", approvals: true },
    file_duplicate: { label: "Repeated in file", color: "gray", approvals: false },
    skipped: { label: "Skipped", color: "gray", approvals: false },
};

const templateRows: ImportRow[] = [
    { brand: "Geek Bar", productLine: "Pulse X", productType: "Disposable Vape", variant: "Blue Razz Ice", sku: "GEEBAR-PULX-BLURAZ", upc: "850012345678", price: 24.99, cost: 11.5 },
];

export default function ImportPage() {
    const scope = useRequiredScope();
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const importProducts = useAppStore((s) => s.importProducts);

    const activeBus = businessUnits.filter((b) => scope.activeBusinessUnitIds.includes(b.id));
    const [buId, setBuId] = useState(activeBus[0]?.id ?? "");
    const [text, setText] = useState("");
    const [fileName, setFileName] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [result, setResult] = useState<(ImportSummary & { fileName: string; buName: string }) | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const parsed = useMemo(() => rowsFromCsv(text), [text]);

    /** Mirrors importProducts(): rows are checked in order, against the catalog before this import. */
    const preview = useMemo<PreviewRow[]>(() => {
        const created: { brand: string; productLine: string; index: number }[] = [];
        const seenCodes = new Map<string, number>();
        return parsed.rows.map((row, i) => {
            const base = { id: `r${i}`, index: i + 1, row };
            if (!row.brand || !row.productLine) return { ...base, outcome: "skipped" as const, note: "Missing brand or product line." };
            const codes = [row.upc && `u:${row.upc}`, row.sku && `s:${row.sku.toLowerCase()}`].filter(Boolean) as string[];
            const repeat = codes.map((c) => seenCodes.get(c)).find((n) => n !== undefined);
            if (repeat !== undefined) return { ...base, outcome: "file_duplicate" as const, note: `Same SKU or UPC as row ${repeat}. Not imported.` };
            codes.forEach((c) => seenCodes.set(c, i + 1));

            const dupes = findDuplicates({ products, variants }, { businessUnitId: buId, brand: row.brand, productLine: row.productLine, variant: row.variant, sku: row.sku, upc: row.upc });
            if (dupes.length) {
                const d = dupes[0];
                return { ...base, outcome: d.kind === "same_product" ? ("new_variant" as const) : ("duplicate" as const), match: { product: d.product, variant: d.variant }, note: d.reason };
            }
            const group = created.find((c) => c.brand === row.brand && c.productLine === row.productLine);
            if (group) return { ...base, outcome: "grouped" as const, note: `Added as a variant of the new product from row ${group.index}.` };
            created.push({ brand: row.brand, productLine: row.productLine, index: i + 1 });
            return { ...base, outcome: "new_product" as const, note: `Creates “${row.brand} ${row.productLine}”.` };
        });
    }, [parsed.rows, products, variants, buId]);

    const count = (o: Outcome[]) => preview.filter((r) => o.includes(r.outcome)).length;
    const toCreate = count(["new_product", "grouped"]);
    const toApprovals = count(["new_variant", "duplicate"]);
    const notImported = count(["skipped", "file_duplicate"]);
    const bu = businessUnits.find((b) => b.id === buId);

    const loadFile = async (file: File) => {
        const content = await file.text();
        setText(content);
        setFileName(file.name);
        setResult(null);
    };

    const loadSample = () => {
        if (activeBus.some((b) => b.id === "bu_smoke")) setBuId("bu_smoke");
        const geek = products.find((p) => p.brand === "Geek Bar" && p.productLine === "Pulse X");
        const blueRazz = variants.find((v) => v.productId === geek?.id && v.name === "Blue Razz Ice");
        const rows: ImportRow[] = [
            {
                brand: "Geek Bar",
                productLine: "Pulse X",
                productType: "Disposable Vape",
                variant: "Blue Razz Ice",
                sku: blueRazz?.sku ?? "GEEBAR-PULX-BLURAZ",
                upc: blueRazz?.barcodes.find((b) => b.unit === "selling")?.code ?? "850012345678",
                price: 24.99,
                cost: 11.5,
            },
            { brand: "Elf Bar", productLine: "BC5000", productType: "Disposable Vape", variant: "Strawberry Kiwi", sku: "QV-10422", upc: "840112093315", price: 19.99, cost: 8.75 },
            { brand: "RAW", productLine: "Classic Rolling Papers", productType: "Rolling Papers", variant: "1 1/4", sku: "QV-10587", upc: "716165177357", price: 2.49, cost: 0.85 },
            { brand: "Geek Bar", productLine: "Pulse X", productType: "Disposable Vape", variant: "Strawberry Banana", sku: "QV-10431", upc: "840112093469", price: 24.99, cost: 11.5 },
            { brand: "Lost Mary", productLine: "MO5000", productType: "Disposable Vape", variant: "Blue Razz Ice", sku: "QV-11002", upc: "840239104421", price: 21.99, cost: 9.4 },
            { brand: "Lost Mary", productLine: "MO5000", productType: "Disposable Vape", variant: "Watermelon Ice", sku: "QV-11003", upc: "840239104438", price: 21.99, cost: 9.4 },
            { brand: "RAW", productLine: "Classic Cones King Size", productType: "Cones", variant: "3 Pack", sku: "QV-10612", upc: "716165200413", price: 3.99, cost: 1.45 },
            { brand: "Backwoods", productLine: "Cigars 5 Pack", productType: "Cigars", variant: "Dark Stout", sku: "QV-10790", upc: "070137512904", price: 11.99, cost: 6.4 },
        ];
        setText(rowsToCsv(rows));
        setFileName("quickvee-alcosta-export.csv");
        setResult(null);
    };

    const runImport = () => {
        const rows = preview.filter((r) => r.outcome !== "file_duplicate").map((r) => r.row);
        const name = fileName ?? "pasted.csv";
        const summary = importProducts(buId, rows, name);
        setResult({ ...summary, fileName: name, buName: bu?.name ?? "" });
        toast.success("Import finished", `${summary.created} created · ${summary.sentToApprovals} sent to Approvals`);
        setText("");
        setFileName(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const clear = () => {
        setText("");
        setFileName(null);
    };

    if (!scope.canManage) {
        return (
            <>
                <PageHeader eyebrow="Catalog" title="Bulk import" />
                <Card>
                    <Empty icon={Lock01} title="Managers import products" description="Ask your manager to run a bulk import." />
                </Card>
            </>
        );
    }

    return (
        <>
            <PageHeader
                eyebrow={bu?.name ?? "Catalog"}
                title="Bulk import"
                description="Bring in products from a POS export or spreadsheet. Every row is checked for duplicates before anything is created."
                actions={
                    <Button color="secondary" size="md" iconLeading={Download01} onPress={() => downloadText("inventory-hq-import-template.csv", rowsToCsv(templateRows))}>
                        Download template
                    </Button>
                }
            />

            {result && (
                <div className="mb-6 rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-secondary text-fg-success-primary">
                                <CheckCircle className="size-6" />
                            </span>
                            <div>
                                <p className="text-lg font-semibold text-primary">Import complete</p>
                                <p className="text-sm text-tertiary">
                                    {result.fileName} into {result.buName}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge type="pill-color" color="success" size="md">
                                        {result.created} created
                                    </Badge>
                                    <Badge type="pill-color" color="orange" size="md">
                                        {result.sentToApprovals} sent to Approvals
                                    </Badge>
                                    {result.skipped > 0 && (
                                        <Badge type="pill-color" color="gray" size="md">
                                            {result.skipped} skipped
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button color="secondary" size="md" href="/catalog/products">
                                View products
                            </Button>
                            {result.sentToApprovals > 0 && (
                                <Button color="primary" size="md" href="/approvals">
                                    Review in Approvals
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Card
                        title="1. Choose a file"
                        description="Columns: brand, product_line, product_type, variant, sku, upc, price, cost."
                        actions={
                            <Button color="link-color" size="md" onPress={loadSample}>
                                Use sample Quickvee export
                            </Button>
                        }
                    >
                        <div className="flex flex-col gap-5">
                            {activeBus.length > 1 && (
                                <Select
                                    label="Import into business unit"
                                    items={activeBus.map((b) => ({ id: b.id, label: b.name }))}
                                    selectedKey={buId}
                                    onSelectionChange={(k: Key | null) => setBuId(String(k))}
                                    className="sm:max-w-sm"
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>
                            )}
                            <div
                                className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary bg-secondary px-6 py-8 text-center"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const f = e.dataTransfer.files?.[0];
                                    if (f) loadFile(f);
                                }}
                            >
                                <span className="flex size-10 items-center justify-center rounded-lg bg-primary shadow-xs ring-1 ring-secondary">
                                    <Upload01 className="size-5 text-fg-secondary" />
                                </span>
                                {fileName ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <File06 className="size-4 text-fg-quaternary" />
                                        <span className="font-semibold text-primary">{fileName}</span>
                                        <span className="text-tertiary">· {parsed.rows.length} rows</span>
                                        <button type="button" aria-label="Remove file" onClick={clear} className="cursor-pointer text-fg-quaternary hover:text-fg-secondary">
                                            <XClose className="size-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-tertiary">
                                        <span className="font-semibold text-primary">Drop a CSV here</span> or choose a file. Excel? Save as CSV first.
                                    </p>
                                )}
                                <Button color="secondary" size="sm" onPress={() => fileRef.current?.click()}>
                                    Choose CSV file
                                </Button>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) loadFile(f);
                                        e.target.value = "";
                                    }}
                                />
                            </div>
                            <TextArea
                                label="Or paste CSV"
                                placeholder={"brand,product_line,product_type,variant,sku,upc,price,cost\nGeek Bar,Pulse X,Disposable Vape,Blue Razz Ice,GB-PX-BRI,850012345678,24.99,11.50"}
                                rows={5}
                                value={text}
                                onChange={(v) => {
                                    setText(v);
                                    if (!v) setFileName(null);
                                    setResult(null);
                                }}
                                textAreaClassName="font-mono text-sm"
                            />
                            {parsed.error && (
                                <p className="flex items-center gap-2 text-sm text-error-primary">
                                    <AlertTriangle className="size-4" /> {parsed.error}
                                </p>
                            )}
                        </div>
                    </Card>

                    {preview.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                                <StatCard label="Rows" value={preview.length} hint={fileName ?? "Pasted"} />
                                <StatCard label="Will be created" value={toCreate} hint="New products" tone="success" icon={PackagePlus} />
                                <StatCard label="To Approvals" value={toApprovals} hint="Possible duplicates" tone={toApprovals ? "warning" : "default"} icon={AlertTriangle} />
                                <StatCard label="Not imported" value={notImported} hint="Missing or repeated" />
                            </div>

                            <TableCard.Root size="sm" className="rounded-2xl">
                                <TableCard.Header
                                    title="2. Review"
                                    description="Each row is checked against the catalog. Likely duplicates are never merged automatically."
                                    contentTrailing={
                                        <Button color="primary" size="md" isDisabled={!toCreate && !toApprovals} onPress={() => setConfirmOpen(true)}>
                                            Import {toCreate + toApprovals} rows
                                        </Button>
                                    }
                                />
                                <Table aria-label="Import preview" size="sm">
                                    <Table.Header>
                                        <Table.Head label="#" />
                                        <Table.Head label="Item" isRowHeader />
                                        <Table.Head label="SKU / UPC" />
                                        <Table.Head label="Price" />
                                        <Table.Head label="Result" />
                                    </Table.Header>
                                    <Table.Body items={preview}>
                                        {(r) => {
                                            const meta = outcomeMeta[r.outcome];
                                            return (
                                                <Table.Row id={r.id}>
                                                    <Table.Cell className="tabular-nums">{r.index}</Table.Cell>
                                                    <Table.Cell>
                                                        <p className="min-w-48 text-sm font-semibold text-primary">
                                                            {[r.row.brand, r.row.productLine].filter(Boolean).join(" ") || <span className="text-quaternary">—</span>}{" "}
                                                            <span className="font-normal text-tertiary">{r.row.variant}</span>
                                                        </p>
                                                        <p className="text-xs text-tertiary">{r.row.productType || "No type"}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p className="font-mono text-xs whitespace-nowrap text-secondary">{r.row.sku || "—"}</p>
                                                        <p className="font-mono text-xs whitespace-nowrap">{r.row.upc || "—"}</p>
                                                    </Table.Cell>
                                                    <Table.Cell className="whitespace-nowrap tabular-nums">
                                                        {formatCurrency(r.row.price)}
                                                        <span className="block text-xs text-quaternary">cost {formatCurrency(r.row.cost)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className="flex min-w-64 flex-col items-start gap-1">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <Badge type="pill-color" size="sm" color={meta.color}>
                                                                    {meta.label}
                                                                    {r.match && <> {r.match.product.name}</>}
                                                                </Badge>
                                                                {meta.approvals && (
                                                                    <Badge type="pill-color" size="sm" color="gray">
                                                                        → Approvals
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-tertiary">
                                                                {r.match ? (
                                                                    <>
                                                                        <Link href={`/catalog/products/view?id=${r.match.product.id}`} className="font-medium text-secondary hover:underline">
                                                                            {r.match.product.name}
                                                                            {r.match.variant && ` — ${r.match.variant.name}`}
                                                                        </Link>
                                                                        {" · "}
                                                                        {r.note}
                                                                    </>
                                                                ) : (
                                                                    r.note
                                                                )}
                                                            </p>
                                                        </div>
                                                    </Table.Cell>
                                                </Table.Row>
                                            );
                                        }}
                                    </Table.Body>
                                </Table>
                            </TableCard.Root>
                        </>
                    )}
                </div>

                <aside className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 2xl:sticky 2xl:top-24 2xl:grid-cols-1 2xl:self-start">
                    <Card title="How duplicates are handled">
                        <ul className="flex flex-col gap-4 text-sm">
                            <Explain color="success" title="New product">
                                Brand + product line isn't in the catalog. Created right away; more rows of the same product become its variants.
                            </Explain>
                            <Explain color="blue" title="New variant of an existing product">
                                Same brand and line, new flavor/color/size. Sent to Approvals so a manager confirms it's really new.
                            </Explain>
                            <Explain color="orange" title="Likely duplicate">
                                Same UPC, SKU or a very similar variant already exists. Never merged automatically — a manager decides in Approvals: same item, new variant or new product.
                            </Explain>
                        </ul>
                    </Card>
                    <Card title="New product or variant?">
                        <NamingGuide compact />
                    </Card>
                </aside>
            </div>

            <ConfirmDialog
                isOpen={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={`Import ${toCreate + toApprovals} rows into ${bu?.name}?`}
                description={`${toCreate} will be created now. ${toApprovals} possible duplicate${toApprovals === 1 ? "" : "s"} will go to Approvals for review.${notImported ? ` ${notImported} row${notImported === 1 ? "" : "s"} won't be imported.` : ""}`}
                confirmLabel="Import"
                typeToConfirm="IMPORT"
                onConfirm={runImport}
            />
        </>
    );
}

const Explain = ({ color, title, children }: { color: "success" | "blue" | "orange"; title: string; children: React.ReactNode }) => (
    <li className="flex flex-col gap-1">
        <span>
            <Badge type="pill-color" size="sm" color={color}>
                {title}
            </Badge>
        </span>
        <span className="text-tertiary">{children}</span>
    </li>
);
