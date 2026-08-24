# Al-Mamlaka Tailor ERP

This repository contains the React/Vite frontend and Express/tRPC backend for the tailor-shop ERP. PostgreSQL, the backend, and local email/password authentication run on the existing Hetzner server. Vercel is used only to publish the static frontend.

## Development

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
```

To run the standalone server locally, create a `.env` from `.env.example`, set `DATABASE_URL`, and run `pnpm start`. The frontend-only command used by Vercel is `pnpm run build:frontend`.

## Production deployment

Read [HETZNER_DEPLOYMENT.md](./HETZNER_DEPLOYMENT.md) before cutover. It describes the PostgreSQL backup and restore sequence, Coolify Docker Compose deployment, Coolify HTTPS domains and health checks, Vercel `VITE_API_URL` configuration, existing-user password reset links, acceptance testing, and recurring backups.

The main operator guide is [ERP-HANDOVER-MANUAL.md](./ERP-HANDOVER-MANUAL.md). Do not commit `.env` files, database dumps, reset-link files, or production credentials.
