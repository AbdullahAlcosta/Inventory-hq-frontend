"use client";

import { useMemo, useState } from "react";
import type { Key } from "react-aria-components";
import { Select } from "@/components/base/select/select";
import { useAppStore } from "@/store/app-store";

interface VariantPickerProps {
    /** Limit choices to products in these brands. */
    businessUnitIds: string[];
    /** Hide variants already chosen. */
    exclude?: string[];
    /** Only list variants for which this returns true. */
    filter?: (variantId: string) => boolean;
    onSelect: (variantId: string) => void;
    label?: string;
    placeholder?: string;
    size?: "sm" | "md";
    className?: string;
}

/** Search-as-you-type picker over product variants (name, variant or SKU). */
export const VariantPicker = ({ businessUnitIds, exclude = [], filter, onSelect, label, placeholder = "Search products or SKU…", size = "md", className }: VariantPickerProps) => {
    const products = useAppStore((s) => s.products);
    const variants = useAppStore((s) => s.variants);
    // Controlled so the field clears (and the list closes) after each pick.
    const [inputValue, setInputValue] = useState("");
    const [resetKey, setResetKey] = useState(0);

    const items = useMemo(
        () =>
            variants
                .filter((v) => {
                    const p = products.find((x) => x.id === v.productId);
                    return p && p.status !== "archived" && businessUnitIds.includes(p.businessUnitId) && !exclude.includes(v.id) && (!filter || filter(v.id));
                })
                .map((v) => {
                    const p = products.find((x) => x.id === v.productId)!;
                    return { id: v.id, label: `${p.name} — ${v.name}`, supportingText: v.sku };
                }),
        [variants, products, businessUnitIds, exclude, filter],
    );

    return (
        <div className={className}>
            <Select.ComboBox
                key={resetKey}
                inputValue={inputValue}
                onInputChange={setInputValue}
                label={label}
                placeholder={placeholder}
                items={items}
                size={size}
                shortcut={false}
                selectedKey={null}
                onSelectionChange={(key: Key | null) => {
                    if (!key) return;
                    onSelect(String(key));
                    setInputValue("");
                    setResetKey((k) => k + 1);
                }}
            >
                {(item) => (
                    <Select.Item id={item.id} supportingText={item.supportingText} textValue={`${item.label} ${item.supportingText}`}>
                        {item.label}
                    </Select.Item>
                )}
            </Select.ComboBox>
        </div>
    );
};
