import postgres from "postgres";

// Grants full owner-level access (framework admin + ERP "admin" business role)
// to the given user emails. Run without emails to list existing accounts.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const emails = process.argv.slice(2).map(email => email.trim().toLowerCase()).filter(Boolean);
const sql = postgres(databaseUrl, { prepare: false });

if (!emails.length) {
  const users = await sql`
    SELECT u."id", u."name", u."email", u."role", b."role" AS "businessRole", b."isActive"
    FROM "users" u LEFT JOIN "userBusinessRoles" b ON b."userId" = u."id"
    ORDER BY u."id"
  `;
  console.table(users);
  console.log("Usage: node scripts/grant-super-admin.mjs <email> [email...]");
  await sql.end();
  process.exit(0);
}

let missing = 0;
for (const email of emails) {
  const user = (await sql`SELECT "id", "name", "email" FROM "users" WHERE lower("email") = ${email} LIMIT 1`)[0];
  if (!user) {
    console.error(`No account found for ${email}. Ask them to sign up first, then rerun.`);
    missing += 1;
    continue;
  }
  await sql.begin(async tx => {
    await tx`UPDATE "users" SET "role" = 'admin', "updatedAt" = now() WHERE "id" = ${user.id}`;
    await tx`
      INSERT INTO "userBusinessRoles" ("userId", "role", "isActive")
      VALUES (${user.id}, 'admin', true)
      ON CONFLICT ("userId") DO UPDATE SET "role" = 'admin', "isActive" = true, "updatedAt" = now()
    `;
    // A custom role would otherwise narrow permissions; admins bypass it, but clear it to keep the team list accurate.
    await tx`DELETE FROM "userCustomRoles" WHERE "userId" = ${user.id}`;
    await tx`UPDATE "pendingAccessRequests" SET "status" = 'approved', "reviewedAt" = now() WHERE "userId" = ${user.id}`;
    await tx`
      INSERT INTO "auditLogs" ("actorId", "action", "entityType", "entityId", "detailsJson")
      VALUES (${user.id}, 'SUPER_ADMIN_GRANTED', 'user', ${user.id}, ${JSON.stringify({ via: "scripts/grant-super-admin.mjs" })})
    `;
  });
  console.log(`Granted Super Admin to ${user.name || "(no name)"} <${user.email}> (user #${user.id}).`);
}

await sql.end();
if (missing) process.exit(1);
