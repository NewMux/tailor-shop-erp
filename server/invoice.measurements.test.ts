import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoiceDeliveries, invoicePayments, invoices, measurementProfiles, sales, saleItems, shopSettings, tailoringOrders, userBusinessRoles } from "../drizzle/schema";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { appRouter } from "./routers";

function makeDetailDb(options: { includeMeasurementsOnInvoice?: boolean; measurementProfileId?: number | null } = {}) {
  const rowsFor = (table: unknown): unknown[] => {
    if (table === userBusinessRoles) return [{ id: 1, userId: 1, role: "admin", isActive: true }];
    if (table === invoices) return [{ id: 900, saleId: 700, invoiceNumber: "INV-000900", status: "paid" }];
    if (table === sales) return [{ id: 700, saleNumber: "POS-TO-700", total: "45.000" }];
    if (table === saleItems) return [{ id: 1, saleId: 700, nameSnapshot: "Thoub tailoring order", quantity: "1.000" }];
    if (table === tailoringOrders) return [{ dueDate: null, includeMeasurementsOnInvoice: options.includeMeasurementsOnInvoice ?? false, measurementProfileId: options.measurementProfileId ?? 9 }];
    if (table === measurementProfiles) return [{ id: 9, version: 3, fitPreference: "Slim", collarStyle: "Bahraini", pocketStyle: "2", measurementsJson: { lengthFL: "58" } }];
    if (table === shopSettings) return [{ shopName: "Al Hussam" }];
    if (table === invoiceDeliveries) return [];
    if (table === invoicePayments) return [];
    return [];
  };
  const chain = (table: unknown) => {
    const base = rowsFor(table);
    const asArray = (): unknown => Object.assign([...base], { limit: async () => base, orderBy: () => asArray() });
    return { where: () => asArray(), limit: async () => base, orderBy: () => asArray() };
  };
  return { select: () => ({ from: (table: unknown) => chain(table) }) };
}

describe("erp.invoices.detail measurements", () => {
  beforeEach(() => getDbMock.mockReset());

  it("includes the linked measurement version when the tailoring order opted in", async () => {
    getDbMock.mockResolvedValue(makeDetailDb({ includeMeasurementsOnInvoice: true, measurementProfileId: 9 }));
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.erp.invoices.detail({ invoiceId: 900 });

    expect(result.measurements).toMatchObject({ version: 3, fitPreference: "Slim", collarStyle: "Bahraini", pocketStyle: "2", values: { lengthFL: "58" } });
  });

  it("omits measurements when the tailoring order did not opt in", async () => {
    getDbMock.mockResolvedValue(makeDetailDb({ includeMeasurementsOnInvoice: false }));
    const caller = appRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.erp.invoices.detail({ invoiceId: 900 });

    expect(result.measurements).toBeNull();
  });
});
