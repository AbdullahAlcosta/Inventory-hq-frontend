"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { CheckCircle, AlertTriangle, Scan, XCircle } from "@untitledui/icons";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

export interface ScanFeedback {
    tone: "success" | "warning" | "error";
    title: string;
    description?: ReactNode;
}

export interface SimulatedCode {
    code: string;
    label: string;
    hint?: string;
}

interface ScanInputProps {
    /** Called with the scanned/typed code. Return feedback to show under the field. */
    onScan: (code: string, quantity: number) => ScanFeedback | void;
    /** Barcodes offered by the "Simulate scan" menu so the flow can be demoed without a scanner. */
    simulate?: SimulatedCode[];
    placeholder?: string;
    /** Show a quantity multiplier (e.g. scanning one case barcode × 3). */
    withQuantity?: boolean;
    autoFocus?: boolean;
    className?: string;
}

/**
 * Scan-first input (PRD §11). USB/Bluetooth scanners type the code and send
 * Enter, so this is a focused text field that submits on Enter. Typing the
 * code by hand is the fallback.
 */
export const ScanInput = ({ onScan, simulate, placeholder = "Scan a barcode or type a code, then press Enter", withQuantity, autoFocus = true, className }: ScanInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [code, setCode] = useState("");
    const [qty, setQty] = useState(1);
    const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    const submit = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        const result = onScan(trimmed, Math.max(1, qty || 1));
        setFeedback(result ?? null);
        setCode("");
        setQty(1);
        setFlash(true);
        setTimeout(() => setFlash(false), 350);
        inputRef.current?.focus();
    };

    const FeedbackIcon = feedback?.tone === "success" ? CheckCircle : feedback?.tone === "warning" ? AlertTriangle : XCircle;

    return (
        <div className={cx("flex flex-col gap-3", className)}>
            <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit(code);
                }}
            >
                <div
                    className={cx(
                        "relative flex flex-1 items-center rounded-xl bg-primary shadow-xs ring-1 ring-primary transition duration-150 ring-inset focus-within:ring-2 focus-within:ring-gray-900",
                        flash && "ring-2 ring-green-500",
                    )}
                >
                    <Scan className="pointer-events-none absolute left-3.5 size-5 text-fg-quaternary" />
                    <input
                        ref={inputRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder={placeholder}
                        aria-label="Barcode"
                        autoComplete="off"
                        className="w-full bg-transparent py-3 pr-3 pl-11 font-mono text-md text-primary outline-hidden placeholder:font-sans placeholder:text-placeholder"
                    />
                    {withQuantity && (
                        <label className="mr-2 flex items-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1 text-sm text-tertiary">
                            ×
                            <input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                                aria-label="Quantity"
                                className="w-12 bg-transparent text-right font-semibold text-primary outline-hidden"
                            />
                        </label>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button type="submit" size="lg" className="flex-1 sm:flex-none">
                        Add
                    </Button>
                    {simulate && simulate.length > 0 && (
                        <AriaDialogTrigger>
                            <Button size="lg" color="secondary" className="flex-1 whitespace-nowrap sm:flex-none">
                                Simulate scan
                            </Button>
                            <AriaPopover placement="bottom end" offset={6} className="max-h-80 w-80 overflow-y-auto rounded-xl bg-primary p-1.5 shadow-lg ring-1 ring-secondary outline-hidden">
                                <AriaDialog aria-label="Simulated barcodes" className="outline-hidden">
                                    {({ close }) => (
                                        <div className="flex flex-col">
                                            <p className="px-2.5 py-1.5 text-xs font-semibold text-quaternary">Demo barcodes</p>
                                            {simulate.map((s) => (
                                                <AriaButton
                                                    key={s.code + s.label}
                                                    onPress={() => {
                                                        close();
                                                        submit(s.code);
                                                    }}
                                                    className="flex cursor-pointer flex-col items-start rounded-lg px-2.5 py-2 text-left outline-hidden hover:bg-primary_hover focus-visible:bg-primary_hover"
                                                >
                                                    <span className="text-sm font-medium text-primary">{s.label}</span>
                                                    <span className="font-mono text-xs text-tertiary">
                                                        {s.code}
                                                        {s.hint ? ` · ${s.hint}` : ""}
                                                    </span>
                                                </AriaButton>
                                            ))}
                                        </div>
                                    )}
                                </AriaDialog>
                            </AriaPopover>
                        </AriaDialogTrigger>
                    )}
                </div>
            </form>
            {feedback && (
                <div
                    className={cx(
                        "flex items-start gap-3 rounded-xl px-4 py-3 ring-1 ring-inset",
                        feedback.tone === "success" && "bg-green-50 ring-green-200",
                        feedback.tone === "warning" && "bg-orange-50 ring-orange-200",
                        feedback.tone === "error" && "bg-red-50 ring-red-200",
                    )}
                    role="status"
                >
                    <FeedbackIcon
                        className={cx(
                            "mt-0.5 size-5 shrink-0",
                            feedback.tone === "success" && "text-green-600",
                            feedback.tone === "warning" && "text-orange-600",
                            feedback.tone === "error" && "text-red-600",
                        )}
                    />
                    <div>
                        <p className="text-sm font-semibold text-primary">{feedback.title}</p>
                        {feedback.description && <p className="text-sm text-secondary">{feedback.description}</p>}
                    </div>
                </div>
            )}
        </div>
    );
};
