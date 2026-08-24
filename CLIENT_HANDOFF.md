# Al-Mamlaka Tailor ERP — Client Delivery Handoff

**Release status:** Client-review ready after automated, backend, and interface verification. The current workspace intentionally contains clearly labelled `[DEMO]` records and must be loaded with the client’s own operational data before go-live.

## What has been delivered

The release provides an authenticated tailor-shop workspace with an owner dashboard, client directory and measurements, inventory control, direct-inventory point of sale, invoices with browser printing/PDF output, workforce operations, shop settings with role assignments, and an audit trail.

The point of sale is intentionally aligned to the active inventory records. It presents the three currently active demo materials exactly once, deducts stock atomically, creates an invoice, and opens a clean print window after checkout. Legacy duplicate demo materials remain archived in the database to preserve prior reference history but are not displayed in live inventory or POS workflows.

## Delivery audit summary

| Area | Outcome | Client note |
|---|---|---|
| Build and automated tests | `pnpm check`, `pnpm test`, and `pnpm build` pass. The current suite contains 26 tests. | Re-run all three commands before every release. |
| Backend access | ERP and POS procedures require an authenticated user. Business-role checks gate sales, inventory, payroll, and administration actions. | Assign least-privilege roles after each team member signs in. |
| Data integrity | Active inventory count is 3. The relational audit found zero invoices without sales, sale lines without sales, stock movements without materials, and duplicate business-role records. | Take a database backup before importing production records. |
| POS and stock | The POS sells direct inventory items, blocks quantities beyond available balance, records stock movement, creates sale/invoice records, and supports immediate print. | Confirm each material’s unit, opening balance, threshold, and initial checkout price before launch. |
| Customer and workforce journeys | Client name/phone search, measurements, attendance, production, and payroll areas are available. | Replace all `[DEMO]` contacts, attendance, production, and payout records. |
| Invoices | Invoice details render in an isolated print document to avoid application overlays. | Allow browser pop-ups for the POS/invoice print workflow. |
| Desktop and mobile | Owner, customer, inventory, POS, invoice, workforce, settings, and audit screens were reviewed. Tables retain horizontal scrolling on compact screens and now disclose how to reach hidden actions. | Test the client’s actual tablets and printer before launch. |

## Client operational setup checklist

1. In **Shop Settings**, replace the demo shop name, Arabic name, CR number, invoice prefix, contact information, and address.
2. Invite/sign in every team member, then assign the minimum required business role: **admin**, **sales**, **inventory**, **tailor**, or **payroll**.
3. Replace `[DEMO]` customers, stock records, staff, payroll, and historical invoices with approved client data. Retain only records the client explicitly wants as training data.
4. Confirm every active inventory material’s code, category, colour, width, unit, on-hand balance, minimum threshold, and cost. At checkout, staff can set the final unit price in the cart; establish a client policy for price overrides.
5. Create a test sale, check the inventory deduction and audit entry, then print the resulting invoice from the client’s actual browser and printer.
6. Set a backup schedule and nominate a business owner responsible for stock adjustments, payroll approvals, and role changes.

## Hosting requirements

The app is a React/Vite frontend with an Express/tRPC backend and Drizzle ORM. The **frontend remains on Vercel as static assets**, while Coolify manages the PostgreSQL database and API containers on the existing Hetzner server. Email/password authentication is self-hosted. The backend is a normal long-running Node process, so it is no longer coupled to a serverless runtime.

For local development or a plain server, use:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The Vercel project only builds the frontend with `pnpm run build:frontend`. Set `VITE_API_URL` in Vercel to the public HTTPS origin assigned to the Coolify `app` service, such as `https://api.example.com`. The Coolify API service must set `ALLOWED_ORIGIN` to the exact Vercel origin. It must not commit `.env` files, credentials, reset-link files, or database dumps to source control.

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Coolify | PostgreSQL connection string using the Compose service hostname `postgres`. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Coolify | PostgreSQL service initialization values. Keep them private. |
| `OWNER_EMAIL` | Coolify | Email automatically granted the admin role on registration. |
| `AUTH_BASE_URL` | Coolify | Public Vercel URL used to build password-reset links. |
| `ALLOWED_ORIGIN` | Coolify | Exact Vercel origin(s) allowed to call the API; comma-separated values are supported for a preview URL and production URL. |
| `VITE_API_URL` | Vercel | Public HTTPS origin of the Coolify API service, baked into the frontend at build time. |
| `NODE_ENV` | Coolify | Set to `production` for the backend container. |
| `PORT` | Coolify | Internal backend port; the Compose app service uses `3000`. |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | Coolify, optional | File-storage proxy credentials if staff-document uploads are enabled. |

### First-time setup with Coolify on Hetzner

1. In Coolify, create a Docker Compose resource from this repository, using `/` as the base directory and `docker-compose.yml` as the Compose file. Use the review branch during testing, then switch to `main` after merge.
2. Add the PostgreSQL, database URL, owner, authentication, CORS, and optional storage variables in Coolify. Keep the `postgres_data` volume persistent.
3. Assign `https://api.example.com` to the Compose `app` service on port `3000`. Point DNS to Hetzner; Coolify supplies HTTPS through its proxy. Do not expose PostgreSQL publicly or add a custom Compose network.
4. Deploy the stack. Coolify runs the checked-in Drizzle migrations before starting the API, and the health check uses `/api/auth/session`.
5. Import the data-only PostgreSQL backup through Coolify’s database import feature or its terminal, then verify the business records before user recovery.
6. Set `VITE_API_URL` in Vercel to the Coolify API origin and deploy the static frontend. Set `AUTH_BASE_URL` and `ALLOWED_ORIGIN` in Coolify to the final Vercel URL.
7. Register the shop owner with the exact `OWNER_EMAIL`. The owner becomes an administrator automatically; other accounts remain pending until approved in Shop Settings → Staff & Access.
8. For users carried over from the old hosted authentication system, run `pnpm auth:reset-links` in the Coolify application terminal after the database restore. Deliver each generated link privately; each link expires after one hour and can be used once.

See [HETZNER_DEPLOYMENT.md](./HETZNER_DEPLOYMENT.md) for the complete Coolify deployment, backup, restore, and cutover procedure.

## Go-live acceptance test

The client should sign in as an administrator and sales user, complete the following in a staging environment, and record the outcomes:

1. Create one test customer and measurement profile.
2. Add or adjust one material; confirm its stock movement and audit entry.
3. Complete a POS sale for an in-stock material; confirm stock decreases by the sold quantity.
4. Confirm the generated invoice prints or saves as a PDF without application chrome.
5. Review the dashboard over a preset range and a Custom period.
6. Confirm a payroll user cannot access administration actions and an inventory user cannot complete unauthorized workflows.
7. Restore a test database backup successfully before accepting production traffic.

## Remaining product decisions for the client

The application is ready for review, but the client should decide whether to add a stored **selling price** separate from inventory cost, barcode scanning, thermal receipt formatting, scheduled low-stock notifications, and a formal production-data import process before operating at scale.
