"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Client-side redirect — works in the static export, unlike server `redirect()`. */
export const ClientRedirect = ({ to }: { to: string }) => {
    const router = useRouter();
    useEffect(() => {
        router.replace(to);
    }, [router, to]);
    return null;
};
