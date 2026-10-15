"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { Logo } from "@/components/app/logo";
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

    // One demo account per role.
    const accounts = demoAccounts.map((d) => ({ ...d, employee: employees.find((e) => e.id === d.employeeId)! })).filter((d) => d.employee);

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
                    <p className="mt-1 text-md text-tertiary">Pick a role to see the app the way that person would.</p>

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

                    <p className="mt-6 text-sm text-tertiary">Each account opens with a short guided tour of what that role can do. You can skip it and replay it later from the account menu.</p>
                </div>
            </div>
        </div>
    );
}
