import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocked.getDb }));

import { calculateExchangeSettlement, posRouter } from "./pos";

const query = (rows: unknown[]) => ({
  from: () => ({
    where: () => ({ orderBy: () => ({ limit: () => rows }), limit: () => rows, for: () => ({ limit: () => rows }) }),
    orderBy: () => ({ limit: () => rows }),
    limit: () => rows,
    innerJoin: () => ({ where: () => ({ limit: () => rows }) }),
  }),
});

describe("pos.checkout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates exchange refunds and balances in the correct direction", () => {
    expect(calculateExchangeSettlement(50, 35)).toEqual({ difference: -15, refundAmount: 15, amountDue: 0 });
    expect(calculateExchangeSettlement(50, 65)).toEqual({ difference: 15, refundAmount: 0, amountDue: 15 });
    expect(calculateExchangeSettlement(50, 50)).toEqual({ difference: 0, refundAmount: 0, amountDue: 0 });
  });

  it("persists the live-mapped line, linked stock update, and invoice within the sale transaction", async () => {
    const writes: unknown[] = [];
    const stockUpdates: unknown[] = [];
    const transactionSelectRows = [[{ id: 1, status: "open" }], [{ id: 4, name: "Navy cotton", inventoryItemId: 81, defaultFabricMeters: "2.000", unitPrice: "45.000", isActive: true }], [{ id: 81, name: "Navy cotton", quantity: "4.000", unit: "Meters", isActive: true }]];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); return { returning: () => [{ id: writes.length === 1 ? 701 : 1 }] }; }) })),
      select: vi.fn(() => query(transactionSelectRows.shift() || [])),
      update: vi.fn(() => ({ set: vi.fn((value: unknown) => { stockUpdates.push(value); return { where: vi.fn() }; }) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = {
      select: vi.fn(() => query(rootResponses.shift() || [])),
      insert: vi.fn(() => ({ values: vi.fn() })),
      transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)),
    };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.checkout({
      sessionId: 1,
      customerName: "Counter client",
      customerPhone: "+973 3000 1000",
      discount: 0,
      paymentMethod: "benefitpay",
      paymentStatus: "paid",
      items: [{ serviceId: 4, inventoryItemId: 81, name: "Navy cotton", quantity: 1, unitPrice: 45 }],
    });

    expect(result).toMatchObject({ id: 701, invoiceId: 1, total: 45 });
    expect(writes).toHaveLength(5);
    expect(writes[1]).toMatchObject({ saleId: 701, serviceId: 4, inventoryItemId: 81, lineTotal: "45.000", assignedTailorId: null, measurementProfileId: null });
    expect(stockUpdates).toEqual([{ quantity: "2.000" }]);
    expect(writes[2]).toMatchObject({ inventoryItemId: 81, movementType: "sale", referenceId: 701, quantityChange: "-2.000", quantityAfter: "2.000" });
    expect(writes[3]).toMatchObject({ saleId: 701, method: "benefitpay", amount: "45.000" });
    expect(writes[4]).toMatchObject({ saleId: 701, invoiceNumber: "POS-000701", status: "paid" });
  });

  it("attaches a replayed checkout without a client session to the resolved open POS session", async () => {
    const writes: unknown[] = [];
    const transactionSelectRows = [[{ id: 77, status: "open" }], [{ id: 4, name: "Navy cotton", inventoryItemId: null, defaultFabricMeters: null, unitPrice: "45.000", isActive: true }]];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); return { returning: () => [{ id: writes.length === 1 ? 703 : 3 }] }; }) })),
      select: vi.fn(() => query(transactionSelectRows.shift() || [])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [], [{ invoicePrefix: "POS" }]];
    const rootDb = {
      select: vi.fn(() => query(rootResponses.shift() || [])),
      insert: vi.fn(() => ({ values: vi.fn() })),
      transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)),
    };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    await caller.checkout({ clientReference: "offline-session-test", customerName: "Offline client", discount: 0, paymentMethod: "cash", paymentStatus: "paid", items: [{ serviceId: 4, name: "Navy cotton", quantity: 1, unitPrice: 45 }] });

    expect(writes[0]).toMatchObject({ clientReference: "offline-session-test", sessionId: 77 });
  });

  it("sells a live inventory material directly without a catalog service dependency", async () => {
    const writes: unknown[] = [];
    const stockUpdates: unknown[] = [];
    const transactionSelectRows = [[{ id: 1, status: "open" }], [{ id: 30001, name: "Navy Premium Cotton", quantity: "16.000", unit: "Meters", costPerUnit: "7.500", isActive: true }]];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); return { returning: () => [{ id: writes.length === 1 ? 702 : 2 }] }; }) })),
      select: vi.fn(() => query(transactionSelectRows.shift() || [])),
      update: vi.fn(() => ({ set: vi.fn((value: unknown) => { stockUpdates.push(value); return { where: vi.fn() }; }) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = { select: vi.fn(() => query(rootResponses.shift() || [])), insert: vi.fn(() => ({ values: vi.fn() })), transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)) };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.checkout({ sessionId: 1, customerName: "Walk-in customer", discount: 0, paymentMethod: "cash", paymentStatus: "paid", items: [{ inventoryItemId: 30001, name: "Navy Premium Cotton", quantity: 2, unitPrice: 9 }] });

    expect(result).toMatchObject({ id: 702, invoiceId: 2, total: 18 });
    expect(writes[1]).toMatchObject({ saleId: 702, serviceId: null, inventoryItemId: 30001, nameSnapshot: "Navy Premium Cotton", unitPrice: "9.000", lineTotal: "18.000" });
    expect(stockUpdates).toEqual([{ quantity: "14.000" }]);
    expect(writes[2]).toMatchObject({ inventoryItemId: 30001, movementType: "sale", quantityChange: "-2.000", quantityAfter: "14.000" });
  });

  it("blocks a signed-in user whose business access is still pending", async () => {
    const rootDb = { select: vi.fn(() => query([])), insert: vi.fn() };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 99, role: "user" } } as never);

    await expect(caller.catalog.list()).rejects.toThrow("pending owner approval");
    expect(rootDb.insert).not.toHaveBeenCalled();
  });

  it("creates a confirmed tailoring order, deposit sale, linked sale line, and invoice atomically from POS", async () => {
    const writes: unknown[] = [];
    const transactionResponses = [
      [{ id: 1, status: "open" }],
      [{ id: 44, name: "[DEMO] Ahmed Al-Hassan", phone: "+973 3330 0011" }],
      [{ id: 9, customerId: 44, version: 1 }],
      [{ id: 7, name: "[DEMO] Khalid Tailor", isActive: true }],
    ];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); const insertIds = [811, 712, 900, 901, 902, 43]; return { returning: () => [{ id: insertIds[writes.length - 1] }] }; }) })),
      select: vi.fn(() => query(transactionResponses.shift() || [])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = {
      select: vi.fn(() => query(rootResponses.shift() || [])),
      insert: vi.fn(() => ({ values: vi.fn() })),
      transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)),
    };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.tailoringCheckout({
      sessionId: 1,
      customerId: 44,
      measurementProfileId: 9,
      assignedTailorId: 7,
      garmentType: "Thoub",
      quantity: 1,
      dueDate: "2026-09-01",
      orderPrice: 45,
      paymentAmount: 20,
      paymentMethod: "benefitpay",
      notes: "[DEMO] Counter thoub order",
      productionNotes: "[DEMO] Begin after fabric selection.",
    });

    expect(result).toMatchObject({ orderId: 811, saleId: 712, invoiceId: 902, total: 20, paymentStatus: "partial" });
    expect(writes).toHaveLength(6);
    expect(writes[0]).toMatchObject({ customerId: 44, measurementProfileId: 9, assignedTailorId: 7, garmentType: "Thoub", status: "confirmed", price: "45.000" });
    expect(writes[1]).toMatchObject({ customerId: 44, subtotal: "45.000", total: "45.000", paidAmount: "20.000", paymentStatus: "partial" });
    expect(writes[2]).toMatchObject({ saleId: 712, method: "benefitpay", amount: "20.000" });
    expect(writes[3]).toMatchObject({ saleId: 712, serviceId: null, inventoryItemId: null, assignedTailorId: 7, measurementProfileId: 9, lineTotal: "45.000" });
    expect(writes[4]).toMatchObject({ saleId: 712, invoiceNumber: "POS-000712", status: "partial" });
    expect(writes[5]).toMatchObject({ invoiceId: 902, amount: "20.000", paymentMethod: "benefitpay", previousPaidAmount: "0.000", paidTotal: "20.000", remainingAmount: "25.000" });
  });

  it("links a catalog tailoring service to the production sale and deducts linked shop fabric", async () => {
    const writes: unknown[] = [];
    const stockUpdates: unknown[] = [];
    const transactionResponses = [
      [{ id: 1, status: "open" }],
      [{ id: 44, name: "[DEMO] Ahmed Al-Hassan", phone: "+973 3330 0011" }],
      [{ id: 9, customerId: 44, version: 1 }],
      [{ id: 7, name: "[DEMO] Khalid Tailor", isActive: true }],
      [{ id: 4, name: "[DEMO] Thobe service", inventoryItemId: 81, defaultFabricMeters: "2.000", isActive: true }],
      [{ id: 81, name: "[DEMO] Navy cotton", quantity: "4.000", unit: "Meters", isActive: true }],
    ];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); const insertIds = [811, 712, 900, 901, 902, 43]; return { returning: () => [{ id: insertIds[writes.length - 1] }] }; }) })),
      select: vi.fn(() => query(transactionResponses.shift() || [])),
      update: vi.fn(() => ({ set: vi.fn((value: unknown) => { stockUpdates.push(value); return { where: vi.fn() }; }) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = { select: vi.fn(() => query(rootResponses.shift() || [])), insert: vi.fn(() => ({ values: vi.fn() })), transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)) };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.tailoringCheckout({ sessionId: 1, customerId: 44, measurementProfileId: 9, assignedTailorId: 7, serviceId: 4, garmentType: "Thoub", quantity: 1, dueDate: "2026-09-01", orderPrice: 45, paymentAmount: 20, paymentMethod: "benefitpay", notes: "[DEMO] Connected service order", productionNotes: "[DEMO] Deduct shop fabric." });

    expect(result).toMatchObject({ orderId: 811, saleId: 712, invoiceId: 43 });
    expect(writes[1]).toMatchObject({ total: "45.000", paidAmount: "20.000" });
    expect(writes[3]).toMatchObject({ saleId: 712, serviceId: 4, inventoryItemId: 81, assignedTailorId: 7, measurementProfileId: 9, quantity: "1.000", lineTotal: "45.000" });
    expect(stockUpdates).toEqual([{ saleId: 712 }, { quantity: "2.000" }]);
    expect(writes[4]).toMatchObject({ inventoryItemId: 81, movementType: "sale", referenceType: "tailoring_order", referenceId: 811, quantityChange: "-2.000", quantityAfter: "2.000" });
  });

  it("creates an unpaid tailoring order when the collected amount is zero", async () => {
    const writes: unknown[] = [];
    const transactionResponses = [
      [{ id: 1, status: "open" }],
      [{ id: 44, name: "Test customer", phone: null }],
      [{ id: 9, customerId: 44, version: 1 }],
      [{ id: 7, name: "Test tailor", isActive: true }],
    ];
    const transactionDb = {
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { writes.push(value); const insertIds = [811, 712, 901, 902]; return { returning: () => [{ id: insertIds[writes.length - 1] }] }; }) })),
      select: vi.fn(() => query(transactionResponses.shift() || [])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    };
    const rootResponses = [[{ userId: 1, role: "admin", isActive: true }], [{ invoicePrefix: "POS" }]];
    const rootDb = {
      select: vi.fn(() => query(rootResponses.shift() || [])),
      insert: vi.fn(() => ({ values: vi.fn() })),
      transaction: vi.fn(async (callback: (tx: typeof transactionDb) => Promise<unknown>) => callback(transactionDb)),
    };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.tailoringCheckout({ sessionId: 1, customerId: 44, measurementProfileId: 9, assignedTailorId: 7, garmentType: "Thoub", quantity: 1, orderPrice: 45, paymentAmount: 0, paymentMethod: "cash", notes: "", productionNotes: "" });

    expect(result).toMatchObject({ orderId: 811, saleId: 712, invoiceId: 902, total: 0, paymentStatus: "unpaid" });
    expect(writes).toHaveLength(4);
    expect(writes[1]).toMatchObject({ subtotal: "45.000", total: "45.000", paidAmount: "0.000", paymentStatus: "unpaid" });
    expect(writes[2]).toMatchObject({ saleId: 712, lineTotal: "45.000", nameSnapshot: expect.stringContaining("unpaid") });
    expect(writes[3]).toMatchObject({ saleId: 712, status: "unpaid" });
  });

  it("returns the existing connected tailoring transaction on a retried client reference", async () => {
    const rootResponses = [
      [{ userId: 1, role: "admin", isActive: true }],
      [{ saleId: 712, invoiceId: 43, saleNumber: "POS-000712", total: "20.000", paidAmount: "20.000", paymentStatus: "paid" }],
      [{ orderNumber: "TO-000811" }],
    ];
    const rootDb = {
      select: vi.fn(() => query(rootResponses.shift() || [])),
      insert: vi.fn(),
      transaction: vi.fn(),
    };
    mocked.getDb.mockResolvedValue(rootDb);
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);

    const result = await caller.tailoringCheckout({ clientReference: "retry-tailor-1", sessionId: 1, customerId: 44, measurementProfileId: 9, assignedTailorId: 7, garmentType: "Thoub", quantity: 1, orderPrice: 45, paymentAmount: 20, paymentMethod: "cash", notes: "", productionNotes: "" });

    expect(result).toMatchObject({ id: 712, invoiceId: 43, orderNumber: "TO-000811", total: 20, paymentStatus: "paid" });
    expect(rootDb.transaction).not.toHaveBeenCalled();
    expect(rootDb.insert).not.toHaveBeenCalled();
  });

  it("rejects a tailoring payment that exceeds the quoted order price before creating records", async () => {
    const caller = posRouter.createCaller({ user: { id: 1, role: "admin" } } as never);
    await expect(caller.tailoringCheckout({ sessionId: 1, customerId: 1, measurementProfileId: 1, assignedTailorId: 1, garmentType: "Thoub", quantity: 1, orderPrice: 45, paymentAmount: 46, paymentMethod: "cash", notes: "", productionNotes: "" })).rejects.toThrow("The payment collected cannot exceed the quoted order price.");
  });
});
