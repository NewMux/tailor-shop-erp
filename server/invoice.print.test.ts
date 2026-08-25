import { afterEach, describe, expect, it, vi } from "vitest";
import { buildInvoicePrintDocument, writeInvoiceToPrintWindow } from "../client/src/lib/invoicePrint";

describe("invoice printing", () => {
  it("builds a self-contained print document without preview or banner content", () => {
    const document = buildInvoicePrintDocument({ shop: { shopName: "Al-Mamlaka Tailor", crNumber: "DEMO-2026" }, invoice: { invoiceNumber: "INV-000001", status: "paid", issuedAt: new Date("2026-08-14T10:00:00.000Z") }, sale: { saleNumber: "SALE-1", customerName: "Ahmed", paymentMethod: "benefitpay", subtotal: 45, discount: 0, total: 45 }, items: [{ name: "Bespoke Thobe", quantity: 1, unitPrice: 45, lineTotal: 45 }] });
    expect(document).toContain("INV-000001");
    expect(document).toContain("Bespoke Thobe");
    expect(document).toContain("CR: DEMO-2026");
    expect(document).not.toContain("This page is not live");
  });

  it("prints the full order total, paid amount, and remaining balance", () => {
    const document = buildInvoicePrintDocument({ shop: null, invoice: { invoiceNumber: "INV-000003", status: "partial", issuedAt: new Date("2026-08-14T10:00:00.000Z") }, sale: { saleNumber: "POS-TO-3", customerName: "Ahmed", paymentMethod: "cash", subtotal: 47, discount: 0, total: 47, paidAmount: 10, remainingAmount: 37 }, items: [{ name: "Bespoke Thobe", quantity: 1, unitPrice: 47, lineTotal: 47 }] });
    expect(document).toContain("BHD 47.000");
    expect(document).toContain("BHD 10.000");
    expect(document).toContain("BHD 37.000");
    expect(document).toContain("Remaining balance");
  });

  it("prints a payment receipt with the original invoice number and running payment balance", () => {
    const document = buildInvoicePrintDocument({ shop: null, invoice: { invoiceNumber: "INV-000004", status: "partial", issuedAt: new Date("2026-08-14T10:00:00.000Z") }, sale: { saleNumber: "TO-4", customerName: "Ahmed", paymentMethod: "cash", subtotal: 47, discount: 0, total: 47 }, items: [{ name: "Bespoke Thobe", quantity: 1, unitPrice: 47, lineTotal: 47 }], payment: { amount: 10, previouslyPaidAmount: 0, paidTotal: 10, remainingAmount: 37, paymentMethod: "cash", reference: "TO-4 initial payment", createdAt: new Date("2026-08-14T10:00:00.000Z") } });
    expect(document).toContain("Payment receipt");
    expect(document).toContain("INV-000004");
    expect(document).toContain("Previously paid");
    expect(document).toContain("This payment");
    expect(document).toContain("Paid total");
    expect(document).toContain("Remaining balance");
    expect(document.match(/BHD 47\.000/g)?.length).toBeGreaterThanOrEqual(1);
    expect(document.match(/BHD 10\.000/g)?.length).toBeGreaterThanOrEqual(2);
    expect(document.match(/BHD 37\.000/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("fills a POS-preopened print window with the issued invoice and invokes print", () => {
    const write = vi.fn();
    const print = vi.fn();
    vi.stubGlobal("window", { setTimeout: (callback: () => void) => { callback(); return 1; } });
    const printWindow = { closed: false, document: { open: vi.fn(), write, close: vi.fn() }, focus: vi.fn(), print } as unknown as Window;
    const opened = writeInvoiceToPrintWindow({ shop: null, invoice: { invoiceNumber: "INV-000002", status: "paid", issuedAt: new Date("2026-08-14T10:00:00.000Z") }, sale: { saleNumber: "POS-2", customerName: "Walk-in customer", paymentMethod: "cash", subtotal: 10, discount: 0, total: 10 }, items: [{ name: "Alteration", quantity: 1, unitPrice: 10, lineTotal: 10 }] }, printWindow);
    expect(opened).toBe(true);
    expect(write).toHaveBeenCalledWith(expect.stringContaining("INV-000002"));
    expect(print).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
