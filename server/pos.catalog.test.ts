import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocked.getDb }));

import { posRouter } from "./pos";
import { getPosAvailabilityLabel, getPosCustomerId, getPosCustomerLabel, getPosLineKey } from "../client/src/lib/posCatalog";
import { getTranslationSource } from "../client/src/lib/translation";

const query = (rows: unknown[]) => {
  const chain = {
    where: () => chain,
    orderBy: () => rows,
    limit: () => rows,
    leftJoin: () => chain,
    from: () => chain,
    groupBy: () => rows,
  };
  return chain;
};

describe("pos.catalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a service label for standalone services instead of a synthetic stock quantity", () => {
    expect(getPosAvailabilityLabel(false, 999999, "unit")).toBe("Service");
    expect(getPosAvailabilityLabel(true, 12.5, "Meters")).toBe("12.50 Meters");
  });

  it("uses one canonical customer selection for the id and visible label", () => {
    const selected = { id: 17, name: "Mohammed Ahmed" };
    expect(getPosCustomerId(selected)).toBe("17");
    expect(getPosCustomerLabel(selected)).toBe("Mohammed Ahmed");
    expect(getPosCustomerId(null)).toBe("");
    expect(getPosCustomerLabel(null)).toBe("Walk-in customer");
  });

  it("preserves React-updated text instead of reverting it to the previous translation", () => {
    expect(getTranslationSource("Ali", "Walk-in customer", "عميل حاضر")).toBe("Ali");
    expect(getTranslationSource("عميل حاضر", "Walk-in customer", "عميل حاضر")).toBe("Walk-in customer");
    expect(getTranslationSource("1 item in order", undefined, undefined)).toBe("1 item in order");
  });

  it("uses stable keys when adding catalog products to the cart", () => {
    expect(getPosLineKey({ catalogKey: "inventory:82", sourceLabel: "Inventory", inventoryItemId: 82, id: 82 })).toBe("inventory:82");
    expect(getPosLineKey({ sourceLabel: "Inventory", inventoryItemId: 82, id: 82 })).toBe("inventory:82");
    expect(getPosLineKey({ sourceLabel: "Service", serviceId: 4, id: 4 })).toBe("service:4");
  });

  it("returns active services and unlinked inventory as unique POS products", async () => {
    const serviceRows = [{
      service: { id: 4, sku: "THOBE-01", name: "Bespoke thobe", category: "tailoring", description: null, unitPrice: "45.000", defaultFabricMeters: "2.000", inventoryItemId: 81, isActive: true },
      inventory: { id: 81, code: "NAVY-01", name: "Navy cotton", quantity: "10.000", unit: "Meters", isActive: true },
    }];
    const inventoryRows = [
      { id: 81, code: "NAVY-01", name: "Navy cotton", category: "fabric", quantity: "10.000", unit: "Meters", costPerUnit: "7.500", isActive: true },
      { id: 82, code: "BUTTON-01", name: "Metal buttons", category: "accessory", quantity: "24.000", unit: "Pieces", costPerUnit: "0.750", isActive: true },
    ];
    const responses = [[{ userId: 1, role: "admin", isActive: true }], serviceRows, inventoryRows, []];
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
