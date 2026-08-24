import { createHash, randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const authBaseUrl = (process.env.AUTH_BASE_URL || "").replace(/\/$/, "");
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!authBaseUrl) throw new Error("AUTH_BASE_URL is required");

const sql = postgres(databaseUrl, { prepare: false });
const users = await sql`SELECT "id", "name", "email" FROM "users" WHERE "email" IS NOT NULL ORDER BY "id"`;
const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
const links = [];

for (const user of users) {
  const token = `reset_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`DELETE FROM "passwordResetTokens" WHERE "userId" = ${user.id}`;
  await sql`
    INSERT INTO "passwordResetTokens" ("tokenHash", "userId", "expiresAt")
    VALUES (${tokenHash}, ${user.id}, ${expiresAt})
  `;
  links.push({
    userId: user.id,
    name: user.name,
    email: user.email,
    expiresAt: expiresAt.toISOString(),
    resetUrl: `${authBaseUrl}/?reset_token=${encodeURIComponent(token)}`,
  });
}

const outputPath = process.env.RESET_LINKS_FILE || `reset-links-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(outputPath, `${JSON.stringify(links, null, 2)}\n`, { mode: 0o600 });
await chmod(outputPath, 0o600);
await sql.end();
console.log(`Created ${links.length} one-time reset links in ${outputPath}`);
console.log("Treat this file as a secret and deliver each link privately to the matching user.");
