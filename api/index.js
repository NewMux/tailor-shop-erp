// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var DEFAULT_SUPABASE_URL = "https://cevoyflcdsdkhigyunlv.supabase.co";
function cleanEnvironmentValue(value) {
  return value?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}
function validSupabaseUrl(...candidates) {
  for (const candidate of candidates) {
    const value = cleanEnvironmentValue(candidate);
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co")) {
        return parsed.toString().replace(/\/$/, "");
      }
    } catch {
    }
  }
  return DEFAULT_SUPABASE_URL;
}
var ENV = {
  databaseUrl: cleanEnvironmentValue(process.env.DATABASE_URL),
  // Prefer server-only Supabase settings for token verification. The VITE_
  // variables remain a backwards-compatible fallback for an existing deploy,
  // but should not be the server's source of truth.
  supabaseUrl: validSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL),
  supabaseAnonKey: cleanEnvironmentValue(
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  ),
  // Email address (case-insensitive) that is automatically granted the admin
  // role the first time it signs in. Set this to the shop owner's login email.
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// shared/const.ts
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/erp.ts
import { and, desc, eq as eq2, gte, like, lte, max, or, sql } from "drizzle-orm";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// drizzle/schema.ts
import { boolean, date, decimal, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
var userRoleEnum = pgEnum("user_role", ["user", "admin"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 320 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var businessRoles = ["admin", "sales", "tailor", "inventory", "payroll"];
var businessRoleEnum = pgEnum("business_role", businessRoles);
var accessRequestStatusEnum = pgEnum("access_request_status", ["pending", "approved", "rejected"]);
var tailoringOrderStatusEnum = pgEnum("tailoring_order_status", ["draft", "confirmed", "cutting", "stitching", "fitting", "ready", "handed_over", "cancelled"]);
var inventoryCategoryEnum = pgEnum("inventory_category", ["fabric", "lining", "buttons", "thread", "accessory", "other"]);
var inventoryItemTypeEnum = pgEnum("inventory_item_type", ["material", "item"]);
var stockMovementTypeEnum = pgEnum("stock_movement_type", ["opening", "adjustment", "sale", "return", "purchase"]);
var serviceCategoryEnum = pgEnum("service_category", ["tailoring", "fabric", "alteration", "accessory", "other"]);
var paymentMethodEnum = pgEnum("payment_method", ["cash", "benefitpay", "bank_transfer", "credit_card"]);
var paymentStatusEnum = pgEnum("payment_status", ["paid", "partial", "unpaid"]);
var invoiceDeliveryChannelEnum = pgEnum("invoice_delivery_channel", ["email", "whatsapp", "share"]);
var invoiceDeliveryStatusEnum = pgEnum("invoice_delivery_status", ["prepared", "sent", "failed"]);
var saleSourceEnum = pgEnum("sale_source", ["counter", "manual", "tailoring"]);
var posSessionStatusEnum = pgEnum("pos_session_status", ["open", "closed"]);
var posOrderStatusEnum = pgEnum("pos_order_status", ["held", "open", "paid", "cancelled", "refunded"]);
var discountTypeEnum = pgEnum("discount_type", ["percent", "amount"]);
var invoiceStatusEnum = pgEnum("invoice_status", ["paid", "partial", "unpaid", "void"]);
var attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "leave", "half_day"]);
var userBusinessRoles = pgTable("userBusinessRoles", { id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), role: businessRoleEnum("role").notNull().default("sales"), isActive: boolean("isActive").notNull().default(true), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var customRoles = pgTable("customRoles", { id: serial("id").primaryKey(), name: varchar("name", { length: 80 }).notNull().unique(), description: varchar("description", { length: 320 }), permissionsJson: jsonb("permissionsJson").notNull(), isActive: boolean("isActive").notNull().default(true), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var userCustomRoles = pgTable("userCustomRoles", { id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), customRoleId: integer("customRoleId").notNull(), isActive: boolean("isActive").notNull().default(true), updatedBy: integer("updatedBy").notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var pendingAccessRequests = pgTable("pendingAccessRequests", { id: serial("id").primaryKey(), userId: integer("userId").notNull().unique(), status: accessRequestStatusEnum("status").notNull().default("pending"), requestedAt: timestamp("requestedAt").defaultNow().notNull(), reviewedAt: timestamp("reviewedAt"), reviewedBy: integer("reviewedBy"), note: varchar("note", { length: 500 }) });
var staffAccessInvites = pgTable("staffAccessInvites", { id: serial("id").primaryKey(), name: varchar("name", { length: 160 }).notNull(), email: varchar("email", { length: 320 }).notNull().unique(), customRoleId: integer("customRoleId").notNull(), isActive: boolean("isActive").notNull().default(true), invitedBy: integer("invitedBy").notNull(), invitedAt: timestamp("invitedAt").defaultNow().notNull(), acceptedByUserId: integer("acceptedByUserId"), acceptedAt: timestamp("acceptedAt") });
var shopSettings = pgTable("shopSettings", { id: serial("id").primaryKey(), shopName: varchar("shopName", { length: 160 }).notNull(), arabicShopName: varchar("arabicShopName", { length: 160 }), crNumber: varchar("crNumber", { length: 80 }), currency: varchar("currency", { length: 8 }).notNull().default("BHD"), phone: varchar("phone", { length: 50 }), email: varchar("email", { length: 320 }), address: text("address"), invoiceTerms: text("invoiceTerms"), invoicePrefix: varchar("invoicePrefix", { length: 16 }).notNull().default("INV"), vatEnabled: boolean("vatEnabled").notNull().default(false), vatRate: decimal("vatRate", { precision: 5, scale: 3 }).notNull().default("10.000"), vatNumber: varchar("vatNumber", { length: 80 }), updatedBy: integer("updatedBy"), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var customers = pgTable("customers", { id: serial("id").primaryKey(), name: varchar("name", { length: 160 }).notNull(), phone: varchar("phone", { length: 50 }).notNull(), email: varchar("email", { length: 320 }), address: text("address"), notes: text("notes"), preferredContact: varchar("preferredContact", { length: 40 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var measurementProfiles = pgTable("measurementProfiles", { id: serial("id").primaryKey(), customerId: integer("customerId").notNull(), version: integer("version").notNull(), measurementsJson: jsonb("measurementsJson").notNull(), fitPreference: varchar("fitPreference", { length: 100 }), collarStyle: varchar("collarStyle", { length: 100 }), pocketStyle: varchar("pocketStyle", { length: 100 }), notes: text("notes"), effectiveDate: date("effectiveDate", { mode: "date" }).notNull(), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var tailoringOrders = pgTable("tailoringOrders", { id: serial("id").primaryKey(), orderNumber: varchar("orderNumber", { length: 60 }).notNull().unique(), customerId: integer("customerId").notNull(), saleId: integer("saleId"), measurementProfileId: integer("measurementProfileId"), assignedTailorId: integer("assignedTailorId"), garmentType: varchar("garmentType", { length: 80 }).notNull().default("Thoub"), quantity: integer("quantity").notNull().default(1), status: tailoringOrderStatusEnum("status").notNull().default("draft"), dueDate: date("dueDate", { mode: "date" }), price: decimal("price", { precision: 12, scale: 3 }).notNull().default("0"), customerSuppliedFabric: boolean("customerSuppliedFabric").notNull().default(false), fabricNotes: text("fabricNotes"), notes: text("notes"), productionNotes: text("productionNotes"), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var inventoryItems = pgTable("inventoryItems", { id: serial("id").primaryKey(), code: varchar("code", { length: 60 }).notNull().unique(), name: varchar("name", { length: 160 }).notNull(), inventoryType: inventoryItemTypeEnum("inventoryType").notNull().default("material"), category: inventoryCategoryEnum("category").notNull(), color: varchar("color", { length: 60 }), size: varchar("size", { length: 60 }), widthInches: decimal("widthInches", { precision: 10, scale: 2 }), unit: varchar("unit", { length: 40 }).notNull().default("Meters"), quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull().default("0"), rollCount: integer("rollCount").notNull().default(0), metersPerRoll: decimal("metersPerRoll", { precision: 12, scale: 3 }), minThreshold: decimal("minThreshold", { precision: 12, scale: 3 }).notNull().default("0"), costPerUnit: decimal("costPerUnit", { precision: 12, scale: 3 }).notNull().default("0"), salePrice: decimal("salePrice", { precision: 12, scale: 3 }).notNull().default("0"), isActive: boolean("isActive").notNull().default(true), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var stockMovements = pgTable("stockMovements", { id: serial("id").primaryKey(), inventoryItemId: integer("inventoryItemId").notNull(), movementType: stockMovementTypeEnum("movementType").notNull(), quantityChange: decimal("quantityChange", { precision: 12, scale: 3 }).notNull(), quantityBefore: decimal("quantityBefore", { precision: 12, scale: 3 }).notNull(), quantityAfter: decimal("quantityAfter", { precision: 12, scale: 3 }).notNull(), referenceType: varchar("referenceType", { length: 40 }), referenceId: integer("referenceId"), notes: text("notes"), createdBy: integer("createdBy"), createdAt: timestamp("createdAt").defaultNow().notNull() });
var services = pgTable("services", { id: serial("id").primaryKey(), sku: varchar("sku", { length: 60 }).notNull().unique(), name: varchar("name", { length: 160 }).notNull(), category: serviceCategoryEnum("category").notNull(), description: text("description"), unitPrice: decimal("unitPrice", { precision: 12, scale: 3 }).notNull(), inventoryItemId: integer("inventoryItemId"), defaultFabricMeters: decimal("defaultFabricMeters", { precision: 12, scale: 3 }), isActive: boolean("isActive").notNull().default(true), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var sales = pgTable("sales", { id: serial("id").primaryKey(), saleNumber: varchar("saleNumber", { length: 60 }).notNull().unique(), clientReference: varchar("clientReference", { length: 120 }).unique(), customerId: integer("customerId"), customerNameSnapshot: varchar("customerNameSnapshot", { length: 160 }).notNull(), customerPhoneSnapshot: varchar("customerPhoneSnapshot", { length: 50 }), subtotal: decimal("subtotal", { precision: 12, scale: 3 }).notNull(), discount: decimal("discount", { precision: 12, scale: 3 }).notNull().default("0"), vatRate: decimal("vatRate", { precision: 5, scale: 3 }).notNull().default("0"), vatAmount: decimal("vatAmount", { precision: 12, scale: 3 }).notNull().default("0"), total: decimal("total", { precision: 12, scale: 3 }).notNull(), paidAmount: decimal("paidAmount", { precision: 12, scale: 3 }).notNull().default("0"), paymentMethod: paymentMethodEnum("paymentMethod").notNull(), paymentStatus: paymentStatusEnum("paymentStatus").notNull().default("paid"), source: saleSourceEnum("source").notNull().default("counter"), sessionId: integer("sessionId"), discountCodeId: integer("discountCodeId"), discountCodeSnapshot: varchar("discountCodeSnapshot", { length: 80 }), returnOfSaleId: integer("returnOfSaleId"), returnMode: varchar("returnMode", { length: 20 }), returnReason: text("returnReason"), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var saleItems = pgTable("saleItems", { id: serial("id").primaryKey(), saleId: integer("saleId").notNull(), serviceId: integer("serviceId"), inventoryItemId: integer("inventoryItemId"), nameSnapshot: varchar("nameSnapshot", { length: 160 }).notNull(), quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(), unitPrice: decimal("unitPrice", { precision: 12, scale: 3 }).notNull(), lineDiscount: decimal("lineDiscount", { precision: 12, scale: 3 }).notNull().default("0"), lineTotal: decimal("total", { precision: 12, scale: 3 }).notNull(), assignedTailorId: integer("assignedTailorId"), measurementProfileId: integer("measurementProfileId") });
var posSessions = pgTable("posSessions", { id: serial("id").primaryKey(), sessionNumber: varchar("sessionNumber", { length: 60 }).notNull().unique(), status: posSessionStatusEnum("status").notNull().default("open"), openedBy: integer("openedBy").notNull(), openingCash: decimal("openingCash", { precision: 12, scale: 3 }).notNull().default("0"), closingCash: decimal("closingCash", { precision: 12, scale: 3 }), openedAt: timestamp("openedAt").defaultNow().notNull(), closedAt: timestamp("closedAt"), notes: text("notes") });
var posOrders = pgTable("posOrders", { id: serial("id").primaryKey(), orderNumber: varchar("orderNumber", { length: 60 }).notNull().unique(), sessionId: integer("sessionId"), customerId: integer("customerId"), status: posOrderStatusEnum("status").notNull().default("held"), cartJson: jsonb("cartJson").notNull(), note: text("note"), createdBy: integer("createdBy").notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), heldAt: timestamp("heldAt").defaultNow().notNull() });
var posPayments = pgTable("posPayments", { id: serial("id").primaryKey(), saleId: integer("saleId").notNull(), method: paymentMethodEnum("method").notNull(), amount: decimal("amount", { precision: 12, scale: 3 }).notNull(), reference: varchar("reference", { length: 160 }), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var discountCodes = pgTable("discountCodes", { id: serial("id").primaryKey(), code: varchar("code", { length: 80 }).notNull().unique(), type: discountTypeEnum("type").notNull(), value: decimal("value", { precision: 12, scale: 3 }).notNull(), maxDiscount: decimal("maxDiscount", { precision: 12, scale: 3 }), minSubtotal: decimal("minSubtotal", { precision: 12, scale: 3 }).notNull().default("0"), usageLimit: integer("usageLimit"), usedCount: integer("usedCount").notNull().default(0), isActive: boolean("isActive").notNull().default(true), expiresAt: timestamp("expiresAt"), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var invoices = pgTable("invoices", { id: serial("id").primaryKey(), saleId: integer("saleId").notNull().unique(), invoiceNumber: varchar("invoiceNumber", { length: 60 }).notNull().unique(), status: invoiceStatusEnum("status").notNull(), issuedAt: timestamp("issuedAt").defaultNow().notNull(), dueDate: date("dueDate", { mode: "date" }), notes: text("notes") });
var invoiceDeliveries = pgTable("invoiceDeliveries", { id: serial("id").primaryKey(), invoiceId: integer("invoiceId").notNull(), channel: invoiceDeliveryChannelEnum("channel").notNull(), recipient: varchar("recipient", { length: 320 }), status: invoiceDeliveryStatusEnum("status").notNull().default("prepared"), message: text("message"), error: text("error"), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var customerBalanceDeliveries = pgTable("customerBalanceDeliveries", { id: serial("id").primaryKey(), customerId: integer("customerId").notNull(), channel: invoiceDeliveryChannelEnum("channel").notNull(), recipient: varchar("recipient", { length: 320 }), status: invoiceDeliveryStatusEnum("status").notNull().default("prepared"), message: text("message"), error: text("error"), createdBy: integer("createdBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var staffProfiles = pgTable("staffProfiles", { id: serial("id").primaryKey(), userId: integer("userId"), name: varchar("name", { length: 160 }).notNull(), phone: varchar("phone", { length: 50 }), jobTitle: varchar("jobTitle", { length: 100 }).notNull(), baseSalary: decimal("baseSalary", { precision: 12, scale: 3 }).notNull(), commissionRate: decimal("commissionRate", { precision: 8, scale: 3 }).notNull().default("0"), isActive: boolean("isActive").notNull().default(true), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull() });
var staffDocuments = pgTable("staffDocuments", { id: serial("id").primaryKey(), staffProfileId: integer("staffProfileId").notNull(), label: varchar("label", { length: 120 }).notNull(), fileName: varchar("fileName", { length: 255 }).notNull(), contentType: varchar("contentType", { length: 120 }).notNull(), storageKey: varchar("storageKey", { length: 500 }).notNull(), storageUrl: varchar("storageUrl", { length: 600 }).notNull(), uploadedBy: integer("uploadedBy").notNull(), uploadedAt: timestamp("uploadedAt").defaultNow().notNull() });
var attendance = pgTable("attendance", { id: serial("id").primaryKey(), staffProfileId: integer("staffProfileId").notNull(), workDate: date("workDate", { mode: "date" }).notNull(), status: attendanceStatusEnum("status").notNull(), absenceReason: varchar("absenceReason", { length: 40 }), absenceDetails: text("absenceDetails"), absenceDocumentId: integer("absenceDocumentId"), absenceDeduction: decimal("absenceDeduction", { precision: 12, scale: 3 }).notNull().default("0"), notes: text("notes"), recordedBy: integer("recordedBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var performanceRecords = pgTable("performanceRecords", { id: serial("id").primaryKey(), staffProfileId: integer("staffProfileId").notNull(), workDate: date("workDate", { mode: "date" }).notNull(), metric: varchar("metric", { length: 120 }).notNull(), units: decimal("units", { precision: 12, scale: 3 }).notNull(), commissionEarned: decimal("commissionEarned", { precision: 12, scale: 3 }).notNull().default("0"), notes: text("notes"), recordedBy: integer("recordedBy").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
var salaryPayouts = pgTable("salaryPayouts", { id: serial("id").primaryKey(), staffProfileId: integer("staffProfileId").notNull(), payPeriod: varchar("payPeriod", { length: 20 }).notNull(), payslipNumber: varchar("payslipNumber", { length: 60 }).unique(), baseSalary: decimal("baseSalary", { precision: 12, scale: 3 }).notNull(), allowances: decimal("allowances", { precision: 12, scale: 3 }).notNull().default("0"), overtime: decimal("overtime", { precision: 12, scale: 3 }).notNull().default("0"), performanceBonus: decimal("performanceBonus", { precision: 12, scale: 3 }).notNull().default("0"), deductions: decimal("deductions", { precision: 12, scale: 3 }).notNull().default("0"), deductionDetails: text("deductionDetails"), netSalary: decimal("netSalary", { precision: 12, scale: 3 }).notNull(), notes: text("notes"), approvedBy: integer("approvedBy").notNull(), paidAt: timestamp("paidAt").defaultNow().notNull() });
var auditLogs = pgTable("auditLogs", { id: serial("id").primaryKey(), actorId: integer("actorId").notNull(), action: varchar("action", { length: 100 }).notNull(), entityType: varchar("entityType", { length: 80 }).notNull(), entityId: integer("entityId"), detailsJson: text("detailsJson"), createdAt: timestamp("createdAt").defaultNow().notNull() });

// server/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
var database = null;
async function getDb() {
  if (!database && ENV.databaseUrl) {
    const client = postgres(ENV.databaseUrl, { prepare: false });
    database = drizzle(client);
  }
  return database;
}
async function upsertUser(user) {
  const db = await getDb();
  if (!db || !user.openId) return;
  const isOwner = (user.email ?? "").toLowerCase() === ENV.ownerEmail && ENV.ownerEmail.length > 0;
  const values = { ...user, lastSignedIn: user.lastSignedIn || /* @__PURE__ */ new Date(), role: isOwner ? "admin" : user.role || "user" };
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn, role: values.role } });
  if (isOwner) return;
  const signedInUser = (await db.select().from(users).where(eq(users.openId, values.openId)).limit(1))[0];
  if (!signedInUser) return;
  const existing = (await db.select().from(pendingAccessRequests).where(eq(pendingAccessRequests.userId, signedInUser.id)).limit(1))[0];
  if (!existing) await db.insert(pendingAccessRequests).values({ userId: signedInUser.id, status: "pending" });
  else if (existing.status === "rejected") await db.update(pendingAccessRequests).set({ status: "pending", requestedAt: /* @__PURE__ */ new Date(), reviewedAt: null, reviewedBy: null, note: null }).where(eq(pendingAccessRequests.id, existing.id));
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}

// server/erp.ts
var adminRoles = ["admin"];
var salesRoles = ["admin", "sales"];
var catalogRoles = ["admin", "sales", "inventory"];
var inventoryRoles = ["admin", "inventory"];
var payrollRoles = ["admin", "payroll"];
var tailoringRoles = ["admin", "sales", "tailor"];
var staffDirectoryRoles = ["admin", "payroll", "sales", "tailor"];
var staffDocumentMimeTypes = /* @__PURE__ */ new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
var staffDocumentExtensions = /* @__PURE__ */ new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"]);
var customPermissionValues = ["dashboard", "customers", "sales", "inventory", "payroll", "production"];
var legacyPermissions = { admin: ["dashboard", "customers", "sales", "inventory", "payroll", "production"], sales: ["dashboard", "customers", "sales"], tailor: ["customers", "production"], inventory: ["inventory"], payroll: ["payroll"] };
var customRoleCanAccess = (permissions, allowed) => allowed.filter((role) => role !== "admin").some((role) => legacyPermissions[role].some((permission) => permissions.includes(permission)));
var three = (value) => value.toFixed(3);
var getMonthBounds = (payPeriod) => {
  const start = /* @__PURE__ */ new Date(`${payPeriod}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end: new Date(end.getTime() - 1) };
};
var absenceDeductionFor = (baseSalary, status, payPeriod) => {
  const [year, month] = payPeriod.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daily = baseSalary / daysInMonth;
  return status === "absent" ? daily : status === "half_day" ? daily / 2 : 0;
};
var id = (result) => {
  const row = Array.isArray(result) ? result[0] : result;
  return Number(row?.id || 0);
};
var dashboardRange = z2.enum(["today", "7d", "30d", "90d", "all", "custom"]);
var getDashboardRangeStart = (range, now = /* @__PURE__ */ new Date()) => {
  const start = new Date(now);
  if (range === "all") return null;
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "90d") start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);
  return start;
};
var getCustomDashboardRange = (startDate, endDate) => ({ start: /* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`), end: /* @__PURE__ */ new Date(`${endDate}T23:59:59.999Z`) });
var dashboardInput = z2.object({ range: dashboardRange, startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).superRefine((value, ctx) => {
  if (value.range === "custom" && (!value.startDate || !value.endDate)) ctx.addIssue({ code: "custom", message: "Choose both a start and end date for a custom period." });
  if (value.range === "custom" && value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The custom period end date must be on or after its start date." });
});
var salesSource = z2.enum(["counter", "manual", "tailoring"]);
var salesHistoryInput = z2.object({ search: z2.string().max(160).optional(), source: salesSource.optional(), paymentStatus: z2.enum(["paid", "partial", "unpaid"]).optional(), startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date." });
});
var invoiceListInput = z2.object({ search: z2.string().max(160).optional(), status: z2.enum(["paid", "partial", "unpaid"]).optional(), source: salesSource.optional(), paymentMethod: z2.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]).optional(), startDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date." });
});
var manualSaleInput = z2.object({ customerId: z2.number().int().positive().optional(), customerName: z2.string().trim().min(2).max(160), customerPhone: z2.string().trim().max(50), description: z2.string().trim().min(2).max(160), quantity: z2.number().positive().max(999), unitPrice: z2.number().positive().max(1e6), discount: z2.number().min(0).max(1e6), paymentMethod: z2.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]), paymentStatus: z2.enum(["paid", "partial", "unpaid"]), notes: z2.string().max(2e3) }).superRefine((value, ctx) => {
  if (value.discount > value.quantity * value.unitPrice) ctx.addIssue({ code: "custom", path: ["discount"], message: "Discount cannot exceed the sale subtotal." });
});
var monthInput = z2.object({ month: z2.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid report month.") });
var getMonthWindow = (month) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthIndex - 1, 1)), end: new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999)) };
};
async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  return db;
}
async function access(userId, frameworkRole, allowed) {
  const db = await dbOrThrow();
  let record = (await db.select().from(userBusinessRoles).where(eq2(userBusinessRoles.userId, userId)).limit(1))[0];
  if (!record) {
    if (frameworkRole !== "admin") {
      const request = (await db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.userId, userId)).limit(1))[0];
      const message = request?.status === "rejected" ? "Your ERP access request was not approved. Contact the shop owner." : "Your ERP access request is awaiting owner approval.";
      throw new TRPCError3({ code: "FORBIDDEN", message });
    }
    await db.insert(userBusinessRoles).values({ userId, role: "admin", isActive: true });
    record = (await db.select().from(userBusinessRoles).where(eq2(userBusinessRoles.userId, userId)).limit(1))[0];
  }
  if (!record?.isActive) throw new TRPCError3({ code: "FORBIDDEN", message: "Your ERP access is inactive." });
  if (record.role === "admin") return record.role;
  const assignment = (await db.select().from(userCustomRoles).where(eq2(userCustomRoles.userId, userId)).limit(1))[0];
  if (assignment) {
    const role = (await db.select().from(customRoles).where(eq2(customRoles.id, assignment.customRoleId)).limit(1))[0];
    const permissions = Array.isArray(role?.permissionsJson) ? role.permissionsJson.filter((value) => typeof value === "string") : [];
    if (!assignment.isActive || !role?.isActive || !customRoleCanAccess(permissions, allowed)) throw new TRPCError3({ code: "FORBIDDEN", message: "Your owner-assigned role is not permitted to perform this action." });
    return `custom:${role.name}`;
  }
  if (allowed.includes(record.role)) return record.role;
  throw new TRPCError3({ code: "FORBIDDEN", message: "Your assigned role is not permitted to perform this action." });
}
async function audit(userId, action, entityType, entityId, details) {
  const db = await dbOrThrow();
  await db.insert(auditLogs).values({ actorId: userId, action, entityType, entityId, detailsJson: details ? JSON.stringify(details) : null });
}
var customerInput = z2.object({ name: z2.string().min(2).max(160), phone: z2.string().min(4).max(50), email: z2.string().email().or(z2.literal("")), address: z2.string().max(1e3), notes: z2.string().max(3e3), preferredContact: z2.string().max(40) });
var tailoringOrderStatuses = ["draft", "confirmed", "cutting", "stitching", "fitting", "ready", "handed_over", "cancelled"];
var tailoringStatus = z2.enum(tailoringOrderStatuses);
var tailoringRelationError = (customerId, measurementCustomerId, tailorActive) => {
  if (measurementCustomerId !== customerId) return "measurement";
  if (tailorActive === false) return "tailor";
  return null;
};
var canMoveTailoringOrder = (from, to) => {
  if (from === to) return true;
  const next = { draft: ["confirmed", "cancelled"], confirmed: ["cutting", "cancelled"], cutting: ["stitching", "cancelled"], stitching: ["fitting", "ready", "cancelled"], fitting: ["stitching", "ready", "cancelled"], ready: ["handed_over", "stitching", "cancelled"], handed_over: [], cancelled: [] };
  return next[from].includes(to);
};
var tailoringOrderInput = z2.object({ customerId: z2.number().int().positive(), measurementProfileId: z2.number().int().positive().optional(), assignedTailorId: z2.number().int().positive().optional(), garmentType: z2.string().min(2).max(80), quantity: z2.number().int().min(1).max(20), dueDate: z2.string().optional(), price: z2.number().min(0), customerSuppliedFabric: z2.boolean().default(false), fabricNotes: z2.string().max(2e3).optional(), notes: z2.string().max(3e3), productionNotes: z2.string().max(3e3) });
var erpRouter = router({
  shop: router({ get: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "inventory", "tailor", "payroll"]);
    return (await dbOrThrow()).select().from(shopSettings).limit(1).then((rows) => rows[0] || null);
  }), save: protectedProcedure.input(z2.object({ shopName: z2.string().min(2), arabicShopName: z2.string(), crNumber: z2.string(), currency: z2.string(), phone: z2.string(), email: z2.string(), address: z2.string(), invoicePrefix: z2.string().min(1).max(16), invoiceTerms: z2.string().max(4e3).optional(), vatEnabled: z2.boolean().default(false), vatRate: z2.number().min(0).max(100).default(10), vatNumber: z2.string().max(80).optional() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const values = { ...input, vatRate: input.vatRate.toFixed(3), vatNumber: input.vatNumber || null, updatedBy: ctx.user.id };
    const existing = (await db.select().from(shopSettings).limit(1))[0];
    if (existing) await db.update(shopSettings).set(values).where(eq2(shopSettings.id, existing.id));
    else await db.insert(shopSettings).values(values);
    await audit(ctx.user.id, "SHOP_SETTINGS_SAVED", "shopSettings", existing?.id);
    return { success: true };
  }) }),
  dashboard: protectedProcedure.input(dashboardInput.optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "inventory", "tailor", "payroll"]);
    const db = await dbOrThrow();
    const range = input?.range || "30d";
    const customRange = range === "custom" && input?.startDate && input?.endDate ? getCustomDashboardRange(input.startDate, input.endDate) : null;
    const rangeStart = customRange?.start || getDashboardRangeStart(range);
    const salesWhere = customRange ? and(gte(sales.createdAt, customRange.start), lte(sales.createdAt, customRange.end)) : rangeStart ? gte(sales.createdAt, rangeStart) : void 0;
    const today = getDashboardRangeStart("today");
    const weekStart = getDashboardRangeStart("7d");
    const monthStart = getDashboardRangeStart("30d");
    const [customerCount] = await db.select({ count: sql`count(*)` }).from(customers);
    const [inventoryCount] = await db.select({ count: sql`count(*)` }).from(inventoryItems).where(eq2(inventoryItems.isActive, true));
    const [rangeMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)`, count: sql`count(*)` }).from(sales).where(salesWhere);
    const [todayMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)` }).from(sales).where(gte(sales.createdAt, today));
    const [weekMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)` }).from(sales).where(gte(sales.createdAt, weekStart));
    const [monthMetrics] = await db.select({ total: sql`coalesce(sum(${sales.total}), 0)` }).from(sales).where(gte(sales.createdAt, monthStart));
    const low = await db.select().from(inventoryItems).where(sql`${inventoryItems.quantity} <= ${inventoryItems.minThreshold}`).orderBy(inventoryItems.quantity).limit(8);
    const filteredSales = await db.select().from(sales).where(salesWhere).orderBy(desc(sales.createdAt)).limit(250);
    const revenueByDayMap = /* @__PURE__ */ new Map();
    for (const sale of filteredSales) {
      const day = new Date(sale.createdAt).toISOString().slice(0, 10);
      revenueByDayMap.set(day, (revenueByDayMap.get(day) || 0) + Number(sale.total));
    }
    const revenueByDay = Array.from(revenueByDayMap.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([day, revenue]) => ({ day, revenue }));
    const topServices = await db.select({ name: saleItems.nameSnapshot, quantity: sql`coalesce(sum(${saleItems.quantity}), 0)`, revenue: sql`coalesce(sum(${saleItems.lineTotal}), 0)` }).from(saleItems).innerJoin(sales, eq2(saleItems.saleId, sales.id)).where(salesWhere).groupBy(saleItems.nameSnapshot).orderBy(desc(sql`sum(${saleItems.lineTotal})`)).limit(5);
    const [activeStaff] = await db.select({ count: sql`count(*)` }).from(staffProfiles).where(eq2(staffProfiles.isActive, true));
    const attendanceToday = await db.select({ status: attendance.status, count: sql`count(*)` }).from(attendance).where(eq2(attendance.workDate, today)).groupBy(attendance.status);
    const attendanceSummary = attendanceToday.reduce((summary, item) => ({ ...summary, [item.status]: Number(item.count || 0) }), { present: 0, absent: 0, leave: 0, half_day: 0 });
    const total = Number(rangeMetrics?.total || 0);
    const saleCount = Number(rangeMetrics?.count || 0);
    return { range, customerCount: Number(customerCount?.count || 0), inventoryCount: Number(inventoryCount?.count || 0), totalSales: total, saleCount, averageOrderValue: saleCount ? total / saleCount : 0, todayRevenue: Number(todayMetrics?.total || 0), weekRevenue: Number(weekMetrics?.total || 0), monthRevenue: Number(monthMetrics?.total || 0), lowStock: low, recentSales: filteredSales.slice(0, 8), revenueByDay, topServices: topServices.map((item) => ({ ...item, quantity: Number(item.quantity), revenue: Number(item.revenue) })), staff: { activeCount: Number(activeStaff?.count || 0), attendance: attendanceSummary } };
  }),
  customers: router({ list: protectedProcedure.input(z2.object({ search: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "tailor"]);
    const db = await dbOrThrow();
    const search = input?.search?.trim();
    return search ? db.select().from(customers).where(or(like(customers.name, `%${search}%`), like(customers.phone, `%${search}%`))).orderBy(desc(customers.createdAt)).limit(20) : db.select().from(customers).orderBy(desc(customers.createdAt)).limit(20);
  }), create: protectedProcedure.input(customerInput).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const result = await db.insert(customers).values({ ...input, email: input.email || null, address: input.address || null, notes: input.notes || null }).returning({ id: customers.id });
    const customerId = id(result);
    await audit(ctx.user.id, "CUSTOMER_CREATED", "customer", customerId);
    return { id: customerId };
  }), update: protectedProcedure.input(customerInput.extend({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    await db.update(customers).set({ ...input, email: input.email || null, address: input.address || null, notes: input.notes || null }).where(eq2(customers.id, input.id));
    await audit(ctx.user.id, "CUSTOMER_UPDATED", "customer", input.id);
    return { success: true };
  }), balance: protectedProcedure.input(z2.object({ customerId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const customer = (await db.select().from(customers).where(eq2(customers.id, input.customerId)).limit(1))[0];
    if (!customer) throw new TRPCError3({ code: "NOT_FOUND", message: "Customer not found." });
    const rows = await db.select().from(sales).where(eq2(sales.customerId, input.customerId)).orderBy(desc(sales.createdAt)).limit(500);
    const balance = rows.reduce((sum, sale) => sum + Math.max(0, Number(sale.total) - Number(sale.paidAmount)), 0);
    return { customer, balance, openInvoices: rows.filter((sale) => Number(sale.total) - Number(sale.paidAmount) > 1e-3).map((sale) => ({ saleNumber: sale.saleNumber, total: Number(sale.total), paidAmount: Number(sale.paidAmount), outstanding: Number(sale.total) - Number(sale.paidAmount), createdAt: sale.createdAt })) };
  }), sendBalance: protectedProcedure.input(z2.object({ customerId: z2.number().int().positive(), channel: z2.enum(["email", "whatsapp", "share"]), recipient: z2.string().trim().max(320).optional(), message: z2.string().max(4e3).optional() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const customer = (await db.select().from(customers).where(eq2(customers.id, input.customerId)).limit(1))[0];
    if (!customer) throw new TRPCError3({ code: "NOT_FOUND", message: "Customer not found." });
    const recipient = input.recipient || (input.channel === "email" ? customer.email || void 0 : customer.phone || void 0);
    if (!recipient) throw new TRPCError3({ code: "BAD_REQUEST", message: `Add a ${input.channel === "email" ? "customer email" : "customer phone number"} before sending the balance.` });
    const balance = (await db.select().from(sales).where(eq2(sales.customerId, input.customerId)).limit(500)).reduce((sum, sale) => sum + Math.max(0, Number(sale.total) - Number(sale.paidAmount)), 0);
    const message = input.message || `Dear ${customer.name}, your current outstanding balance is ${balance.toFixed(3)} BHD.`;
    const result = await db.insert(customerBalanceDeliveries).values({ customerId: customer.id, channel: input.channel, recipient, message, status: "prepared", createdBy: ctx.user.id }).returning({ id: customerBalanceDeliveries.id });
    await audit(ctx.user.id, "CUSTOMER_BALANCE_DELIVERY_PREPARED", "customer", customer.id, { channel: input.channel, recipient, balance });
    return { id: Number(result[0]?.id || 0), channel: input.channel, recipient, balance, message };
  }), measurements: protectedProcedure.input(z2.object({ customerId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "tailor"]);
    return (await dbOrThrow()).select().from(measurementProfiles).where(eq2(measurementProfiles.customerId, input.customerId)).orderBy(desc(measurementProfiles.version));
  }), addMeasurement: protectedProcedure.input(z2.object({ customerId: z2.number().int(), measurements: z2.record(z2.string(), z2.string()), fitPreference: z2.string(), collarStyle: z2.string(), pocketStyle: z2.string(), notes: z2.string(), effectiveDate: z2.string() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "tailor", "sales"]);
    const db = await dbOrThrow();
    const latest = (await db.select({ version: max(measurementProfiles.version) }).from(measurementProfiles).where(eq2(measurementProfiles.customerId, input.customerId)))[0];
    const result = await db.insert(measurementProfiles).values({ ...input, measurementsJson: input.measurements, version: Number(latest?.version || 0) + 1, effectiveDate: new Date(input.effectiveDate), createdBy: ctx.user.id }).returning({ id: measurementProfiles.id });
    const profileId = id(result);
    await audit(ctx.user.id, "MEASUREMENT_VERSION_CREATED", "measurementProfile", profileId);
    return { id: profileId };
  }) }),
  inventory: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, ["admin", "sales", "inventory"]);
    return (await dbOrThrow()).select().from(inventoryItems).where(eq2(inventoryItems.isActive, true)).orderBy(inventoryItems.name);
  }), create: protectedProcedure.input(z2.object({ code: z2.string().min(1), name: z2.string().min(2), inventoryType: z2.enum(["material", "item"]).default("material"), category: z2.enum(["fabric", "lining", "buttons", "thread", "accessory", "other"]), color: z2.string(), size: z2.string().optional(), widthInches: z2.number().optional(), unit: z2.string().min(1), minThreshold: z2.number().min(0), costPerUnit: z2.number().min(0), salePrice: z2.number().min(0).default(0), openingQuantity: z2.number().min(0), rollCount: z2.number().int().min(0).default(0), metersPerRoll: z2.number().positive().optional() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const db = await dbOrThrow();
    const result = await db.insert(inventoryItems).values({ ...input, color: input.color || null, size: input.size || null, widthInches: input.widthInches?.toString(), quantity: three(input.openingQuantity), rollCount: input.rollCount, metersPerRoll: input.metersPerRoll?.toString() || null, minThreshold: three(input.minThreshold), costPerUnit: three(input.costPerUnit), salePrice: three(input.salePrice) }).returning({ id: inventoryItems.id });
    const itemId = id(result);
    if (input.openingQuantity) await db.insert(stockMovements).values({ inventoryItemId: itemId, movementType: "opening", quantityChange: three(input.openingQuantity), quantityBefore: "0.000", quantityAfter: three(input.openingQuantity), createdBy: ctx.user.id, notes: "Opening balance" });
    await audit(ctx.user.id, "INVENTORY_CREATED", "inventoryItem", itemId);
    return { id: itemId };
  }), update: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), code: z2.string().min(1), name: z2.string().min(2), inventoryType: z2.enum(["material", "item"]).default("material"), category: z2.enum(["fabric", "lining", "buttons", "thread", "accessory", "other"]), color: z2.string(), size: z2.string().optional(), widthInches: z2.number().optional(), unit: z2.string().min(1), minThreshold: z2.number().min(0), costPerUnit: z2.number().min(0), salePrice: z2.number().min(0).default(0), rollCount: z2.number().int().min(0), metersPerRoll: z2.number().positive().optional() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const db = await dbOrThrow();
    const item = (await db.select({ id: inventoryItems.id }).from(inventoryItems).where(eq2(inventoryItems.id, input.id)).limit(1))[0];
    if (!item) throw new TRPCError3({ code: "NOT_FOUND", message: "Inventory item not found." });
    await db.update(inventoryItems).set({ code: input.code, name: input.name, inventoryType: input.inventoryType, category: input.category, color: input.color || null, size: input.size || null, widthInches: input.widthInches?.toString(), unit: input.unit, minThreshold: three(input.minThreshold), costPerUnit: three(input.costPerUnit), salePrice: three(input.salePrice), rollCount: input.rollCount, metersPerRoll: input.metersPerRoll?.toString() || null }).where(eq2(inventoryItems.id, input.id));
    await audit(ctx.user.id, "INVENTORY_UPDATED", "inventoryItem", input.id, input);
    return { success: true };
  }), adjust: protectedProcedure.input(z2.object({ inventoryItemId: z2.number().int(), quantityChange: z2.number(), rollCountChange: z2.number().int().default(0), notes: z2.string().max(1e3) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const db = await dbOrThrow();
    const item = (await db.select().from(inventoryItems).where(eq2(inventoryItems.id, input.inventoryItemId)).limit(1))[0];
    if (!item) throw new TRPCError3({ code: "NOT_FOUND", message: "Inventory item not found." });
    const before = Number(item.quantity);
    const after = before + input.quantityChange;
    const rollCountAfter = Number(item.rollCount || 0) + input.rollCountChange;
    if (input.quantityChange === 0 && input.rollCountChange === 0) throw new TRPCError3({ code: "BAD_REQUEST", message: "Enter a meter or roll adjustment." });
    if (after < 0 || rollCountAfter < 0) throw new TRPCError3({ code: "BAD_REQUEST", message: "Stock cannot drop below zero." });
    await db.update(inventoryItems).set({ quantity: three(after), rollCount: rollCountAfter }).where(eq2(inventoryItems.id, item.id));
    await db.insert(stockMovements).values({ inventoryItemId: item.id, movementType: "adjustment", quantityChange: three(input.quantityChange), quantityBefore: three(before), quantityAfter: three(after), createdBy: ctx.user.id, notes: input.notes || null });
    await audit(ctx.user.id, "STOCK_ADJUSTED", "inventoryItem", item.id, input);
    return { quantity: after };
  }) }),
  services: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, catalogRoles);
    const records = await (await dbOrThrow()).select({ service: services, inventory: inventoryItems }).from(services).leftJoin(inventoryItems, eq2(services.inventoryItemId, inventoryItems.id)).where(eq2(services.isActive, true)).orderBy(services.name);
    return records.map((record) => ({ ...record.service, inventory: record.inventory?.id ? { id: record.inventory.id, code: record.inventory.code, name: record.inventory.name, quantity: record.inventory.quantity, unit: record.inventory.unit, isActive: record.inventory.isActive } : null }));
  }), create: protectedProcedure.input(z2.object({ sku: z2.string().min(1), name: z2.string().min(2), category: z2.enum(["tailoring", "fabric", "alteration", "accessory", "other"]), description: z2.string(), unitPrice: z2.number().positive(), inventoryItemId: z2.number().int().optional(), defaultFabricMeters: z2.number().optional() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, inventoryRoles);
    const result = await (await dbOrThrow()).insert(services).values({ ...input, description: input.description || null, unitPrice: three(input.unitPrice), defaultFabricMeters: input.defaultFabricMeters?.toString() }).returning({ id: services.id });
    const serviceId = id(result);
    await audit(ctx.user.id, "SERVICE_CREATED", "service", serviceId);
    return { id: serviceId };
  }) }),
  sales: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    return (await dbOrThrow()).select().from(sales).orderBy(desc(sales.createdAt)).limit(100);
  }), create: protectedProcedure.input(z2.object({ customerId: z2.number().int().optional(), customerName: z2.string().min(1), customerPhone: z2.string().optional(), discount: z2.number().min(0), paymentMethod: z2.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]), paymentStatus: z2.enum(["paid", "partial", "unpaid"]), items: z2.array(z2.object({ serviceId: z2.number().int().optional(), inventoryItemId: z2.number().int().optional(), name: z2.string().min(1), quantity: z2.number().positive(), unitPrice: z2.number().nonnegative() })).min(1) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const total = Math.max(0, subtotal - input.discount);
    const saleNumber = `SALE-${Date.now()}`;
    const invoicePrefix = shop?.invoicePrefix || "INV";
    const saleId = await db.transaction(async (tx) => {
      const saleResult = await tx.insert(sales).values({ saleNumber, customerId: input.customerId, customerNameSnapshot: input.customerName, customerPhoneSnapshot: input.customerPhone || null, subtotal: three(subtotal), discount: three(input.discount), total: three(total), paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, createdBy: ctx.user.id }).returning({ id: sales.id });
      const createdId = id(saleResult);
      for (const item of input.items) {
        await tx.insert(saleItems).values({ saleId: createdId, serviceId: item.serviceId, inventoryItemId: item.inventoryItemId, nameSnapshot: item.name, quantity: three(item.quantity), unitPrice: three(item.unitPrice), lineTotal: three(item.quantity * item.unitPrice) });
        if (item.inventoryItemId) {
          const stock = (await tx.select().from(inventoryItems).where(eq2(inventoryItems.id, item.inventoryItemId)).limit(1))[0];
          if (!stock) throw new TRPCError3({ code: "BAD_REQUEST", message: "Linked inventory item was not found." });
          const before = Number(stock.quantity);
          const after = before - item.quantity;
          if (after < 0) throw new TRPCError3({ code: "BAD_REQUEST", message: `${stock.name} does not have enough stock.` });
          await tx.update(inventoryItems).set({ quantity: three(after) }).where(eq2(inventoryItems.id, stock.id));
          await tx.insert(stockMovements).values({ inventoryItemId: stock.id, movementType: "sale", quantityChange: three(-item.quantity), quantityBefore: three(before), quantityAfter: three(after), referenceType: "sale", referenceId: createdId, createdBy: ctx.user.id, notes: saleNumber });
        }
      }
      await tx.insert(invoices).values({ saleId: createdId, invoiceNumber: `${invoicePrefix}-${String(createdId).padStart(6, "0")}`, status: input.paymentStatus });
      return createdId;
    });
    await audit(ctx.user.id, "SALE_COMPLETED", "sale", saleId, { total });
    return { id: saleId, total };
  }) }),
  salesHistory: router({ list: protectedProcedure.input(salesHistoryInput.optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const [saleRows, invoiceRows] = await Promise.all([db.select().from(sales).orderBy(desc(sales.createdAt)).limit(500), db.select().from(invoices)]);
    const invoiceBySale = new Map(invoiceRows.map((invoice) => [invoice.saleId, invoice]));
    const search = input?.search?.trim().toLowerCase();
    const start = input?.startDate ? /* @__PURE__ */ new Date(`${input.startDate}T00:00:00.000Z`) : null;
    const end = input?.endDate ? /* @__PURE__ */ new Date(`${input.endDate}T23:59:59.999Z`) : null;
    return saleRows.filter((sale) => (!input?.source || sale.source === input.source) && (!input?.paymentStatus || sale.paymentStatus === input.paymentStatus) && (!start || sale.createdAt >= start) && (!end || sale.createdAt <= end) && (!search || [sale.saleNumber, sale.customerNameSnapshot, sale.customerPhoneSnapshot || ""].some((value) => value.toLowerCase().includes(search)))).map((sale) => ({ ...sale, invoice: invoiceBySale.get(sale.id) || null }));
  }), monthlyReport: protectedProcedure.input(monthInput).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const { start, end } = getMonthWindow(input.month);
    const [allSales, invoiceRows, allItems, shop] = await Promise.all([db.select().from(sales).orderBy(desc(sales.createdAt)).limit(1e3), db.select().from(invoices), db.select().from(saleItems), db.select().from(shopSettings).limit(1).then((rows2) => rows2[0] || null)]);
    const rows = allSales.filter((sale) => sale.createdAt >= start && sale.createdAt <= end);
    const invoiceBySale = new Map(invoiceRows.map((invoice) => [invoice.saleId, invoice]));
    const includedIds = new Set(rows.map((sale) => sale.id));
    const bySource = /* @__PURE__ */ new Map();
    const byPayment = /* @__PURE__ */ new Map();
    const topLines = /* @__PURE__ */ new Map();
    for (const sale of rows) {
      const source = bySource.get(sale.source) || { count: 0, total: 0 };
      source.count += 1;
      source.total += Number(sale.total);
      bySource.set(sale.source, source);
      const payment = byPayment.get(sale.paymentMethod) || { count: 0, total: 0 };
      payment.count += 1;
      payment.total += Number(sale.total);
      byPayment.set(sale.paymentMethod, payment);
    }
    for (const line of allItems) if (includedIds.has(line.saleId)) {
      const current = topLines.get(line.nameSnapshot) || { quantity: 0, total: 0 };
      current.quantity += Number(line.quantity);
      current.total += Number(line.lineTotal);
      topLines.set(line.nameSnapshot, current);
    }
    const total = rows.reduce((sum, sale) => sum + Number(sale.total), 0);
    return { month: input.month, shop, totals: { saleCount: rows.length, revenue: total, averageOrder: rows.length ? total / rows.length : 0, paidCount: rows.filter((sale) => sale.paymentStatus === "paid").length, partialCount: rows.filter((sale) => sale.paymentStatus === "partial").length, unpaidCount: rows.filter((sale) => sale.paymentStatus === "unpaid").length }, bySource: Array.from(bySource, ([source, values]) => ({ source, ...values })), byPayment: Array.from(byPayment, ([paymentMethod2, values]) => ({ paymentMethod: paymentMethod2, ...values })), topLines: Array.from(topLines, ([name, values]) => ({ name, ...values })).sort((left, right) => right.total - left.total).slice(0, 8), sales: rows.map((sale) => ({ ...sale, invoice: invoiceBySale.get(sale.id) || null })) };
  }) }),
  invoices: router({ list: protectedProcedure.input(invoiceListInput.optional()).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const search = input?.search?.trim().toLowerCase();
    const start = input?.startDate ? /* @__PURE__ */ new Date(`${input.startDate}T00:00:00.000Z`) : null;
    const end = input?.endDate ? /* @__PURE__ */ new Date(`${input.endDate}T23:59:59.999Z`) : null;
    const [invoiceRows, saleRows] = await Promise.all([db.select().from(invoices).orderBy(desc(invoices.issuedAt)).limit(500), db.select().from(sales).orderBy(desc(sales.createdAt)).limit(500)]);
    const saleById = new Map(saleRows.map((sale) => [sale.id, sale]));
    return invoiceRows.map((invoice) => ({ ...invoice, sale: saleById.get(invoice.saleId) || null })).filter((row) => (!input?.status || row.status === input.status) && (!input?.source || row.sale?.source === input.source) && (!input?.paymentMethod || row.sale?.paymentMethod === input.paymentMethod) && (!start || row.issuedAt >= start) && (!end || row.issuedAt <= end) && (!search || [row.invoiceNumber, row.sale?.saleNumber || "", row.sale?.customerNameSnapshot || "", row.sale?.customerPhoneSnapshot || ""].some((value) => value.toLowerCase().includes(search))));
  }), detail: protectedProcedure.input(z2.object({ invoiceId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const invoice = (await db.select().from(invoices).where(eq2(invoices.id, input.invoiceId)).limit(1))[0];
    if (!invoice) throw new TRPCError3({ code: "NOT_FOUND", message: "Invoice not found." });
    const sale = (await db.select().from(sales).where(eq2(sales.id, invoice.saleId)).limit(1))[0];
    if (!sale) throw new TRPCError3({ code: "NOT_FOUND", message: "Sale for this invoice was not found." });
    const items = await db.select().from(saleItems).where(eq2(saleItems.saleId, sale.id));
    const shop = (await db.select().from(shopSettings).limit(1))[0] || null;
    const deliveries = await db.select().from(invoiceDeliveries).where(eq2(invoiceDeliveries.invoiceId, invoice.id)).orderBy(desc(invoiceDeliveries.createdAt)).limit(20);
    return { invoice, sale, items, shop, deliveries };
  }), prepareDelivery: protectedProcedure.input(z2.object({ invoiceId: z2.number().int().positive(), channel: z2.enum(["email", "whatsapp", "share"]), recipient: z2.string().trim().max(320).optional(), message: z2.string().trim().max(2e3).optional() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, salesRoles);
    const db = await dbOrThrow();
    const invoice = (await db.select().from(invoices).where(eq2(invoices.id, input.invoiceId)).limit(1))[0];
    if (!invoice) throw new TRPCError3({ code: "NOT_FOUND", message: "Invoice not found." });
    const result = await db.insert(invoiceDeliveries).values({ invoiceId: input.invoiceId, channel: input.channel, recipient: input.recipient || null, status: "prepared", message: input.message || null, createdBy: ctx.user.id }).returning({ id: invoiceDeliveries.id });
    const deliveryId = id(result);
    await audit(ctx.user.id, "INVOICE_DELIVERY_PREPARED", "invoice", input.invoiceId, { channel: input.channel, recipient: input.recipient });
    return { id: deliveryId, status: "prepared" };
  }) }),
  staff: router({
    documents: router({
      list: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
        await access(ctx.user.id, ctx.user.role, payrollRoles);
        return (await dbOrThrow()).select().from(staffDocuments).where(eq2(staffDocuments.staffProfileId, input.staffProfileId)).orderBy(desc(staffDocuments.uploadedAt)).limit(100);
      }),
      download: protectedProcedure.input(z2.object({ documentId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await access(ctx.user.id, ctx.user.role, payrollRoles);
        const document = (await (await dbOrThrow()).select().from(staffDocuments).where(eq2(staffDocuments.id, input.documentId)).limit(1))[0];
        if (!document) throw new TRPCError3({ code: "NOT_FOUND", message: "Staff document not found." });
        return { url: await storageGetSignedUrl(document.storageKey), fileName: document.fileName, contentType: document.contentType };
      }),
      upload: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int().positive(), label: z2.string().trim().min(2).max(120), fileName: z2.string().trim().min(1).max(255), contentType: z2.string().trim().min(1).max(120), dataBase64: z2.string().min(1).max(5e6) }).superRefine((value, ctx) => {
        const extension = value.fileName.toLowerCase().slice(value.fileName.lastIndexOf("."));
        if (!staffDocumentMimeTypes.has(value.contentType) || !staffDocumentExtensions.has(extension)) ctx.addIssue({ code: "custom", path: ["fileName"], message: "Upload a PDF, PNG, JPG, WEBP, DOC, or DOCX staff document." });
      })).mutation(async ({ ctx, input }) => {
        await access(ctx.user.id, ctx.user.role, payrollRoles);
        const profile = (await (await dbOrThrow()).select({ id: staffProfiles.id }).from(staffProfiles).where(eq2(staffProfiles.id, input.staffProfileId)).limit(1))[0];
        if (!profile) throw new TRPCError3({ code: "NOT_FOUND", message: "Staff profile not found." });
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const stored = await storagePut(`staff/${input.staffProfileId}/${Date.now()}-${safeName}`, Buffer.from(input.dataBase64, "base64"), input.contentType);
        const result = await (await dbOrThrow()).insert(staffDocuments).values({ staffProfileId: input.staffProfileId, label: input.label, fileName: input.fileName, contentType: input.contentType, storageKey: stored.key, storageUrl: stored.url, uploadedBy: ctx.user.id }).returning({ id: staffDocuments.id });
        const documentId = id(result);
        await audit(ctx.user.id, "STAFF_DOCUMENT_UPLOADED", "staffDocument", documentId, { staffProfileId: input.staffProfileId, label: input.label });
        return { id: documentId, url: stored.url };
      })
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, staffDirectoryRoles);
      return (await dbOrThrow()).select().from(staffProfiles).where(eq2(staffProfiles.isActive, true)).orderBy(staffProfiles.name);
    }),
    linkAccess: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int().positive(), userId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const db = await dbOrThrow();
      const profile = (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.staffProfileId)).limit(1))[0];
      if (!profile) throw new TRPCError3({ code: "NOT_FOUND", message: "Staff profile not found." });
      const user = (await db.select({ id: users.id }).from(users).where(eq2(users.id, input.userId)).limit(1))[0];
      if (!user) throw new TRPCError3({ code: "NOT_FOUND", message: "ERP access account not found." });
      const existing = (await db.select({ id: staffProfiles.id }).from(staffProfiles).where(eq2(staffProfiles.userId, input.userId)).limit(1))[0];
      if (existing && existing.id !== input.staffProfileId) throw new TRPCError3({ code: "CONFLICT", message: "This ERP account is already linked to another payroll profile." });
      await db.update(staffProfiles).set({ userId: input.userId, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(staffProfiles.id, input.staffProfileId));
      await audit(ctx.user.id, "STAFF_ACCESS_LINKED", "staffProfile", input.staffProfileId, { userId: input.userId });
      return { success: true };
    }),
    unlinkAccess: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, adminRoles);
      const db = await dbOrThrow();
      await db.update(staffProfiles).set({ userId: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(staffProfiles.id, input.staffProfileId));
      await audit(ctx.user.id, "STAFF_ACCESS_UNLINKED", "staffProfile", input.staffProfileId);
      return { success: true };
    }),
    create: protectedProcedure.input(z2.object({ name: z2.string().min(2), phone: z2.string(), jobTitle: z2.string().min(2), baseSalary: z2.number().min(0), commissionRate: z2.number().min(0) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const result = await (await dbOrThrow()).insert(staffProfiles).values({ ...input, phone: input.phone || null, baseSalary: three(input.baseSalary), commissionRate: three(input.commissionRate) }).returning({ id: staffProfiles.id });
      const staffId = id(result);
      await audit(ctx.user.id, "STAFF_CREATED", "staffProfile", staffId);
      return { id: staffId };
    }),
    recordAttendance: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int(), workDate: z2.string(), status: z2.enum(["present", "absent", "leave", "half_day"]), absenceReason: z2.enum(["sick", "unexcused", "personal", "other"]).optional(), absenceDetails: z2.string().max(1e3).optional(), absenceDocumentId: z2.number().int().positive().optional(), notes: z2.string() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const db = await dbOrThrow();
      const profile = (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.staffProfileId)).limit(1))[0];
      if (!profile) throw new TRPCError3({ code: "NOT_FOUND", message: "Staff profile not found." });
      const payPeriod = input.workDate.slice(0, 7);
      const absenceDeduction = absenceDeductionFor(Number(profile.baseSalary), input.status, payPeriod);
      await db.insert(attendance).values({ staffProfileId: input.staffProfileId, workDate: new Date(input.workDate), status: input.status, absenceReason: input.status === "present" ? null : input.absenceReason || null, absenceDetails: input.status === "present" ? null : input.absenceDetails?.trim() || null, absenceDocumentId: input.status === "present" ? null : input.absenceDocumentId || null, absenceDeduction: three(absenceDeduction), notes: input.notes || null, recordedBy: ctx.user.id });
      await audit(ctx.user.id, "ATTENDANCE_RECORDED", "attendance", input.staffProfileId, { status: input.status, absenceDeduction });
      return { success: true, absenceDeduction };
    }),
    attendanceHistory: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      return (await dbOrThrow()).select().from(attendance).orderBy(desc(attendance.workDate)).limit(100);
    }),
    performance: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      return (await dbOrThrow()).select().from(performanceRecords).orderBy(desc(performanceRecords.workDate)).limit(100);
    }),
    addPerformance: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int(), workDate: z2.string(), metric: z2.string().min(2), units: z2.number().min(0), commissionEarned: z2.number().min(0), notes: z2.string() })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      await (await dbOrThrow()).insert(performanceRecords).values({ ...input, workDate: new Date(input.workDate), units: three(input.units), commissionEarned: three(input.commissionEarned), notes: input.notes || null, recordedBy: ctx.user.id });
      await audit(ctx.user.id, "PERFORMANCE_RECORDED", "performanceRecord", input.staffProfileId);
      return { success: true };
    }),
    payouts: protectedProcedure.query(async ({ ctx }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      return (await dbOrThrow()).select().from(salaryPayouts).orderBy(desc(salaryPayouts.paidAt)).limit(100);
    }),
    calculate: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int().positive(), payPeriod: z2.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid pay period."), allowances: z2.number().min(0).max(1e6).default(0), overtime: z2.number().min(0).max(1e6).default(0), deductions: z2.number().min(0).max(1e6).default(0) })).query(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const db = await dbOrThrow();
      const staff = (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.staffProfileId)).limit(1))[0];
      if (!staff) throw new TRPCError3({ code: "NOT_FOUND", message: "Staff profile not found." });
      const { start, end } = getMonthBounds(input.payPeriod);
      const rows = await db.select().from(performanceRecords).where(and(eq2(performanceRecords.staffProfileId, staff.id), gte(performanceRecords.workDate, start), lte(performanceRecords.workDate, end)));
      const attendanceRows = await db.select().from(attendance).where(and(eq2(attendance.staffProfileId, staff.id), gte(attendance.workDate, start), lte(attendance.workDate, end)));
      const performanceBonus = rows.reduce((sum, row) => sum + Number(row.commissionEarned), 0);
      const baseSalary = Number(staff.baseSalary);
      const absenceDeduction = attendanceRows.reduce((sum, row) => sum + (Number(row.absenceDeduction) || absenceDeductionFor(baseSalary, row.status, input.payPeriod)), 0);
      const totalDeductions = input.deductions + absenceDeduction;
      const grossSalary = baseSalary + input.allowances + input.overtime + performanceBonus;
      const netSalary = grossSalary - totalDeductions;
      return { staffProfileId: staff.id, staffName: staff.name, payPeriod: input.payPeriod, baseSalary, allowances: input.allowances, overtime: input.overtime, performanceBonus, manualDeductions: input.deductions, absenceDeduction, deductions: totalDeductions, absenceCount: attendanceRows.filter((row) => row.status === "absent").length, halfDayCount: attendanceRows.filter((row) => row.status === "half_day").length, grossSalary, netSalary };
    }),
    createPayout: protectedProcedure.input(z2.object({ staffProfileId: z2.number().int().positive(), payPeriod: z2.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid pay period."), amount: z2.number().positive().max(1e6).optional(), allowances: z2.number().min(0).max(1e6).default(0), overtime: z2.number().min(0).max(1e6).default(0), performanceBonus: z2.number().min(0).max(1e6).optional(), deductions: z2.number().min(0).max(1e6).default(0), deductionDetails: z2.string().max(2e3).optional(), notes: z2.string().max(2e3) })).mutation(async ({ ctx, input }) => {
      await access(ctx.user.id, ctx.user.role, payrollRoles);
      const db = await dbOrThrow();
      const staff = (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.staffProfileId)).limit(1))[0];
      if (!staff) throw new TRPCError3({ code: "NOT_FOUND", message: "Staff profile not found." });
      const { start, end } = getMonthBounds(input.payPeriod);
      const rows = await db.select().from(performanceRecords).where(and(eq2(performanceRecords.staffProfileId, staff.id), gte(performanceRecords.workDate, start), lte(performanceRecords.workDate, end)));
      const attendanceRows = await db.select().from(attendance).where(and(eq2(attendance.staffProfileId, staff.id), gte(attendance.workDate, start), lte(attendance.workDate, end)));
      const performanceBonus = input.performanceBonus ?? rows.reduce((sum, row) => sum + Number(row.commissionEarned), 0);
      const baseSalary = Number(staff.baseSalary);
      const absenceDeduction = attendanceRows.reduce((sum, row) => sum + (Number(row.absenceDeduction) || absenceDeductionFor(baseSalary, row.status, input.payPeriod)), 0);
      const totalDeductions = input.deductions + absenceDeduction;
      const grossSalary = baseSalary + input.allowances + input.overtime + performanceBonus;
      const finalAmount = input.amount ?? grossSalary - totalDeductions;
      if (finalAmount <= 0) throw new TRPCError3({ code: "BAD_REQUEST", message: "The calculated net salary must be greater than zero." });
      const payslipNumber = `PS-${input.payPeriod.replace("-", "")}-${staff.id}-${Date.now()}`;
      const deductionDetails = [input.deductionDetails?.trim(), absenceDeduction > 0 ? `Automatic absence deduction: ${three(absenceDeduction)}` : ""].filter(Boolean).join(" \xB7 ") || null;
      const result = await db.insert(salaryPayouts).values({ staffProfileId: staff.id, payPeriod: input.payPeriod, payslipNumber, baseSalary: staff.baseSalary, allowances: three(input.allowances), overtime: three(input.overtime), performanceBonus: three(performanceBonus), deductions: three(totalDeductions), deductionDetails, netSalary: three(finalAmount), notes: input.notes.trim() || null, approvedBy: ctx.user.id }).returning({ id: salaryPayouts.id });
      const payoutId = id(result);
      await audit(ctx.user.id, "SALARY_PAYOUT_CREATED", "salaryPayout", payoutId, { staffProfileId: staff.id, payPeriod: input.payPeriod, finalAmount: three(finalAmount), deductions: three(totalDeductions), absenceDeduction: three(absenceDeduction), payslipNumber });
      return { id: payoutId, netSalary: finalAmount, payslipNumber, absenceDeduction, deductions: totalDeductions };
    })
  }),
  tailoring: router({ list: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, tailoringRoles);
    const db = await dbOrThrow();
    const [orders, clientRows, tailorRows, measurementRows, saleRows, invoiceRows] = await Promise.all([db.select().from(tailoringOrders).orderBy(desc(tailoringOrders.createdAt)).limit(100), db.select().from(customers), db.select().from(staffProfiles), db.select().from(measurementProfiles), db.select({ id: sales.id, saleNumber: sales.saleNumber, paidAmount: sales.paidAmount, total: sales.total, paymentStatus: sales.paymentStatus, paymentMethod: sales.paymentMethod }).from(sales).orderBy(desc(sales.createdAt)).limit(500), db.select({ saleId: invoices.saleId, invoiceNumber: invoices.invoiceNumber, status: invoices.status }).from(invoices).limit(500)]);
    const clients = new Map(clientRows.map((client) => [client.id, client]));
    const tailors = new Map(tailorRows.map((tailor) => [tailor.id, tailor]));
    const measurements = new Map(measurementRows.map((profile) => [profile.id, profile]));
    const salesById = new Map(saleRows.map((sale) => [sale.id, sale]));
    const invoicesBySaleId = new Map(invoiceRows.map((invoice) => [invoice.saleId, invoice]));
    return orders.map((order) => ({ ...order, sale: order.saleId ? salesById.get(order.saleId) || null : null, invoice: order.saleId ? invoicesBySaleId.get(order.saleId) || null : null, customerName: clients.get(order.customerId)?.name || "Archived customer", customerPhone: clients.get(order.customerId)?.phone || null, tailorName: order.assignedTailorId ? tailors.get(order.assignedTailorId)?.name || "Former tailor" : null, measurementVersion: order.measurementProfileId ? measurements.get(order.measurementProfileId)?.version || null : null }));
  }), create: protectedProcedure.input(tailoringOrderInput).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, tailoringRoles);
    const db = await dbOrThrow();
    const customer = (await db.select().from(customers).where(eq2(customers.id, input.customerId)).limit(1))[0];
    if (!customer) throw new TRPCError3({ code: "NOT_FOUND", message: "Choose a valid customer for the tailoring order." });
    const profile = input.measurementProfileId ? (await db.select().from(measurementProfiles).where(eq2(measurementProfiles.id, input.measurementProfileId)).limit(1))[0] : null;
    const tailor = input.assignedTailorId ? (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.assignedTailorId)).limit(1))[0] : null;
    const relationError = tailoringRelationError(input.customerId, profile?.customerId, input.assignedTailorId ? Boolean(tailor?.isActive) : null);
    if (relationError === "measurement") throw new TRPCError3({ code: "BAD_REQUEST", message: "Save or choose a measurement version belonging to this customer before confirming the tailoring order." });
    if (relationError === "tailor") throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active tailor." });
    const orderNumber = `TO-${Date.now()}`;
    const result = await db.insert(tailoringOrders).values({ ...input, orderNumber, measurementProfileId: input.measurementProfileId || null, assignedTailorId: input.assignedTailorId || null, dueDate: input.dueDate ? new Date(input.dueDate) : null, price: three(input.price), customerSuppliedFabric: input.customerSuppliedFabric, fabricNotes: input.fabricNotes || null, notes: input.notes || null, productionNotes: input.productionNotes || null, createdBy: ctx.user.id, status: "confirmed" }).returning({ id: tailoringOrders.id });
    const orderId = id(result);
    await audit(ctx.user.id, "TAILORING_ORDER_CREATED", "tailoringOrder", orderId, { orderNumber, customerId: input.customerId, garmentType: input.garmentType, dueDate: input.dueDate });
    return { id: orderId, orderNumber };
  }), update: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), assignedTailorId: z2.number().int().positive().optional(), status: tailoringStatus, dueDate: z2.string().optional(), productionNotes: z2.string().max(3e3) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, tailoringRoles);
    const db = await dbOrThrow();
    const current = (await db.select().from(tailoringOrders).where(eq2(tailoringOrders.id, input.id)).limit(1))[0];
    if (!current) throw new TRPCError3({ code: "NOT_FOUND", message: "Tailoring order not found." });
    if (!canMoveTailoringOrder(current.status, input.status)) throw new TRPCError3({ code: "BAD_REQUEST", message: "Move the order through the production stages in sequence before handover." });
    if (input.assignedTailorId) {
      const tailor = (await db.select().from(staffProfiles).where(eq2(staffProfiles.id, input.assignedTailorId)).limit(1))[0];
      if (!tailor?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active tailor." });
    }
    await db.update(tailoringOrders).set({ assignedTailorId: input.assignedTailorId || null, status: input.status, dueDate: input.dueDate ? new Date(input.dueDate) : null, productionNotes: input.productionNotes || null }).where(eq2(tailoringOrders.id, input.id));
    await audit(ctx.user.id, "TAILORING_ORDER_UPDATED", "tailoringOrder", input.id, input);
    return { success: true };
  }) }),
  team: router({ listRoles: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const baseRoles = await db.select({ userId: userBusinessRoles.userId, businessRole: userBusinessRoles.role, isActive: userBusinessRoles.isActive, name: users.name, email: users.email }).from(userBusinessRoles).leftJoin(users, eq2(userBusinessRoles.userId, users.id));
    const assignments = await db.select().from(userCustomRoles);
    const definitions = await db.select().from(customRoles);
    const byUser = new Map(assignments.map((assignment) => [assignment.userId, assignment]));
    const byId = new Map(definitions.map((role) => [role.id, role]));
    return baseRoles.map((base) => {
      const assignment = byUser.get(base.userId);
      const customRole = assignment ? byId.get(assignment.customRoleId) : void 0;
      return { ...base, customRoleId: customRole?.id || null, customRoleName: customRole?.name || null, customRoleActive: Boolean(assignment?.isActive && customRole?.isActive) };
    });
  }), removeUser: protectedProcedure.input(z2.object({ userId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    if (input.userId === ctx.user.id) throw new TRPCError3({ code: "FORBIDDEN", message: "The owner account cannot be removed." });
    const db = await dbOrThrow();
    const target = (await db.select({ id: users.id, role: users.role }).from(users).where(eq2(users.id, input.userId)).limit(1))[0];
    if (!target) throw new TRPCError3({ code: "NOT_FOUND", message: "This user no longer exists." });
    const targetBusinessRole = (await db.select().from(userBusinessRoles).where(eq2(userBusinessRoles.userId, input.userId)).limit(1))[0];
    if (target.role === "admin" || targetBusinessRole?.role === "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Owner accounts cannot be removed." });
    await db.transaction(async (tx) => {
      await tx.delete(userCustomRoles).where(eq2(userCustomRoles.userId, input.userId));
      await tx.delete(userBusinessRoles).where(eq2(userBusinessRoles.userId, input.userId));
      await tx.delete(pendingAccessRequests).where(eq2(pendingAccessRequests.userId, input.userId));
      await tx.delete(staffAccessInvites).where(eq2(staffAccessInvites.acceptedByUserId, input.userId));
      await tx.update(staffProfiles).set({ userId: null, isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(staffProfiles.userId, input.userId));
      await tx.delete(users).where(eq2(users.id, input.userId));
    });
    await audit(ctx.user.id, "USER_REMOVED", "user", input.userId, { access: "revoked", records: "preserved" });
    return { success: true };
  }), listCustomRoles: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const rows = await (await dbOrThrow()).select().from(customRoles).orderBy(customRoles.name);
    return rows.map((role) => ({ ...role, permissions: Array.isArray(role.permissionsJson) ? role.permissionsJson.filter((value) => typeof value === "string") : [] }));
  }), createCustomRole: protectedProcedure.input(z2.object({ name: z2.string().min(2).max(80), description: z2.string().max(320), permissions: z2.array(z2.enum(customPermissionValues)).min(1) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const result = await (await dbOrThrow()).insert(customRoles).values({ name: input.name.trim(), description: input.description.trim() || null, permissionsJson: input.permissions, createdBy: ctx.user.id }).returning({ id: customRoles.id });
    const roleId = id(result);
    await audit(ctx.user.id, "CUSTOM_ROLE_CREATED", "customRole", roleId, input);
    return { id: roleId };
  }), updateCustomRole: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), name: z2.string().min(2).max(80), description: z2.string().max(320), permissions: z2.array(z2.enum(customPermissionValues)).min(1), isActive: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    await (await dbOrThrow()).update(customRoles).set({ name: input.name.trim(), description: input.description.trim() || null, permissionsJson: input.permissions, isActive: input.isActive }).where(eq2(customRoles.id, input.id));
    await audit(ctx.user.id, "CUSTOM_ROLE_UPDATED", "customRole", input.id, input);
    return { success: true };
  }), assignCustomRole: protectedProcedure.input(z2.object({ userId: z2.number().int().positive(), customRoleId: z2.number().int().positive(), isActive: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const role = (await db.select().from(customRoles).where(eq2(customRoles.id, input.customRoleId)).limit(1))[0];
    if (!role?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active owner-managed role." });
    await db.insert(userCustomRoles).values({ ...input, updatedBy: ctx.user.id }).onConflictDoUpdate({ target: userCustomRoles.userId, set: { customRoleId: input.customRoleId, isActive: input.isActive, updatedBy: ctx.user.id } });
    await audit(ctx.user.id, "CUSTOM_ROLE_ASSIGNED", "user", input.userId, input);
    return { success: true };
  }), clearCustomRole: protectedProcedure.input(z2.object({ userId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    await (await dbOrThrow()).delete(userCustomRoles).where(eq2(userCustomRoles.userId, input.userId));
    await audit(ctx.user.id, "CUSTOM_ROLE_CLEARED", "user", input.userId);
    return { success: true };
  }), assignRole: protectedProcedure.input(z2.object({ userId: z2.number().int(), role: z2.enum(["admin", "sales", "tailor", "inventory", "payroll"]), isActive: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    await db.insert(userBusinessRoles).values(input).onConflictDoUpdate({ target: userBusinessRoles.userId, set: { role: input.role, isActive: input.isActive } });
    await audit(ctx.user.id, "BUSINESS_ROLE_ASSIGNED", "user", input.userId, input);
    return { success: true };
  }) }),
  access: router({ listInvites: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const [invites, roles] = await Promise.all([db.select().from(staffAccessInvites).orderBy(desc(staffAccessInvites.invitedAt)), db.select().from(customRoles)]);
    const roleById = new Map(roles.map((role) => [role.id, role]));
    return invites.map((invite) => ({ ...invite, roleName: roleById.get(invite.customRoleId)?.name || "Archived role" }));
  }), inviteStaff: protectedProcedure.input(z2.object({ name: z2.string().trim().min(2).max(160), email: z2.string().trim().email().max(320), customRoleId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const role = (await db.select().from(customRoles).where(eq2(customRoles.id, input.customRoleId)).limit(1))[0];
    if (!role?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active role before preparing staff access." });
    const email = input.email.toLowerCase();
    await db.insert(staffAccessInvites).values({ name: input.name, email, customRoleId: role.id, invitedBy: ctx.user.id, isActive: true }).onConflictDoUpdate({ target: staffAccessInvites.email, set: { name: input.name, customRoleId: role.id, invitedBy: ctx.user.id, invitedAt: /* @__PURE__ */ new Date(), isActive: true, acceptedByUserId: null, acceptedAt: null } });
    await audit(ctx.user.id, "STAFF_ACCESS_PREPARED", "staffAccessInvite", void 0, { email, roleId: role.id });
    return { email, roleName: role.name };
  }), cancelInvite: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    await db.update(staffAccessInvites).set({ isActive: false }).where(eq2(staffAccessInvites.id, input.id));
    await audit(ctx.user.id, "STAFF_ACCESS_CANCELLED", "staffAccessInvite", input.id);
    return { success: true };
  }), listPending: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const [requests, people] = await Promise.all([db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.status, "pending")).orderBy(desc(pendingAccessRequests.requestedAt)), db.select().from(users)]);
    const byId = new Map(people.map((person) => [person.id, person]));
    return requests.map((request) => ({ ...request, name: byId.get(request.userId)?.name || `User #${request.userId}`, email: byId.get(request.userId)?.email || null }));
  }), approvePending: protectedProcedure.input(z2.object({ requestId: z2.number().int().positive(), customRoleId: z2.number().int().positive(), note: z2.string().max(500) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const [request, role] = await Promise.all([db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.id, input.requestId)).limit(1).then((rows) => rows[0]), db.select().from(customRoles).where(eq2(customRoles.id, input.customRoleId)).limit(1).then((rows) => rows[0])]);
    if (!request || request.status !== "pending") throw new TRPCError3({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
    if (!role?.isActive) throw new TRPCError3({ code: "BAD_REQUEST", message: "Choose an active owner-managed role." });
    await db.transaction(async (tx) => {
      await tx.insert(userBusinessRoles).values({ userId: request.userId, role: "sales", isActive: true }).onConflictDoUpdate({ target: userBusinessRoles.userId, set: { isActive: true } });
      await tx.insert(userCustomRoles).values({ userId: request.userId, customRoleId: role.id, isActive: true, updatedBy: ctx.user.id }).onConflictDoUpdate({ target: userCustomRoles.userId, set: { customRoleId: role.id, isActive: true, updatedBy: ctx.user.id } });
      await tx.update(pendingAccessRequests).set({ status: "approved", reviewedAt: /* @__PURE__ */ new Date(), reviewedBy: ctx.user.id, note: input.note || null }).where(eq2(pendingAccessRequests.id, request.id));
    });
    await audit(ctx.user.id, "ACCESS_REQUEST_APPROVED", "pendingAccessRequest", request.id, { userId: request.userId, roleId: role.id });
    return { success: true };
  }), rejectPending: protectedProcedure.input(z2.object({ requestId: z2.number().int().positive(), note: z2.string().max(500) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const request = (await db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.id, input.requestId)).limit(1))[0];
    if (!request || request.status !== "pending") throw new TRPCError3({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
    await db.update(pendingAccessRequests).set({ status: "rejected", reviewedAt: /* @__PURE__ */ new Date(), reviewedBy: ctx.user.id, note: input.note || null }).where(eq2(pendingAccessRequests.id, request.id));
    await audit(ctx.user.id, "ACCESS_REQUEST_REJECTED", "pendingAccessRequest", request.id, { userId: request.userId });
    return { success: true };
  }) }),
  accessApproval: router({ approveWithPermissions: protectedProcedure.input(z2.object({ requestId: z2.number().int().positive(), name: z2.string().trim().min(2).max(80), description: z2.string().trim().max(320), permissions: z2.array(z2.enum(["dashboard", "customers", "sales", "inventory", "production", "payroll"])).min(1), note: z2.string().max(500) })).mutation(async ({ ctx, input }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    const db = await dbOrThrow();
    const request = (await db.select().from(pendingAccessRequests).where(eq2(pendingAccessRequests.id, input.requestId)).limit(1))[0];
    if (!request || request.status !== "pending") throw new TRPCError3({ code: "NOT_FOUND", message: "This access request is no longer waiting for review." });
    const transaction = await db.transaction(async (tx) => {
      const roleResult = await tx.insert(customRoles).values({ name: input.name, description: input.description || null, permissionsJson: input.permissions, isActive: true, createdBy: ctx.user.id }).returning({ id: customRoles.id });
      const roleId = id(roleResult);
      await tx.insert(userBusinessRoles).values({ userId: request.userId, role: "sales", isActive: true }).onConflictDoUpdate({ target: userBusinessRoles.userId, set: { isActive: true } });
      await tx.insert(userCustomRoles).values({ userId: request.userId, customRoleId: roleId, isActive: true, updatedBy: ctx.user.id }).onConflictDoUpdate({ target: userCustomRoles.userId, set: { customRoleId: roleId, isActive: true, updatedBy: ctx.user.id } });
      await tx.update(pendingAccessRequests).set({ status: "approved", reviewedAt: /* @__PURE__ */ new Date(), reviewedBy: ctx.user.id, note: input.note || null }).where(eq2(pendingAccessRequests.id, request.id));
      return roleId;
    });
    await audit(ctx.user.id, "ACCESS_REQUEST_APPROVED_WITH_PERMISSIONS", "pendingAccessRequest", request.id, { userId: request.userId, roleId: transaction });
    return { roleId: transaction };
  }) }),
  audit: protectedProcedure.query(async ({ ctx }) => {
    await access(ctx.user.id, ctx.user.role, adminRoles);
    return (await dbOrThrow()).select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
  })
});

// server/pos.ts
import { and as and2, desc as desc2, eq as eq3, isNull, like as like2, lt, or as or2, sql as sql2 } from "drizzle-orm";
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";
var money = (value) => Number(value.toFixed(3)).toFixed(3);
var paymentMethod = z3.enum(["cash", "benefitpay", "bank_transfer", "credit_card"]);
var returnMode = z3.enum(["items", "amount", "exchange"]);
var taxFor = (netAmount, shop) => {
  const vatRate = shop?.vatEnabled ? Number(shop.vatRate || 0) : 0;
  const vatAmount = Math.max(0, netAmount) * vatRate / 100;
  return { vatRate, vatAmount, netAmount: Math.max(0, netAmount), grossAmount: Math.max(0, netAmount) + vatAmount };
};
var taxFromGross = (grossAmount, shop) => {
  const vatRate = shop?.vatEnabled ? Number(shop.vatRate || 0) : 0;
  const gross = Math.max(0, grossAmount);
  const netAmount = gross / (1 + vatRate / 100);
  return { vatRate, vatAmount: gross - netAmount, netAmount, grossAmount: gross };
};
var cartItem = z3.object({
  serviceId: z3.number().int().optional(),
  inventoryItemId: z3.number().int().optional(),
  name: z3.string().min(1).max(160),
  quantity: z3.number().positive().max(999),
  unitPrice: z3.number().nonnegative().max(1e6),
  lineDiscount: z3.number().min(0).max(1e6).default(0)
}).refine((item) => Boolean(item.serviceId || item.inventoryItemId), "Choose an inventory item or catalog item.");
var paymentLine = z3.object({ method: paymentMethod, amount: z3.number().positive().max(1e6), reference: z3.string().trim().max(160).optional() });
var calculateExchangeSettlement = (returnedGross, replacementGross) => {
  const difference = Number((replacementGross - returnedGross).toFixed(3));
  return { difference, refundAmount: Math.max(0, -difference), amountDue: Math.max(0, difference) };
};
async function dbOrThrow2() {
  const db = await getDb();
  if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  return db;
}
async function requireCounterAccess(userId) {
  const db = await dbOrThrow2();
  const role = (await db.select().from(userBusinessRoles).where(eq3(userBusinessRoles.userId, userId)).limit(1))[0];
  if (!role) throw new TRPCError4({ code: "FORBIDDEN", message: "Your ERP access is pending owner approval." });
  if (!role.isActive) throw new TRPCError4({ code: "FORBIDDEN", message: "Your ERP access is inactive." });
  if (role.role === "admin") return;
  const assignment = (await db.select().from(userCustomRoles).where(eq3(userCustomRoles.userId, userId)).limit(1))[0];
  if (assignment) {
    const customRole = (await db.select().from(customRoles).where(eq3(customRoles.id, assignment.customRoleId)).limit(1))[0];
    const permissions = Array.isArray(customRole?.permissionsJson) ? customRole.permissionsJson.filter((value) => typeof value === "string") : [];
    if (!assignment.isActive || !customRole?.isActive || !permissions.includes("sales")) throw new TRPCError4({ code: "FORBIDDEN", message: "Your owner-assigned role is not permitted to complete counter sales." });
    return;
  }
  if (role.role !== "sales") throw new TRPCError4({ code: "FORBIDDEN", message: "Your role is not permitted to complete counter sales." });
}
async function audit2(userId, action, entityType, entityId, details) {
  const db = await dbOrThrow2();
  await db.insert(auditLogs).values({ actorId: userId, action, entityType, entityId, detailsJson: JSON.stringify(details) });
}
async function existingCheckoutByReference(clientReference) {
  if (!clientReference) return null;
  const db = await dbOrThrow2();
  const existing = (await db.select({ saleId: sales.id, invoiceId: invoices.id, saleNumber: sales.saleNumber, total: sales.total, paidAmount: sales.paidAmount, paymentStatus: sales.paymentStatus }).from(sales).innerJoin(invoices, eq3(invoices.saleId, sales.id)).where(eq3(sales.clientReference, clientReference)).limit(1))[0];
  return existing ? { id: existing.saleId, invoiceId: existing.invoiceId, total: Number(existing.total), paidAmount: Number(existing.paidAmount), paymentStatus: existing.paymentStatus, saleNumber: existing.saleNumber } : null;
}
async function existingTailoringCheckoutByReference(clientReference) {
  const replay = await existingCheckoutByReference(clientReference);
  if (!replay) return null;
  const db = await dbOrThrow2();
  const order = (await db.select({ orderNumber: tailoringOrders.orderNumber }).from(tailoringOrders).where(eq3(tailoringOrders.saleId, replay.id)).limit(1))[0];
  return { ...replay, orderNumber: order?.orderNumber };
}
async function consumeDiscountUsage(tx, discountId) {
  const updated = await tx.update(discountCodes).set({ usedCount: sql2`${discountCodes.usedCount} + 1` }).where(and2(eq3(discountCodes.id, discountId), or2(isNull(discountCodes.usageLimit), lt(discountCodes.usedCount, discountCodes.usageLimit)))).returning({ id: discountCodes.id });
  if (!updated.length) throw new TRPCError4({ code: "BAD_REQUEST", message: "This discount code has reached its usage limit." });
}
var sessionInput = z3.object({ openingCash: z3.number().min(0).max(1e6), notes: z3.string().trim().max(2e3).optional() });
var checkoutInput = z3.object({
  clientReference: z3.string().trim().max(120).optional(),
  sessionId: z3.number().int().positive().optional(),
  heldOrderId: z3.number().int().positive().optional(),
  customerId: z3.number().int().positive().optional(),
  customerName: z3.string().min(1).max(160),
  customerPhone: z3.string().max(50).optional(),
  note: z3.string().trim().max(2e3).optional(),
  discount: z3.number().min(0).max(1e6).default(0),
  discountCode: z3.string().trim().max(80).optional(),
  paymentMethod: paymentMethod.default("cash"),
  paymentStatus: z3.enum(["paid", "partial", "unpaid"]).default("paid"),
  payments: z3.array(paymentLine).max(8).optional(),
  items: z3.array(cartItem).min(1)
}).superRefine((value, ctx) => {
  for (const item of value.items) if (item.lineDiscount > item.quantity * item.unitPrice) ctx.addIssue({ code: "custom", path: ["items"], message: `The discount for ${item.name} cannot exceed its line subtotal.` });
});
var quickCheckoutInput = z3.object({
  clientReference: z3.string().trim().max(120).optional(),
  sessionId: z3.number().int().positive().optional(),
  customerId: z3.number().int().positive().optional(),
  customerName: z3.string().min(1).max(160).default("Walk-in customer"),
  customerPhone: z3.string().max(50).optional(),
  amount: z3.number().positive().max(1e6),
  paymentMethod: paymentMethod.default("cash"),
  note: z3.string().trim().max(2e3).optional()
});
var tailoringCheckoutInput = z3.object({
  clientReference: z3.string().trim().max(120).optional(),
  sessionId: z3.number().int().positive().optional(),
  customerId: z3.number().int().positive(),
  measurementProfileId: z3.number().int().positive(),
  assignedTailorId: z3.number().int().positive(),
  serviceId: z3.number().int().positive().optional(),
  garmentType: z3.string().trim().min(2).max(80),
  quantity: z3.number().int().min(1).max(20),
  dueDate: z3.string().optional(),
  orderPrice: z3.number().positive(),
  paymentAmount: z3.number().min(0).max(1e6),
  customerSuppliedFabric: z3.boolean().default(false),
  fabricNotes: z3.string().max(2e3).optional(),
  paymentMethod,
  notes: z3.string().max(3e3),
  productionNotes: z3.string().max(3e3)
}).superRefine((value, ctx) => {
  if (value.paymentAmount > value.orderPrice) ctx.addIssue({ code: "custom", path: ["paymentAmount"], message: "The payment collected cannot exceed the quoted order price." });
});
var heldOrderInput = z3.object({
  sessionId: z3.number().int().positive(),
  customerId: z3.number().int().positive().optional(),
  note: z3.string().trim().max(2e3).optional(),
  items: z3.array(cartItem).min(1)
});
var returnItemSelection = z3.array(z3.object({ saleItemId: z3.number().int().positive(), quantity: z3.number().positive() })).max(1, "Choose only one item to return.");
var exchangeReplacementInput = z3.object({ serviceId: z3.number().int().positive().optional(), inventoryItemId: z3.number().int().positive().optional(), quantity: z3.number().positive().max(999) }).refine((item) => Boolean(item.serviceId || item.inventoryItemId), "Choose a replacement product.");
var returnInput = z3.object({
  sessionId: z3.number().int().positive().optional(),
  originalSaleId: z3.number().int().positive(),
  paymentMethod,
  mode: returnMode.default("items"),
  amount: z3.number().positive().max(1e6).optional(),
  reason: z3.string().trim().max(2e3).optional(),
  note: z3.string().trim().max(2e3).optional(),
  items: returnItemSelection.optional(),
  replacementItem: exchangeReplacementInput.optional()
}).superRefine((value, ctx) => {
  if ((value.mode === "items" || value.mode === "exchange") && (!value.items || value.items.length === 0)) ctx.addIssue({ code: "custom", path: ["items"], message: "Choose at least one item to return." });
  if (value.mode === "amount" && (!value.amount || value.amount <= 0)) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a refund amount." });
  if (value.mode === "exchange" && !value.replacementItem) ctx.addIssue({ code: "custom", path: ["replacementItem"], message: "Choose a replacement product." });
});
async function validateSession(tx, sessionId) {
  const session = (await tx.select().from(posSessions).where(eq3(posSessions.id, sessionId)).limit(1))[0];
  if (!session || session.status !== "open") throw new TRPCError4({ code: "BAD_REQUEST", message: "Open a POS session before completing this order." });
  return session;
}
async function resolveSession(tx, sessionId, userId) {
  if (sessionId) return validateSession(tx, sessionId);
  const existing = (await tx.select().from(posSessions).where(eq3(posSessions.status, "open")).orderBy(desc2(posSessions.openedAt)).limit(1))[0];
  if (existing) return existing;
  const sessionNumber = `POS-${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const result = await tx.insert(posSessions).values({ sessionNumber, openedBy: userId, openingCash: money(0), notes: "Opened automatically while synchronizing offline sales" }).returning();
  const session = result[0];
  if (!session) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The POS session could not be opened for offline sales." });
  return session;
}
async function resolveDiscount(tx, code, subtotal) {
  if (!code) return { id: null, snapshot: null, amount: 0 };
  const record = (await tx.select().from(discountCodes).where(eq3(discountCodes.code, code.toUpperCase())).limit(1))[0];
  if (!record || !record.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "This discount code is not active." });
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) throw new TRPCError4({ code: "BAD_REQUEST", message: "This discount code has expired." });
  if (record.usageLimit !== null && record.usedCount >= record.usageLimit) throw new TRPCError4({ code: "BAD_REQUEST", message: "This discount code has reached its usage limit." });
  if (subtotal < Number(record.minSubtotal)) throw new TRPCError4({ code: "BAD_REQUEST", message: `This code requires a subtotal of at least ${money(Number(record.minSubtotal))} BHD.` });
  const raw = record.type === "percent" ? subtotal * Number(record.value) / 100 : Number(record.value);
  const amount = Math.min(subtotal, record.maxDiscount ? Math.min(raw, Number(record.maxDiscount)) : raw);
  return { id: record.id, snapshot: record.code, amount };
}
var posRouter = router({
  catalog: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      const [serviceRows, inventoryRows] = await Promise.all([
        db.select({ service: services, inventory: inventoryItems }).from(services).leftJoin(inventoryItems, eq3(services.inventoryItemId, inventoryItems.id)).where(eq3(services.isActive, true)).orderBy(services.name),
        db.select().from(inventoryItems).where(eq3(inventoryItems.isActive, true)).orderBy(inventoryItems.name)
      ]);
      const linkedInventoryIds = new Set(serviceRows.map((row) => row.inventory?.id).filter((value) => Boolean(value)));
      const serviceCatalog = serviceRows.map(({ service, inventory }) => ({
        id: service.id,
        catalogKey: `service:${service.id}`,
        kind: "service",
        serviceId: service.id,
        inventoryItemId: inventory?.id || null,
        sku: service.sku,
        name: service.name,
        category: service.category,
        description: service.description || "",
        unitPrice: service.unitPrice,
        defaultFabricMeters: service.defaultFabricMeters || null,
        isActive: service.isActive,
        inventory: inventory?.id ? { id: inventory.id, code: inventory.code, name: inventory.name, quantity: inventory.quantity, unit: inventory.unit, isActive: inventory.isActive } : null
      }));
      const inventoryCatalog = inventoryRows.filter((item) => !linkedInventoryIds.has(item.id)).map((item) => ({
        id: item.id,
        catalogKey: `inventory:${item.id}`,
        kind: "inventory",
        serviceId: null,
        inventoryItemId: item.id,
        sku: item.code,
        name: item.name,
        category: item.category,
        description: `${item.unit} \xB7 direct inventory item`,
        unitPrice: Number(item.salePrice) > 0 ? item.salePrice : item.costPerUnit,
        defaultFabricMeters: null,
        isActive: item.isActive,
        inventory: { id: item.id, code: item.code, name: item.name, quantity: item.quantity, unit: item.unit, isActive: item.isActive }
      }));
      return [...serviceCatalog, ...inventoryCatalog];
    })
  }),
  session: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      return (await db.select().from(posSessions).where(eq3(posSessions.status, "open")).orderBy(desc2(posSessions.openedAt)).limit(1))[0] || null;
    }),
    open: protectedProcedure.input(sessionInput).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      const existing = (await db.select().from(posSessions).where(eq3(posSessions.status, "open")).orderBy(desc2(posSessions.openedAt)).limit(1))[0];
      if (existing) return existing;
      const sessionNumber = `POS-${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
      const result = await db.insert(posSessions).values({ sessionNumber, openedBy: ctx.user.id, openingCash: money(input.openingCash), notes: input.notes || null }).returning();
      const session = result[0];
      await audit2(ctx.user.id, "POS_SESSION_OPENED", "posSession", session.id, { sessionNumber, openingCash: input.openingCash });
      return session;
    }),
    close: protectedProcedure.input(z3.object({ sessionId: z3.number().int().positive(), closingCash: z3.number().min(0), notes: z3.string().trim().max(2e3).optional() })).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      const session = (await db.select().from(posSessions).where(eq3(posSessions.id, input.sessionId)).limit(1))[0];
      if (!session || session.status !== "open") throw new TRPCError4({ code: "NOT_FOUND", message: "The POS session is not open." });
      await db.update(posSessions).set({ status: "closed", closingCash: money(input.closingCash), closedAt: /* @__PURE__ */ new Date(), notes: input.notes || session.notes }).where(eq3(posSessions.id, session.id));
      await audit2(ctx.user.id, "POS_SESSION_CLOSED", "posSession", session.id, { sessionNumber: session.sessionNumber, closingCash: input.closingCash });
      return { success: true };
    })
  }),
  orders: router({
    held: protectedProcedure.query(async ({ ctx }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      return db.select().from(posOrders).where(eq3(posOrders.status, "held")).orderBy(desc2(posOrders.updatedAt)).limit(100);
    }),
    hold: protectedProcedure.input(heldOrderInput).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      const orderNumber = `HOLD-${Date.now()}`;
      const result = await db.insert(posOrders).values({ orderNumber, sessionId: input.sessionId, customerId: input.customerId, cartJson: input.items, note: input.note || null, createdBy: ctx.user.id }).returning({ id: posOrders.id });
      const id2 = Number(result[0]?.id || 0);
      await audit2(ctx.user.id, "POS_ORDER_HELD", "posOrder", id2, { orderNumber, lineCount: input.items.length });
      return { id: id2, orderNumber };
    }),
    cancel: protectedProcedure.input(z3.object({ orderId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      await db.update(posOrders).set({ status: "cancelled", updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posOrders.id, input.orderId));
      await audit2(ctx.user.id, "POS_ORDER_CANCELLED", "posOrder", input.orderId, {});
      return { success: true };
    })
  }),
  discounts: router({
    validate: protectedProcedure.input(z3.object({ code: z3.string().trim().min(1).max(80), subtotal: z3.number().min(0) })).query(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      return resolveDiscount(db, input.code, input.subtotal);
    })
  }),
  checkout: protectedProcedure.input(checkoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id);
    const replay = await existingCheckoutByReference(input.clientReference);
    if (replay) return replay;
    const db = await dbOrThrow2();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const saleNumber = `POS-${Date.now()}`;
    const checkout = await db.transaction(async (tx) => {
      const resolvedSession = await resolveSession(tx, input.sessionId, ctx.user.id);
      const resolved = [];
      for (const item of input.items) {
        if (item.inventoryItemId && !item.serviceId) {
          const stock2 = (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, item.inventoryItemId)).for("update").limit(1))[0];
          if (!stock2?.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "This inventory item is no longer available at POS." });
          const lineSubtotal2 = item.quantity * item.unitPrice;
          resolved.push({ serviceId: null, inventoryItemId: stock2.id, name: stock2.name, quantity: item.quantity, unitPrice: item.unitPrice, lineDiscount: Math.min(item.lineDiscount, lineSubtotal2), stockPerSaleUnit: 1, stock: stock2 });
          continue;
        }
        const catalogItem = (await tx.select().from(services).where(eq3(services.id, item.serviceId)).limit(1))[0];
        if (!catalogItem || !catalogItem.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: `${item.name} is no longer available at POS.` });
        if (item.inventoryItemId && item.inventoryItemId !== catalogItem.inventoryItemId) throw new TRPCError4({ code: "BAD_REQUEST", message: `${catalogItem.name} no longer matches the selected inventory item.` });
        const stock = catalogItem.inventoryItemId ? (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, catalogItem.inventoryItemId)).for("update").limit(1))[0] : null;
        if (catalogItem.inventoryItemId && !stock?.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: `${catalogItem.name} has no active inventory link.` });
        const unitPrice = Number(catalogItem.unitPrice);
        const lineSubtotal = item.quantity * unitPrice;
        resolved.push({ serviceId: catalogItem.id, inventoryItemId: catalogItem.inventoryItemId, name: catalogItem.name, quantity: item.quantity, unitPrice, lineDiscount: Math.min(item.lineDiscount, lineSubtotal), stockPerSaleUnit: catalogItem.inventoryItemId ? Number(catalogItem.defaultFabricMeters || 1) : 0, stock: stock || null });
      }
      const subtotal = resolved.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const lineDiscount = resolved.reduce((sum, item) => sum + item.lineDiscount, 0);
      const code = await resolveDiscount(tx, input.discountCode, subtotal - lineDiscount);
      const customer = input.customerId ? (await tx.select().from(customers).where(eq3(customers.id, input.customerId)).limit(1))[0] : null;
      if (input.customerId && !customer) throw new TRPCError4({ code: "NOT_FOUND", message: "The selected customer was not found." });
      const taxableSubtotal = Math.max(0, subtotal - lineDiscount - input.discount - code.amount);
      const tax = taxFor(taxableSubtotal, shop);
      const total = tax.grossAmount;
      const payments = input.payments?.length ? input.payments : input.paymentStatus === "paid" ? [{ method: input.paymentMethod, amount: total }] : [];
      const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (paidAmount > total + 1e-3) throw new TRPCError4({ code: "BAD_REQUEST", message: "Payments cannot exceed the order total." });
      const calculatedStatus = paidAmount >= total - 1e-3 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
      const saleResult = await tx.insert(sales).values({ saleNumber, clientReference: input.clientReference || null, customerId: customer?.id || null, customerNameSnapshot: customer?.name || input.customerName, customerPhoneSnapshot: customer?.phone || input.customerPhone || null, subtotal: money(subtotal), discount: money(lineDiscount + input.discount + code.amount), vatRate: money(tax.vatRate), vatAmount: money(tax.vatAmount), total: money(total), paidAmount: money(paidAmount), paymentMethod: payments[0]?.method || input.paymentMethod, paymentStatus: calculatedStatus, source: "counter", sessionId: resolvedSession.id, discountCodeId: code.id, discountCodeSnapshot: code.snapshot, createdBy: ctx.user.id }).returning({ id: sales.id });
      const saleId = Number(saleResult[0]?.id || 0);
      if (!saleId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The sale header could not be created." });
      for (const item of resolved) {
        await tx.insert(saleItems).values({ saleId, serviceId: item.serviceId, inventoryItemId: item.inventoryItemId, nameSnapshot: item.name, quantity: money(item.quantity), unitPrice: money(item.unitPrice), lineDiscount: money(item.lineDiscount), lineTotal: money(Math.max(0, item.quantity * item.unitPrice - item.lineDiscount)), assignedTailorId: null, measurementProfileId: null });
        if (item.inventoryItemId && item.stock) {
          const before = Number(item.stock.quantity);
          const quantityDeducted = item.quantity * item.stockPerSaleUnit;
          const after = before - quantityDeducted;
          if (after < 0) throw new TRPCError4({ code: "BAD_REQUEST", message: `${item.stock.name} does not have enough stock.` });
          await tx.update(inventoryItems).set({ quantity: money(after) }).where(eq3(inventoryItems.id, item.stock.id));
          await tx.insert(stockMovements).values({ inventoryItemId: item.stock.id, movementType: "sale", quantityChange: money(-quantityDeducted), quantityBefore: money(before), quantityAfter: money(after), referenceType: "sale", referenceId: saleId, createdBy: ctx.user.id, notes: `${saleNumber} \xB7 ${money(item.stockPerSaleUnit)} ${item.stock.unit} per sale unit` });
        }
      }
      if (payments.length) for (const payment of payments) await tx.insert(posPayments).values({ saleId, method: payment.method, amount: money(payment.amount), reference: payment.reference || null, createdBy: ctx.user.id });
      if (code.id) await consumeDiscountUsage(tx, code.id);
      const invoiceResult = await tx.insert(invoices).values({ saleId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`, status: calculatedStatus, notes: `${input.note || "Issued from Odoo-style POS register."}${tax.vatAmount > 0 ? ` VAT ${money(tax.vatRate)}% included.` : ""}` }).returning({ id: invoices.id });
      const invoiceId = Number(invoiceResult[0]?.id || 0);
      if (!invoiceId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The invoice could not be created." });
      if (input.heldOrderId) await tx.update(posOrders).set({ status: "paid", updatedAt: /* @__PURE__ */ new Date() }).where(eq3(posOrders.id, input.heldOrderId));
      return { saleId, invoiceId, total, paidAmount, paymentStatus: calculatedStatus, lineCount: resolved.length };
    });
    await audit2(ctx.user.id, "POS_CHECKOUT_COMPLETED", "sale", checkout.saleId, { saleNumber, total: checkout.total, paidAmount: checkout.paidAmount, paymentStatus: checkout.paymentStatus, lineCount: checkout.lineCount });
    return { id: checkout.saleId, invoiceId: checkout.invoiceId, total: checkout.total, paidAmount: checkout.paidAmount, paymentStatus: checkout.paymentStatus, saleNumber };
  }),
  quickCheckout: protectedProcedure.input(quickCheckoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id);
    const replay = await existingCheckoutByReference(input.clientReference);
    if (replay) return replay;
    const db = await dbOrThrow2();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const saleNumber = `POS-${Date.now()}`;
    const tax = taxFor(input.amount, shop);
    const total = tax.grossAmount;
    const checkout = await db.transaction(async (tx) => {
      const resolvedSession = await resolveSession(tx, input.sessionId, ctx.user.id);
      const customer = input.customerId ? (await tx.select().from(customers).where(eq3(customers.id, input.customerId)).limit(1))[0] : null;
      if (input.customerId && !customer) throw new TRPCError4({ code: "NOT_FOUND", message: "The selected customer was not found." });
      const saleResult = await tx.insert(sales).values({
        saleNumber,
        clientReference: input.clientReference || null,
        customerId: customer?.id || null,
        customerNameSnapshot: customer?.name || input.customerName,
        customerPhoneSnapshot: customer?.phone || input.customerPhone || null,
        subtotal: money(input.amount),
        discount: money(0),
        vatRate: money(tax.vatRate),
        vatAmount: money(tax.vatAmount),
        total: money(total),
        paidAmount: money(total),
        paymentMethod: input.paymentMethod,
        paymentStatus: "paid",
        source: "counter",
        sessionId: resolvedSession.id,
        createdBy: ctx.user.id
      }).returning({ id: sales.id });
      const saleId = Number(saleResult[0]?.id || 0);
      if (!saleId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The walk-in sale could not be created." });
      await tx.insert(saleItems).values({
        saleId,
        serviceId: null,
        inventoryItemId: null,
        nameSnapshot: "Walk-in sale",
        quantity: money(1),
        unitPrice: money(input.amount),
        lineDiscount: money(0),
        lineTotal: money(input.amount),
        assignedTailorId: null,
        measurementProfileId: null
      });
      await tx.insert(posPayments).values({ saleId, method: input.paymentMethod, amount: money(total), reference: null, createdBy: ctx.user.id });
      const invoiceResult = await tx.insert(invoices).values({ saleId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`, status: "paid", notes: `${input.note || "Walk-in amount sale from POS register."}${tax.vatAmount > 0 ? ` VAT ${money(tax.vatRate)}% added.` : ""}` }).returning({ id: invoices.id });
      const invoiceId = Number(invoiceResult[0]?.id || 0);
      if (!invoiceId) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The walk-in invoice could not be created." });
      return { saleId, invoiceId, total, paidAmount: total, paymentStatus: "paid" };
    });
    await audit2(ctx.user.id, "POS_WALKIN_CHECKOUT_COMPLETED", "sale", checkout.saleId, { saleNumber, total: checkout.total, paymentMethod: input.paymentMethod });
    return { id: checkout.saleId, invoiceId: checkout.invoiceId, total: checkout.total, paidAmount: checkout.paidAmount, paymentStatus: checkout.paymentStatus, saleNumber };
  }),
  returns: router({
    lookup: protectedProcedure.input(z3.object({ saleNumber: z3.string().trim().min(1).max(160), search: z3.string().trim().min(1).max(160).optional() })).query(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      const term = (input.search || input.saleNumber).trim();
      const exact = (await db.select().from(sales).where(eq3(sales.saleNumber, term)).limit(1))[0];
      const sale = exact || (await db.select().from(sales).where(and2(or2(like2(sales.saleNumber, `%${term}%`), like2(sales.customerNameSnapshot, `%${term}%`), like2(sales.customerPhoneSnapshot, `%${term}%`)), sql2`${sales.returnOfSaleId} is null`)).orderBy(desc2(sales.createdAt)).limit(1))[0];
      if (!sale || sale.returnOfSaleId) return null;
      const items = await db.select().from(saleItems).where(eq3(saleItems.saleId, sale.id));
      return { sale, items };
    }),
    create: protectedProcedure.input(returnInput).mutation(async ({ ctx, input }) => {
      await requireCounterAccess(ctx.user.id);
      const db = await dbOrThrow2();
      const shop = (await db.select().from(shopSettings).limit(1))[0];
      const result = await db.transaction(async (tx) => {
        const resolvedSession = await resolveSession(tx, input.sessionId, ctx.user.id);
        const original = (await tx.select().from(sales).where(eq3(sales.id, input.originalSaleId)).limit(1))[0];
        if (!original) throw new TRPCError4({ code: "NOT_FOUND", message: "The original sale was not found." });
        const originalItems = await tx.select().from(saleItems).where(eq3(saleItems.saleId, original.id));
        const priorReturns = await tx.select().from(sales).where(eq3(sales.returnOfSaleId, original.id));
        const priorRefunds = priorReturns.filter((row) => row.returnMode !== "exchange_replacement");
        const priorReturnIds = new Set(priorRefunds.map((row) => row.id));
        const priorReturnItems = (await tx.select().from(saleItems)).filter((item) => priorReturnIds.has(item.saleId));
        const lines = input.mode === "items" || input.mode === "exchange" ? (input.items || []).map((request) => {
          const source = originalItems.find((item) => item.id === request.saleItemId);
          if (!source) throw new TRPCError4({ code: "BAD_REQUEST", message: "A returned item does not belong to the original sale." });
          const alreadyReturned = priorReturnItems.filter((item) => item.nameSnapshot === source.nameSnapshot).reduce((sum, item) => sum + Math.abs(Number(item.quantity)), 0);
          if (alreadyReturned + request.quantity > Number(source.quantity) + 1e-3) throw new TRPCError4({ code: "BAD_REQUEST", message: `Cannot return more ${source.nameSnapshot} than was sold.` });
          const originalQuantity = Math.max(Number(source.quantity), 1e-3);
          return { source, quantity: request.quantity, lineTotal: request.quantity * (Number(source.lineTotal) / originalQuantity) };
        }) : [];
        const originalGross = Math.max(0, Number(original.total));
        const alreadyRefundedGross = priorRefunds.reduce((sum, row) => sum + Math.abs(Number(row.total)), 0);
        const vatRate = Number(original.vatRate || 0);
        const requestedGross = input.mode === "amount" ? Number(input.amount || 0) : lines.reduce((sum, line) => sum + line.lineTotal, 0) * (1 + vatRate / 100);
        if (requestedGross <= 0) throw new TRPCError4({ code: "BAD_REQUEST", message: "The refund amount must be greater than zero." });
        if (alreadyRefundedGross + requestedGross > originalGross + 1e-3) throw new TRPCError4({ code: "BAD_REQUEST", message: "The refund cannot exceed the remaining amount on the original sale." });
        if (input.mode === "amount" && !input.reason?.trim()) throw new TRPCError4({ code: "BAD_REQUEST", message: "Enter a reason for an amount-based refund." });
        let replacement = null;
        if (input.mode === "exchange") {
          const replacementInput = input.replacementItem;
          if (!replacementInput) throw new TRPCError4({ code: "BAD_REQUEST", message: "Choose a replacement product." });
          if (replacementInput.serviceId) {
            const service = (await tx.select().from(services).where(eq3(services.id, replacementInput.serviceId)).limit(1))[0];
            if (!service || !service.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "The replacement service is no longer active." });
            const stock = service.inventoryItemId ? (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, service.inventoryItemId)).for("update").limit(1))[0] || null : null;
            const stockPerSaleUnit = service.inventoryItemId ? Number(service.defaultFabricMeters || 1) : 0;
            if (stock && Number(stock.quantity) + 1e-3 < replacementInput.quantity * stockPerSaleUnit) throw new TRPCError4({ code: "BAD_REQUEST", message: `Not enough stock for ${service.name}.` });
            replacement = { serviceId: service.id, inventoryItemId: service.inventoryItemId || null, name: service.name, quantity: replacementInput.quantity, unitPrice: Number(service.unitPrice), stockPerSaleUnit, stock };
          } else {
            const stock = replacementInput.inventoryItemId ? (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, replacementInput.inventoryItemId)).for("update").limit(1))[0] || null : null;
            if (!stock || !stock.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "The replacement inventory item is no longer active." });
            const unitPrice = Number(stock.salePrice) > 0 ? Number(stock.salePrice) : Number(stock.costPerUnit);
            if (unitPrice <= 0) throw new TRPCError4({ code: "BAD_REQUEST", message: `Set a sale price for ${stock.name} before using it as an exchange replacement.` });
            if (Number(stock.quantity) + 1e-3 < replacementInput.quantity) throw new TRPCError4({ code: "BAD_REQUEST", message: `Not enough stock for ${stock.name}.` });
            replacement = { serviceId: null, inventoryItemId: stock.id, name: stock.name, quantity: replacementInput.quantity, unitPrice, stockPerSaleUnit: 1, stock };
          }
        }
        const replacementNet = replacement ? replacement.quantity * replacement.unitPrice : 0;
        const replacementGross = replacement ? replacementNet * (1 + vatRate / 100) : 0;
        const settlement = calculateExchangeSettlement(requestedGross, replacementGross);
        const settlementAmount = settlement.difference;
        const netTotal = input.mode === "amount" ? requestedGross / (1 + vatRate / 100) : lines.reduce((sum, line) => sum + line.lineTotal, 0);
        const vatAmount = requestedGross - netTotal;
        const saleNumber = `RET-${Date.now()}`;
        const saleResult = await tx.insert(sales).values({ saleNumber, customerId: original.customerId, customerNameSnapshot: original.customerNameSnapshot, customerPhoneSnapshot: original.customerPhoneSnapshot, subtotal: money(-netTotal), discount: "0.000", vatRate: money(vatRate), vatAmount: money(-vatAmount), total: money(-requestedGross), paidAmount: money(-requestedGross), paymentMethod: input.paymentMethod, paymentStatus: "paid", source: "counter", sessionId: resolvedSession.id, returnOfSaleId: original.id, returnMode: input.mode, returnReason: input.reason || input.note || null, createdBy: ctx.user.id }).returning({ id: sales.id });
        const saleId = Number(saleResult[0]?.id || 0);
        if (input.mode === "items" || input.mode === "exchange") for (const line of lines) {
          await tx.insert(saleItems).values({ saleId, serviceId: line.source.serviceId, inventoryItemId: line.source.inventoryItemId, nameSnapshot: line.source.nameSnapshot, quantity: money(-line.quantity), unitPrice: money(Number(line.source.unitPrice)), lineDiscount: money(Number(line.source.lineDiscount)), lineTotal: money(-line.lineTotal), assignedTailorId: line.source.assignedTailorId, measurementProfileId: line.source.measurementProfileId });
          if (line.source.inventoryItemId) {
            const stock = (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, line.source.inventoryItemId)).for("update").limit(1))[0];
            if (stock) {
              const before = Number(stock.quantity);
              const stockPerSaleUnit = line.source.serviceId ? Number((await tx.select({ defaultFabricMeters: services.defaultFabricMeters }).from(services).where(eq3(services.id, line.source.serviceId)).limit(1))[0]?.defaultFabricMeters || 1) : 1;
              const after = before + line.quantity * stockPerSaleUnit;
              await tx.update(inventoryItems).set({ quantity: money(after) }).where(eq3(inventoryItems.id, stock.id));
              await tx.insert(stockMovements).values({ inventoryItemId: stock.id, movementType: "return", quantityChange: money(line.quantity), quantityBefore: money(before), quantityAfter: money(after), referenceType: "sale", referenceId: saleId, createdBy: ctx.user.id, notes: `${saleNumber} \xB7 return of ${original.saleNumber}` });
            }
          }
        }
        else {
          await tx.insert(saleItems).values({ saleId, serviceId: null, inventoryItemId: null, nameSnapshot: `Refund \xB7 ${input.reason}`, quantity: "1.000", unitPrice: money(netTotal), lineDiscount: "0.000", lineTotal: money(-netTotal), assignedTailorId: null, measurementProfileId: null });
        }
        await tx.insert(posPayments).values({ saleId, method: input.paymentMethod, amount: money(-requestedGross), reference: `${input.mode === "exchange" ? "Exchange return" : "Refund"} of ${original.saleNumber}${input.reason ? ` \xB7 ${input.reason}` : ""}`, createdBy: ctx.user.id });
        const invoiceResult = await tx.insert(invoices).values({ saleId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`, status: "paid", notes: input.note || `${input.mode === "amount" ? "Amount refund" : input.mode === "exchange" ? "Exchange return" : "Item return"} of ${original.saleNumber}${input.reason ? ` \xB7 ${input.reason}` : ""}.` }).returning({ id: invoices.id });
        let replacementSaleId = null;
        let replacementInvoiceId = null;
        if (replacement && input.mode === "exchange") {
          const replacementSaleNumber = `EXC-${Date.now()}`;
          const replacementSaleResult = await tx.insert(sales).values({ saleNumber: replacementSaleNumber, customerId: original.customerId, customerNameSnapshot: original.customerNameSnapshot, customerPhoneSnapshot: original.customerPhoneSnapshot, subtotal: money(replacementNet), discount: "0.000", vatRate: money(vatRate), vatAmount: money(replacementGross - replacementNet), total: money(replacementGross), paidAmount: money(replacementGross), paymentMethod: input.paymentMethod, paymentStatus: "paid", source: "counter", sessionId: resolvedSession.id, returnOfSaleId: original.id, returnMode: "exchange_replacement", returnReason: `Replacement for ${original.saleNumber}`, createdBy: ctx.user.id }).returning({ id: sales.id });
          replacementSaleId = Number(replacementSaleResult[0]?.id || 0);
          await tx.insert(saleItems).values({ saleId: replacementSaleId, serviceId: replacement.serviceId, inventoryItemId: replacement.inventoryItemId, nameSnapshot: replacement.name, quantity: money(replacement.quantity), unitPrice: money(replacement.unitPrice), lineDiscount: "0.000", lineTotal: money(replacementNet), assignedTailorId: null, measurementProfileId: null });
          if (replacement.stock && replacement.inventoryItemId) {
            const before = Number(replacement.stock.quantity);
            const after = before - replacement.quantity * replacement.stockPerSaleUnit;
            await tx.update(inventoryItems).set({ quantity: money(after) }).where(eq3(inventoryItems.id, replacement.inventoryItemId));
            await tx.insert(stockMovements).values({ inventoryItemId: replacement.inventoryItemId, movementType: "sale", quantityChange: money(-replacement.quantity * replacement.stockPerSaleUnit), quantityBefore: money(before), quantityAfter: money(after), referenceType: "exchange", referenceId: replacementSaleId, createdBy: ctx.user.id, notes: `${replacementSaleNumber} \xB7 replacement for ${original.saleNumber}` });
          }
          await tx.insert(posPayments).values({ saleId: replacementSaleId, method: input.paymentMethod, amount: money(requestedGross), reference: `Exchange credit from ${original.saleNumber}`, createdBy: ctx.user.id });
          if (Math.abs(settlementAmount) > 5e-4) await tx.insert(posPayments).values({ saleId: replacementSaleId, method: input.paymentMethod, amount: money(settlementAmount), reference: settlementAmount > 0 ? `Exchange balance due from ${original.saleNumber}` : `Exchange refund to original ${original.saleNumber}`, createdBy: ctx.user.id });
          const replacementInvoiceResult = await tx.insert(invoices).values({ saleId: replacementSaleId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(replacementSaleId).padStart(6, "0")}`, status: "paid", notes: `Replacement item for exchange ${original.saleNumber}. ${settlementAmount > 0 ? `Balance collected: ${money(settlementAmount)}.` : settlementAmount < 0 ? `Refund issued: ${money(Math.abs(settlementAmount))}.` : "No balance due."}` }).returning({ id: invoices.id });
          replacementInvoiceId = Number(replacementInvoiceResult[0]?.id || 0);
        }
        return { saleId, invoiceId: Number(invoiceResult[0]?.id || 0), saleNumber, total: input.mode === "exchange" ? settlementAmount : -requestedGross, replacementSaleId, replacementInvoiceId, settlementAmount: input.mode === "exchange" ? settlementAmount : null };
      });
      await audit2(ctx.user.id, input.mode === "exchange" ? "POS_EXCHANGE_COMPLETED" : "POS_RETURN_COMPLETED", "sale", result.saleId, { originalSaleId: input.originalSaleId, total: result.total, replacementSaleId: result.replacementSaleId, settlementAmount: result.settlementAmount });
      return result;
    })
  }),
  tailoringCheckout: protectedProcedure.input(tailoringCheckoutInput).mutation(async ({ ctx, input }) => {
    await requireCounterAccess(ctx.user.id);
    const replay = await existingTailoringCheckoutByReference(input.clientReference);
    if (replay) return replay;
    const db = await dbOrThrow2();
    const shop = (await db.select().from(shopSettings).limit(1))[0];
    const orderNumber = `TO-${Date.now()}`;
    const saleNumber = `POS-TO-${Date.now()}`;
    const paymentStatus = input.paymentAmount >= input.orderPrice - 1e-3 ? "paid" : input.paymentAmount > 0 ? "partial" : "unpaid";
    const paymentTax = taxFromGross(input.paymentAmount, shop);
    const transaction = await db.transaction(async (tx) => {
      const resolvedSession = await resolveSession(tx, input.sessionId, ctx.user.id);
      const customer = (await tx.select().from(customers).where(eq3(customers.id, input.customerId)).limit(1))[0];
      if (!customer) throw new TRPCError4({ code: "NOT_FOUND", message: "Choose a valid customer before creating a tailoring order." });
      const measurement = (await tx.select().from(measurementProfiles).where(eq3(measurementProfiles.id, input.measurementProfileId)).limit(1))[0];
      if (!measurement || measurement.customerId !== customer.id) throw new TRPCError4({ code: "BAD_REQUEST", message: "Choose a saved measurement version belonging to this customer." });
      const tailor = (await tx.select().from(staffProfiles).where(eq3(staffProfiles.id, input.assignedTailorId)).limit(1))[0];
      if (!tailor?.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "Choose an active tailor for this production order." });
      const service = input.serviceId ? (await tx.select().from(services).where(eq3(services.id, input.serviceId)).limit(1))[0] : null;
      if (input.serviceId && (!service || !service.isActive)) throw new TRPCError4({ code: "BAD_REQUEST", message: "The selected tailoring service is no longer available." });
      const linkedStock = service?.inventoryItemId ? (await tx.select().from(inventoryItems).where(eq3(inventoryItems.id, service.inventoryItemId)).for("update").limit(1))[0] : null;
      if (service?.inventoryItemId && !linkedStock?.isActive) throw new TRPCError4({ code: "BAD_REQUEST", message: "The selected tailoring service has no active material link." });
      const stockPerPiece = service?.inventoryItemId ? Number(service.defaultFabricMeters || 1) : 0;
      const stockNeeded = input.quantity * stockPerPiece;
      if (!input.customerSuppliedFabric && linkedStock && Number(linkedStock.quantity) < stockNeeded) throw new TRPCError4({ code: "BAD_REQUEST", message: `${linkedStock.name} does not have enough stock for this tailoring order.` });
      const orderResult = await tx.insert(tailoringOrders).values({ orderNumber, customerId: customer.id, measurementProfileId: measurement.id, assignedTailorId: tailor.id, garmentType: input.garmentType, quantity: input.quantity, dueDate: input.dueDate ? new Date(input.dueDate) : null, price: money(input.orderPrice), customerSuppliedFabric: input.customerSuppliedFabric, fabricNotes: input.fabricNotes || null, status: "confirmed", notes: input.notes || null, productionNotes: input.productionNotes || null, createdBy: ctx.user.id }).returning({ id: tailoringOrders.id });
      const orderId = Number(orderResult[0]?.id || 0);
      const saleResult = await tx.insert(sales).values({ saleNumber, clientReference: input.clientReference || null, customerId: customer.id, customerNameSnapshot: customer.name, customerPhoneSnapshot: customer.phone || null, subtotal: money(paymentTax.netAmount), discount: "0.000", vatRate: money(paymentTax.vatRate), vatAmount: money(paymentTax.vatAmount), total: money(input.paymentAmount), paidAmount: money(input.paymentAmount), paymentMethod: input.paymentMethod, paymentStatus, source: "tailoring", sessionId: resolvedSession.id, createdBy: ctx.user.id }).returning({ id: sales.id });
      const saleId = Number(saleResult[0]?.id || 0);
      await tx.update(tailoringOrders).set({ saleId }).where(eq3(tailoringOrders.id, orderId));
      if (input.paymentAmount > 0) await tx.insert(posPayments).values({ saleId, method: input.paymentMethod, amount: money(input.paymentAmount), reference: `${orderNumber} initial payment`, createdBy: ctx.user.id });
      await tx.insert(saleItems).values({ saleId, serviceId: service?.id || null, inventoryItemId: linkedStock?.id || null, nameSnapshot: `${service?.name || input.garmentType} tailoring order \xB7 ${paymentStatus === "paid" ? "full payment" : paymentStatus === "partial" ? "deposit" : "unpaid"}`, quantity: money(input.quantity), unitPrice: money(paymentTax.netAmount / input.quantity), lineDiscount: "0.000", lineTotal: money(paymentTax.netAmount), assignedTailorId: tailor.id, measurementProfileId: measurement.id });
      if (!input.customerSuppliedFabric && linkedStock && stockNeeded > 0) {
        const before = Number(linkedStock.quantity);
        const after = before - stockNeeded;
        await tx.update(inventoryItems).set({ quantity: money(after) }).where(eq3(inventoryItems.id, linkedStock.id));
        await tx.insert(stockMovements).values({ inventoryItemId: linkedStock.id, movementType: "sale", quantityChange: money(-stockNeeded), quantityBefore: money(before), quantityAfter: money(after), referenceType: "tailoring_order", referenceId: orderId, createdBy: ctx.user.id, notes: `${orderNumber} \xB7 ${money(stockPerPiece)} ${linkedStock.unit} per piece` });
      }
      const invoiceResult = await tx.insert(invoices).values({ saleId, invoiceNumber: `${shop?.invoicePrefix || "INV"}-${String(saleId).padStart(6, "0")}`, status: paymentStatus, notes: `${orderNumber} \xB7 ${input.garmentType} \xB7 quoted ${money(input.orderPrice)} BHD incl. VAT \xB7 ${paymentStatus === "paid" ? "full payment" : paymentStatus === "partial" ? "deposit" : "no payment"} collected from POS.${input.customerSuppliedFabric ? " Customer supplied fabric." : " Shop fabric."}` }).returning({ id: invoices.id });
      return { orderId, saleId, invoiceId: Number(invoiceResult[0]?.id || 0) };
    });
    await audit2(ctx.user.id, "POS_TAILORING_CHECKOUT_COMPLETED", "tailoringOrder", transaction.orderId, { orderNumber, saleNumber, paymentAmount: input.paymentAmount, orderPrice: input.orderPrice, paymentStatus });
    return { ...transaction, orderNumber, saleNumber, total: input.paymentAmount, paymentStatus };
  })
});

// server/routers.ts
var authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user)
});
var appRouter = router({ system: systemRouter, auth: authRouter, erp: erpRouter, pos: posRouter });

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
async function getSupabaseUser(accessToken) {
  if (!ENV.supabaseAnonKey) {
    throw ForbiddenError("Server authentication is not configured");
  }
  let response;
  try {
    response = await fetch(`${ENV.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      }
    });
  } catch {
    throw ForbiddenError("Session verification unavailable");
  }
  if (!response.ok) {
    throw ForbiddenError("Invalid session");
  }
  const data = await response.json();
  if (!data?.id) {
    throw ForbiddenError("Invalid session");
  }
  return data;
}
var SDKServer = class {
  /**
   * Verifies the Supabase access token sent as `Authorization: Bearer <token>`
   * against the Supabase Auth user endpoint, then syncs it to the app-level
   * `users` row (role/pending-approval gating lives there, not in Supabase).
   */
  async authenticateRequest(req) {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : void 0;
    if (!token) {
      throw ForbiddenError("Missing session");
    }
    const authUser = await getSupabaseUser(token);
    const metadata = authUser.user_metadata;
    const name = typeof metadata?.name === "string" && metadata.name || typeof metadata?.full_name === "string" && metadata.full_name || authUser.email || "";
    await upsertUser({
      openId: authUser.id,
      name,
      email: authUser.email ?? null,
      loginMethod: "supabase",
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    const user = await getUserByOpenId(authUser.id);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/storageProxy.ts
import { eq as eq4 } from "drizzle-orm";
async function canReadStaffDocuments(userId) {
  const db = await getDb();
  if (!db) return false;
  const businessRole = (await db.select({ role: userBusinessRoles.role, isActive: userBusinessRoles.isActive }).from(userBusinessRoles).where(eq4(userBusinessRoles.userId, userId)).limit(1))[0];
  if (!businessRole?.isActive) return false;
  if (businessRole.role === "admin" || businessRole.role === "payroll") return true;
  const assignment = (await db.select({ customRoleId: userCustomRoles.customRoleId, isActive: userCustomRoles.isActive }).from(userCustomRoles).where(eq4(userCustomRoles.userId, userId)).limit(1))[0];
  if (!assignment?.isActive) return false;
  const customRole = (await db.select({ permissionsJson: customRoles.permissionsJson, isActive: customRoles.isActive }).from(customRoles).where(eq4(customRoles.id, assignment.customRoleId)).limit(1))[0];
  const permissions = Array.isArray(customRole?.permissionsJson) ? customRole.permissionsJson.filter((value) => typeof value === "string") : [];
  return Boolean(customRole?.isActive && permissions.includes("payroll"));
}
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key || key.length > 500) {
      res.status(400).send("Invalid storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const user = await sdk.authenticateRequest(req);
      if (!await canReadStaffDocuments(user.id)) {
        res.status(403).send("You are not permitted to access this document.");
        return;
      }
      const db = await getDb();
      if (!db) {
        res.status(503).send("Database unavailable");
        return;
      }
      const document = (await db.select({ id: staffDocuments.id }).from(staffDocuments).where(eq4(staffDocuments.storageKey, key)).limit(1))[0];
      if (!document) {
        res.status(404).send("Document not found");
        return;
      }
      const forgeUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
      res.redirect(307, url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      if (message === "Missing session" || message === "Invalid session" || message === "Session verification unavailable" || message === "Server authentication is not configured") {
        res.status(401).send("Authentication required");
        return;
      }
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/app.ts
function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cache-Control", "no-store");
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  registerStorageProxy(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/vercel.ts
var vercel_default = createApp();
export {
  vercel_default as default
};
