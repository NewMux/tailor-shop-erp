# Al Hussam Tailor ERP
## Handover and Operations Manual

**Prepared by:** Manus AI  
**Handover scope:** Customer management, inventory, service catalog, POS sales, connected tailoring orders, production, returns and exchanges, invoices, staff access, attendance, payroll, documents, password recovery, and operational troubleshooting.  
**Application:** `alhussam-erp` / `tailor-shop-erp`  
**Production URL:** [alhussam-erp.com](https://www.alhussam-erp.com)  
**Vercel production alias:** [tailor-shop-erp.vercel.app](https://tailor-shop-erp.vercel.app)  
**Repository:** [m4ahmed7/tailor-shop-erp](https://github.com/m4ahmed7/tailor-shop-erp)  
**Manual status:** Verified against the current application source, automated tests, production schema, and an authorized production session. The connected POS-to-tailoring transaction was verified read-only in production after the browser timed out; the remaining write/print workflows still require an authorized operator session for final acceptance.

> **Important handover distinction:** This manual separates behavior verified from application source and automated tests from behavior executed interactively in production. An authorized owner session successfully opened the protected workspaces and verified existing customer, inventory, tailoring, sales-history, and POS data. A controlled POS-to-tailoring submission was then confirmed through read-only production records after the browser became unresponsive. Returns, payroll, staff-document upload, invoice printing, password-email completion, and settings write operations were not executed in this run; those remain explicit owner acceptance steps.

## 1. Operating model

The ERP has one shared business record for each important object. Customers are created once and then selected in the POS and tailoring workflows. Services and sellable stock items are maintained from the Inventory workspace and appear together in the POS catalog. A normal sale remains a sales transaction, while a tailoring sale creates a production order and its commercial records together.

The connected tailoring workflow is the preferred procedure for any order that requires measurements, a tailor, a due date, or production tracking. It creates the tailoring order, sale, sale line, payment, and invoice atomically. If the selected service is linked to shop fabric with a default meter quantity, the same transaction also records the material deduction. A normal retail sale must not be used when the item needs production tracking.

| Business object | Where it is managed | Where it is used |
|---|---|---|
| Customer | Customers workspace | POS, tailoring orders, returns, reports |
| Measurement profile | Customers and tailoring workflow | Tailoring order validation and production |
| Material stock | Inventory workspace | POS-linked service consumption, direct stock sales, adjustments |
| Sellable stock item and variant | Inventory workspace | POS, returns, exchanges, stock movements |
| Service catalog item | Inventory → POS catalog services | POS normal sale or New tailoring order handoff |
| Tailoring production order | Tailoring Orders workspace | Production stages, due dates, handover |
| Sale and payment | POS and Sales History | Invoice, returns, exchanges, reporting |
| Invoice | Invoices workspace | Printing, filtering, customer receipt |
| Staff and payroll | Staff & Payroll workspace | Access, attendance, deductions, payslips |
| Shop configuration | Shop Settings | Branding, invoice prefix, VAT, receipt terms |

## 2. First-time setup for the owner

An administrator should complete the following setup before staff begin selling. Open **Shop Settings** and save the business name, optional Arabic name, commercial registration, phone, email, address, invoice prefix, VAT settings, VAT number, and receipt or invoice terms. The shop configuration is used by invoice numbering, invoice presentation, and receipts. The current production database had no saved Shop Settings row during the audit, so this is an owner action before operational use.

Next open **Inventory** and create the catalog. Create material stock for fabrics and other consumables, using the correct unit such as meters. Enter the total available quantity in that unit and maintain roll or package information where the form provides it. Create sellable inventory items for products that are sold directly, including size, color, SKU, price, and available quantity when applicable. Create services from the **POS catalog services** section inside Inventory, not from Shop Settings. A service can remain standalone or be linked to a material and a default fabric-meter quantity.

The production database previously contained three active `[TEST]` inventory records and one active `[TEST]` service. Deactivate or delete those records from the Inventory workspace before the shop goes live with real data. This cleanup is data maintenance rather than a software repair.

## 3. Sign-in, password recovery, and security

### Normal sign-in

Open the production URL and sign in with the staff email and password assigned by the owner. The ERP should remain behind the staff sign-in boundary until authentication succeeds. Do not share a staff password or use another employee’s account; audit records are attributed to the authenticated user.

### Forgot-password procedure

The sign-in screen includes **Forgot password?**. Enter the staff email and choose **Send reset link**. The response is intentionally neutral so the screen does not reveal whether an email is registered. Because this zero-cost deployment does not require an external email provider, the server administrator must obtain the one-time link from the server log or run `pnpm auth:reset-links` and deliver the matching link privately to the user. The application must show **Set a new password**, not the ERP workspace. Enter and confirm a new password of at least eight characters, choose **Update password**, and then continue into the ERP.

Reset links expire after one hour and are invalidated after one use. If a link has expired or is invalid, request a new link from the server administrator. Existing users carried over from the former authentication service must use this reset process once because their old password hashes are not imported into the local authentication tables.

### Owner access and custom roles

The owner should use **Staff & Payroll → Access management** to invite staff and assign an owner-managed custom role. A custom role should contain only the permissions needed for the job: Dashboard, Customers, Sales, Inventory, Production, and Payroll. Admin users retain the broad administrative bypass. A custom role with one permission must not gain access to unrelated areas.

| Role or permission profile | Recommended operational scope |
|---|---|
| Admin / owner | All workspaces, settings, staff access, audit trail, and configuration |
| Sales | Customers, POS, sales history, invoices, and permitted catalog viewing |
| Tailor / production | Tailoring Orders, measurements needed for production, and production status updates |
| Inventory | Materials, rolls, variants, quantities, adjustments, and POS catalog maintenance |
| Payroll | Attendance, salary calculations, deductions, payslips, and staff records permitted by the owner |
| Custom role | Only the explicitly selected permission categories |

The owner should test each new role with a non-owner account before handing over a password. A dashboard-only user should not be able to adjust inventory or create payroll payouts.

## 4. Customers and measurements

Open **Customers** to create a customer before starting a tailoring order. Enter the customer’s name and contact information, then save. Search by name, phone, or available identifiers to edit the record. From the customer record, create or maintain measurement profiles. Save each meaningful revision as a new version rather than overwriting the history when the garment fit changes.

In POS, choose the customer before adding order lines when the sale needs a customer identity. The selected customer is the single source of truth for the visible customer label, the order count, and the checkout payload. Choose **Walk-in customer** only for anonymous sales. When a tailoring service is selected, a real customer is required before the order can be confirmed.

A measurement profile must belong to the selected customer. If the profile belongs to another person, the server rejects the tailoring order before creating records. Choose the customer first, then select one of that customer’s measurement versions.

## 5. Inventory and POS catalog

### Material inventory and fabric rolls

Create a material item for fabric and set its unit to meters when the business tracks meters. Enter the total meters available. If the business also counts physical rolls, record roll information in the appropriate inventory fields or notes so staff can see both the physical packaging and the total usable meters. Do not enter the number of rolls as if it were the number of meters.

For example, a fabric stock of four rolls at twenty meters each should be represented as eighty meters available, with four rolls recorded as the physical roll count where the inventory form supports it. When two meters are consumed by a service, the stock should decrease from eighty to seventy-eight meters and an inventory movement should be recorded.

### Sellable items and variants

Use a sellable inventory record for products that can be selected directly in POS. Maintain size, color, SKU, price, unit, and available quantity. If two colors or sizes have different prices, create or maintain separate variants with their own SKU and price rather than relying on a free-text note.

### Services

Open **Inventory → POS catalog services** and choose **Add service**. Enter the service name, category, code if used, selling price, and optional material link. For a service that consumes shop fabric, set the linked material and default fabric-meter quantity. For a service where the customer supplies fabric, leave the material link empty and record the customer-supplied-fabric note on the tailoring order.

A service can be sold directly from POS or used to start a connected tailoring order. The POS catalog combines active services and sellable inventory so staff do not need to search in two separate sales screens.

## 6. New Sale: normal POS sale

Use **New sale** for a direct retail transaction or a service that does not require production tracking.

First choose the customer or leave the order as Walk-in. Select a service or stock item from the catalog. Each item is added to the cart as a separate line. Add additional items by selecting them again; the cart should preserve separate line identities and update its count and total immediately.

Review each line. Use the direct quantity field for meters or units, the direct amount field for authorized price adjustments, and the discount field for a line discount. The keypad remains available for desktop keyboard or numeric-entry workflows, but staff do not need to calculate a multi-item total manually. The POS calculates line totals and the order total.

Choose **Review order**, select the payment method, enter the amount collected, and complete payment. A successful checkout creates the sale, sale lines, payment record, invoice, and any required inventory movement. Print the invoice or locate it later under **Invoices** or **Sales History**.

| Desktop shortcut | Action |
|---|---|
| `/` or Ctrl/Cmd+K | Focus catalog search |
| F2 | Open payment step |
| F4 | Open walk-in amount sale |
| F8 | Open held or saved orders |
| F9 | Open customer picker |
| Enter | Apply numeric input |
| Escape | Close the active sheet or dialog |
| Ctrl/Cmd+Enter | Complete the payment step |

The persistent register-status bar has been removed from POS. Staff should use the POS screen itself; they should not expect to find a separate **Register ready** bar. Session and end-of-day code remains available through the existing session flow.

## 7. New Tailor Order: connected production sale

Use this workflow when the customer needs a garment produced, measured, assigned to a tailor, or tracked through production.

Start in **POS → New sale**, choose the customer, open the Services catalog, and choose **New tailoring order** on the relevant service. The POS switches to Tailoring mode and carries over the service, garment name, quoted price, payment amount, and customer. If no customer was selected, the customer picker opens and asks staff to choose one before continuing.

Confirm or adjust the garment type and quoted order price. Select the customer’s measurement profile and an active tailor. Enter quantity, due date, production notes, fabric notes, and whether the fabric is supplied by the customer. Review the deposit or full payment amount and choose the payment method.

Choose **Confirm tailoring order**. The server validates that the customer exists, the measurement profile belongs to that customer, the tailor is active, the payment does not exceed the quote, and the linked service and material are valid. It then creates the production order, sale, sale line, payment, and invoice in one transaction. If the service is linked to shop material, the configured quantity is deducted and an inventory movement is recorded. If any validation fails, the transaction is rejected before partial records are created.

The **Tailoring Orders** board shows the order number, customer, tailor, due date, production status, linked sale number, payment amount and status, and invoice number. Move the order through the available production stages only as work progresses.

| Production status | Meaning and handover action |
|---|---|
| Confirmed | Order accepted and ready to enter production |
| Cutting | Fabric and cutting work is in progress |
| Ready | Garment is completed and awaiting customer handover |
| Collected | Customer has received the garment; record handover only after collection |
| Cancelled | Order will not continue; use only with an appropriate note and owner process |

## 8. Returns, refunds, and exchanges

Open **POS → Return**. Search by receipt number, customer name, or phone. The search requires at least three characters. Select the receipt and confirm the customer snapshot and total shown on screen.

For a line return, choose **Return items**, select one original line, and enter the quantity to return. The server validates the selected line and quantity, restores eligible inventory, and records the refund. For an amount-only refund, choose **Refund amount**, enter the amount and a reason, select the refund method, and confirm. Use this when the operator does not need to return a specific stock line.

For an exchange, choose **Exchange**, select the original line and quantity, choose a replacement product or service from the active catalog, and enter the replacement quantity and an optional note such as size change or color change. The original item is restored, the replacement is sold, and only the difference is settled. If the replacement is cheaper, the customer receives the difference; if it is more expensive, the difference is collected. The original payment method is used for settlement.

When the customer does not know the receipt number, search by phone or customer name. If no result is found, do not guess or create an unreferenced return. Escalate to the owner or use the amount-refund path only when the business’s approved refund policy allows it and a clear reason is recorded.

## 9. Sales history and invoices

Use **Sales History** to search and review completed sales, payment status, customer, and totals. Use **Invoices** to filter by invoice number, sale number, payment method, status, or date and to print a self-contained invoice. The invoice uses shop settings for branding, invoice prefix, VAT configuration, and receipt terms.

If an invoice is missing, first confirm that the sale was completed rather than held or queued offline. Then search by sale number and customer. Do not create a manual duplicate sale from Sales History; the application deliberately does not expose manual-sale creation there.

## 10. Staff, attendance, payroll, and documents

Open **Staff & Payroll** and create or maintain a staff profile with the employee’s job title, base salary, commission rate, and active status. Use the access-management area separately to invite or approve the user account and assign the correct custom role.

Record attendance for each working day. Mark absence or half-day status accurately, add the reason, and attach a supporting certificate when required by the shop’s policy. The payroll calculation reads attendance records and calculates automatic absence deductions before a payslip is created.

For a pay period, choose the employee and month, then enter allowances, overtime, performance bonus when needed, and manual deductions. Review the calculation before creating the payout. The preview shows base salary, gross salary, manual deductions, automatic absence deduction, total deductions, and net salary. Only after the figures are correct should staff create the payslip. A zero or negative final payout and an invalid month are rejected before payroll data changes.

The payslip history displays the pay period, employee, gross value, deductions, and net value. Use the **Payslip** action to open the print view. Upload employment contracts, sick notes, or other staff documents with a clear label. A document can be opened later and selected as support for an absence record.

## 11. Offline operation and deployment freshness

The POS can queue checkout activity when the device is offline, provided the catalog has previously loaded while connected. When connected again, pending synchronization should complete through the normal application flow. Staff should connect the POS device before the day begins so the current service and inventory catalog is cached.

The service worker is configured to prefer fresh JavaScript and CSS assets and to reload when a new controller takes over. If an old screen remains after a deployment, close and reopen the browser tab, confirm the network connection, and allow the application to reload before creating a sale. Never process the same sale twice while an offline queue is still synchronizing.

## 12. Troubleshooting guide

| Symptom | First response | Escalation |
|---|---|---|
| Password reset link enters the ERP without a reset screen | Sign out, request a new link from Forgot password, and confirm the current deployment is loaded | Owner or technical administrator checks the Vercel URL, `VITE_API_URL`, and Hetzner API logs |
| Reset link is expired | Request a new link; do not reuse the old URL | Run `pnpm auth:reset-links` on Hetzner and deliver the new matching link privately |
| Customer name does not appear in POS | Re-select the customer with F9 or the customer picker, then reload the catalog | Check browser cache and current deployment |
| Cart count remains zero after adding an item | Confirm the item is active and visible, then refresh once | Check catalog query and service worker freshness |
| Tailoring order cannot confirm | Verify customer, customer-owned measurement profile, active tailor, quote, and payment amount | Owner checks the related records and permissions |
| Fabric quantity does not decrease | Confirm the service is linked to a material and has a default meter quantity; confirm the service is using shop fabric | Inventory owner checks the linked material and stock movement |
| Return cannot find a receipt | Search by customer phone or name and use at least three characters | Owner reviews Sales History or Invoices |
| Exchange requests the wrong amount | Confirm the original line, replacement item, and quantity; the difference is settled automatically | Owner reviews the original sale and exchange note |
| Payroll net amount is unexpected | Review attendance status, automatic absence deduction, allowances, overtime, bonus, and manual deductions in the preview | Payroll administrator checks attendance records and pay period |
| Staff cannot open a workspace | Confirm the assigned custom-role permission and active status | Admin reviews Staff & Payroll access management |
| Invoice prefix or terms are wrong | Save Shop Settings and create only future invoices with the corrected configuration | Owner verifies the shop settings row exists |

## 13. Handover acceptance checklist

The following checklist is the final operator acceptance run. Use a clearly marked demo customer, demo inventory, and demo service. Do not use real payments while testing.

| Check | Operator action | Expected result | Status |
|---|---|---|---|
| Sign-in | Sign in with an approved staff account | ERP workspace opens only after authentication | **Passed live** |
| Password recovery | Request reset, follow the email, set a new password | Recovery screen appears before ERP access | Source repaired and automated passed; live email completion pending |
| Role boundary | Sign in as a restricted role and open an unauthorized workspace | Access is denied or the route is hidden | **Automated passed; live operator pending** |
| Customer | Create customer, create measurement, select customer in POS | Customer label and order count update immediately | Existing customer selection and POS synchronization **passed live**; create/edit mutation pending |
| Inventory | Add a material measured in meters and a sellable size/color item | Correct units, variants, and prices appear | Existing meter/roll display **passed live**; add/edit mutation pending |
| Service catalog | Create a service in Inventory and link optional material | Service management and POS visibility **passed live** for existing data; add/edit mutation pending |
| Normal sale | Add two lines, edit quantity and price, take payment, print invoice | One sale, payment, invoice, and stock movement are recorded | Automated/source passed; live operator pending |
| Tailoring sale | Start New tailoring order from a service, choose measurement and tailor, take deposit | Production order and connected commercial records are created atomically | **Passed live and read-only production verified**: `TO-1787199224117`, sale `POS-TO-1787199224117`, invoice `INV-000021`, cash payment `48.000 BHD`, and linked stock deduction |
| Production | Move a demo order through confirmed, cutting, ready, and collected | Status changes and linked commercial data were visible live; stage lifecycle pending |
| Return | Search by receipt, return one line, confirm refund | Eligible stock is restored and refund is recorded | Automated passed; live operator pending |
| Exchange | Replace one line with a cheaper and a more expensive item | Difference is refunded or collected correctly | Automated passed; live operator pending |
| Payroll | Record absence, calculate month, review preview, create payslip | Automatic deduction appears before final net amount | Automated/source passed; live operator pending |
| Staff documents | Upload and open a document, select it for an absence | Document remains available and can support attendance | Source passed; live operator pending |
| Offline | Load catalog while online, disconnect, queue a demo sale, reconnect | Sale synchronizes once without duplication | Source passed; live operator pending |

## 14. Verified release evidence

The handover audit produced the following repository evidence after the password-recovery repair.

| Validation | Result |
|---|---:|
| TypeScript check: `pnpm check` | Passed |
| Full Vitest suite: `pnpm test` | **50/50 passed across 12 files** |
| Production build: `pnpm build` and `pnpm run build:frontend` | Passed |
| Formatting/whitespace: `git diff --check` | Passed before generated build output |
| Production shell smoke test | Passed; staff sign-in boundary loaded |
| Protected live workflow test | Authorized session reached core workspaces; connected tailoring transaction verified read-only in production; remaining operator checks pending |
| Production schema: `inventoryItems.size` | Applied and confirmed |
| Production schema: nullable unique `tailoringOrders.saleId` | Applied and confirmed |
| Existing connected-sale release | `d68898a` on `main` |
| Handover and password-recovery release | `57cad96` on `main`; Vercel production deployment is **READY** |

The production backend is built into `dist/index.js` and runs on Hetzner. Vercel publishes only `dist/public` through `pnpm run build:frontend`; no generated API bundle is committed. See `HETZNER_DEPLOYMENT.md` for the cutover, backup, reset-link, and rollback procedure.

## 15. Owner actions before final operational sign-off

The owner should first save the Shop Settings record with the real business identity, invoice prefix, VAT settings, and invoice terms. The owner should then remove or deactivate all `[TEST]` records, create the real material and service catalog, and complete the live acceptance checklist with a demo customer and test records.

The owner should also generate one reset link for a controlled test account and confirm that the recipient sees the new-password screen. The authorized live session verified sign-in, core workspace navigation, customer selection, catalog visibility, customer/cart synchronization, and one complete connected tailoring transaction through read-only production records. The owner must still test each staff role using a separate account, complete the return, payroll, staff-document, invoice-print, settings, and production-stage checks, and retain the audit trail for the first real sales day.

## References

[3]: https://github.com/m4ahmed7/tailor-shop-erp "Al Hussam Tailor ERP GitHub repository"

[4]: https://www.alhussam-erp.com "Al Hussam Tailor ERP production deployment"
