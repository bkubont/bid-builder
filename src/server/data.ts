/**
 * Data access for one company. Every function takes the caller's companyId
 * (from their login, never from the browser) and only touches that
 * company's rows. Plain functions with no Next.js imports, so they can be
 * tested directly against a database.
 */
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  aiUsage,
  companies,
  companySettings,
  customers,
  estimates,
  invites,
  invoices,
  memberships,
  pricebookItems,
  scheduleBlocks,
  user,
} from "@/db/schema";
import { DEFAULT_COMPANY, createSeedData } from "@/lib/seed";
import type {
  AppData,
  CompanySettings,
  Customer,
  Estimate,
  Invoice,
  PricebookItem,
  ScheduleBlock,
} from "@/lib/types";
import { dateOnlyFromToday } from "@/lib/utils";
import type {
  CompanyInput,
  CustomerInput,
  EstimateInput,
  InvoiceUpdateInput,
  PricebookItemInput,
  ScheduleBlockInput,
} from "./validation";

/** An error whose message is safe and useful to show the person. */
export class UserError extends Error {}

export type Role = "owner" | "member";

/** The database, or a transaction on it. */
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

const newId = () => crypto.randomUUID();
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

// ---------------------------------------------------------------------------
// Row -> app types
// ---------------------------------------------------------------------------

type CustomerRow = typeof customers.$inferSelect;
type PricebookRow = typeof pricebookItems.$inferSelect;
type EstimateRow = typeof estimates.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;
type BlockRow = typeof scheduleBlocks.$inferSelect;

const toCustomer = (r: CustomerRow): Customer => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  address: r.address,
  notes: r.notes,
  createdAt: r.createdAt.toISOString(),
});

const toPricebookItem = (r: PricebookRow): PricebookItem => ({
  id: r.id,
  name: r.name,
  category: r.category,
  trade: r.trade,
  unit: r.unit,
  unitCost: Number(r.unitCost),
  keywords: r.keywords ?? [],
});

const toEstimate = (r: EstimateRow): Estimate => ({
  id: r.id,
  number: r.number,
  customerId: r.customerId ?? "",
  jobTitle: r.jobTitle,
  jobAddress: r.jobAddress,
  trade: r.trade,
  status: r.status,
  lineItems: r.lineItems ?? [],
  taxPercent: Number(r.taxPercent),
  notes: r.notes,
  validUntil: r.validUntil,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  number: r.number,
  estimateId: r.estimateId ?? undefined,
  customerId: r.customerId ?? "",
  jobTitle: r.jobTitle,
  jobAddress: r.jobAddress,
  status: r.status,
  lineItems: r.lineItems ?? [],
  taxPercent: Number(r.taxPercent),
  notes: r.notes,
  dueDate: r.dueDate,
  createdAt: r.createdAt.toISOString(),
  paidAt: iso(r.paidAt),
});

const toBlock = (r: BlockRow): ScheduleBlock => ({
  id: r.id,
  estimateId: r.estimateId,
  lineItemIds: r.lineItemIds ?? undefined,
  title: r.title,
  start: r.start.toISOString(),
  durationMinutes: r.durationMinutes,
});

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

/** Everything the app shows for one company. Small businesses: one round trip. */
export async function loadSnapshot(db: Db, companyId: string): Promise<AppData> {
  const [company, settings, cust, pb, est, inv, blocks] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)).limit(1),
    db.select().from(companySettings).where(eq(companySettings.companyId, companyId)).limit(1),
    db.select().from(customers).where(eq(customers.companyId, companyId)).orderBy(asc(customers.name)),
    db
      .select()
      .from(pricebookItems)
      .where(eq(pricebookItems.companyId, companyId))
      .orderBy(asc(pricebookItems.trade), asc(pricebookItems.name)),
    db.select().from(estimates).where(eq(estimates.companyId, companyId)).orderBy(desc(estimates.updatedAt)),
    db.select().from(invoices).where(eq(invoices.companyId, companyId)).orderBy(desc(invoices.createdAt)),
    db.select().from(scheduleBlocks).where(eq(scheduleBlocks.companyId, companyId)).orderBy(asc(scheduleBlocks.start)),
  ]);
  if (!company[0] || !settings[0]) throw new Error(`Company ${companyId} is missing settings`);
  const s = settings[0];
  return {
    company: {
      name: company[0].name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      licenseNumber: s.licenseNumber,
      defaultMarkup: Number(s.defaultMarkup),
      defaultTax: Number(s.defaultTax),
      terms: s.terms,
    },
    customers: cust.map(toCustomer),
    pricebook: pb.map(toPricebookItem),
    estimates: est.map(toEstimate),
    invoices: inv.map(toInvoice),
    scheduleBlocks: blocks.map(toBlock),
    counters: { estimate: s.estimateCounter, invoice: s.invoiceCounter },
  };
}

/** Snapshot plus when it was read, so the browser can tell it from an older offline copy. */
export async function loadSnapshotWithTime(db: Db, companyId: string) {
  const loadedAt = Date.now();
  return { data: await loadSnapshot(db, companyId), loadedAt };
}

// ---------------------------------------------------------------------------
// Company + settings
// ---------------------------------------------------------------------------

export async function createCompany(
  db: Db,
  input: { name: string; ownerUserId: string }
): Promise<string> {
  const companyId = newId();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(companies).values({ id: companyId, name: input.name, createdAt: now });
    await tx.insert(companySettings).values({
      companyId,
      email: "",
      phone: "",
      address: "",
      licenseNumber: "",
      defaultMarkup: DEFAULT_COMPANY.defaultMarkup,
      defaultTax: DEFAULT_COMPANY.defaultTax,
      terms: DEFAULT_COMPANY.terms,
      updatedAt: now,
    });
    await tx
      .insert(memberships)
      .values({ companyId, userId: input.ownerUserId, role: "owner", createdAt: now });
  });
  return companyId;
}

export async function countCompanies(db: Db): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(companies);
  return Number(row?.n ?? 0);
}

export async function updateCompany(db: Db, companyId: string, input: CompanyInput): Promise<CompanySettings> {
  await db.transaction(async (tx) => {
    await tx.update(companies).set({ name: input.name }).where(eq(companies.id, companyId));
    await tx
      .update(companySettings)
      .set({
        email: input.email,
        phone: input.phone,
        address: input.address,
        licenseNumber: input.licenseNumber,
        defaultMarkup: input.defaultMarkup,
        defaultTax: input.defaultTax,
        terms: input.terms,
        updatedAt: new Date(),
      })
      .where(eq(companySettings.companyId, companyId));
  });
  return { ...input };
}

/** Reserve the next estimate or invoice number. Must run inside a transaction. */
async function nextNumber(tx: Exec, companyId: string, kind: "estimate" | "invoice"): Promise<string> {
  const [row] = await tx
    .select({ estimate: companySettings.estimateCounter, invoice: companySettings.invoiceCounter })
    .from(companySettings)
    .where(eq(companySettings.companyId, companyId))
    .for("update"); // lock the row so two saves can't get the same number
  if (!row) throw new Error("Company settings missing");
  const next = row[kind] + 1;
  await tx
    .update(companySettings)
    .set(kind === "estimate" ? { estimateCounter: next } : { invoiceCounter: next })
    .where(eq(companySettings.companyId, companyId));
  return `${kind === "estimate" ? "EST" : "INV"}-${next}`;
}

// ---------------------------------------------------------------------------
// Ownership helpers
// ---------------------------------------------------------------------------

async function assertCustomer(db: Db, companyId: string, customerId: string) {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)))
    .limit(1);
  if (!row) throw new UserError("That customer no longer exists. Pick another.");
}

async function getEstimateRow(db: Db, companyId: string, estimateId: string) {
  const [row] = await db
    .select()
    .from(estimates)
    .where(and(eq(estimates.id, estimateId), eq(estimates.companyId, companyId)))
    .limit(1);
  return row;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function upsertCustomer(db: Db, companyId: string, input: CustomerInput): Promise<Customer> {
  const now = new Date();
  if (input.id) {
    const where = and(eq(customers.id, input.id), eq(customers.companyId, companyId));
    const [existing] = await db.select().from(customers).where(where).limit(1);
    if (!existing) throw new UserError("That customer no longer exists.");
    const values = {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      notes: input.notes,
      updatedAt: now,
    };
    await db.update(customers).set(values).where(where);
    return toCustomer({ ...existing, ...values });
  }
  const row = {
    id: newId(),
    companyId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(customers).values(row);
  return toCustomer(row);
}

export async function deleteCustomer(db: Db, companyId: string, customerId: string) {
  await db.delete(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)));
}

// ---------------------------------------------------------------------------
// Pricebook
// ---------------------------------------------------------------------------

export async function upsertPricebookItem(
  db: Db,
  companyId: string,
  input: PricebookItemInput
): Promise<PricebookItem> {
  const now = new Date();
  const keywords = [...new Set(input.keywords.map((k) => k.toLowerCase()).filter(Boolean))];
  const values = {
    name: input.name,
    category: input.category,
    trade: input.trade,
    unit: input.unit,
    unitCost: input.unitCost,
    keywords,
    updatedAt: now,
  };
  if (input.id) {
    const where = and(eq(pricebookItems.id, input.id), eq(pricebookItems.companyId, companyId));
    const [existing] = await db.select({ id: pricebookItems.id }).from(pricebookItems).where(where).limit(1);
    if (!existing) throw new UserError("That pricebook item no longer exists.");
    await db.update(pricebookItems).set(values).where(where);
    return { id: input.id, ...values };
  }
  const id = newId();
  await db.insert(pricebookItems).values({ id, companyId, ...values, createdAt: now });
  return { id, ...values };
}

export async function deletePricebookItem(db: Db, companyId: string, itemId: string) {
  await db
    .delete(pricebookItems)
    .where(and(eq(pricebookItems.id, itemId), eq(pricebookItems.companyId, companyId)));
}

export async function listPricebook(db: Db, companyId: string): Promise<PricebookItem[]> {
  const rows = await db.select().from(pricebookItems).where(eq(pricebookItems.companyId, companyId));
  return rows.map(toPricebookItem);
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

export async function upsertEstimate(db: Db, companyId: string, input: EstimateInput): Promise<Estimate> {
  await assertCustomer(db, companyId, input.customerId);
  const now = new Date();
  const values = {
    customerId: input.customerId,
    jobTitle: input.jobTitle,
    jobAddress: input.jobAddress,
    trade: input.trade,
    status: input.status,
    lineItems: input.lineItems,
    taxPercent: input.taxPercent,
    notes: input.notes,
    validUntil: input.validUntil,
    updatedAt: now,
  };

  if (input.id) {
    const existing = await getEstimateRow(db, companyId, input.id);
    if (!existing) throw new UserError("This estimate was deleted on another device.");
    await db
      .update(estimates)
      .set(values)
      .where(and(eq(estimates.id, input.id), eq(estimates.companyId, companyId)));
    return toEstimate({ ...existing, ...values });
  }

  return db.transaction(async (tx) => {
    const number = await nextNumber(tx, companyId, "estimate");
    const row = { id: newId(), companyId, number, ...values, createdAt: now };
    await tx.insert(estimates).values(row);
    return toEstimate(row);
  });
}

export async function deleteEstimate(db: Db, companyId: string, estimateId: string) {
  // Schedule blocks go with it (ON DELETE CASCADE); invoices keep their copy.
  await db.delete(estimates).where(and(eq(estimates.id, estimateId), eq(estimates.companyId, companyId)));
}

export async function duplicateEstimate(db: Db, companyId: string, estimateId: string): Promise<Estimate> {
  const source = await getEstimateRow(db, companyId, estimateId);
  if (!source) throw new UserError("This estimate was deleted on another device.");
  const now = new Date();
  return db.transaction(async (tx) => {
    const number = await nextNumber(tx, companyId, "estimate");
    const row: EstimateRow = {
      ...source,
      id: newId(),
      number,
      status: "draft",
      jobTitle: `${source.jobTitle} (copy)`.slice(0, 200),
      lineItems: (source.lineItems ?? []).map((li) => ({ ...li, id: newId() })),
      validUntil: dateOnlyFromToday(30),
      createdAt: now,
      updatedAt: now,
    };
    await tx.insert(estimates).values(row);
    return toEstimate(row);
  });
}

/**
 * Create the invoice for an estimate. If one already exists it is returned
 * instead (also enforced by a unique index), so a double tap can't bill twice.
 */
export async function convertEstimateToInvoice(
  db: Db,
  companyId: string,
  estimateId: string
): Promise<{ invoice: Invoice; estimate: Estimate }> {
  return db.transaction(async (tx) => {
    const t = tx;
    const [source] = await t
      .select()
      .from(estimates)
      .where(and(eq(estimates.id, estimateId), eq(estimates.companyId, companyId)))
      .for("update");
    if (!source) throw new UserError("This estimate was deleted on another device.");

    const [already] = await t
      .select()
      .from(invoices)
      .where(and(eq(invoices.estimateId, estimateId), eq(invoices.companyId, companyId)))
      .limit(1);
    if (already) return { invoice: toInvoice(already), estimate: toEstimate(source) };

    const now = new Date();
    const number = await nextNumber(t, companyId, "invoice");
    const row: InvoiceRow = {
      id: newId(),
      companyId,
      number,
      estimateId: source.id,
      customerId: source.customerId,
      jobTitle: source.jobTitle,
      jobAddress: source.jobAddress,
      status: "draft",
      lineItems: (source.lineItems ?? []).map((li) => ({ ...li, id: newId() })),
      taxPercent: source.taxPercent,
      notes: source.notes,
      dueDate: dateOnlyFromToday(14),
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await t.insert(invoices).values(row);
    await t
      .update(estimates)
      .set({ status: "converted", updatedAt: now })
      .where(and(eq(estimates.id, estimateId), eq(estimates.companyId, companyId)));
    return {
      invoice: toInvoice(row),
      estimate: toEstimate({ ...source, status: "converted", updatedAt: now }),
    };
  });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function updateInvoice(db: Db, companyId: string, input: InvoiceUpdateInput): Promise<Invoice> {
  const where = and(eq(invoices.id, input.id), eq(invoices.companyId, companyId));
  const [existing] = await db.select().from(invoices).where(where).limit(1);
  if (!existing) throw new UserError("This invoice was deleted on another device.");
  const values = {
    status: input.status,
    dueDate: input.dueDate ?? existing.dueDate,
    notes: input.notes ?? existing.notes,
    // Only a paid invoice keeps a paid date.
    paidAt: input.status === "paid" ? (existing.paidAt ?? new Date()) : null,
    updatedAt: new Date(),
  };
  await db.update(invoices).set(values).where(where);
  return toInvoice({ ...existing, ...values });
}

export async function deleteInvoice(db: Db, companyId: string, invoiceId: string) {
  await db.delete(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)));
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function upsertScheduleBlock(
  db: Db,
  companyId: string,
  input: ScheduleBlockInput
): Promise<ScheduleBlock> {
  const estimate = await getEstimateRow(db, companyId, input.estimateId);
  if (!estimate) throw new UserError("That job was deleted on another device.");
  const now = new Date();
  const values = {
    estimateId: input.estimateId,
    lineItemIds: input.lineItemIds?.length ? input.lineItemIds : null,
    title: input.title,
    start: new Date(input.start),
    durationMinutes: input.durationMinutes,
    updatedAt: now,
  };
  if (input.id) {
    const where = and(eq(scheduleBlocks.id, input.id), eq(scheduleBlocks.companyId, companyId));
    const [existing] = await db.select({ id: scheduleBlocks.id }).from(scheduleBlocks).where(where).limit(1);
    if (!existing) throw new UserError("That timeblock was removed on another device.");
    await db.update(scheduleBlocks).set(values).where(where);
    return toBlock({ id: input.id, companyId, createdAt: now, ...values });
  }
  const row = { id: newId(), companyId, createdAt: now, ...values };
  await db.insert(scheduleBlocks).values(row);
  return toBlock(row);
}

export async function moveScheduleBlock(db: Db, companyId: string, blockId: string, start: string) {
  const where = and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.companyId, companyId));
  const [existing] = await db.select({ id: scheduleBlocks.id }).from(scheduleBlocks).where(where).limit(1);
  if (!existing) throw new UserError("That timeblock was removed on another device.");
  await db.update(scheduleBlocks).set({ start: new Date(start), updatedAt: new Date() }).where(where);
}

export async function deleteScheduleBlock(db: Db, companyId: string, blockId: string) {
  await db
    .delete(scheduleBlocks)
    .where(and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.companyId, companyId)));
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/**
 * Replace this company's customers, pricebook, estimates, invoices and
 * schedule with the fictional test data. Company settings and logins stay.
 * Seed ids are replaced with fresh ones so companies never share ids.
 */
export async function replaceWithTestData(db: Db, companyId: string) {
  const seed = createSeedData();
  const ids = new Map<string, string>();
  const remap = (old: string) => {
    if (!ids.has(old)) ids.set(old, newId());
    return ids.get(old)!;
  };
  const now = new Date();
  const remapLines = (lines: Estimate["lineItems"]) =>
    lines.map((li) => ({
      ...li,
      id: remap(`line:${li.id}`),
      pricebookItemId: li.pricebookItemId ? remap(li.pricebookItemId) : undefined,
    }));

  await db.transaction(async (tx) => {
    // Order matters for foreign keys.
    await tx.delete(scheduleBlocks).where(eq(scheduleBlocks.companyId, companyId));
    await tx.delete(invoices).where(eq(invoices.companyId, companyId));
    await tx.delete(estimates).where(eq(estimates.companyId, companyId));
    await tx.delete(customers).where(eq(customers.companyId, companyId));
    await tx.delete(pricebookItems).where(eq(pricebookItems.companyId, companyId));

    await tx.insert(customers).values(
      seed.customers.map((c) => ({
        id: remap(c.id),
        companyId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        notes: c.notes,
        createdAt: now,
        updatedAt: now,
      }))
    );
    await tx.insert(pricebookItems).values(
      seed.pricebook.map((p) => ({
        id: remap(p.id),
        companyId,
        name: p.name,
        category: p.category,
        trade: p.trade,
        unit: p.unit,
        unitCost: p.unitCost,
        keywords: p.keywords,
        createdAt: now,
        updatedAt: now,
      }))
    );
    const estimateLines = new Map<string, Estimate["lineItems"]>();
    await tx.insert(estimates).values(
      seed.estimates.map((e) => {
        const lineItems = remapLines(e.lineItems);
        estimateLines.set(e.id, lineItems);
        return {
          id: remap(e.id),
          companyId,
          number: e.number,
          customerId: remap(e.customerId),
          jobTitle: e.jobTitle,
          jobAddress: e.jobAddress,
          trade: e.trade,
          status: e.status,
          lineItems,
          taxPercent: e.taxPercent,
          notes: e.notes,
          validUntil: e.validUntil,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        };
      })
    );
    await tx.insert(invoices).values(
      seed.invoices.map((i) => ({
        id: remap(i.id),
        companyId,
        number: i.number,
        estimateId: i.estimateId ? remap(i.estimateId) : null,
        customerId: remap(i.customerId),
        jobTitle: i.jobTitle,
        jobAddress: i.jobAddress,
        status: i.status,
        lineItems: remapLines(i.lineItems),
        taxPercent: i.taxPercent,
        notes: i.notes,
        dueDate: i.dueDate,
        paidAt: i.paidAt ? new Date(i.paidAt) : null,
        createdAt: new Date(i.createdAt),
        updatedAt: now,
      }))
    );
    await tx.insert(scheduleBlocks).values(
      seed.scheduleBlocks.map((b) => ({
        id: remap(b.id),
        companyId,
        estimateId: remap(b.estimateId),
        lineItemIds: b.lineItemIds?.map((l) => remap(`line:${l}`)) ?? null,
        title: b.title,
        start: new Date(b.start),
        durationMinutes: b.durationMinutes,
        createdAt: now,
        updatedAt: now,
      }))
    );
    // Continue numbering after the test data's numbers.
    await tx
      .update(companySettings)
      .set({
        estimateCounter: sql`GREATEST(${companySettings.estimateCounter}, ${seed.counters.estimate})`,
        invoiceCounter: sql`GREATEST(${companySettings.invoiceCounter}, ${seed.counters.invoice})`,
      })
      .where(eq(companySettings.companyId, companyId));
  });
}

// ---------------------------------------------------------------------------
// People and invites
// ---------------------------------------------------------------------------

export type Member = { userId: string; name: string; email: string; role: Role; joinedAt: string };
export type PendingInvite = { id: string; email: string; role: Role; expiresAt: string; createdAt: string };

export async function getMembershipForUser(db: Db, userId: string) {
  const [row] = await db
    .select({ companyId: memberships.companyId, role: memberships.role, companyName: companies.name })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  return row;
}

export async function listMembers(db: Db, companyId: string): Promise<Member[]> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.companyId, companyId))
    .orderBy(asc(memberships.createdAt));
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

export async function listPendingInvites(db: Db, companyId: string): Promise<PendingInvite[]> {
  const rows = await db
    .select()
    .from(invites)
    .where(and(eq(invites.companyId, companyId), isNull(invites.acceptedAt)))
    .orderBy(desc(invites.createdAt));
  const now = Date.now();
  return rows
    .filter((r) => r.expiresAt.getTime() > now)
    .map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(digest).toString("hex");
}

/** Creates an invite and returns the secret token for the link (shown once). */
export async function createInvite(
  db: Db,
  companyId: string,
  input: { email: string; role: Role; createdBy: string }
): Promise<{ token: string; invite: PendingInvite }> {
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);
  if (existingUser) {
    throw new UserError("That email already has a Bid Builder login. Joining a second company isn't supported yet.");
  }
  // Replace any earlier unused invite for the same email.
  await db
    .delete(invites)
    .where(and(eq(invites.companyId, companyId), eq(invites.email, input.email), isNull(invites.acceptedAt)));
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const now = new Date();
  const row = {
    id: newId(),
    companyId,
    email: input.email,
    role: input.role,
    tokenHash: await sha256Hex(token),
    createdBy: input.createdBy,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    acceptedAt: null,
  };
  await db.insert(invites).values(row);
  return {
    token,
    invite: {
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function findOpenInvite(db: Db, token: string) {
  if (!token || token.length > 100) return undefined;
  const [row] = await db
    .select({
      id: invites.id,
      companyId: invites.companyId,
      email: invites.email,
      role: invites.role,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      companyName: companies.name,
    })
    .from(invites)
    .innerJoin(companies, eq(companies.id, invites.companyId))
    .where(eq(invites.tokenHash, await sha256Hex(token)))
    .limit(1);
  if (!row || row.acceptedAt || row.expiresAt.getTime() < Date.now()) return undefined;
  return row;
}

export async function acceptInvite(db: Db, inviteId: string, companyId: string, userId: string, role: Role) {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(invites).set({ acceptedAt: now }).where(eq(invites.id, inviteId));
    await tx.insert(memberships).values({ companyId, userId, role, createdAt: now });
  });
}

export async function revokeInvite(db: Db, companyId: string, inviteId: string) {
  await db.delete(invites).where(and(eq(invites.id, inviteId), eq(invites.companyId, companyId)));
}

export async function removeMember(db: Db, companyId: string, userId: string) {
  const members = await listMembers(db, companyId);
  const target = members.find((m) => m.userId === userId);
  if (!target) throw new UserError("That person isn't on this account.");
  if (target.role === "owner" && members.filter((m) => m.role === "owner").length <= 1) {
    throw new UserError("You can't remove the last Owner.");
  }
  await db.delete(memberships).where(and(eq(memberships.companyId, companyId), eq(memberships.userId, userId)));
}

// ---------------------------------------------------------------------------
// AI usage limit
// ---------------------------------------------------------------------------

/** Count one AI draft for today. Returns false when the daily limit is reached. */
export async function takeAiDraft(db: Db, companyId: string, day: string, limit: number): Promise<boolean> {
  await db
    .insert(aiUsage)
    .values({ companyId, day, count: 1 })
    .onDuplicateKeyUpdate({ set: { count: sql`${aiUsage.count} + 1` } });
  const [row] = await db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.companyId, companyId), eq(aiUsage.day, day)))
    .limit(1);
  return (row?.count ?? 0) <= limit;
}
