# Handover Findings Log

## Authentication, access, and navigation

The production shell loaded successfully at the current Vercel deployment and presented the expected staff sign-in boundary. Because no authorized browser session was available, protected navigation could not be clicked live during this run. The application’s route map and layout were verified in source: Overview, Customers, Inventory, Tailoring Orders, Point of Sale, Sales History, Invoices, Staff & Payroll, Shop Settings, and Audit Trail are registered in `client/src/App.tsx` and exposed by `DashboardLayout.tsx`.

The custom-role regression suite passed. A dashboard-only custom role is denied inventory and payroll routes; inventory and sales roles can view the shared POS catalog; and admin remains the broad bypass path. The automated authentication callback tests also pass, including expired OTP-link handling.

## Baseline validation

`pnpm check` passed. The full Vitest suite passed with 49 tests across 12 files. No TypeScript or regression defect was exposed by the baseline run. The production build remains a final gate after the handover audit and any repair.

## Live test limitation

Protected live workflows remain pending operator execution because the available browser is unauthenticated and the user cannot take over the browser. The final manual will include an explicit operator checklist for sign-in and each protected workflow rather than presenting source-level verification as live execution.

## POS and customer/cart audit

The POS has three explicit modes: New sale, Tailoring order, and Return. Customer state is held in `selectedCustomer`, with `customerId` derived from that state; Walk-in is represented by a null customer. The catalog combines service and inventory records, and catalog cards support normal sale selection plus a service-to-tailoring handoff. The tailoring handoff carries the selected service, customer, price, and payment amount into the tailoring form.

The POS supports keyboard-first operation through `/` or Ctrl/Cmd+K search, F2 payment, F4 walk-in amount, F8 saved orders, F9 customer picker, Enter to apply numeric editing, Escape to close panels, and Ctrl/Cmd+Enter to complete payment. Direct quantity, price, discount, and payment amount fields are retained alongside the keypad. Offline checkout is queued in the browser when `navigator.onLine` is false and the layout shows pending synchronization state.

The source audit did not expose a definite defect in these paths. One live-browser check remains required: select a real customer, add two catalog items, alter quantity/amount with keyboard input, complete a partial or full payment, print the invoice, and confirm the customer name and cart count update immediately.

## Password recovery migration

The deployment now uses a local password-reset token stored as a SHA-256 digest in PostgreSQL. Recovery links open the dedicated **Set a new password** screen before the ERP workspace is rendered. Tokens expire after one hour, are invalidated after use, and are replaced when a newer link is generated.

Users carried over from the former hosted authentication system receive no imported password hash. The operator must run `pnpm auth:reset-links`, deliver each matching link privately, and delete the generated file after delivery. Automated validation covers the new query-token callback helper; the full protected workflow still requires an authenticated operator session.

## Operational workflow audit

- Returns mode accepts a receipt number, customer name, or phone; it supports item returns, full or partial amount refunds, and exchanges. Item returns restore eligible stock. Exchanges restore the original item, sell the replacement from the unified catalog, and settle only the price difference. Amount refunds require a reason. The live browser workflow remains pending because no authenticated session was available.
- Inventory supports material quantities with explicit units, including meter-based fabric stock, and sellable inventory variants with size, color, and price data. The POS catalog combines active services and sellable inventory. Service records may optionally link to a material and default fabric-meter consumption.
- Payroll calculates gross salary, manual deductions, automatic absence and half-day deductions, performance bonuses, and net salary before payout creation. The payslip history shows the breakdown and provides a print action. Attendance records drive the automatic deduction calculation.
- Staff records include attendance, payroll, documents, and access-management flows. Staff documents can be uploaded, opened, and selected as supporting certificates for absence records. Staff access approval uses owner-managed custom roles and the custom-role permission-bypass regression is covered by automated tests.
- POS register status is no longer displayed as a persistent bar. Session open/close and end-of-day modal code remains present, while normal checkout resolves the active session path. The manual must not instruct staff to look for the removed status bar.

## Evidence status

- Automated TypeScript check: passed after the recovery-flow repair.
- Automated regression suite: 50 tests passed.
- Full live business-flow verification: pending an authenticated operator session; the public deployment and sign-in boundary were reachable, but protected records were not accessed during this audit.
