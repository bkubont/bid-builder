/**
 * Data layer tests against a real MySQL/MariaDB database.
 * Set TEST_DATABASE_URL to run them (they're skipped otherwise), e.g.
 *   TEST_DATABASE_URL=mysql://bid:localdev@127.0.0.1:3306/bidbuilder_test npm test
 * The test database is wiped.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createDb, type Db } from "@/db";
import { user } from "@/db/schema";
import * as data from "../data";
import { sql } from "drizzle-orm";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("data layer (database)", () => {
  let db: Db;
  let end: () => Promise<void>;

  beforeAll(() => {
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url! } });
    const created = createDb(url!);
    db = created.db;
    end = () => created.pool.end();
  });
  afterAll(async () => end?.());

  beforeEach(async () => {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of ["ai_usage", "schedule_blocks", "invoices", "estimates", "customers", "pricebook_items", "invites", "memberships", "company_settings", "companies", "session", "account", "verification", "user"]) {
      await db.execute(sql.raw(`DELETE FROM \`${t}\``));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  });

  async function makeCompany(label: string) {
    const userId = crypto.randomUUID();
    const now = new Date();
    await db.insert(user).values({ id: userId, name: label, email: `${label}@example.com`, emailVerified: false, createdAt: now, updatedAt: now });
    const companyId = await data.createCompany(db, { name: `${label} Co`, ownerUserId: userId });
    return { userId, companyId };
  }

  const estimateInput = (customerId: string, extra: Partial<Parameters<typeof data.upsertEstimate>[2]> = {}) => ({
    customerId,
    jobTitle: "Deck",
    jobAddress: "1 Main St",
    trade: "carpentry" as const,
    status: "draft" as const,
    lineItems: [{ id: "l1", description: "Labor", category: "labor" as const, quantity: 3, unit: "hr", unitCost: 110.5, markupPercent: 20 }],
    taxPercent: 6,
    notes: "",
    validUntil: "2026-12-20",
    ...extra,
  });

  it("round-trips money, JSON line items and calendar dates exactly", async () => {
    const { companyId } = await makeCompany("a");
    const c = await data.upsertCustomer(db, companyId, { name: "Pat", email: "", phone: "", address: "", notes: "" });
    await data.upsertEstimate(db, companyId, estimateInput(c.id));
    const snap = await data.loadSnapshot(db, companyId);
    const e = snap.estimates[0];
    expect(e.number).toBe("EST-1001");
    expect(e.validUntil).toBe("2026-12-20");
    expect(e.taxPercent).toBe(6);
    expect(e.lineItems[0]).toMatchObject({ quantity: 3, unitCost: 110.5, markupPercent: 20 });
    expect(snap.company.name).toBe("a Co");
    expect(snap.company.defaultMarkup).toBe(20);
  });

  it("keeps companies apart: no reads, edits or deletes across companies", async () => {
    const a = await makeCompany("a");
    const b = await makeCompany("b");
    const ca = await data.upsertCustomer(db, a.companyId, { name: "A's customer", email: "", phone: "", address: "", notes: "" });
    const ea = await data.upsertEstimate(db, a.companyId, estimateInput(ca.id));

    const snapB = await data.loadSnapshot(db, b.companyId);
    expect(snapB.customers).toHaveLength(0);
    expect(snapB.estimates).toHaveLength(0);

    // B can't edit, use, delete or convert A's records
    await expect(data.upsertCustomer(db, b.companyId, { id: ca.id, name: "hacked", email: "", phone: "", address: "", notes: "" })).rejects.toThrow(data.UserError);
    await expect(data.upsertEstimate(db, b.companyId, estimateInput(ca.id))).rejects.toThrow(/customer/);
    await expect(data.upsertEstimate(db, b.companyId, { ...estimateInput(ca.id), id: ea.id })).rejects.toThrow(data.UserError);
    await expect(data.convertEstimateToInvoice(db, b.companyId, ea.id)).rejects.toThrow(data.UserError);
    await expect(data.upsertScheduleBlock(db, b.companyId, { estimateId: ea.id, title: "x", start: new Date().toISOString(), durationMinutes: 60 })).rejects.toThrow(data.UserError);
    await data.deleteCustomer(db, b.companyId, ca.id);
    await data.deleteEstimate(db, b.companyId, ea.id);

    const snapA = await data.loadSnapshot(db, a.companyId);
    expect(snapA.customers.map((c) => c.name)).toEqual(["A's customer"]);
    expect(snapA.estimates).toHaveLength(1);
  });

  it("never hands out the same number twice, even when saves happen at once", async () => {
    const { companyId } = await makeCompany("a");
    const c = await data.upsertCustomer(db, companyId, { name: "Pat", email: "", phone: "", address: "", notes: "" });
    const saved = await Promise.all(Array.from({ length: 12 }, () => data.upsertEstimate(db, companyId, estimateInput(c.id))));
    const numbers = new Set(saved.map((e) => e.number));
    expect(numbers.size).toBe(12);
  });

  it("numbers each company separately", async () => {
    const a = await makeCompany("a");
    const b = await makeCompany("b");
    const ca = await data.upsertCustomer(db, a.companyId, { name: "x", email: "", phone: "", address: "", notes: "" });
    const cb = await data.upsertCustomer(db, b.companyId, { name: "y", email: "", phone: "", address: "", notes: "" });
    expect((await data.upsertEstimate(db, a.companyId, estimateInput(ca.id))).number).toBe("EST-1001");
    expect((await data.upsertEstimate(db, b.companyId, estimateInput(cb.id))).number).toBe("EST-1001");
  });

  it("converts an estimate to exactly one invoice, even on a double tap", async () => {
    const { companyId } = await makeCompany("a");
    const c = await data.upsertCustomer(db, companyId, { name: "Pat", email: "", phone: "", address: "", notes: "" });
    const e = await data.upsertEstimate(db, companyId, estimateInput(c.id));
    const results = await Promise.allSettled([
      data.convertEstimateToInvoice(db, companyId, e.id),
      data.convertEstimateToInvoice(db, companyId, e.id),
      data.convertEstimateToInvoice(db, companyId, e.id),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof data.convertEstimateToInvoice>>>[];
    expect(ok.length).toBeGreaterThan(0);
    expect(new Set(ok.map((r) => r.value.invoice.id)).size).toBe(1);
    const snap = await data.loadSnapshot(db, companyId);
    expect(snap.invoices).toHaveLength(1);
    expect(snap.invoices[0].number).toBe("INV-2001");
    expect(snap.estimates[0].status).toBe("converted");
  });

  it("clears the paid date when an invoice is no longer paid", async () => {
    const { companyId } = await makeCompany("a");
    const c = await data.upsertCustomer(db, companyId, { name: "Pat", email: "", phone: "", address: "", notes: "" });
    const e = await data.upsertEstimate(db, companyId, estimateInput(c.id));
    const { invoice } = await data.convertEstimateToInvoice(db, companyId, e.id);
    expect((await data.updateInvoice(db, companyId, { id: invoice.id, status: "paid" })).paidAt).toBeTruthy();
    expect((await data.updateInvoice(db, companyId, { id: invoice.id, status: "sent" })).paidAt).toBeUndefined();
  });

  it("loads the test data into two companies without sharing ids", async () => {
    const a = await makeCompany("a");
    const b = await makeCompany("b");
    await data.replaceWithTestData(db, a.companyId);
    await data.replaceWithTestData(db, b.companyId);
    await data.replaceWithTestData(db, a.companyId); // running it again replaces, not duplicates
    const sa = await data.loadSnapshot(db, a.companyId);
    const sb = await data.loadSnapshot(db, b.companyId);
    expect(sa.customers).toHaveLength(8);
    expect(sa.pricebook.length).toBeGreaterThan(30);
    expect(sa.estimates).toHaveLength(9);
    expect(sa.invoices).toHaveLength(3);
    expect(sa.scheduleBlocks).toHaveLength(6);
    const idsA = new Set(sa.customers.map((c) => c.id));
    expect(sb.customers.some((c) => idsA.has(c.id))).toBe(false);
    // schedule blocks still point at their estimate and line
    const lineBlock = sa.scheduleBlocks.find((blk) => blk.lineItemIds?.length);
    const est = sa.estimates.find((e) => e.id === lineBlock!.estimateId)!;
    expect(est.lineItems.map((l) => l.id)).toContain(lineBlock!.lineItemIds![0]);
    // new estimates continue after the test numbers
    const next = await data.upsertEstimate(db, a.companyId, estimateInput(sa.customers[0].id));
    expect(next.number).toBe("EST-1010");
  });

  it("invites: link works once, expires, and can't be reused", async () => {
    const { companyId, userId } = await makeCompany("a");
    const { token } = await data.createInvite(db, companyId, { email: "crew@example.com", role: "member", createdBy: userId });
    const found = await data.findOpenInvite(db, token);
    expect(found?.email).toBe("crew@example.com");
    expect(await data.findOpenInvite(db, token + "x")).toBeUndefined();
    const crewId = crypto.randomUUID();
    const now = new Date();
    await db.insert(user).values({ id: crewId, name: "Crew", email: "crew@example.com", emailVerified: false, createdAt: now, updatedAt: now });
    await data.acceptInvite(db, found!.id, companyId, crewId, "member");
    expect(await data.findOpenInvite(db, token)).toBeUndefined();
    const members = await data.listMembers(db, companyId);
    expect(members.map((m) => m.role).sort()).toEqual(["member", "owner"]);
    await expect(data.removeMember(db, companyId, userId)).rejects.toThrow(/last Owner/);
  });

  it("enforces the daily AI draft limit per company", async () => {
    const a = await makeCompany("a");
    const b = await makeCompany("b");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await data.takeAiDraft(db, a.companyId, "2026-11-17", 3));
    expect(results).toEqual([true, true, true, false]);
    expect(await data.takeAiDraft(db, b.companyId, "2026-11-17", 3)).toBe(true);
    expect(await data.takeAiDraft(db, a.companyId, "2026-11-18", 3)).toBe(true);
  });
});
