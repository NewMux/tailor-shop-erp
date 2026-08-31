import { beforeEach, describe, expect, it, vi } from "vitest";
import { customRoles, invoices, sales, saleItems, userBusinessRoles, userCustomRoles } from "../drizzle/schema";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { customRoleCanAccess, erpRouter } from "./erp";

const actor = { id: 88, openId: "manager", name: "Manager", email: "manager@example.com", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

function makeContext() {
  return { user: actor, req: { protocol: "https", headers: {} }, res: {} } as never;
}

function makeInvoiceDeleteDb(options: { hasCustomRole?: boolean; customRolePermissions?: string[] } = {}) {
  const rows = (table: unknown) => {
    if (table === userBusinessRoles) return [{ id: 1, userId: actor.id, role: "sales", isActive: true }];
    if (table === userCustomRoles) return options.hasCustomRole ? [{ id: 1, userId: actor.id, customRoleId: 5, isActive: true }] : [];
    if (table === customRoles) return options.hasCustomRole ? [{ id: 5, name: "Manager", permissionsJson: options.customRolePermissions ?? ["sales"], isActive: true }] : [];
    if (table === invoices) return [{ id: 100, saleId: 200, invoiceNumber: "INV-000100" }];
    if (table === sales) return [{ id: 200, saleNumber: "POS-000200" }];
    if (table === saleItems) return [];
    return [];
  };
  const where = (table: unknown) => Object.assign([...rows(table)], { limit: async () => rows(table), for: () => ({ limit: async () => rows(table) }) });
  const db: Record<string, unknown> = {
    select: () => ({ from: (table: unknown) => ({ where: () => where(table) }) }),
    insert: () => ({ values: () => ({ returning: async () => [{ id: 1 }] }) }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
    delete: () => ({ where: async () => [] }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };
  return db;
}

describe("owner-managed role permissions", () => {
  beforeEach(() => getDbMock.mockReset());

  it("allows only the operational areas selected by the owner", () => {
    expect(customRoleCanAccess(["sales", "customers"], ["sales"])).toBe(true);
    expect(customRoleCanAccess(["sales", "customers"], ["inventory"])).toBe(false);
    expect(customRoleCanAccess(["payroll"], ["payroll"])).toBe(true);
  });

  it("requires the sales permission for a custom counter role", () => {
    expect(customRoleCanAccess(["sales"], ["sales"])).toBe(true);
    expect(customRoleCanAccess(["inventory"], ["sales"])).toBe(false);
  });

  it("does not let a dashboard-only role into inventory routes", () => {
    expect(customRoleCanAccess(["dashboard"], ["admin", "inventory"])).toBe(false);
  });

  it("allows inventory and sales roles to view the shared POS catalog", () => {
    expect(customRoleCanAccess(["inventory"], ["admin", "sales", "inventory"])).toBe(true);
    expect(customRoleCanAccess(["sales"], ["admin", "sales", "inventory"])).toBe(true);
    expect(customRoleCanAccess(["payroll"], ["admin", "sales", "inventory"])).toBe(false);
  });

  it("does not let a dashboard-only role into payroll routes", () => {
    expect(customRoleCanAccess(["dashboard"], ["admin", "payroll"])).toBe(false);
  });

  it("lets a custom role with the sales permission delete an invoice without being an admin", async () => {
    getDbMock.mockResolvedValue(makeInvoiceDeleteDb({ hasCustomRole: true, customRolePermissions: ["dashboard", "customers", "sales", "inventory", "payroll", "production"] }));
    const caller = erpRouter.createCaller(makeContext());
    await expect(caller.invoices.delete({ invoiceId: 100 })).resolves.toMatchObject({ invoiceNumber: "INV-000100", saleNumber: "POS-000200" });
  });

  it("blocks a custom role without the sales permission from deleting an invoice", async () => {
    getDbMock.mockResolvedValue(makeInvoiceDeleteDb({ hasCustomRole: true, customRolePermissions: ["payroll"] }));
    const caller = erpRouter.createCaller(makeContext());
    await expect(caller.invoices.delete({ invoiceId: 100 })).rejects.toThrow("Your owner-assigned role is not permitted to perform this action.");
  });

  it("still blocks the plain built-in Sales business role from deleting an invoice", async () => {
    getDbMock.mockResolvedValue(makeInvoiceDeleteDb({ hasCustomRole: false }));
    const caller = erpRouter.createCaller(makeContext());
    await expect(caller.invoices.delete({ invoiceId: 100 })).rejects.toThrow("Your assigned role is not permitted to perform this action.");
  });
});
