# Hetzner and Vercel deployment runbook

## Target architecture

The production system has two parts. Vercel serves the React/Vite static frontend, and the existing Hetzner server runs PostgreSQL plus the Express/tRPC API and local email/password authentication.

```text
Staff browser
    │
    ├── https://erp.example.com  ──► Vercel static frontend
    │                                  │
    │                                  └── VITE_API_URL
    │
    └── https://api.example.com  ──► HTTPS reverse proxy on Hetzner
                                       │
                                       └── Docker app :3000
                                             │
                                             └── Docker PostgreSQL
```

The browser sends an opaque local session token in the `Authorization` header. The token is hashed before it is stored in PostgreSQL. The application never stores a plaintext password; passwords are stored as salted scrypt hashes. Existing business tables and numeric user IDs remain unchanged.

## 1. Preserve the existing data before changing production

Do not delete or pause the existing database until the new deployment has passed the acceptance test. From a machine that has the PostgreSQL client utilities installed, create a custom-format backup of the application’s `public` schema:

```bash
mkdir -p backups
export OLD_DATABASE_URL='postgresql://old-user:old-password@old-host:5432/old-database'
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump --format=custom --schema=public --no-owner --no-acl \
  "$OLD_DATABASE_URL" > "backups/tailor-erp-$STAMP-full.dump"
pg_dump --format=custom --schema=public --data-only --no-owner --no-acl \
  --exclude-table-data='*.__drizzle_migrations' \
  "$OLD_DATABASE_URL" > "backups/tailor-erp-$STAMP-data.dump"
```

Using `--schema=public` deliberately copies the ERP tables and migration history without copying the former provider’s authentication schema. Keep the dump outside Git and protect it as confidential business data. PostgreSQL documents that custom-format archives are restored with `pg_restore` and can be inspected before restoration.[1] [2]

## 2. Prepare the Hetzner server

Install Docker Engine and the Docker Compose plugin on the existing Ubuntu server, then clone this repository into a private deployment directory:

```bash
git clone https://github.com/NewMux/tailor-shop-erp.git /opt/tailor-shop-erp
cd /opt/tailor-shop-erp
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set values similar to the following. Use a long random PostgreSQL password; do not reuse the old database password.

```dotenv
POSTGRES_DB=tailor_erp
POSTGRES_USER=erp
POSTGRES_PASSWORD=replace-with-a-long-random-password
OWNER_EMAIL=owner@example.com
AUTH_BASE_URL=https://erp.example.com
ALLOWED_ORIGIN=https://erp.example.com
```

The Compose file passes the database credentials only to the containers. Docker’s official guidance recommends keeping sensitive values out of the Compose file itself and using environment or secret mechanisms instead.[3]

Start PostgreSQL first so the restored data can be loaded into an empty database:

```bash
docker compose up -d postgres
docker compose ps
```

## 3. Create the current schema and restore the application data

Copy the data archive to the server using a secure transfer method, for example `scp`, and place it under `/opt/tailor-shop-erp/backups/`. First build the app image and apply the checked-in Drizzle migrations to the empty PostgreSQL database. This creates the current schema and migration history without copying the former authentication provider's internal tables.

```bash
docker compose build app
docker compose run --rm app pnpm exec drizzle-kit migrate
```

Restore the **data-only** archive into that freshly migrated schema. The archive intentionally excludes Drizzle's migration bookkeeping rows because the target already has the current migration history. Run this only after checking that the selected dump is the intended backup.

```bash
export DUMP_FILE=backups/tailor-erp-YYYYMMDDTHHMMSSZ-data.dump
docker compose exec -T postgres sh -c \
  'pg_restore --no-owner --no-acl --data-only --exit-on-error \
   -d "$POSTGRES_DB" -U "$POSTGRES_USER"' < "$DUMP_FILE"
```

A restore can execute SQL from the archive, so inspect archives from trusted sources before loading them.[1] [2] The command uses `--exit-on-error` so a partial restore does not look successful. Keep the full archive as a rollback safeguard; restore only the data archive during the normal cutover.

## 4. Start the API

The `0006_local_auth.sql` migration adds `passwordHash`, `authSessions`, and `passwordResetTokens`; it does not replace or renumber the existing ERP tables.

```bash
docker compose up -d app
docker compose logs --tail=100 app
```

Check the unauthenticated session endpoint from the server itself:

```bash
curl -fsS http://127.0.0.1:3000/api/auth/session
```

The expected response is JSON containing `"authenticated":false`. Do not expose PostgreSQL’s port publicly. The supplied Compose file binds the app only to `127.0.0.1`; expose the API through an HTTPS reverse proxy.

## 5. Put the API behind HTTPS

Point an `A` or `AAAA` DNS record such as `api.example.com` to the Hetzner server. Configure the reverse proxy using `Caddyfile.example`, or reproduce the same rule in an existing Nginx installation:

```text
api.example.com  →  http://127.0.0.1:3000
```

After HTTPS is active, verify the public endpoint:

```bash
curl -fsS https://api.example.com/api/auth/session
```

Set `ALLOWED_ORIGIN` to the exact Vercel frontend origin. If both a preview and production deployment must call the API, use a comma-separated value, for example `https://preview.example.vercel.app,https://erp.example.com`. Do not use `*` because the frontend uses credentials and authenticated requests.

## 6. Deploy the frontend on Vercel

Import the GitHub repository into the existing Vercel project. The checked-in `vercel.json` now runs `pnpm run build:frontend` and publishes only `dist/public`; it no longer deploys a Vercel API function.

Create the following Vercel environment variable for both Preview and Production as appropriate:

```text
VITE_API_URL=https://api.example.com
```

Do not add `DATABASE_URL`, `POSTGRES_PASSWORD`, `OWNER_EMAIL`, or other backend secrets to Vercel. Deploy after saving the variable because Vercel applies environment-variable changes to new deployments rather than retroactively changing an existing deployment.[4]

After deployment, open the Vercel URL and confirm that the browser can reach the Hetzner API. A failed preflight request normally means that `ALLOWED_ORIGIN` does not exactly match the Vercel origin.

## 7. Re-establish user access

The restored `users` rows retain their names, email addresses, roles, approvals, and business relationships. Their old password hashes are not imported. Generate private one-time links for all existing users:

```bash
docker compose exec app sh -c \
  'RESET_LINKS_FILE=/tmp/reset-links.json pnpm auth:reset-links'
docker cp "$(docker compose ps -q app):/tmp/reset-links.json" ./reset-links.json
chmod 600 ./reset-links.json
```

Deliver each link only to its matching user. Every generated link expires after one hour and is invalidated when used. Delete the local file after delivery. New users can register from the sign-in screen, and the account matching `OWNER_EMAIL` becomes the administrator automatically. Other new accounts enter the existing owner-approval workflow.

The **Forgot password?** form intentionally returns a neutral response. With no paid mail service configured, the server administrator must use the server log or `pnpm auth:reset-links` to create and deliver the link privately. An SMTP provider can be added later without changing the database schema.

## 8. Acceptance test before cutover

Use the Vercel production URL and verify the following in order:

| Area | Required check |
|---|---|
| Static frontend | The Vercel deployment loads without a Vercel function error. |
| New authentication | Register a controlled test account, sign in, refresh the page, and sign out. |
| Existing authentication | Use one generated reset link, set a new password, refresh, and sign in again. |
| Authorization | Confirm the owner is an administrator and a newly registered non-owner remains pending until approved. |
| Database | Create a test customer, inventory item, sale, and audit entry; verify the records survive a container restart. |
| Storage | If staff documents are enabled, upload and download a controlled test document. |
| Recovery | Request a second reset link, confirm that the first link is invalid, and confirm that an expired link is rejected. |
| Backups | Create a fresh Hetzner `pg_dump` archive and record where it is stored. |

Keep the former production deployment available until these checks pass. Only then change the public workflow to the new Vercel deployment and API origin.

## 9. Routine operations

Use these commands for normal operations:

```bash
cd /opt/tailor-shop-erp
docker compose ps
docker compose logs --tail=100 app
docker compose pull postgres
docker compose up -d --build app
```

Create a recurring database backup outside the application directory. For example, the following command writes a compressed custom-format archive; choose a retention policy and copy backups to storage that is not the same disk as the live database:

```bash
mkdir -p /opt/backups/tailor-erp
docker compose exec -T postgres pg_dump \
  --format=custom --no-owner --no-acl \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > "/opt/backups/tailor-erp/$(date -u +%Y%m%dT%H%M%SZ).dump"
```

## References

[1]: https://www.postgresql.org/docs/current/app-pgdump.html "PostgreSQL pg_dump documentation"

[2]: https://www.postgresql.org/docs/current/app-pgrestore.html "PostgreSQL pg_restore documentation"

[3]: https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/ "Docker Compose environment variables"

[4]: https://vercel.com/docs/environment-variables "Vercel environment variables"
