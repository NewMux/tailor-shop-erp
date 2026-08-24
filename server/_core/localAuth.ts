import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { authSessions, passwordResetTokens, users, type User } from "../../drizzle/schema";
import { ensurePendingAccess, getDb, getUserByEmail, getUserById } from "../db";
import { ENV } from "./env";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const SESSION_COOKIE = "erp_session";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `$scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[1] !== "scrypt") return false;
  const salt = Buffer.from(parts[2], "base64url");
  const expected = Buffer.from(parts[3], "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function randomToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function tokenFromRequest(req: Request) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7).trim() || undefined;
  }
  return readCookie(req, SESSION_COOKIE);
}

function setSessionCookie(res: Response, token: string) {
  const sameSite = ENV.secureCookies ? "None" : "Lax";
  const secure = ENV.secureCookies ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`,
  );
}

function clearSessionCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${ENV.secureCookies ? "None" : "Lax"}; Max-Age=0${ENV.secureCookies ? "; Secure" : ""}`,
  );
}

function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function createSession(userId: number) {
  const db = await getDb();
  if (!db) throw new AuthError("Database unavailable", 503, "DATABASE_UNAVAILABLE");
  const now = new Date();
  await db.delete(authSessions).where(and(eq(authSessions.userId, userId), lt(authSessions.expiresAt, now)));
  const token = randomToken("local");
  await db.insert(authSessions).values({
    tokenHash: hashOpaqueToken(token),
    userId,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    lastUsedAt: now,
  });
  return token;
}

async function revokeSession(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashOpaqueToken(token)));
}

export async function getUserForRequest(req: Request): Promise<User | undefined> {
  const token = tokenFromRequest(req);
  if (!token) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();
  const session = (
    await db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.tokenHash, hashOpaqueToken(token)), gt(authSessions.expiresAt, now)))
      .limit(1)
  )[0];
  if (!session) return undefined;
  await db.update(authSessions).set({ lastUsedAt: now }).where(eq(authSessions.id, session.id));
  return getUserById(session.userId);
}

async function createResetToken(userId: number) {
  const db = await getDb();
  if (!db) throw new AuthError("Database unavailable", 503, "DATABASE_UNAVAILABLE");
  const rawToken = randomToken("reset");
  const now = new Date();
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.insert(passwordResetTokens).values({
    tokenHash: hashOpaqueToken(rawToken),
    userId,
    expiresAt: new Date(now.getTime() + RESET_TTL_MS),
  });
  return rawToken;
}

function resetUrl(req: Request, token: string) {
  const base = ENV.authBaseUrl || req.headers.origin || "";
  return `${base.replace(/\/$/, "")}/?reset_token=${encodeURIComponent(token)}`;
}

async function register(req: Request, res: Response) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (name.length < 2 || name.length > 160) throw new AuthError("Enter a valid full name.");
  if (!email || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) throw new AuthError("Enter a valid email address.");
  if (password.length < 8 || password.length > 200) throw new AuthError("Password must be between 8 and 200 characters.");

  const db = await getDb();
  if (!db) throw new AuthError("Database unavailable", 503, "DATABASE_UNAVAILABLE");
  if (await getUserByEmail(email)) throw new AuthError("An account already exists for this email. Use the password reset option.", 409, "ACCOUNT_EXISTS");

  const passwordHash = await hashPassword(password);
  const role = ENV.ownerEmail && email === ENV.ownerEmail ? "admin" : "user";
  const inserted = await db
    .insert(users)
    .values({
      openId: `local_${randomUUID()}`,
      name,
      email,
      passwordHash,
      loginMethod: "local",
      role,
    })
    .returning();
  const user = inserted[0];
  if (!user) throw new AuthError("Unable to create the account", 500, "ACCOUNT_CREATE_FAILED");
  await ensurePendingAccess(user.id, user.role);
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: publicUser(user), token });
}

async function login(req: Request, res: Response) {
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = email ? await getUserByEmail(email) : undefined;
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    if (user && !user.passwordHash) {
      throw new AuthError("This account needs a password reset before it can sign in.", 401, "PASSWORD_RESET_REQUIRED");
    }
    throw new AuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }
  await ensurePendingAccess(user.id, user.role);
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: publicUser(user), token });
}

async function forgotPassword(req: Request, res: Response) {
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const user = email ? await getUserByEmail(email) : undefined;
  let resetUrlValue: string | undefined;
  if (user) {
    const token = await createResetToken(user.id);
    resetUrlValue = resetUrl(req, token);
    console.info(`[Auth] Password reset link for ${email}: ${resetUrlValue}`);
  }
  res.json({
    message: "If an account exists for this email, a reset link has been generated for the server administrator.",
    ...(ENV.isProduction ? {} : { resetUrl: resetUrlValue }),
  });
}

async function resetPassword(req: Request, res: Response) {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || password.length < 8 || password.length > 200) throw new AuthError("The reset token or new password is invalid.");

  const db = await getDb();
  if (!db) throw new AuthError("Database unavailable", 503, "DATABASE_UNAVAILABLE");
  const now = new Date();
  const reset = (
    await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, hashOpaqueToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
      .limit(1)
  )[0];
  if (!reset) throw new AuthError("This password reset link is invalid or expired.", 400, "RESET_TOKEN_INVALID");

  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash, loginMethod: "local", updatedAt: now }).where(eq(users.id, reset.userId));
  await db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, reset.id));
  await db.delete(authSessions).where(eq(authSessions.userId, reset.userId));
  const user = await getUserById(reset.userId);
  if (!user) throw new AuthError("Account not found", 404, "ACCOUNT_NOT_FOUND");
  await ensurePendingAccess(user.id, user.role);
  const sessionToken = await createSession(user.id);
  setSessionCookie(res, sessionToken);
  res.json({ user: publicUser({ ...user, passwordHash }), token: sessionToken });
}

function sendError(res: Response, error: unknown) {
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error("[Auth] Unexpected error", error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Authentication service unavailable." } });
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      await register(req, res);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      await login(req, res);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/auth/forgot", async (req, res) => {
    try {
      await forgotPassword(req, res);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/auth/reset", async (req, res) => {
    try {
      await resetPassword(req, res);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const user = await getUserForRequest(req);
      res.json({ authenticated: Boolean(user), user: user ? publicUser(user) : null });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await revokeSession(tokenFromRequest(req));
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });
}
