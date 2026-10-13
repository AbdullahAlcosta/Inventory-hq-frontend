import type { Employee, Role } from "@/lib/types";

export const roleInfo: Record<Role, { label: string; description: string; color: "brand" | "blue" | "gray" }> = {
    executive: {
        label: "Executive",
        description: "Sees everything in the company. Adds employees, decides any approval and gets the monthly report.",
        color: "brand",
    },
    manager: {
        label: "Manager",
        description: "Works within assigned stores or warehouses. Decides approvals for those locations and manages vendors & purchase orders.",
        color: "blue",
    },
    associate: {
        label: "Associate",
        description: "Store associates request stock and confirm deliveries. Warehouse associates receive, pick, pack and ship.",
        color: "gray",
    },
};

export const levelLabel = (level: Employee["level"]) => (level === "company" ? "Company" : level === "store" ? "Store" : "Warehouse");

/** Plain-language list of what a role + assignment allows (PRD §4, §7). */
export const capabilitiesFor = (role: Role, level: Employee["level"], locationNames: string[], buNames: string[]): string[] => {
    if (role === "executive") {
        return [
            "Sees every business unit, store and warehouse in this company",
            "Decides every approval",
            "Adds and edits employees, business units and locations",
            "Gets the monthly executive report",
        ];
    }
    const where = locationNames.length ? locationNames.join(", ") : buNames.length ? `no locations yet in ${buNames.join(", ")}` : "no locations yet";
    const list = [`Sees stock and products for: ${where}`, "Looks up any product's quantity across locations (read-only)"];
    if (role === "manager") {
        list.push("Decides approvals for their locations (counts, adjustments, reorders…)");
        list.push("Manages vendors and purchase orders");
        list.push("Manages sales channel connections, allocation and reconciliation");
        if (level === "warehouse") list.push("Runs receiving, picking, packing and shipping");
        else list.push("Requests stock from the warehouse and confirms deliveries");
    } else if (level === "warehouse") {
        list.push("Receives purchase orders by scanning");
        list.push("Picks, packs and ships store requests");
        list.push("Counts stock and logs adjustments (sent to approval)");
    } else {
        list.push("Requests stock from the warehouse");
        list.push("Confirms deliveries manually or by scanning");
        list.push("Counts stock and logs adjustments (sent to approval)");
    }
    return list;
};
