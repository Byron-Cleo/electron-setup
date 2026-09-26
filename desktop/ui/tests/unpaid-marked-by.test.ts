import { describe, it, expect } from "vitest";
import { unpaidMarkedByLabel } from "@/lib/utils";

const CASHIER = "c0ffee00-0000-4000-8000-000000000001";
const MANAGER = "c0ffee00-0000-4000-8000-000000000002";

describe("unpaidMarkedByLabel", () => {
  it("returns null for an order that has not been marked unpaid", () => {
    expect(unpaidMarkedByLabel(false, null, undefined)).toBeNull();
    expect(unpaidMarkedByLabel(false, CASHIER, "cashier")).toBeNull();
  });

  it("reports System Marked when there is no actor (shift auto-closed)", () => {
    expect(unpaidMarkedByLabel(true, null, undefined)).toBe("System Marked");
  });

  it("reports Cashier Marked when a cashier marked it during service", () => {
    expect(unpaidMarkedByLabel(true, CASHIER, "cashier")).toBe("Cashier Marked");
  });

  it("reports Manager Marked for a manager marking it during manual close", () => {
    expect(unpaidMarkedByLabel(true, MANAGER, "manager")).toBe("Manager Marked");
  });

  it("treats admin the same as manager", () => {
    expect(unpaidMarkedByLabel(true, MANAGER, "admin")).toBe("Manager Marked");
  });

  it("falls back to Manager Marked for an unknown or deleted user", () => {
    // roles map missing the id entirely, e.g. the user was deleted
    expect(unpaidMarkedByLabel(true, MANAGER, undefined)).toBe("Manager Marked");
    // a role that is neither cashier nor a manager-level role
    expect(unpaidMarkedByLabel(true, MANAGER, "waiter")).toBe("Manager Marked");
  });
});
