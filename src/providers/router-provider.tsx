"use client";

import type { PropsWithChildren } from "react";
import { useRouter } from "next/navigation";
import { RouterProvider } from "react-aria-components";

declare module "react-aria-components" {
    interface RouterConfig {
        routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
    }
}

export const RouteProvider = ({ children }: PropsWithChildren) => {
    const router = useRouter();

    // Prefix hrefs with the base path (set when hosted under /<repo> on GitHub Pages).
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const useHref = (href: string) => (href.startsWith("/") ? basePath + href : href);

    return (
        <RouterProvider navigate={router.push} useHref={useHref}>
            {children}
        </RouterProvider>
    );
};
