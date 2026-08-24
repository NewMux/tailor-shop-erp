import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pendingAccessRequests, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!database && ENV.databaseUrl) {
    const client = postgres(ENV.databaseUrl, { prepare: false });
    database = drizzle(client);
  }
  return database;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1))[0];
}

/**
 * Non-admin staff are intentionally allowed to sign in before approval. The
 * existing ERP access gate then keeps them out of business procedures until an
 * owner assigns a role, matching the original onboarding behavior.
 */
export async function ensurePendingAccess(userId: number, role: "user" | "admin") {
  if (role === "admin") return;
  const db = await getDb();
  if (!db) return;

  const existing = (
    await db
      .select()
      .from(pendingAccessRequests)
      .where(eq(pendingAccessRequests.userId, userId))
      .limit(1)
  )[0];

  if (!existing) {
    await db.insert(pendingAccessRequests).values({ userId, status: "pending" });
  } else if (existing.status === "rejected") {
    await db
      .update(pendingAccessRequests)
      .set({
        status: "pending",
        requestedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        note: null,
      })
      .where(and(eq(pendingAccessRequests.id, existing.id), eq(pendingAccessRequests.userId, userId)));
  }
}
