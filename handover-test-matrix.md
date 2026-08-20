# ERP Handover Test Matrix

## Purpose

This matrix defines the checks required for operational handover of the Al Hussam Tailor ERP. It separates repository-verified behavior from live-browser behavior. The production smoke test confirmed that the application shell and sign-in boundary load, but an authenticated browser session was not available; protected live scenarios therefore remain marked for operator execution.

| ID | Workflow | Acceptance criteria | Evidence source | Status |
|---|---|---|---|---|
| AUTH-01 | Staff sign-in | The production URL loads the branded sign-in screen and protects the ERP routes until authentication succeeds. | Live production smoke test; `client/src/pages/Login.tsx` or auth route implementation | **Passed live** for shell and boundary; authenticated execution pending |
| AUTH-02 | Role and custom-permission access | Admin bypass remains intact, custom roles only receive explicitly granted permissions, and inventory/sales/tailoring/payroll boundaries are enforced. | `server/custom.roles.test.ts`, `server/erp.ts` | **Passed automated** |
| AUTH-03 | Password recovery | A reset link opens an explicit set-new-password screen, updates the password, and only then permits normal ERP navigation. Expired links clear the session and show recovery guidance. | `client/src/lib/authCallback.ts`, `client/src/components/AuthGate.tsx`, `server/auth.callback.test.ts` | **Passed automated/source audit**; live execution pending |
| NAV-01 | Workspace navigation | Authorized staff can reach Overview, Customers, Inventory, Tailoring Orders, POS, Sales History, Invoices, Staff & Payroll, Shop Settings, and Audit Trail. | `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx` | **Source verified**; live execution pending |
| CUST-01 | Customer registration and edit | A customer can be created, searched, selected in POS, edited, and retained as the single customer source for the cart and order. | `client/src/pages/CustomerMaintenance.tsx`, `client/src/pages/PointOfSale.tsx`, `server/erp.validation.test.ts`, `server/pos.catalog.test.ts` | **Passed automated/source audit** |
| INV-01 | Material inventory | Staff can create material stock with size/roll information, record quantities, and view stock units/rolls separately from total meters. | `client/src/pages/ErpWorkspace.tsx`, inventory workflows, `drizzle/0004_customer_workflows.sql` | **Source verified**; live execution pending |
| INV-02 | Sellable inventory and variants | Sellable items support variant information such as size/color/SKU and can be priced by the owner. | Inventory UI and schema; customer workflow changes | **Source verified**; live execution pending |
| CAT-01 | Service catalog management | Services are created and maintained from Inventory under the POS catalog, not Shop Settings, and can optionally link to material stock. | `client/src/pages/ErpWorkspace.tsx`, `server/erp.ts`, POS catalog tests | **Passed automated/source audit** |
| POS-01 | Normal POS sale | Staff can select a customer, add services and inventory items, edit quantities and amounts by keyboard, apply discounts, accept payment, and issue an invoice. | `client/src/pages/PointOfSale.tsx`, `server/pos.test.ts`, `server/pos.checkout.test.ts` | **Passed automated/source audit**; live execution pending |
| POS-02 | Catalog/cart synchronization | Selecting a customer updates the visible customer and order label; adding multiple items updates the same cart and totals without stale translation or duplicate keys. | `server/pos.catalog.test.ts`, POS state implementation | **Passed automated** |
| POS-03 | Connected tailoring sale | Selecting a tailoring service and choosing New tailoring order preserves the customer/service/price, then atomically creates the production order, sale, payment, invoice, and optional linked-material deduction. | `server/pos.checkout.test.ts`, `drizzle/0005_tailoring_sale_link.sql`, POS implementation | **Passed automated**; live execution pending |
| TAIL-01 | Measurements and tailoring validation | A measurement profile must belong to the selected customer and the assigned tailor must be active. | `server/tailoring.orders.test.ts`, `client/src/pages/TailoringOrders.tsx` | **Passed automated** |
| TAIL-02 | Production lifecycle | Staff can move a valid order through production stages, record readiness, and complete handover without invalid shortcuts. | `server/tailoring.orders.test.ts`, `client/src/pages/TailoringOrders.tsx` | **Passed automated/source audit** |
| TAIL-03 | Sale/invoice visibility | The production board shows linked sale number, payment amount/status, and invoice number for connected orders. | Tailoring board implementation and linked-sale response | **Source verified**; live execution pending |
| RET-01 | Return/exchange | A return validates one selected original line, calculates refund direction correctly, and exchanges update inventory atomically. | `server/pos.test.ts`, `server/pos.checkout.test.ts`, customer workflow code | **Passed automated** |
| PAY-01 | Payroll and deductions | Payroll validates pay period and positive final payout, shows deductions in the calculation before final payslip, and attendance absence deductions are reflected. | `server/erp.validation.test.ts`, `client/src/pages/WorkforceHub.tsx` | **Passed automated/source audit**; live execution pending |
| STAFF-01 | Staff access and documents | Authorized administrators can invite, approve, remove, and manage staff access and documents without bypassing custom permissions. | `server/erp.validation.test.ts`, role tests, WorkforceHub UI | **Passed automated/source audit**; live execution pending |
| INV-03 | Invoice/receipt | Invoice printing is self-contained, uses shop branding/terms, and invoice filters work by invoice, sale, payment, status, and date. | `server/invoice.print.test.ts`, `server/invoice.filters.test.ts`, `server/sales.report.test.ts` | **Passed automated** |
| OPS-01 | Offline/cache behavior | Stale JavaScript/CSS bundles do not overwrite current React state, and the service worker refreshes after a new deployment. | `client/public/sw.js`, `client/src/main.tsx` | **Source verified** |
| PROD-01 | Production schema | Production includes `inventoryItems.size` and nullable unique `tailoringOrders.saleId`; migrations are recorded and applied. | Supabase migration result; `drizzle/0004_customer_workflows.sql`, `drizzle/0005_tailoring_sale_link.sql` | **Passed production schema check** |

## Automated baseline

After the handover repair, `pnpm check` passed and the full Vitest suite passed with **50 tests across 12 files**. The production build also passed after the repair.

## Live-test limitation

The production deployment currently opens at the staff sign-in screen in the available browser. No authorized credentials were available for this run, so the operator must execute the protected scenarios after sign-in using the manual below. The live login boundary itself is functioning as expected. The password-recovery repair is source-verified and covered by automated tests, but the email-link portion remains an operator acceptance step.
