"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Lock01, Plus, Trash01 } from "@untitledui/icons";
import type { Key } from "react-aria-components";
import { Card } from "@/components/app/card";
import { type VariantDraft, emptyVariantDraft, productName, suggestSku, variantFromDraft } from "@/components/app/catalog/catalog-utils";
import { DuplicateList } from "@/components/app/catalog/duplicate-list";
import { NamingGuide } from "@/components/app/catalog/naming-guide";
import { AttributeFields, ComplianceFields, IdentityFields, type ProductDraft, UomFields, emptyProductDraft, productFromDraft } from "@/components/app/catalog/product-fields";
import { checkVariantDraft } from "@/components/app/catalog/use-duplicate-check";
import { VariantFields } from "@/components/app/catalog/variant-fields";
import { Empty } from "@/components/app/empty";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Select } from "@/components/base/select/select";
import { useRequiredScope } from "@/hooks/use-session";
import { type DuplicateMatch, findDuplicates, normalize } from "@/lib/selectors";
import type { Product } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

const Step = ({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) => (
    <Card
        title={
            <span className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-gray-950 text-sm font-semibold text-white">{n}</span>
                {title}
            </span>
        }
        description={description}
    >
        {children}
    </Card>
);

export default function NewProductPage() {
    const scope = useRequiredScope();
    const router = useRouter();
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    const businessUnits = useAppStore((s) => s.businessUnits);
    const allVendors = useAppStore((s) => s.vendors);
    const createProduct = useAppStore((s) => s.createProduct);
    const addVariant = useAppStore((s) => s.addVariant);

    const activeBus = businessUnits.filter((b) => scope.activeBusinessUnitIds.includes(b.id));
    const [buId, setBuId] = useState(activeBus[0]?.id ?? "");
    const bu = businessUnits.find((b) => b.id === buId);
    const hasAttrs = !!bu && bu.attributeKeys.length > 0;
    const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
    const [rows, setRows] = useState<VariantDraft[]>(() => [emptyVariantDraft()]);
    const [override, setOverride] = useState(false);
    const [status, setStatus] = useState<Product["status"]>("active");

    const patch = (p: Partial<ProductDraft>) => {
        setDraft((d) => ({ ...d, ...p }));
        if (p.brand !== undefined || p.productLine !== undefined) setOverride(false);
    };
    const patchRow = (key: string, p: Partial<VariantDraft>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

    const vendors = allVendors.filter((v) => v.businessUnitIds.includes(buId));
    const productTypes = Array.from(new Set(products.filter((p) => p.businessUnitId === buId).map((p) => p.productType))).sort();
    const name = productName(draft.brand, draft.productLine);
    const effSku = (r: VariantDraft) => (r.skuTouched && r.sku.trim() ? r.sku.trim() : suggestSku(draft.brand, draft.productLine, r.name));

    /* ---------------- live duplicate check (Appendix A) ---------------- */
    const data = useMemo(() => ({ products, variants }), [products, variants]);
    const hasIdentity = draft.brand.trim().length > 1 && draft.productLine.trim().length > 0;

    const productMatches = useMemo(
        () => (hasIdentity ? findDuplicates(data, { businessUnitId: buId, brand: draft.brand, productLine: draft.productLine }).filter((m) => m.kind === "same_product") : []),
        [data, hasIdentity, buId, draft.brand, draft.productLine],
    );

    const rowChecks = useMemo(
        () =>
            rows.map((r) => {
                const touched = r.name.trim() || r.sellingBarcode.trim() || r.caseBarcode.trim() || r.skuTouched;
                if (!touched) return { key: r.key, blocking: [] as DuplicateMatch[], internal: [] as string[] };
                const matches = checkVariantDraft(data, { businessUnitId: buId, brand: draft.brand, productLine: draft.productLine, draft: { ...r, sku: effSku(r) } });
                const blocking = matches.filter((m) => m.kind === "exact_code" || m.kind === "same_variant");
                // Codes repeated inside this form
                const internal: string[] = [];
                rows.forEach((o) => {
                    if (o.key === r.key) return;
                    if (effSku(o) && effSku(o).toLowerCase() === effSku(r).toLowerCase()) internal.push(`SKU ${effSku(r)} is used twice in this form.`);
                    [r.sellingBarcode, r.caseBarcode].forEach((c) => {
                        if (c.trim() && [o.sellingBarcode, o.caseBarcode].includes(c.trim())) internal.push(`Barcode ${c} is used twice in this form.`);
                    });
                    if (r.name.trim() && normalize(o.name) === normalize(r.name)) internal.push(`Variant “${r.name}” is listed twice.`);
                });
                return { key: r.key, blocking, internal: Array.from(new Set(internal)) };
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [data, rows, buId, draft.brand, draft.productLine],
    );
    const blockingCount = rowChecks.reduce((a, c) => a + c.blocking.length + c.internal.length, 0);
    const exactCount = rowChecks.reduce((a, c) => a + c.blocking.filter((m) => m.kind === "exact_code").length, 0);

    const namedRows = rows.filter((r) => r.name.trim());
    const lineHasVariant = namedRows.find((r) => normalize(draft.productLine).includes(normalize(r.name)) && normalize(r.name).length > 2);

    const missing: string[] = [];
    if (!buId) missing.push("business unit");
    if (!draft.brand.trim()) missing.push("brand");
    if (!draft.productLine.trim()) missing.push("product line");
    if (!draft.productType.trim()) missing.push("product type");
    if (!namedRows.length) missing.push("at least one variant");

    const needsOverride = productMatches.length > 0 && !override;
    const canSave = !missing.length && !blockingCount && !needsOverride;

    const save = () => {
        if (!canSave || !bu) return;
        const p = productFromDraft(draft);
        const id = createProduct(
            { ...p, businessUnitId: buId, status, imageColor: swatchFor(p.brand) },
            namedRows.map((r) => variantFromDraft({ ...r, sku: effSku(r) }, bu.attributeKeys[0] ? { [bu.attributeKeys[0]]: r.name.trim() } : {})),
        );
        toast.success("Product created", `${p.name} with ${namedRows.length} variant${namedRows.length === 1 ? "" : "s"}`);
        router.push(`/catalog/products/${id}`);
    };

    const addAllTo = (target: Product) => {
        namedRows.forEach((r) => addVariant(target.id, variantFromDraft({ ...r, sku: effSku(r) }, bu?.attributeKeys[0] ? { [bu.attributeKeys[0]]: r.name.trim() } : {})));
        toast.success(`Added ${namedRows.length} variant${namedRows.length === 1 ? "" : "s"}`, `to ${target.name}`);
        router.push(`/catalog/products/${target.id}`);
    };

    const openAsVariant = (target: Product) => {
        const r = rows[0];
        const params = new URLSearchParams({ addVariant: "1" });
        if (r.name.trim()) params.set("name", r.name.trim());
        if (r.skuTouched && r.sku.trim()) params.set("sku", r.sku.trim());
        if (r.sellingBarcode.trim()) params.set("upc", r.sellingBarcode.trim());
        if (r.caseBarcode.trim()) params.set("caseUpc", r.caseBarcode.trim());
        if (r.price) params.set("price", r.price);
        if (r.cost) params.set("cost", r.cost);
        router.push(`/catalog/products/${target.id}?${params.toString()}`);
    };

    if (!scope.canManage) {
        return (
            <>
                <PageHeader eyebrow="Catalog" title="New product" backHref="/catalog/products" backLabel="Products" />
                <Card>
                    <Empty icon={Lock01} title="Managers create products" description="Ask your manager to add a product or a new variant." />
                </Card>
            </>
        );
    }

    return (
        <>
            <PageHeader
                eyebrow={bu?.name ?? "Catalog"}
                title="New product"
                description="Search first — never create a duplicate. Flavors, colors, strengths and sizes are variants of one product."
                backHref="/catalog/products"
                backLabel="Products"
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Step n={1} title="What is it?" description="Product name is Brand + Product Line. No variant, no abbreviations.">
                        <div className="flex flex-col gap-4">
                            {activeBus.length > 1 && (
                                <Select
                                    label="Business unit"
                                    items={activeBus.map((b) => ({ id: b.id, label: b.name }))}
                                    selectedKey={buId}
                                    onSelectionChange={(k: Key | null) => {
                                        setBuId(String(k));
                                        setRows((rs) => rs.map((r) => ({ ...r, vendorId: null })));
                                    }}
                                    isRequired
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>
                            )}
                            <IdentityFields draft={draft} onChange={patch} productTypes={productTypes} />
                            {lineHasVariant && (
                                <p className="flex items-center gap-2 text-sm text-warning-primary">
                                    <AlertTriangle className="size-4" /> The product line contains the variant “{lineHasVariant.name}”. Keep the variant out of the product name.
                                </p>
                            )}
                        </div>
                    </Step>

                    {productMatches.length > 0 && (
                        <DuplicateList
                            matches={productMatches}
                            title="This product may already exist"
                            description="Same brand and a matching product line. If only the flavor, color, strength or size is different, add it as a variant instead."
                            renderActions={(m) => (
                                <>
                                    <Button color="secondary" size="sm" onPress={() => openAsVariant(m.product)}>
                                        Add as variant of {m.product.name}
                                    </Button>
                                    {namedRows.length > 0 && m.product.businessUnitId === buId && (
                                        <Button color="primary" size="sm" isDisabled={exactCount > 0} onPress={() => addAllTo(m.product)}>
                                            Add {namedRows.length} variant{namedRows.length === 1 ? "" : "s"} now
                                        </Button>
                                    )}
                                </>
                            )}
                        >
                            <Checkbox
                                isSelected={override}
                                onChange={setOverride}
                                label="Not a duplicate — this is a different product"
                                hint="Only if the brand, device model or product type is actually different."
                            />
                        </DuplicateList>
                    )}

                    {bu && hasAttrs && (
                        <Step n={2} title={`${bu.name} attributes`} description="Product-level values. Leave blank if they change per variant.">
                            <AttributeFields draft={draft} onChange={patch} keys={bu.attributeKeys} />
                        </Step>
                    )}

                    <Step n={hasAttrs ? 3 : 2} title="Compliance" description="Restricted flags stop pushes to channels that don't accept them.">
                        <ComplianceFields draft={draft} onChange={patch} />
                    </Step>

                    <Step n={hasAttrs ? 4 : 3} title="Units of measure" description="Buy by the case, sell by the each. Case barcodes convert automatically.">
                        <UomFields draft={draft} onChange={patch} />
                    </Step>

                    <Step n={hasAttrs ? 5 : 4} title="Variants" description="One row per flavor, color, strength or size. Each has its own SKU and barcodes.">
                        <div className="flex flex-col gap-4">
                            {rows.map((r, i) => {
                                const check = rowChecks.find((c) => c.key === r.key)!;
                                const bad = check.blocking.length > 0 || check.internal.length > 0;
                                return (
                                    <div key={r.key} className={cx("rounded-xl p-4 ring-1 ring-inset", bad ? "ring-error_subtle" : "ring-secondary")}>
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold tracking-wide text-quaternary uppercase">Variant {i + 1}</p>
                                                <p className="truncate text-sm font-semibold text-primary">
                                                    {name || <span className="text-quaternary">Brand Product Line</span>}{" "}
                                                    <span className="text-brand-secondary">{r.name.trim() || <span className="text-quaternary">Variant</span>}</span>
                                                </p>
                                            </div>
                                            {rows.length > 1 && (
                                                <ButtonUtility icon={Trash01} size="sm" color="tertiary" tooltip="Remove variant" onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
                                            )}
                                        </div>
                                        <VariantFields
                                            draft={r}
                                            onChange={(p) => patchRow(r.key, p)}
                                            vendors={vendors}
                                            suggestedSku={suggestSku(draft.brand, draft.productLine, r.name)}
                                            purchaseUnit={draft.purchaseUnit || "Case"}
                                            sellingUnit={draft.sellingUnit || "Each"}
                                        />
                                        {check.internal.length > 0 && (
                                            <ul className="mt-3 flex flex-col gap-1">
                                                {check.internal.map((m) => (
                                                    <li key={m} className="flex items-center gap-2 text-sm text-error-primary">
                                                        <AlertTriangle className="size-4" /> {m}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <DuplicateList
                                            className="mt-4"
                                            tone="error"
                                            matches={check.blocking}
                                            title="Already in the catalog"
                                            description="This variant, SKU or barcode already exists. You can't save a duplicate — open the existing item instead."
                                            renderActions={(m) => (
                                                <Button color="secondary" size="sm" href={`/catalog/products/${m.product.id}`}>
                                                    Open
                                                </Button>
                                            )}
                                        />
                                    </div>
                                );
                            })}
                            <div>
                                <Button
                                    color="secondary"
                                    size="md"
                                    iconLeading={Plus}
                                    onPress={() => {
                                        const last = rows[rows.length - 1];
                                        setRows((rs) => [
                                            ...rs,
                                            emptyVariantDraft({
                                                price: last?.price ?? "",
                                                cost: last?.cost ?? "",
                                                reorderPoint: last?.reorderPoint ?? "10",
                                                restockQty: last?.restockQty ?? "24",
                                                leadTimeDays: last?.leadTimeDays ?? "7",
                                                vendorId: last?.vendorId ?? null,
                                            }),
                                        ]);
                                    }}
                                >
                                    Add another variant
                                </Button>
                            </div>
                        </div>
                    </Step>
                </div>

                {/* Sidebar: preview, checks, guidance */}
                <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
                    <Card title="Preview" description="How this will appear everywhere.">
                        <div className="flex flex-col gap-4">
                            <div>
                                <p className="text-xs font-semibold tracking-wide text-quaternary uppercase">Product</p>
                                <p className="mt-1 text-lg font-semibold text-primary">{name || <span className="text-quaternary">Brand + Product Line</span>}</p>
                                {draft.productType && <p className="text-sm text-tertiary">{draft.productType}</p>}
                            </div>
                            <div>
                                <p className="text-xs font-semibold tracking-wide text-quaternary uppercase">Variants</p>
                                <ul className="mt-1 flex flex-col gap-1.5">
                                    {rows.map((r) => (
                                        <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
                                            <span className="min-w-0 truncate text-primary">
                                                {name || "…"} {r.name.trim() || <span className="text-quaternary">+ variant</span>}
                                            </span>
                                            <span className="shrink-0 font-mono text-xs text-tertiary">{effSku(r) || "—"}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="border-t border-secondary pt-4">
                                <p className="text-xs font-semibold tracking-wide text-quaternary uppercase">Duplicate check</p>
                                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                                    <CheckLine pending={!hasIdentity} ok={!productMatches.length || override} label={productMatches.length ? (override ? "Marked as a different product" : "Similar product exists") : hasIdentity ? "No similar product" : "Enter brand and line"} />
                                    <CheckLine ok={!exactCount} label={exactCount ? `${exactCount} SKU / UPC already used` : "SKUs and barcodes are unique"} />
                                    <CheckLine
                                        ok={!(blockingCount - exactCount)}
                                        label={blockingCount - exactCount ? `${blockingCount - exactCount} variant issue${blockingCount - exactCount === 1 ? "" : "s"}` : "No repeated variants"}
                                    />
                                </ul>
                            </div>
                            <div className="flex flex-col gap-3 border-t border-secondary pt-4">
                                <Select
                                    label="Save as"
                                    size="sm"
                                    items={[
                                        { id: "active", label: "Active" },
                                        { id: "draft", label: "Draft" },
                                    ]}
                                    selectedKey={status}
                                    onSelectionChange={(k: Key | null) => setStatus((k as Product["status"]) ?? "active")}
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>
                                <Button color="primary" size="lg" isDisabled={!canSave} onPress={save}>
                                    Create product
                                </Button>
                                {!canSave && (
                                    <p className="text-xs text-tertiary">
                                        {missing.length
                                            ? `Still needed: ${missing.join(", ")}.`
                                            : blockingCount
                                              ? "Fix the duplicate SKUs, barcodes or variants first."
                                              : "Add as a variant of the existing product, or confirm it's different."}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>
                    <Card title="New product or variant?" description="Appendix A of the catalog rules.">
                        <NamingGuide />
                    </Card>
                </aside>
            </div>
        </>
    );
}

const CheckLine = ({ ok, label, pending }: { ok: boolean; label: string; pending?: boolean }) => (
    <li className={cx("flex items-center gap-2", pending ? "text-tertiary" : ok ? "text-secondary" : "text-error-primary")}>
        {pending ? <CheckCircle className="size-4 text-fg-quaternary" /> : ok ? <CheckCircle className="size-4 text-fg-success-primary" /> : <AlertTriangle className="size-4" />}
        {label}
    </li>
);

const swatches = ["#0ea5e9", "#a855f7", "#f97316", "#16a34a", "#ef4444", "#0f172a", "#ec4899", "#d97706", "#3b82f6", "#64748b"];
const swatchFor = (brand: string) => swatches[Array.from(brand).reduce((a, c) => a + c.charCodeAt(0), 0) % swatches.length];
