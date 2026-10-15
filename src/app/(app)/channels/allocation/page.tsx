import { ClientRedirect } from "@/components/app/client-redirect";

/** Allocation moved to Catalog; keep old links working. */
export default function OldAllocationPage() {
    return <ClientRedirect to="/catalog/allocation" />;
}
