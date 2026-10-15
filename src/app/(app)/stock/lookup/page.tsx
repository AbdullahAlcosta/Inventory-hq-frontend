"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClientRedirect } from "@/components/app/client-redirect";

/** Product Lookup was merged into Products; keep old links (and ?q=) working. */
function LookupRedirect() {
    const q = useSearchParams().get("q");
    return <ClientRedirect to={q ? `/catalog/products?q=${encodeURIComponent(q)}` : "/catalog/products"} />;
}

export default function LookupPage() {
    return (
        <Suspense fallback={null}>
            <LookupRedirect />
        </Suspense>
    );
}
