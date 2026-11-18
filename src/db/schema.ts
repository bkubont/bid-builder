/**
 * Database schema (MySQL / MariaDB).
 *
 * Every business table carries `company_id`, and every query in
 * src/server/data filters on it, so one company can never read or change
 * another company's rows.
 *
 * Money uses DECIMAL (exact), calendar dates use DATE ("YYYY-MM-DD"),
 * timestamps are stored in UTC.
 */
import {
  boolean,
  customType,
  date,
  datetime,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { EstimateSection, LineCategory, LineItem } from "@/lib/types";

/** JSON column that works on both MySQL (returns objects) and MariaDB (returns text). */
const jsonColumn = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => "json",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => (typeof value === "string" ? JSON.parse(value) : value) as T,
  })(name);

const id = (name = "id") => varchar(name, { length: 36 });
const createdAt = () => datetime("created_at", { mode: "date", fsp: 3 }).notNull();
const updatedAt = () => datetime("updated_at", { mode: "date", fsp: 3 }).notNull();
const money = (name: string) => decimal(name, { precision: 12, scale: 4, mode: "number" });
const percent = (name: string) => decimal(name, { precision: 7, scale: 3, mode: "number" });

const TRADES = [
  "general",
  "carpentry",
  "electrical",
  "plumbing",
  "hvac",
  "roofing",
  "painting",
  "concrete",
] as const;
const CATEGORIES = ["labor", "material", "equipment", "other"] as const;

// ---------------------------------------------------------------------------
// Auth tables (shape required by Better Auth)
// ---------------------------------------------------------------------------

export const user = mysqlTable("user", {
  id: id().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = mysqlTable(
  "session",
  {
    id: id().primaryKey(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    userId: id("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)]
);

export const account = mysqlTable(
  "account",
  {
    id: id().primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    userId: id("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: datetime("access_token_expires_at", { mode: "date", fsp: 3 }),
    refreshTokenExpiresAt: datetime("refresh_token_expires_at", { mode: "date", fsp: 3 }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)]
);

export const verification = mysqlTable(
  "verification",
  {
    id: id().primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

// ---------------------------------------------------------------------------
// Companies, people, invites
// ---------------------------------------------------------------------------

export const companies = mysqlTable("companies", {
  id: id().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: createdAt(),
});

export const memberships = mysqlTable(
  "memberships",
  {
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: id("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["owner", "member"]).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.userId] }), index("membership_user_idx").on(t.userId)]
);

export const invites = mysqlTable(
  "invites",
  {
    id: id().primaryKey(),
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 254 }).notNull(),
    role: mysqlEnum("role", ["owner", "member"]).notNull(),
    /** SHA-256 of the secret in the invite link; the link itself is never stored. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    createdBy: id("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    acceptedAt: datetime("accepted_at", { mode: "date", fsp: 3 }),
  },
  (t) => [index("invite_company_idx").on(t.companyId)]
);

export const companySettings = mysqlTable("company_settings", {
  companyId: id("company_id")
    .primaryKey()
    .references(() => companies.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 254 }).notNull().default(""),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  address: varchar("address", { length: 255 }).notNull().default(""),
  licenseNumber: varchar("license_number", { length: 80 }).notNull().default(""),
  defaultMarkup: percent("default_markup").notNull().default(20),
  defaultTax: percent("default_tax").notNull().default(6),
  terms: text("terms").notNull(),
  /** null = materials only (the default). */
  taxableCategories: jsonColumn<LineCategory[] | null>("taxable_categories"),
  depositPercent: percent("deposit_percent").notNull().default(50),
  estimateCounter: int("estimate_counter").notNull().default(1000),
  invoiceCounter: int("invoice_counter").notNull().default(2000),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Business data
// ---------------------------------------------------------------------------

export const customers = mysqlTable(
  "customers",
  {
    id: id().primaryKey(),
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 254 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    address: varchar("address", { length: 255 }).notNull().default(""),
    notes: text("notes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customer_company_idx").on(t.companyId)]
);

export const pricebookItems = mysqlTable(
  "pricebook_items",
  {
    id: id().primaryKey(),
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    category: mysqlEnum("category", CATEGORIES).notNull(),
    trade: mysqlEnum("trade", TRADES).notNull(),
    unit: varchar("unit", { length: 16 }).notNull(),
    unitCost: money("unit_cost").notNull(),
    keywords: jsonColumn<string[]>("keywords").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pricebook_company_idx").on(t.companyId)]
);

export const estimates = mysqlTable(
  "estimates",
  {
    id: id().primaryKey(),
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 32 }).notNull(),
    customerId: id("customer_id").references(() => customers.id, { onDelete: "set null" }),
    jobTitle: varchar("job_title", { length: 200 }).notNull(),
    jobAddress: varchar("job_address", { length: 255 }).notNull().default(""),
    trade: mysqlEnum("trade", TRADES).notNull(),
    status: mysqlEnum("status", ["draft", "sent", "accepted", "declined", "converted"]).notNull(),
    lineItems: jsonColumn<LineItem[]>("line_items").notNull(),
    sections: jsonColumn<EstimateSection[] | null>("sections"),
    taxPercent: percent("tax_percent").notNull(),
    /** null on documents made before this setting existed = tax every line. */
    taxableCategories: jsonColumn<LineCategory[] | null>("taxable_categories"),
    notes: text("notes").notNull(),
    validUntil: date("valid_until", { mode: "string" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("estimate_company_number_uq").on(t.companyId, t.number),
    index("estimate_company_idx").on(t.companyId, t.updatedAt),
  ]
);

export const invoices = mysqlTable(
  "invoices",
  {
    id: id().primaryKey(),
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 32 }).notNull(),
    kind: mysqlEnum("kind", ["final", "deposit"]).notNull().default("final"),
    estimateId: id("estimate_id").references(() => estimates.id, { onDelete: "set null" }),
    customerId: id("customer_id").references(() => customers.id, { onDelete: "set null" }),
    jobTitle: varchar("job_title", { length: 200 }).notNull(),
    jobAddress: varchar("job_address", { length: 255 }).notNull().default(""),
    status: mysqlEnum("status", ["draft", "sent", "paid", "overdue"]).notNull(),
    lineItems: jsonColumn<LineItem[]>("line_items").notNull(),
    sections: jsonColumn<EstimateSection[] | null>("sections"),
    taxPercent: percent("tax_percent").notNull(),
    taxableCategories: jsonColumn<LineCategory[] | null>("taxable_categories"),
    depositApplied: decimal("deposit_applied", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    notes: text("notes").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    paidAt: datetime("paid_at", { mode: "date", fsp: 3 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("invoice_company_number_uq").on(t.companyId, t.number),
    // At most one deposit and one final invoice per estimate: a double tap can't bill twice.
    uniqueIndex("invoice_estimate_kind_uq").on(t.estimateId, t.kind),
    index("invoice_company_idx").on(t.companyId, t.createdAt),
  ]
);

export const scheduleBlocks = mysqlTable(
  "schedule_blocks",
  {
    id: id().primaryKey(),
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    estimateId: id("estimate_id")
      .notNull()
      .references(() => estimates.id, { onDelete: "cascade" }),
    lineItemIds: jsonColumn<string[] | null>("line_item_ids"),
    title: varchar("title", { length: 255 }).notNull(),
    start: datetime("start", { mode: "date", fsp: 3 }).notNull(),
    durationMinutes: int("duration_minutes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("block_company_start_idx").on(t.companyId, t.start)]
);

/** Per-company daily count of AI drafts, for the usage limit. */
export const aiUsage = mysqlTable(
  "ai_usage",
  {
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    count: int("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.day] })]
);

/** Emails sent from the app, for the daily limit and a record of what went out. */
export const emailLog = mysqlTable(
  "email_log",
  {
    id: id().primaryKey(),
    companyId: id("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    sentBy: id("sent_by").references(() => user.id, { onDelete: "set null" }),
    documentType: mysqlEnum("document_type", ["estimate", "invoice"]).notNull(),
    documentId: id("document_id").notNull(),
    toEmail: varchar("to_email", { length: 254 }).notNull(),
    providerId: varchar("provider_id", { length: 100 }),
    createdAt: createdAt(),
  },
  (t) => [index("email_log_company_idx").on(t.companyId, t.createdAt)]
);
