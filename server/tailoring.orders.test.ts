import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs, customers, measurementProfiles, staffProfiles, tailoringOrders, userBusinessRoles, userCustomRoles } from "../drizzle/schema";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { erpRouter } from "./erp";

const actor = { id: 77, openId: "owner", name: "Owner", email: "owner@example.com", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

function makeContext() {
  return { user: actor, req: { protocol: "https", headers: {} }, res: {} } as never;
}

function makeDb(options: { measurementCustomerId?: number; tailorActive?: boolean; currentStatus?: string } = {}) {
  const updates: unknown[] = [];
  const rows = (table: unknown) => {
    if (table === userBusinessRoles) return [{ id: 1, userId: actor.id, role: "sales", isActive: true }];
    if (table === userCustomRoles) return [];
    if (table === customers) return [{ id: 8, name: "Customer", phone: "33300011" }];
    if (table === measurementProfiles) return [{ id: 12, customerId: options.measurementCustomerId ?? 8, version: 2 }];
    if (table === staffProfiles) return [{ id: 6, isActive: options.tailorActive ?? true, name: "Tailor" }];
    if (table === tailoringOrders) return [{ id: 44, status: options.currentStatus ?? "ready" }];
    return [];
  };
  const db = {
    select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => rows(table) }), orderBy: async () => rows(table) }) }),
    insert: (table: unknown) => ({ values: () => ({ returning: async () => [{ id: table === tailoringOrders ? 501 : 1 }] }) }),
    update: () => ({ set: (value: unknown) => ({ where: async () => { updates.push(value); return []; } }) }),
  };
  return { db, updates };
}

describe("tailoring order procedures", () => {
  beforeEach(() => getDbMock.mockReset());

  it("creates a confirmed thoub order only when the measurement belongs to the chosen customer and the tailor is active", async () => {
    const { db } = makeDb(); getDbMock.mockResolvedValue(db);
    const caller = erpRouter.createCaller(makeContext());
    const result = await caller.tailoring.create({ customerId: 8, measurementProfileId: 12, assignedTailorId: 6, garmentType: "Thoub", quantity: 1, dueDate: "2026-08-28", price: 45, notes: "Classic fit", productionNotes: "" });
    expect(result).toMatchObject({ id: 501 });
    await expect(caller.tailoring.create({ customerId: 8, measurementProfileId: 12, assignedTailorId: 6, garmentType: "Thoub", quantity: 1, dueDate: "2026-08-28", price: 45, notes: "Classic fit", productionNotes: "" })).resolves.toMatchObject({ id: 501 });
  });

  it("rejects a measurement from a different customer and an inactive assigned tailor", async () => {
    const measurementMismatch = makeDb({ measurementCustomerId: 9 }); getDbMock.mockResolvedValue(measurementMismatch.db);
    const caller = erpRouter.createCaller(makeContext());
    await expect(caller.tailoring.create({ customerId: 8, measurementProfileId: 12, assignedTailorId: 6, garmentType: "Thoub", quantity: 1, dueDate: "", price: 0, notes: "", productionNotes: "" })).rejects.toThrow("measurement version");
    const inactiveTailor = makeDb({ tailorActive: false }); getDbMock.mockResolvedValue(inactiveTailor.db);
    await expect(caller.tailoring.create({ customerId: 8, measurementProfileId: 12, assignedTailorId: 6, garmentType: "Thoub", quantity: 1, dueDate: "", price: 0, notes: "", productionNotes: "" })).rejects.toThrow("active tailor");
  });

  it("allows a direct stage selection and persists the production update", async () => {
    const valid = makeDb({ currentStatus: "ready" }); getDbMock.mockResolvedValue(valid.db);
    const caller = erpRouter.createCaller(makeContext());
    await expect(caller.tailoring.update({ id: 44, assignedTailorId: 6, status: "handed_over", dueDate: "2026-08-28", productionNotes: "Collected by customer" })).resolves.toEqual({ success: true });
    expect(valid.updates).toHaveLength(1);
    const direct = makeDb({ currentStatus: "confirmed" }); getDbMock.mockResolvedValue(direct.db);
    await expect(caller.tailoring.update({ id: 44, assignedTailorId: 6, status: "handed_over", dueDate: "", productionNotes: "" })).resolves.toEqual({ success: true });
    expect(direct.updates).toHaveLength(1);
  });
});
