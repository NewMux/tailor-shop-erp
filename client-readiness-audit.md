# Client-Readiness Audit and Hardening Record

**Project:** `m4ahmed7/tailor-shop-erp` / `alhussam-erp`  
**Audit date:** 20 August 2026  
**Release branch:** `fix/custom-role-admin-bypass`  
**Target release:** `main`

## Executive conclusion

A full client-readiness review was completed across application security, authentication and authorization, transactional integrity, inventory behavior, frontend safety, dependency hygiene, production configuration, build reliability, and repository cleanliness. The verified release-blocking issues found during the review have been remediated in the working tree, and the final validation suite is required immediately before commit and push.

The release preserves the intended business behavior while closing approval bypasses, preventing duplicate connected tailoring checkouts, making inventory writes concurrency-safe, protecting staff documents, reducing request-memory exposure, escaping generated payslip HTML, removing production demo mutations, and enforcing the supported pnpm dependency policy.

## Security findings and resolutions

| ID | Severity | Verified finding | Resolution | Verification |
|---|---|---|---|---|
| SEC-01 | Critical | The POS access helper could create an active `sales` business-role row for an authenticated user who had not been approved, bypassing the pending-user gate. | `requireCounterAccess()` now fails closed when no active approved business role exists. Automatic role creation was removed. | Regression coverage denies POS access to a pending user; full test suite passes. |
| SEC-02 | High | `erp.shop.get` was protected only by authentication and could expose shop settings to a signed-in but unapproved account. | The procedure now invokes the approved business-role gate before returning shop settings. | Authorization path reviewed and type/test validation passes. |
| SEC-03 | High | The `/manus-storage/*` proxy could issue signed document redirects without a verified session or payroll-level authorization. | The proxy now requires a verified local session, active admin/payroll access or owner-assigned payroll permission, and a storage key registered in `staffDocuments`. Responses are private and non-cacheable. The client uses the protected `erp.staff.documents.download` procedure rather than opening legacy storage URLs directly. | Proxy and client paths reviewed; protected download procedure is role-gated. |
| SEC-04 | High | Connected tailoring checkout lacked replay protection, so a timeout or retry could create duplicate sales, payments, tailoring orders, and material deductions. | Standard, quick, and connected tailoring checkout now accept bounded `clientReference` values. A unique sales reference and linked tailoring-order constraints provide the database boundary; retries return the existing linked transaction. POS and offline replay paths forward stable references. | Regression test covers connected tailoring replay; test suite passes. |
| SEC-05 | Medium | Discount usage was checked and incremented in separate operations, allowing concurrent checkouts to exceed a usage limit. | Usage increments now use an atomic conditional update with `usedCount < usageLimit` inside the checkout transaction. | Checkout logic reviewed and full test suite passes. |
| SEC-06 | Medium | Authenticated accounts were synchronized before business-role approval, which was safe only if every business route consistently enforced the approval gate. | Route-level review closed the identified POS and shop-settings approval gaps. Protected ERP procedures continue to use the central approved-access boundary, while admin routes use the admin procedure. | Public-procedure and protected-route inventory completed; typecheck and tests pass. |

## Transactional and data-integrity hardening

All POS inventory reads that precede quantity writes now acquire PostgreSQL `FOR UPDATE` row locks. This covers counter sales, linked services, returns, exchanges, and connected tailoring orders, preventing concurrent requests from reading the same quantity and overwriting one another. The existing unique constraints for sales client references, tailoring order numbers, and tailoring-to-sale links remain the database-level protection against duplicate records.

Connected tailoring checkout remains transactional: customer, measurement, tailor, service/material availability, sale, payment, order linkage, sale item, and inventory deduction are committed together or rolled back together. Stable client references make browser retries safe without changing the normal first-submit behavior.

## Frontend and HTTP hardening

Database-backed text inserted into the payslip print document is escaped before HTML generation, closing the verified stored-content XSS path in that renderer. Staff-document uploads enforce an allow-list for supported PDF, PNG, JPG, WEBP, DOC, and DOCX MIME/extension combinations, while the server-side size limit remains bounded.

The Express application disables `X-Powered-By`, limits request bodies to 10 MB, and emits `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store`, and conditional HSTS. Equivalent edge security headers, including HSTS, are configured in `vercel.json` for all deployed routes.

## Dependency and supply-chain policy

The project is now pinned to **pnpm 11.22.0** with supported engine constraints of Node `>=22 <23` and pnpm `>=11.22.0 <12`, matching pnpm 11’s documented Node 22 minimum. The deprecated `package.json.pnpm` configuration was removed and the dependency policy was moved to the root `pnpm-workspace.yaml`, where the security overrides, patched dependency, and 24-hour minimum release-age policy are recognized by the active toolchain.

The lockfile was regenerated under pnpm 11. Frozen installation succeeds, and the workspace explicitly allows only the reviewed native build scripts for `@tailwindcss/oxide` and `esbuild`; all other dependency build scripts remain blocked by default. The production dependency audit reports **zero vulnerabilities across 352 production dependencies**. The enforced resolutions include the reviewed versions of `fast-xml-parser`, `path-to-regexp`, `qs`, `body-parser`, `lodash`, and the Smithy resolver policy.

A small number of non-blocking maintenance items remain: three deprecated subdependencies (`@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, and `tar`), the inactive Recharts 2.x line, and an existing peer mismatch between `@builder.io/vite-plugin-jsx-loc` and Vite 7. These were not upgraded blindly because doing so could introduce unrelated UI or build changes; they should be handled in a separate dependency-maintenance cycle.

## Repository and production hygiene

The unused client debug telemetry collector and its Vite injection/log endpoint were removed. The production ERP router no longer exposes the admin-only demo, demo-recovery, or demo-workforce mutations, which could seed fake customers, inventory, sales, invoices, staff, attendance, performance, or payroll data. Obsolete tracked scaffold/backlog artifacts (`template.json`, `todo.md`, and `reference-notes.md`) were deleted.

The backend is built into `dist/index.js` for the Hetzner container, while Vercel publishes only the static frontend from `dist/public`. Sandbox-only notes, helper scripts, local inventories, and temporary validation artifacts remain outside the repository release and are not intended for commit.

## Validation evidence

The following checks are the release gate and must remain green at handoff:

| Check | Result |
|---|---|
| `pnpm check` | Pass |
| Vitest suite (`52/52`) | Pass |
| `pnpm build` and `pnpm run build:frontend` | Pass |
| `git diff --check` | Pass |
| Frozen pnpm installation / lockfile policy check | Pass |
| `pnpm audit --prod` | 0 vulnerabilities |

## Owner actions before go-live

The code release is hardened, but operational readiness still depends on the client completing the remaining business setup and acceptance steps. The owner should save and verify the intended Shop Settings values, review and deactivate any `[TEST]` customers, products, services, staff, and transactions that were created during acceptance testing, and complete the live handover checklist in `ERP-HANDOVER-MANUAL.md` and `handover-test-matrix.md`.

The client should also confirm the final role assignments and approval state for every staff member, verify that payroll administrators can access staff documents while ordinary roles cannot, confirm inventory roll quantities and meter units, and perform at least one end-to-end sale, return/refund, tailoring order, payment, stock deduction, attendance, and payslip acceptance flow in the production workspace. These are operational verification actions, not unresolved code defects.

## References

The dependency configuration follows [pnpm workspace settings](https://pnpm.io/10.x/settings) and [pnpm package metadata documentation](https://pnpm.io/package_json). Operational procedures and acceptance evidence are maintained in `ERP-HANDOVER-MANUAL.md`, `handover-test-matrix.md`, and `handover-live-observations.md`.
