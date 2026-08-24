# Coolify deployment runbook for Hetzner

## Target architecture

Coolify manages one Docker Compose service stack on the existing Hetzner server. The stack contains the `postgres` database and the `app` Express/tRPC backend. Vercel continues to publish only the React/Vite frontend.

```text
Staff browser
    │
    ├── https://erp.example.com  ──► Vercel static frontend
    │                                  │
    │                                  └── VITE_API_URL
    │
    └── https://api.example.com  ──► Coolify proxy / HTTPS
                                       │
                                       └── app service :3000
                                             │
                                             └── postgres service
                                                   │
                                                   └── postgres_data volume
```

The repository uses Coolify’s **Docker Compose build pack**. Coolify creates the service network and routes the configured domain through its proxy; the Compose file therefore does not define a custom network or a host port binding. Coolify’s documentation specifically warns against custom networks because they can make proxy routing intermittent.[1]

The browser sends an opaque local session token in the `Authorization` header. The token is hashed before it is stored in PostgreSQL. Passwords are stored as salted scrypt hashes. Existing business tables and numeric user IDs remain unchanged.

## 1. Preserve the existing data

Do not delete or pause the former database until the Coolify deployment has passed the acceptance test. From a machine with PostgreSQL client utilities installed, create both a full rollback archive and a data-only archive:

```bash
mkdir -p backups
export OLD_DATABASE_URL='postgresql://old-user:old-password@old-host:5432/old-database'
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

# Full rollback archive; keep this confidential and outside Git.
pg_dump --format=custom --schema=public --no-owner --no-acl \
  "$OLD_DATABASE_URL" > "backups/tailor-erp-$STAMP-full.dump"

# Data archive for import into the new schema. Do not copy old migration rows.
pg_dump --format=custom --schema=public --data-only --no-owner --no-acl \
  --exclude-table-data='*.__drizzle_migrations' \
  "$OLD_DATABASE_URL" > "backups/tailor-erp-$STAMP-data.dump"
```

The custom format is supported by `pg_restore`, but PostgreSQL warns that custom-format archives are sensitive to version differences between dump and restore tools. If the old database major version differs from the new Coolify PostgreSQL version, use a plain SQL dump and `psql` instead.[2] [3]

Keep both files outside the repository and restrict permissions:

```bash
chmod 600 backups/*.dump
```

## 2. Create the Coolify service stack

In Coolify, open the target project and choose **Create New Resource**. Select the GitHub repository through the GitHub App or deploy key, choose the branch `migration/self-hosted-hetzner` while reviewing the pull request, and select **Docker Compose** as the build pack. After the pull request is merged, change the branch to `main`.

Use these values in the Compose configuration:

| Coolify field | Value |
|---|---|
| Base directory | `/` |
| Docker Compose location | `docker-compose.yml` |
| Public service | `app` |
| Public port | `3000` |
| Database service | `postgres` |
| Database public exposure | Disabled |
| Persistent storage | Keep the `postgres_data` volume |

Coolify’s Compose build pack expects the Compose path relative to the base directory and allows services to communicate through their service names.[1] The application’s internal database hostname is therefore `postgres`, not a public DNS name.

The repository’s Compose file already includes a PostgreSQL health check, an application health check, the persistent `postgres_data` volume, and the `app` service’s internal port exposure. Do not add a custom `networks:` section or a public port mapping in the Coolify editor.

## 3. Configure Coolify environment variables

Add the following variables in the Coolify service-stack environment-variable screen. Use production values, not the placeholders shown below:

```dotenv
POSTGRES_DB=tailor_erp
POSTGRES_USER=erp
POSTGRES_PASSWORD=replace-with-a-long-random-password
DATABASE_URL=postgres://erp:replace-with-a-long-random-password@postgres:5432/tailor_erp
OWNER_EMAIL=owner@example.com
AUTH_BASE_URL=https://erp.example.com
ALLOWED_ORIGIN=https://erp.example.com
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

If the password contains URL-reserved characters, URL-encode it inside `DATABASE_URL`. Coolify supports managing environment variables in its UI; keep secrets there rather than committing them to Git.[4]

`AUTH_BASE_URL` is the public frontend URL used in password-reset links. `ALLOWED_ORIGIN` must exactly match the browser origin that Vercel serves. If both a production and preview frontend must call the API, use a comma-separated allow-list, for example:

```dotenv
ALLOWED_ORIGIN=https://erp.example.com,https://preview.example.vercel.app
```

Do not add database credentials or backend secrets to Vercel.

## 4. Configure the API domain and HTTPS

Create a DNS `A` or `AAAA` record such as `api.example.com` pointing to the Hetzner server. In the Coolify service-stack configuration, assign the public domain to the `app` service and set the exposed port to `3000`:

```text
https://api.example.com -> app:3000
```

Coolify’s proxy handles HTTPS and routing. The repository’s `Caddyfile.example` is retained only as a reference for deployments outside Coolify; it is not needed when Coolify’s proxy is active.

Enable the application health check. The image and Compose service both check:

```text
GET /api/auth/session
```

An unauthenticated deployment should return HTTP 200 with `{"authenticated":false,"user":null}`. Coolify can route traffic only to healthy containers when health checks are enabled; failed checks can result in `404` or “No available server” responses from the proxy.[5]

## 5. Deploy the initial stack

Trigger the first deployment from Coolify. Watch the deployment logs until the following sequence completes:

```text
PostgreSQL becomes healthy
Drizzle migrations run
The Express server starts on port 3000
The container health check passes
Coolify marks the app healthy
```

The Docker image runs `pnpm exec drizzle-kit migrate` before starting the API. The checked-in migration journal includes the complete sequence through `0006_local_auth`, including the previously omitted offline-delivery/payroll migrations. This creates the schema before the old business data is imported.

Do not import old data into the new database until the migration log shows success.

## 6. Import existing business data

The preferred path is to use the PostgreSQL resource’s **Import Backups** screen if your Coolify version exposes the database as a managed PostgreSQL resource. Coolify expects a custom-format archive made with `pg_dump -Fc`; its documentation also notes that plain or tar formats are safer across PostgreSQL major-version differences.[6]

For the Compose stack, use the Coolify terminal or an SSH shell on the Hetzner server to copy the data archive into the server and restore it into the running `postgres` service. The exact container name is generated by Coolify, so identify it from the service logs or `docker ps` rather than hard-coding a name:

```bash
# Run on the Hetzner host after the Coolify stack is healthy.
docker ps --format '{{.Names}}\t{{.Image}}' | grep 'postgres:16-alpine'

# Replace POSTGRES_CONTAINER with the generated Coolify container name.
export POSTGRES_CONTAINER='replace-with-coolify-postgres-container'
export DUMP_FILE='/opt/backups/tailor-erp-YYYYMMDDTHHMMSSZ-data.dump'

# Restore only application data; the archive excludes old Drizzle migration rows.
docker exec -i "$POSTGRES_CONTAINER" sh -c \
  'pg_restore --no-owner --no-acl --data-only --exit-on-error \
   -d "$POSTGRES_DB" -U "$POSTGRES_USER"' < "$DUMP_FILE"
```

If Coolify’s generated container is not reachable from the host shell, use the resource’s terminal or Coolify’s database import feature instead. Do not expose PostgreSQL to the public internet merely to perform the import.

After importing, redeploy or restart the `app` service so the API reconnects cleanly. Verify the existing customers, inventory, sales, invoices, tailoring orders, staff records, and role assignments before moving to user-password recovery.

## 7. Re-establish user access

The restored `users` rows retain names, email addresses, roles, approvals, and business relationships, but old hosted-auth password hashes are not imported. Generate private one-time reset links from the Coolify application terminal or a one-off shell in the backend container:

```bash
RESET_LINKS_FILE=/tmp/reset-links.json pnpm auth:reset-links
```

Copy the generated file through a secure operator channel, deliver each link only to its matching user, and delete the file immediately. Each link expires after one hour and is invalidated after use. The account matching `OWNER_EMAIL` becomes administrator automatically when it registers or signs in. Other new accounts follow the existing owner-approval workflow.

The **Forgot password?** form returns a neutral response. Because this no-cost deployment does not assume a paid mail provider, the operator must generate and deliver reset links privately. SMTP can be added later without changing the authentication schema.

## 8. Configure the Vercel frontend

Keep the existing Vercel project, but set this build-time variable for the required environments:

```text
VITE_API_URL=https://api.example.com
```

The repository’s `vercel.json` publishes only `dist/public` through `pnpm run build:frontend`; it no longer deploys a Vercel backend function. Deploy a new Vercel build after changing the variable because Vercel applies environment changes to new deployments.[7]

Open the deployed frontend and confirm that the browser can reach `https://api.example.com/api/auth/session`. A failed CORS preflight usually means `ALLOWED_ORIGIN` does not exactly match the Vercel origin.

## 9. Acceptance test before cutover

Use the Vercel production URL and verify the following:

| Area | Required check |
|---|---|
| Coolify routing | `https://api.example.com/api/auth/session` returns HTTP 200. |
| Static frontend | The Vercel deployment loads without a Vercel function error. |
| New authentication | Register a controlled account, sign in, refresh, and sign out. |
| Existing authentication | Use one generated reset link, set a new password, refresh, and sign in again. |
| Authorization | Confirm the owner is an administrator and a new non-owner remains pending until approved. |
| Database | Create a controlled customer, inventory item, sale, and audit entry; restart the app and verify persistence. |
| Storage | If staff documents are enabled, upload and download a controlled document. |
| Reset security | Generate a second reset link, confirm the first is invalid, and confirm an expired link is rejected. |
| Backup | Create a fresh PostgreSQL dump using Coolify’s backup feature or `scripts/backup-db.sh`. |

Keep the former deployment available until these checks pass. Only then change the normal staff workflow to the new Vercel deployment and Coolify API domain.

## 10. Routine Coolify operations

Use Coolify for normal deployments, restarts, logs, health checks, environment variables, and domain configuration. Use the repository scripts only from a trusted Coolify terminal or SSH session:

```bash
# From the application source directory when using an SSH deployment shell.
pnpm run check
pnpm test
pnpm run build

# From the Compose stack host when the script is available there.
./scripts/backup-db.sh
```

Schedule backups through Coolify’s PostgreSQL backup facility when available. Keep at least one copy outside the live Hetzner disk; a backup stored only on the same server does not protect against server or disk loss.

## References

[1]: https://coolify.io/docs/applications/build-packs/docker-compose "Coolify Docker Compose Build Packs"

[2]: https://www.postgresql.org/docs/current/app-pgdump.html "PostgreSQL pg_dump documentation"

[3]: https://www.postgresql.org/docs/current/app-pgrestore.html "PostgreSQL pg_restore documentation"

[4]: https://coolify.io/docs/knowledge-base/environment-variables "Coolify environment variables"

[5]: https://coolify.io/docs/knowledge-base/health-checks "Coolify health checks"

[6]: https://coolify.io/docs/databases/postgresql "Coolify PostgreSQL"

[7]: https://vercel.com/docs/environment-variables "Vercel environment variables"
