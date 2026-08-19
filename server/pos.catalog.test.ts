import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocked.getDb }));

import { posRouter } from "./pos";

const query = (rows: unknown[]) => {
  const chain = {
    where: () => chain,
    orderBy: () => rows,
    limit: () => rows,
    leftJoin: () => chain,
    from: () => chain,
  };
  return chain;
};

describe("pos.catalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active services and unlinked inventory as unique POS products", async () => {
    const serviceRows = [{
      service: { id: 4, sku: "THOBE-01", name: "Bespoke thobe", category: "tailoring", description: null, unitPrice: "45.000", defaultFabricMeters: "2.000", inventoryItemId: 81, isActive: true },
      inventory: { id: 81, code: "NAVY-01", name: "Navy cotton", quantity: "10.000", unit: "Meters", isActive: true },
    }];
    const inventoryRows = [
      { id: 81, code: "NAVY-01", name: "Navy cotton", category: "fabric", quantity: "10.000", unit: "Meters", costPerUnit: "7.500", isActive: true },
      { id: 82, code: "BUTTON-01", name: "Metal buttons", category: "accessory", quantity: "24.000", unit: "Pieces", costPerUnit: "0.750", isActive: true },
    ];
    const responses = [[{ userId: 1, role: "admin", isActive: true }], serviceRows, inventoryRows];
    const db = { select: vi.fn(() => query(responses.shift() || [])) };
    mocked.getDb.mockResolvedValue(db);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.catalog.list();

    expect(result).toEqual([
      expect.objectContaining({ catalogKey: "service:4", kind: "service", serviceId: 4, inventoryItemId: 81, unitPrice: "45.000" }),
      expect.objectContaining({ catalogKey: "inventory:82", kind: "inventory", serviceId: null, inventoryItemId: 82, unitPrice: "0.750" }),
    ]);
    expect(new Set(result.map(item => item.catalogKey)).size).toBe(result.length);
  });
});

it("calculates a payment total from every cart item", async () => {
  const { calculateCheckoutTotal } = await import("./pos");
  expect(calculateCheckoutTotal([{ quantity: 2, unitPrice: 12.5 }, { quantity: 1, unitPrice: 7.25 }], 0)).toEqual({ subtotal: 32.25, total: 32.25 });
});
