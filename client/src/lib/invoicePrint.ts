import { clientBrand } from "@/lib/branding";
import { getStoredLanguage, translateCopy } from "@/contexts/LanguageContext";
import { measurementFields } from "@/lib/measurements";

export type InvoicePrintPayload = {
  shop: { shopName: string; arabicShopName?: string | null; crNumber?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null; address?: string | null; invoiceTerms?: string | null } | null;
  invoice: { invoiceNumber: string; status: string; issuedAt: Date | string; readyBy?: Date | string | null; notes?: string | null };
  sale: { saleNumber: string; customerName: string; customerPhone?: string | null; paymentMethod: string; subtotal: number | string; discount: number | string; vatRate?: number | string | null; vatAmount?: number | string | null; total: number | string; paidAmount?: number | string | null; remainingAmount?: number | string | null };
  items: Array<{ name: string; quantity: number | string; unitPrice: number | string; lineTotal: number | string }>;
  payment?: { amount: number | string; previouslyPaidAmount: number | string; paidTotal: number | string; remainingAmount: number | string; paymentMethod?: string | null; reference?: string | null; createdAt?: Date | string };
  measurements?: { version: number; fitPreference?: string | null; collarStyle?: string | null; pocketStyle?: string | null; values: Record<string, string> } | null;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
const paymentLabels: Record<string, string> = { cash: "Cash", card: "Card", credit_card: "Card", benefitpay: "BenefitPay", bank_transfer: "Bank transfer", split: "Split payment" };

export function buildInvoicePrintDocument(payload: InvoicePrintPayload, format: "a4" | "receipt" = "a4") {
  const language = getStoredLanguage();
  const isArabic = language === "ar";
  const label = (value: string) => escapeHtml(translateCopy(value, language));
  const money = (value: number | string) => `${isArabic ? "د.ب" : "BHD"} ${Number(value || 0).toFixed(3)}`;
  const issuedDate = (value: Date | string) => new Date(value).toLocaleString(isArabic ? "ar-BH" : "en-BH", { dateStyle: "medium", timeStyle: "short" });
  const shopName = isArabic ? payload.shop?.arabicShopName || payload.shop?.shopName || clientBrand.name : payload.shop?.shopName || clientBrand.name;
  const paymentReceipt = payload.payment;
  const paymentMethod = String(paymentReceipt?.paymentMethod || payload.sale.paymentMethod).replace("_", " ").toLowerCase();
  const localizedPayment = isArabic ? translateCopy(paymentLabels[paymentMethod] || paymentMethod, language) : paymentLabels[paymentMethod] || paymentMethod;
  const paymentDate = paymentReceipt?.createdAt ? new Date(paymentReceipt.createdAt).toLocaleString(isArabic ? "ar-BH" : "en-BH", { dateStyle: "medium", timeStyle: "short" }) : null;
  const readyBy = payload.invoice.readyBy ? new Date(payload.invoice.readyBy).toLocaleDateString(isArabic ? "ar-BH" : "en-BH", { dateStyle: "medium" }) : null;
  const browserOrigin = typeof window !== "undefined" && typeof window.location?.origin === "string" ? window.location.origin : "";
  const logoUrl = browserOrigin ? new URL(clientBrand.logoSrc, browserOrigin).toString() : clientBrand.logoSrc;
  const itemRows = payload.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td class="numeric">${escapeHtml(item.quantity)}</td><td class="numeric">${money(item.unitPrice)}</td><td class="numeric strong">${money(item.lineTotal)}</td></tr>`).join("");
  const measurements = payload.measurements;
  const measurementCells = measurements ? [
    measurements.fitPreference ? { label: "Fit preference", value: measurements.fitPreference } : null,
    measurements.collarStyle ? { label: "Collar style", value: measurements.collarStyle } : null,
    measurements.pocketStyle ? { label: "Pocket style", value: measurements.pocketStyle } : null,
    ...measurementFields.map(field => { const value = measurements.values?.[field.key]; return value && String(value).trim() ? { label: field.label, value: String(value) } : null; }),
  ].filter((cell): cell is { label: string; value: string } => Boolean(cell)) : [];
  const measurementsSection = measurements && measurementCells.length ? `<section class="measurements"><p class="label">${label("Measurements")} (${label("version")} ${measurements.version})</p><div class="measurement-grid">${measurementCells.map(cell => `<div class="measurement-cell"><span class="measurement-label">${escapeHtml(cell.label)}</span><span class="measurement-value">${escapeHtml(cell.value)}</span></div>`).join("")}</div></section>` : "";
  return `<!doctype html><html lang="${language}" dir="${isArabic ? "rtl" : "ltr"}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(payload.invoice.invoiceNumber)}</title><style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17253a; background: #fff; direction: ${isArabic ? "rtl" : "ltr"}; font-family: "Noto Sans Arabic", Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.45; }
    .invoice { width: 100%; max-width: 180mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 26px; padding-bottom: 20px; border-bottom: 2px solid #1f496d; }
    .brand { min-width: 0; } .brand-row { display: flex; align-items: center; gap: 14px; } .logo { width: 86px; height: 86px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; object-fit: contain; }
    h1 { margin: 0; font-size: 21px; } h2 { margin: 0; color: #1f496d; font-size: 22px; letter-spacing: .06em; text-transform: uppercase; }
    .arabic, .muted { color: #64748b; } .ready-by { margin: 8px 0 0; color: #1f496d; } .contact { margin-top: 12px; color: #475569; } .contact div { margin: 2px 0; }
    .invoice-meta { min-width: 180px; text-align: end; } .invoice-meta p { margin: 4px 0; } .badge { display: inline-block; margin-top: 8px; padding: 4px 8px; border-radius: 999px; background: #e9f4ec; color: #17603a; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 22px 0; } .party:last-child { text-align: end; } .label { margin-bottom: 6px; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; } .party strong { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; } th { padding: 10px 8px; background: #eef2f6; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; color: #475569; font-size: 10px; letter-spacing: .08em; text-align: start; text-transform: uppercase; } td { padding: 11px 8px; border-bottom: 1px solid #e2e8f0; } .numeric { direction: ltr; text-align: end; white-space: nowrap; } .strong { font-weight: 700; }
    .totals { width: 230px; margin: 20px 0 0 auto; } .total-row { display: flex; justify-content: space-between; gap: 24px; padding: 5px 0; } .grand-total { margin-top: 7px; padding-top: 9px; border-top: 2px solid #1f496d; color: #1f496d; font-size: 16px; font-weight: 700; }
    .note { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; } .thanks { margin-top: 20px; color: #64748b; font-size: 11px; text-align: center; }
    .measurements { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e2e8f0; } .measurement-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px; margin-top: 10px; } .measurement-cell { font-size: 11px; } .measurement-label { display: block; color: #64748b; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; } .measurement-value { display: block; margin-top: 2px; font-weight: 600; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body><main class="invoice"><header class="header"><section class="brand"><div class="brand-row"><img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(clientBrand.logoAlt)}" loading="eager" decoding="sync" /><div><h1>${escapeHtml(shopName)}</h1>${!isArabic && payload.shop?.arabicShopName ? `<div class="arabic">${escapeHtml(payload.shop.arabicShopName)}</div>` : ""}<div class="contact">${payload.shop?.address ? `<div>${escapeHtml(payload.shop.address)}</div>` : ""}${payload.shop?.phone ? `<div>${escapeHtml(payload.shop.phone)}</div>` : ""}${payload.shop?.email ? `<div>${escapeHtml(payload.shop.email)}</div>` : ""}${payload.shop?.crNumber ? `<div>${label("CR")}: ${escapeHtml(payload.shop.crNumber)}</div>` : ""}${payload.shop?.vatNumber ? `<div>${label("VAT registration number")}: ${escapeHtml(payload.shop.vatNumber)}</div>` : ""}</div></div></section><section class="invoice-meta"><h2>${label(paymentReceipt ? "Payment receipt" : "Invoice")}</h2><p><strong>${escapeHtml(payload.invoice.invoiceNumber)}</strong></p><p class="muted">${label(paymentReceipt ? "Payment date" : "Issued")} ${escapeHtml(paymentDate || issuedDate(payload.invoice.issuedAt))}</p>${readyBy ? `<p class="ready-by"><strong>${label("Ready By")}</strong> ${escapeHtml(readyBy)}</p>` : ""}<span class="badge">${escapeHtml(payload.invoice.status)}</span></section></header><section class="parties"><div class="party"><div class="label">${label("Bill to")}</div><strong>${escapeHtml(payload.sale.customerName)}</strong><div class="muted">${escapeHtml(payload.sale.customerPhone || label("No phone recorded"))}</div></div><div class="party"><div class="label">${label("Payment")}</div><strong>${escapeHtml(localizedPayment)}</strong><div class="muted">${label("Sale reference")}: ${escapeHtml(payload.sale.saleNumber)}</div></div></section><table><thead><tr><th>${label("Description")}</th><th class="numeric">${label("Qty")}</th><th class="numeric">${label("Unit price")}</th><th class="numeric">${label("Line total")}</th></tr></thead><tbody>${itemRows}</tbody></table><section class="totals"><div class="total-row"><span>${label("Subtotal")}</span><span>${money(payload.sale.subtotal)}</span></div><div class="total-row"><span>${label("Discount")}</span><span>${money(payload.sale.discount)}</span></div>${Number(payload.sale.vatAmount || 0) > 0 ? `<div class="total-row"><span>${label("VAT")}${payload.sale.vatRate ? ` (${escapeHtml(Number(payload.sale.vatRate).toFixed(3).replace(/\.000$/, ""))}%)` : ""}</span><span>${money(payload.sale.vatAmount || 0)}</span></div>` : ""}<div class="total-row grand-total"><span>${label("Total")}</span><span>${money(payload.sale.total)}</span></div>${paymentReceipt ? `<div class="total-row"><span>${label("Previously paid")}</span><span>${money(paymentReceipt.previouslyPaidAmount)}</span></div><div class="total-row"><span>${label("This payment")}</span><span>${money(paymentReceipt.amount)}</span></div><div class="total-row"><span>${label("Paid total")}</span><span>${money(paymentReceipt.paidTotal)}</span></div><div class="total-row"><span>${label("Remaining balance")}</span><span>${money(paymentReceipt.remainingAmount)}</span></div>` : payload.sale.paidAmount !== undefined ? `<div class="total-row"><span>${label("Paid")}</span><span>${money(payload.sale.paidAmount || 0)}</span></div><div class="total-row"><span>${label("Remaining balance")}</span><span>${money(payload.sale.remainingAmount ?? Number(payload.sale.total || 0) - Number(payload.sale.paidAmount || 0))}</span></div>` : ""}</section>${paymentReceipt?.reference ? `<p class="note"><strong>${label("Payment reference")}</strong><br />${escapeHtml(paymentReceipt.reference)}</p>` : ""}${payload.invoice.notes ? `<p class="note">${escapeHtml(payload.invoice.notes)}</p>` : ""}${payload.shop?.invoiceTerms ? `<section class="note"><strong>${label("Terms and conditions")}</strong><br />${escapeHtml(payload.shop.invoiceTerms).replace(/\n/g, "<br />")}</section>` : ""}${measurementsSection}<p class="thanks">${label("Thank you for your business.")}</p></main></body></html>`;
}

export function writeInvoiceToPrintWindow(payload: InvoicePrintPayload, printWindow: Window | null, format: "a4" | "receipt" = "a4") {
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(buildInvoicePrintDocument(payload, format));
  printWindow.document.close();
  let printed = false;
  const triggerPrint = () => {
    if (printed || printWindow.closed) return;
    printed = true;
    printWindow.focus();
    printWindow.print();
  };
  const logo = typeof printWindow.document.querySelector === "function" ? printWindow.document.querySelector<HTMLImageElement>("img.logo") : null;
  if (logo && !logo.complete) {
    logo.addEventListener("load", triggerPrint, { once: true });
    logo.addEventListener("error", triggerPrint, { once: true });
    window.setTimeout(triggerPrint, 1500);
  } else {
    window.setTimeout(triggerPrint, 250);
  }
  return true;
}

export function openInvoicePrintWindow(payload: InvoicePrintPayload, format: "a4" | "receipt" = "a4") {
  return writeInvoiceToPrintWindow(payload, window.open("", "_blank", "popup,width=900,height=720"), format);
}

export function openInvoiceReceiptPrintWindow(payload: InvoicePrintPayload) {
  return openInvoicePrintWindow(payload, "receipt");
}
