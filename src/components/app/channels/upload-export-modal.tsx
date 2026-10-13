"use client";

import { useEffect, useRef, useState } from "react";
import { File06, UploadCloud02 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { ModalDialog } from "@/components/app/modal-dialog";
import { toast } from "@/components/app/toast";
import { channelAllocation } from "@/lib/selectors";
import type { ChannelConnection } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

type Row = { sku: string; quantity: number };

/** Parses a "sku,quantity" CSV. The header row is optional; sku may be a SKU or barcode. */
export const parseExportCsv = (text: string): Row[] =>
    text
        .split(/\r?\n/)
        .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")))
        .filter((cells) => cells.length >= 2 && cells[0] && !Number.isNaN(Number(cells[1])) && cells[1] !== "")
        .map(([sku, qty]) => ({ sku, quantity: Math.round(Number(qty)) }));

export const UploadExportModal = ({ isOpen, onOpenChange, connections }: { isOpen: boolean; onOpenChange: (o: boolean) => void; connections: ChannelConnection[] }) => {
    const listings = useAppStore((s) => s.listings);
    const variants = useAppStore((s) => s.variants);
    const stockLevels = useAppStore((s) => s.stockLevels);
    const allocations = useAppStore((s) => s.allocations);
    const reconcileUpload = useAppStore((s) => s.reconcileUpload);

    const [connectionId, setConnectionId] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [result, setResult] = useState<{ compared: number; mismatches: number; unknown: number } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setConnectionId(connections.find((c) => c.status === "connected")?.id ?? connections[0]?.id ?? null);
        setFileName(null);
        setRows([]);
        setResult(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const connection = connections.find((c) => c.id === connectionId);

    const loadSample = () => {
        if (!connection) return;
        const synced = listings.filter((l) => l.connectionId === connection.id && l.status === "synced");
        const sample = synced.map((l, i) => {
            const v = variants.find((x) => x.id === l.variantId)!;
            const expected = channelAllocation({ stockLevels, allocations }, l.variantId, connection).sellable;
            // Two numbers are off so the report has something to show.
            const off = i === 1 ? -2 : i === 3 ? 1 : 0;
            return { sku: v.sku, quantity: Math.max(0, expected + off) };
        });
        if (!sample.length) {
            toast.warning("Nothing to sample", "This connection has no synced listings yet.");
            return;
        }
        setRows(sample);
        setFileName(`${connection.channel}-export-sample.csv`);
        setResult(null);
    };

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        const parsed = parseExportCsv(await file.text());
        setRows(parsed);
        setFileName(file.name);
        setResult(null);
        if (!parsed.length) toast.error("No rows found", "Expected two columns: sku,quantity.");
    };

    const run = () => {
        if (!connection || !fileName || !rows.length) return;
        setResult(reconcileUpload(connection.id, rows, fileName));
    };

    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title="Upload channel export"
            description="Compare a channel's stock export with what we expect it to show. Any difference is flagged."
            size="md"
            footer={
                result ? (
                    <>
                        <Button color="secondary" size="lg" href="/approvals">
                            Open Approvals
                        </Button>
                        <Button color="primary" size="lg" onPress={() => onOpenChange(false)}>
                            Done
                        </Button>
                    </>
                ) : (
                    <>
                        <Button color="secondary" size="lg" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button color="primary" size="lg" isDisabled={!connection || !rows.length} onPress={run}>
                            Compare
                        </Button>
                    </>
                )
            }
        >
            {result ? (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Compared", value: result.compared },
                            { label: "Mismatches", value: result.mismatches },
                            { label: "Unknown codes", value: result.unknown },
                        ].map((s) => (
                            <div key={s.label} className="rounded-xl bg-secondary p-4">
                                <p className="text-sm text-tertiary">{s.label}</p>
                                <p className="mt-1 text-display-xs font-semibold text-primary tabular-nums">{s.value}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-sm text-secondary">
                        {result.mismatches
                            ? `${result.mismatches} mismatch${result.mismatches === 1 ? " was" : "es were"} added to the report and sent to Approvals for review.`
                            : "Everything in the file matches what we expect."}
                        {result.unknown ? ` ${result.unknown} row${result.unknown === 1 ? "" : "s"} didn't match any SKU or barcode.` : ""}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    <Select
                        label="Connection"
                        items={connections.map((c) => ({ id: c.id, label: c.name }))}
                        selectedKey={connectionId}
                        onSelectionChange={(k) => {
                            setConnectionId(k as string);
                            setRows([]);
                            setFileName(null);
                        }}
                    >
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>

                    <div className="flex flex-col items-center rounded-xl border border-dashed border-primary px-6 py-8 text-center">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                            {fileName ? <File06 className="size-5" /> : <UploadCloud02 className="size-5" />}
                        </span>
                        {fileName ? (
                            <>
                                <p className="mt-3 text-sm font-semibold text-primary">{fileName}</p>
                                <p className="text-sm text-tertiary">{rows.length} rows ready to compare</p>
                            </>
                        ) : (
                            <>
                                <p className="mt-3 text-sm font-semibold text-primary">CSV with columns sku,quantity</p>
                                <p className="text-sm text-tertiary">The sku column can hold a SKU or a barcode.</p>
                            </>
                        )}
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            <Button size="sm" color="secondary" onPress={() => fileRef.current?.click()}>
                                Choose file
                            </Button>
                            <Button size="sm" color="tertiary" isDisabled={!connection} onPress={loadSample}>
                                Use sample export
                            </Button>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => {
                                onFile(e.target.files?.[0]);
                                e.target.value = "";
                            }}
                        />
                    </div>
                </div>
            )}
        </ModalDialog>
    );
};
