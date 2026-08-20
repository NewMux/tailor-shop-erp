import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { getMonthWindow, rollDerivedQuantity } from "./erp";
import { effectiveInventoryQuantity } from "./inventoryQuantity";

function context(): TrpcContext {
  return { user: { id: 1, openId: "test-user", name: "Test User", email: "test@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("ERP input contracts", () => {
  it("rejects a counter sale with no lines before business processing", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.sales.create({ customerName: "Walk-in", discount: 0, paymentMethod: "cash", paymentStatus: "paid", items: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects malformed customer input before persistence", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.customers.create({ name: "A", phone: "1", email: "invalid-email", address: "", notes: "", preferredContact: "WhatsApp" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("does not expose manual-sale creation through Sales History", async () => {
    const caller = appRouter.createCaller(context()) as any;
    await expect(caller.erp.salesHistory.createManual({})).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("derives material availability from rolls and meters per roll", () => {
    expect(rollDerivedQuantity("material", 10, 20)).toBe(200);
    expect(rollDerivedQuantity("material", 0, 20)).toBeNull();
    expect(rollDerivedQuantity("material", 10)).toBeNull();
    expect(rollDerivedQuantity("item", 10, 20)).toBeNull();
  });
  it("uses roll-derived availability for legacy zero-stock materials without movement history", () => {
    expect(effectiveInventoryQuantity({ inventoryType: "material", quantity: "0.000", rollCount: 10, metersPerRoll: "20.000", hasMovement: false })).toBe(200);
  });
  it("does not resurrect a genuinely depleted material that has movement history", () => {
    expect(effectiveInventoryQuantity({ inventoryType: "material", quantity: "0.000", rollCount: 10, metersPerRoll: "20.000", hasMovement: true })).toBe(0);
  });
  it("calculates inclusive UTC month boundaries for monthly reporting", () => {
    const window = getMonthWindow("2026-02");
    expect(window.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });
  it("rejects a malformed staff access invitation before persistence", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.access.inviteStaff({ name: "A", email: "not-an-email", customRoleId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects an incomplete owner approval before access changes", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.access.approvePending({ requestId: 0, customRoleId: 0, note: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects exact-permission approval without a pending request or permissions", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.accessApproval.approveWithPermissions({ requestId: 0, name: "A", description: "", permissions: [], note: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects an invalid user-removal request before any access records can change", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.team.removeUser({ userId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("requires a positive final amount for a payroll payout before any payroll data can change", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.staff.createPayout({ staffProfileId: 1, payPeriod: "2026-08", amount: 0, deductions: 0, notes: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects a malformed payroll pay period before any payroll data can change", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.erp.staff.createPayout({ staffProfileId: 1, payPeriod: "2026-13", amount: 100, deductions: 0, notes: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
