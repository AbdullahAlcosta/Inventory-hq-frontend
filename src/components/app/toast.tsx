"use client";

import { AlertTriangle, CheckCircle, InfoCircle, XClose } from "@untitledui/icons";
import { create } from "zustand";
import { cx } from "@/utils/cx";

type Tone = "success" | "error" | "info" | "warning";
interface Toast {
    id: number;
    title: string;
    description?: string;
    tone: Tone;
}

const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; remove: (id: number) => void }>((set) => ({
    toasts: [],
    push: (t) => {
        const id = Date.now() + Math.random();
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500);
    },
    remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Fire a toast from anywhere: `toast.success("Saved")`. */
export const toast = {
    success: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: "success" }),
    error: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: "error" }),
    warning: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: "warning" }),
    info: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: "info" }),
};

const icons = { success: CheckCircle, error: AlertTriangle, warning: AlertTriangle, info: InfoCircle };
const tones = { success: "text-green-600", error: "text-red-600", warning: "text-orange-500", info: "text-gray-700" };

export const Toaster = () => {
    const { toasts, remove } = useToasts();
    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
            {toasts.map((t) => {
                const Icon = icons[t.tone];
                return (
                    <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl bg-primary p-4 shadow-lg ring-1 ring-secondary duration-200 animate-in fade-in slide-in-from-bottom-2">
                        <Icon className={cx("mt-0.5 size-5 shrink-0", tones[t.tone])} />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-primary">{t.title}</p>
                            {t.description && <p className="mt-0.5 text-sm text-tertiary">{t.description}</p>}
                        </div>
                        <button onClick={() => remove(t.id)} className="text-fg-quaternary hover:text-fg-secondary" aria-label="Dismiss">
                            <XClose className="size-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
