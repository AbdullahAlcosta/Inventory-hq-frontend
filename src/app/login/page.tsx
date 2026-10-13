"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useHydrated } from "@/hooks/use-session";
import { initials } from "@/lib/format";
import { demoAccounts } from "@/mock/seed";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/utils/cx";

const roleText = (role: string, level: string) => (role === "executive" ? "Executive" : `${level === "warehouse" ? "Warehouse" : "Store"} ${role[0].toUpperCase()}${role.slice(1)}`);

export default function LoginPage() {
    const router = useRouter();
    const hydrated = useHydrated();
    const employees = useAppStore((s) => s.employees);
    const companies = useAppStore((s) => s.companies);
    const login = useAppStore((s) => s.login);
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Demo accounts plus any company executive added later (so new companies can be tried out).
    const accounts = [
        ...demoAccounts.map((d) => ({ ...d, employee: employees.find((e) => e.id === d.employeeId)! })).filter((d) => d.employee),
        ...employees
            .filter((e) => e.role === "executive" && !demoAccounts.some((d) => d.employeeId === e.id))
            .map((e) => ({ employeeId: e.id, headline: "Executive of a company added in Setup.", employee: e })),
    ];

    const signIn = (id: string) => {
        login(id);
        router.push("/dashboard");
    };

    return (
        <div className="flex min-h-dvh flex-col bg-secondary lg:flex-row">
            <div className="flex flex-col justify-between bg-[#161616] px-8 py-8 text-white lg:w-[440px] lg:py-12">
                <Logo />
                <div className="mt-10 lg:mt-0">
                    <h1 className="text-display-sm font-semibold">One record of products, stock and prices.</h1>
                    <p className="mt-4 text-md text-gray-400">
                        Push products to Quickvee, Shopify and WooCommerce, receive purchase orders by scanning, replenish stores from the warehouse, and decide everything that
                        needs a person in Approvals.
                    </p>
                </div>
                <p className="mt-10 text-xs text-gray-500 lg:mt-0">Static MVP · demo data only · no backend connected</p>
            </div>

            <div className="flex flex-1 items-start justify-center px-4 py-10 lg:items-center">
                <div className="w-full max-w-2xl">
                    <h2 className="text-display-xs font-semibold text-primary">Sign in</h2>
                    <p className="mt-1 text-md text-tertiary">Pick a demo account to see the app through that person’s role and assignment.</p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {hydrated &&
                            accounts.map(({ employee, headline }) => {
                                const company = companies.find((c) => c.id === employee.companyId);
                                return (
                                    <AriaButton
                                        key={employee.id}
                                        onPress={() => signIn(employee.id)}
                                        className={cx(
                                            "group flex cursor-pointer flex-col gap-3 rounded-xl bg-primary p-4 text-left shadow-xs ring-1 ring-secondary outline-hidden transition duration-100 ease-linear",
                                            "hover:ring-2 hover:ring-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900",
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-semibold text-white">
                                                {initials(employee.name)}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-primary">{employee.name}</p>
                                                <p className="truncate text-xs text-tertiary">
                                                    {roleText(employee.role, employee.level)} · {company?.name}
                                                </p>
                                            </div>
                                            <ArrowRight className="size-4 text-fg-quaternary transition group-hover:translate-x-0.5 group-hover:text-fg-primary" />
                                        </div>
                                        <p className="text-sm text-tertiary">{headline}</p>
                                    </AriaButton>
                                );
                            })}
                    </div>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-border-secondary" />
                        <span className="text-xs text-quaternary">or sign in with email</span>
                        <div className="h-px flex-1 bg-border-secondary" />
                    </div>

                    <form
                        className="flex flex-col gap-3 sm:flex-row sm:items-start"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const match = employees.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
                            if (!match) return setError("No employee with that email. Try one of the demo accounts above.");
                            if (match.status === "disabled") return setError("This account is disabled.");
                            signIn(match.id);
                        }}
                    >
                        <Input
                            className="flex-1"
                            type="email"
                            placeholder="you@company.com"
                            aria-label="Email"
                            value={email}
                            onChange={(v) => {
                                setEmail(v);
                                setError(null);
                            }}
                            isInvalid={!!error}
                            hint={error ?? "Any employee email works — there’s no password in the demo."}
                        />
                        <Button type="submit" size="lg">
                            Continue
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
