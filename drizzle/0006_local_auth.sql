ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" text;

CREATE TABLE IF NOT EXISTS "authSessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "tokenHash" varchar(128) NOT NULL UNIQUE,
  "userId" integer NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "lastUsedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "authSessions_userId_idx" ON "authSessions" ("userId");
CREATE INDEX IF NOT EXISTS "authSessions_expiresAt_idx" ON "authSessions" ("expiresAt");

CREATE TABLE IF NOT EXISTS "passwordResetTokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "tokenHash" varchar(128) NOT NULL UNIQUE,
  "userId" integer NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "passwordResetTokens_userId_idx" ON "passwordResetTokens" ("userId");
CREATE INDEX IF NOT EXISTS "passwordResetTokens_expiresAt_idx" ON "passwordResetTokens" ("expiresAt");