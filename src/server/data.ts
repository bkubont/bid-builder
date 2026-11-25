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
  emailLog,
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
import { documentTotals, roundCents, type EstimateSection, type LineCategory, type LineItem } from "@/lib/types";
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
  sections: r.sections ?? [],
  taxPercent: Number(r.taxPercent),
  taxableCategories: r.taxableCategories ?? null,
  notes: r.notes,
  validUntil: r.validUntil,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  number: r.number,
  kind: r.kind,
  estimateId: r.estimateId ?? undefined,
  customerId: r.customerId ?? "",
  jobTitle: r.jobTitle,
  jobAddress: r.jobAddress,
  status: r.status,
  lineItems: r.lineItems ?? [],
  sections: r.sections ?? [],
  taxPercent: Number(r.taxPercent),
  taxableCategories: r.taxableCategories ?? null,
  depositApplied: Number(r.depositApplied) || 0,
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
  assignedUserId: r.assignedUserId ?? null,
});

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

/** Everything the app shows for one company. Small businesses: one round trip. */
export async function loadSnapshot(db: Db, companyId: string): Promise<AppData> {
  const [company, settings, cust, pb, est, inv, blocks, team] = await Promise.all([
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
    db
      .select({ id: user.id, name: user.name, role: memberships.role })
      .from(memberships)
      .innerJoin(user, eq(user.id, memberships.userId))
      .where(eq(memberships.companyId, companyId))
      .orderBy(asc(memberships.createdAt)),
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
      taxableCategories: s.taxableCategories ?? DEFAULT_COMPANY.taxableCategories,
      depositPercent: Number(s.depositPercent),
    },
    customers: cust.map(toCustomer),
    pricebook: pb.map(toPricebookItem),
    estimates: est.map(toEstimate),
    invoices: inv.map(toInvoice),
    scheduleBlocks: blocks.map(toBlock),
    team,
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
      taxableCategories: DEFAULT_COMPANY.taxableCategories,
      depositPercent: DEFAULT_COMPANY.depositPercent,
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
        taxableCategories: input.taxableCategories,
        depositPercent: input.depositPercent,
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

async function companyTaxRule(db: Exec, companyId: string): Promise<LineCategory[]> {
  const [row] = await db
    .select({ taxable: companySettings.taxableCategories })
    .from(companySettings)
    .where(eq(companySettings.companyId, companyId))
    .limit(1);
  return row?.taxable ?? DEFAULT_COMPANY.taxableCategories;
}

/** Drop links to sections that don't exist on this estimate. */
function cleanSections(lines: LineItem[], sections: EstimateSection[]): LineItem[] {
  const ids = new Set(sections.map((s) => s.id));
  return lines.map((l) => (l.sectionId && !ids.has(l.sectionId) ? { ...l, sectionId: undefined } : l));
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
    lineItems: cleanSections(input.lineItems, input.sections),
    sections: input.sections,
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
    // New estimates keep the tax rule in force when they were made.
    const taxableCategories = await companyTaxRule(tx, companyId);
    const row = { id: newId(), companyId, number, ...values, taxableCategories, createdAt: now };
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

    const existing = await t
      .select()
      .from(invoices)
      .where(and(eq(invoices.estimateId, estimateId), eq(invoices.companyId, companyId)));
    const already = existing.find((i) => i.kind === "final");
    if (already) return { invoice: toInvoice(already), estimate: toEstimate(source) };
    // Subtract a deposit that was already billed for this job.
    const depositRow = existing.find((i) => i.kind === "deposit");
    const depositApplied = depositRow ? documentTotals(toInvoice(depositRow)).total : 0;

    const now = new Date();
    const number = await nextNumber(t, companyId, "invoice");
    const row: InvoiceRow = {
      id: newId(),
      companyId,
      number,
      kind: "final",
      estimateId: source.id,
      customerId: source.customerId,
      jobTitle: source.jobTitle,
      jobAddress: source.jobAddress,
      status: "draft",
      lineItems: (source.lineItems ?? []).map((li) => ({ ...li, id: newId() })),
      sections: source.sections,
      taxPercent: source.taxPercent,
      taxableCategories: source.taxableCategories,
      depositApplied,
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

/**
 * Bill a share of the estimate up front. One deposit per estimate (also
 * enforced by a unique index); asking again returns the existing one.
 * The final invoice subtracts it.
 */
export async function createDepositInvoice(
  db: Db,
  companyId: string,
  estimateId: string,
  percent: number
): Promise<{ invoice: Invoice; estimate: Estimate }> {
  if (!(percent > 0 && percent <= 100)) throw new UserError("Enter a deposit between 1% and 100%.");
  return db.transaction(async (t) => {
    const [source] = await t
      .select()
      .from(estimates)
      .where(and(eq(estimates.id, estimateId), eq(estimates.companyId, companyId)))
      .for("update");
    if (!source) throw new UserError("This estimate was deleted on another device.");
    const existing = await t
      .select()
      .from(invoices)
      .where(and(eq(invoices.estimateId, estimateId), eq(invoices.companyId, companyId)));
    const already = existing.find((i) => i.kind === "deposit");
    if (already) return { invoice: toInvoice(already), estimate: toEstimate(source) };
    if (existing.some((i) => i.kind === "final")) {
      throw new UserError("This job already has its final invoice, so a deposit can't be added.");
    }
    const estimate = toEstimate(source);
    const amount = roundCents((documentTotals(estimate).total * percent) / 100);
    if (amount <= 0) throw new UserError("Add priced lines to the estimate before requesting a deposit.");

    const now = new Date();
    const number = await nextNumber(t, companyId, "invoice");
    const pct = Number(percent.toFixed(2));
    const row: InvoiceRow = {
      id: newId(),
      companyId,
      number,
      kind: "deposit",
      estimateId: source.id,
      customerId: source.customerId,
      jobTitle: source.jobTitle,
      jobAddress: source.jobAddress,
      status: "draft",
      lineItems: [
        {
          id: newId(),
          description: `Deposit (${pct}%) for ${source.number} — ${source.jobTitle}`.slice(0, 300),
          category: "other",
          quantity: 1,
          unit: "ea",
          unitCost: amount,
          markupPercent: 0,
        },
      ],
      sections: [],
      taxPercent: 0, // the deposit is a share of the taxed total
      taxableCategories: [],
      depositApplied: 0,
      notes: "Deposit due on acceptance. It will be subtracted from the final invoice.",
      dueDate: dateOnlyFromToday(0),
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await t.insert(invoices).values(row);
    // Asking for a deposit means the customer said yes.
    const status = source.status === "converted" ? source.status : "accepted";
    await t
      .update(estimates)
      .set({ status, updatedAt: now })
      .where(and(eq(estimates.id, estimateId), eq(estimates.companyId, companyId)));
    return { invoice: toInvoice(row), estimate: toEstimate({ ...source, status, updatedAt: now }) };
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
  await db.transaction(async (t) => {
    const [target] = await t
      .select({ kind: invoices.kind, estimateId: invoices.estimateId })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .for("update");
    if (!target) return;
    // A deposit already subtracted on the final invoice can't just disappear,
    // or the final invoice would credit money that was never billed.
    if (target.kind === "deposit" && target.estimateId) {
      const [final] = await t
        .select({ number: invoices.number, depositApplied: invoices.depositApplied })
        .from(invoices)
        .where(
          and(
            eq(invoices.estimateId, target.estimateId),
            eq(invoices.companyId, companyId),
            eq(invoices.kind, "final")
          )
        )
        .limit(1);
      if (final && Number(final.depositApplied) > 0) {
        throw new UserError(
          `This deposit is already subtracted on final invoice ${final.number}. Delete ${final.number} first if the deposit needs to go.`
        );
      }
    }
    await t.delete(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)));
  });
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** The assignee must be on this company's team (or null for unassigned). */
async function checkAssignee(db: Exec, companyId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const [row] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.companyId, companyId), eq(memberships.userId, userId)))
    .limit(1);
  if (!row) throw new UserError("That person isn't on your team anymore.");
  return userId;
}

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
    assignedUserId: await checkAssignee(db, companyId, input.assignedUserId),
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

/** Move, resize, retitle or reassign a block. Only the fields given change. */
export async function updateScheduleBlock(
  db: Db,
  companyId: string,
  blockId: string,
  patch: { start?: string; durationMinutes?: number; assignedUserId?: string | null; title?: string }
): Promise<ScheduleBlock> {
  const where = and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.companyId, companyId));
  const [existing] = await db.select().from(scheduleBlocks).where(where).limit(1);
  if (!existing) throw new UserError("That timeblock was removed on another device.");
  const values: Partial<BlockRow> = { updatedAt: new Date() };
  if (patch.start !== undefined) values.start = new Date(patch.start);
  if (patch.durationMinutes !== undefined) values.durationMinutes = patch.durationMinutes;
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.assignedUserId !== undefined) {
    values.assignedUserId = await checkAssignee(db, companyId, patch.assignedUserId);
  }
  await db.update(scheduleBlocks).set(values).where(where);
  return toBlock({ ...existing, ...values });
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
          sections: e.sections,
          taxPercent: e.taxPercent,
          taxableCategories: e.taxableCategories,
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
        kind: i.kind,
        estimateId: i.estimateId ? remap(i.estimateId) : null,
        customerId: remap(i.customerId),
        jobTitle: i.jobTitle,
        jobAddress: i.jobAddress,
        status: i.status,
        lineItems: remapLines(i.lineItems),
        sections: i.sections,
        taxPercent: i.taxPercent,
        taxableCategories: i.taxableCategories,
        depositApplied: i.depositApplied,
        notes: i.notes,
        dueDate: i.dueDate,
        paidAt: i.paidAt ? new Date(i.paidAt) : null,
        createdAt: new Date(i.createdAt),
        updatedAt: now,
      }))
    );
    // Spread the test schedule across the team, team members first.
    const people = await tx
      .select({ id: memberships.userId, role: memberships.role })
      .from(memberships)
      .where(eq(memberships.companyId, companyId))
      .orderBy(asc(memberships.createdAt));
    const crew = [...people.filter((p) => p.role === "member"), ...people.filter((p) => p.role === "owner")];
    await tx.insert(scheduleBlocks).values(
      seed.scheduleBlocks.map((b, i) => ({
        id: remap(b.id),
        companyId,
        estimateId: remap(b.estimateId),
        lineItemIds: b.lineItemIds?.map((l) => remap(`line:${l}`)) ?? null,
        title: b.title,
        start: new Date(b.start),
        durationMinutes: b.durationMinutes,
        // Deck days go to the first person; the rest alternate.
        assignedUserId: crew.length ? crew[(b.estimateId === "est-2" ? 0 : i) % crew.length].id : null,
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
  await db.transaction(async (t) => {
    await t.delete(memberships).where(and(eq(memberships.companyId, companyId), eq(memberships.userId, userId)));
    // Their scheduled work goes back to unassigned, so it isn't lost from view.
    await t
      .update(scheduleBlocks)
      .set({ assignedUserId: null, updatedAt: new Date() })
      .where(and(eq(scheduleBlocks.companyId, companyId), eq(scheduleBlocks.assignedUserId, userId)));
  });
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

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** The estimate or invoice being emailed, with its customer, if it's this company's. */
export async function getDocumentForEmail(
  db: Db,
  companyId: string,
  documentType: "estimate" | "invoice",
  documentId: string
) {
  if (documentType === "estimate") {
    const row = await getEstimateRow(db, companyId, documentId);
    return row ? { number: row.number, status: row.status } : undefined;
  }
  const [row] = await db
    .select({ number: invoices.number, status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.id, documentId), eq(invoices.companyId, companyId)))
    .limit(1);
  return row;
}

export async function countEmailsSince(db: Db, companyId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(emailLog)
    .where(and(eq(emailLog.companyId, companyId), sql`${emailLog.createdAt} >= ${since}`));
  return Number(row?.n ?? 0);
}

/**
 * Reserve one email against the company's 24-hour limit before sending.
 * The company's settings row is locked while counting, so two sends at the
 * same moment can't both squeeze under the limit. Returns the log row id;
 * call confirmEmailSent after sending, or releaseEmailSlot if it failed.
 */
export async function reserveEmailSlot(
  db: Db,
  companyId: string,
  input: { sentBy: string; documentType: "estimate" | "invoice"; documentId: string; toEmail: string },
  limit: number
): Promise<string> {
  return db.transaction(async (t) => {
    await t
      .select({ id: companySettings.companyId })
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId))
      .for("update");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [row] = await t
      .select({ n: sql<number>`count(*)` })
      .from(emailLog)
      .where(and(eq(emailLog.companyId, companyId), sql`${emailLog.createdAt} >= ${since}`));
    if (Number(row?.n ?? 0) >= limit) {
      throw new UserError("Today's email limit is reached. Use Share, or try again tomorrow.");
    }
    const id = newId();
    await t.insert(emailLog).values({ id, companyId, ...input, providerId: null, createdAt: new Date() });
    return id;
  });
}

/** The send failed: give the slot back. */
export async function releaseEmailSlot(db: Db, companyId: string, logId: string) {
  await db.delete(emailLog).where(and(eq(emailLog.id, logId), eq(emailLog.companyId, companyId)));
}

/** The email went out: note the provider's id and mark a draft document as sent. */
export async function confirmEmailSent(
  db: Db,
  companyId: string,
  logId: string,
  input: { documentType: "estimate" | "invoice"; documentId: string; providerId?: string }
) {
  const now = new Date();
  await db
    .update(emailLog)
    .set({ providerId: input.providerId ?? null })
    .where(and(eq(emailLog.id, logId), eq(emailLog.companyId, companyId)));
  if (input.documentType === "estimate") {
    await db
      .update(estimates)
      .set({ status: "sent", updatedAt: now })
      .where(and(eq(estimates.id, input.documentId), eq(estimates.companyId, companyId), eq(estimates.status, "draft")));
  } else {
    await db
      .update(invoices)
      .set({ status: "sent", updatedAt: now })
      .where(and(eq(invoices.id, input.documentId), eq(invoices.companyId, companyId), eq(invoices.status, "draft")));
  }
}
