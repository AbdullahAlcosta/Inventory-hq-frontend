"use client";

import { type ReactNode, useState } from "react";
import { Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";

interface ModalDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
}

const widths = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" };

/** Standard modal: header with title + close, scrollable body, footer actions. */
export const ModalDialog = ({ isOpen, onOpenChange, title, description, children, footer, size = "md" }: ModalDialogProps) => (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
        <Modal className={cx(widths[size])}>
            <Dialog aria-label={typeof title === "string" ? title : "Dialog"}>
                {({ close }) => (
                    <div className="flex max-h-[inherit] flex-col">
                        <div className="relative border-b border-secondary px-5 pt-5 pb-4 md:px-6">
                            <AriaHeading slot="title" className="pr-8 text-lg font-semibold text-primary">
                                {title}
                            </AriaHeading>
                            {description && <p className="mt-1 text-sm text-tertiary">{description}</p>}
                            <CloseButton size="md" className="absolute top-4 right-4" onPress={close} />
                        </div>
                        {children && <div className="overflow-y-auto px-5 py-5 md:px-6">{children}</div>}
                        {footer && <div className="flex flex-col-reverse gap-3 border-t border-secondary px-5 py-4 sm:flex-row sm:justify-end md:px-6">{footer}</div>}
                    </div>
                )}
            </Dialog>
        </Modal>
    </ModalOverlay>
);

interface ConfirmDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    destructive?: boolean;
    /** Require typing this phrase before confirming (like "Send All"). */
    typeToConfirm?: string;
}

export const ConfirmDialog = ({ isOpen, onOpenChange, title, description, children, confirmLabel, onConfirm, destructive, typeToConfirm }: ConfirmDialogProps) => {
    const [typed, setTyped] = useState("");
    const ready = !typeToConfirm || typed === typeToConfirm;
    const close = () => {
        setTyped("");
        onOpenChange(false);
    };
    return (
        <ModalDialog
            isOpen={isOpen}
            onOpenChange={(o) => (o ? onOpenChange(true) : close())}
            title={title}
            description={description}
            size="sm"
            footer={
                <>
                    <Button color="secondary" size="lg" onPress={close}>
                        Cancel
                    </Button>
                    <Button
                        color={destructive ? "primary-destructive" : "primary"}
                        size="lg"
                        isDisabled={!ready}
                        onPress={() => {
                            onConfirm();
                            close();
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {children}
            {typeToConfirm && (
                <div className={cx(children ? "mt-5 border-t border-secondary pt-5" : "")}>
                    <p className="mb-2 text-sm text-secondary">
                        Type <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-primary">{typeToConfirm}</span> to confirm
                    </p>
                    <Input aria-label="Confirmation" placeholder={`Type exactly: ${typeToConfirm}`} value={typed} onChange={setTyped} />
                </div>
            )}
        </ModalDialog>
    );
};
