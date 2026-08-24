# Live Handover Observations

## Production smoke test

- URL tested: https://tailor-shop-ov75fzxr9-m4ahmed7-4321s-projects.vercel.app
- Page title: Al Hussam Tailor ERP
- Browser state: unauthenticated staff session
- Observed screen: `Sign in to Al-Mamlaka ERP`, with email, password, Sign in, Register, and Arabic-language controls.
- Result: the production shell loads successfully and the authentication boundary is active. Protected ERP workflows could not be executed because no authorized credentials were available in the browser session and the user could not take over the browser.
- Test limitation: continue with source-level review, automated regression tests, production build validation, and public authentication smoke checks; protected live workflows should be re-run by an authorized operator using this manual.

## Source/deployment context

- Repository: `m4ahmed7/tailor-shop-erp`
- Production commit at test start: `d68898af34d9df210f54fb1cdddf5aab3fa54e53` (`Connect tailoring orders to POS sales`)
- Production deployment: `https://tailor-shop-ov75fzxr9-m4ahmed7-4321s-projects.vercel.app`
- Current target architecture: static frontend on Vercel; PostgreSQL, API, and local authentication on Hetzner
- Main application routes: `/`, `/customers`, `/inventory`, `/tailoring`, `/sales`, `/sales-history`, `/invoices`, `/team`, `/settings`, `/audit`
- Automated test files: `auth.callback.test.ts`, `custom.roles.test.ts`, `dashboard.test.ts`, `erp.validation.test.ts`, `invoice.filters.test.ts`, `invoice.print.test.ts`, `operations.search.test.ts`, `pos.catalog.test.ts`, `pos.checkout.test.ts`, `pos.test.ts`, `sales.report.test.ts`, `tailoring.orders.test.ts`

## Final handover release

Commit `08caa503a4f79c75f16c21ab54146896ca8cc2a5` was pushed to `main` with the canonical GitHub no-reply author email. Vercel production deployment `dpl_AejAAi4p65Zv1zqM6B7F3gN53rcw` reached `READY` at `https://tailor-shop-gy2c1j8oq-m4ahmed7-4321s-projects.vercel.app`.

The public deployment and sign-in boundary were reachable. No authorized browser session was available, so customer records, real checkout mutations, returns, payroll writes, staff access changes, and password-email completion were not executed against production during this run. These are explicitly listed as operator acceptance steps in `ERP-HANDOVER-MANUAL.md`.

## Authorized live session

The owner account was authenticated successfully on the final production deployment. The dashboard loaded with the expected navigation: Overview, Customers, Inventory, Tailoring orders, Point of Sale, Sales history, Invoices, Staff & Payroll, Shop Settings, and Audit Trail. The dashboard displayed existing business data, including 20 completed sales, 3 registered clients, low-stock Test Material 2, and historical return records. This confirms the protected application shell and owner navigation are reachable in production.

## Live customer workflow

The Customers workspace loaded successfully. It listed existing customers and exposed New customer, search, Edit, and Measurements controls. Selecting Ali displayed the customer profile and contact details, but the outstanding balance and operational data remained on a visible `Loading…` state during the observation. This should be rechecked after a short wait and included as a potential live defect if it does not resolve.

## Live customer and production observations

After waiting, Ali’s customer record resolved correctly: outstanding balance displayed `0.000 BHD`, and measurement history showed fitting version 1 with the stored measurement fields. The Tailoring orders workspace loaded with three existing production orders and visible stage counts. The displayed legacy orders showed `No linked sale recorded`, which is consistent with historical records created before the explicit sale link; a new linked-order acceptance test is still required.

## Live inventory workflow

Inventory loaded successfully with Add inventory, Add service, search, POS catalog services, and the on-hand stock table. Services are now managed in Inventory and displayed alongside stock: `[TEST] Bespoke Thobe` showed linked fabric and `BHD 48.000`, while `Albassam` showed standalone `BHD 8.000`. Material rows exposed meters, rolls, threshold, cost, sale price, Edit, and Adjust controls. `Test-002` displayed `0.000 Meters`, `2 rolls`, and `20.000 m per roll`, confirming roll metadata is visible. Existing `[TEST]` records remain owner cleanup items.

## Live inventory and sales-history observations

The live Inventory workspace confirmed unified service management and roll-aware stock fields. Sales History also loaded successfully with 20 transactions, source filters, payment-status filters, date filters, invoice actions, and CSV export. Existing records included two Tailoring-source partial payments (`POS-TO-1787138788002` and `POS-TO-1787138720708`) and negative Counter-source return records, which are consistent with the implemented return accounting model.

## Live POS read-only workflow

The Point of Sale workspace loaded with New sale, Tailoring order, Return, customer attachment, saved-cart count, keyboard guidance, amount-only sale, unified product filters, and catalog tiles. Services and stock items were both visible. Service cards exposed `Add to sale` and `New tailoring order`, while inventory cards exposed `Add to sale`. Opening the customer picker listed Walk-in, Ali, the test customer, and Jassim, confirming customer attachment is available before checkout.

## Live POS customer and catalog observations

Selecting Ali updated both the top customer control and the order summary from Walk-in customer to Ali, confirming the customer/cart synchronization fix in production. After scrolling, the service cards visibly exposed separate `Add to sale` and `New tailoring order` buttons, while the stock cards exposed `Add to sale`; the current cart remained at `0 items` and `BHD 0.000`. This confirms the intended non-destructive POS handoff controls are reachable.

## Live acceptance: controlled POS-to-tailoring test

The authenticated production session successfully opened Customers, Tailoring orders, Inventory, Sales History, and POS. The POS customer picker attached `[TEST] Layla Al-Khalifa` to the unsaved cart and displayed that customer as the active sale customer. The unified catalog displayed `[TEST] Bespoke Thobe` with both `Add to sale` and `New tailoring order` actions. Selecting `New tailoring order` preserved the customer and displayed a connected-service summary stating that the service would be saved on the sale line and tailoring order. A saved `Version 1` measurement, `[TEST] Khalid Tailor · Senior Tailor`, and due date `2026-08-28` were selected. The confirm action entered `Creating order…`; the subsequent browser read timed out before the success or error state could be captured. The final transaction result therefore remains pending live verification.

## Controlled live POS-to-tailoring transaction — verified read-only after browser timeout

The browser became unresponsive after submission, so no duplicate submission was attempted. A read-only production query confirmed that the transaction did complete: tailoring order `TO-1787199224117` (`id=4`) for `[TEST] Layla Al-Khalifa` and `[TEST] Bespoke Thobe` was created at `2026-08-20 04:13:44`, with status `confirmed`, due date `2026-08-28`, and explicit `saleId=21`. The linked sale is `POS-TO-1787199224117`, total `48.000 BHD`, paid amount `48.000 BHD`, status `paid`, with invoice `INV-000021`. A cash payment of `48.000 BHD` and the service sale line were present. Because shop fabric was used, the production stock movement was also confirmed: inventory item `1` decreased by `3.000` meters from `8.000` to `5.000`, with reference `tailoring_order` / order `4`. This confirms the atomic sale, invoice, payment, production-order, and linked-stock behavior in production. No second transaction was submitted.

The live browser session remains unstable after navigation, so subsequent live acceptance checks should resume only after the authorized session is restored.

## Final evidence release verification

The documentation update was committed as `1f227410b56e76055d7db4c4724698c96244b0d4` with the canonical GitHub no-reply author email and pushed to `main`. Vercel created production deployment `dpl_2f1HK9P997LRhe2ojqtpoBqaUWXc` from that commit and reported state `READY` at `https://tailor-shop-4njfmdm2j-m4ahmed7-4321s-projects.vercel.app`. The stable owner URL remains `https://www.alhussam-erp.com`.
