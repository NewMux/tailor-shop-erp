import { describe, expect, it } from "vitest";
import { customRoleCanAccess } from "./erp";

describe("owner-managed role permissions", () => {
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
});
