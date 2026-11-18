"use server";

/**
 * Server actions the app calls. Each is a public endpoint, so every one:
 *  1. checks the session (requireMe / requireOwner),
 *  2. validates the input shape (zod),
 *  3. scopes all reads/writes to the caller's company (data.ts).
 * They return { ok, data } or { ok: false, error } with a message safe to show.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import * as data from "./data";
import { UserError } from "./data";
import { checkSetupCode, createLogin, ownerEmail, setPasswordFor } from "./accounts";
import { emailConfigured, sendEmail } from "./email";
import { requireMe, requireOwner } from "./session";
import {
  companySchema,
  customerSchema,
  estimateSchema,
  inviteSchema,
  invoiceUpdateSchema,
  pricebookItemSchema,
  scheduleBlockSchema,
  sendDocumentSchema,
} from "./validation";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Some details aren't valid." };
    }
    console.error("Action failed", error);
    return { ok: false, error: "Something went wrong saving that. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export async function getSnapshotAction() {
  return run(async () => {
    const me = await requireMe();
    return data.loadSnapshot(getDb(), me.companyId);
  });
}

export async function updateCompanyAction(input: unknown) {
  return run(async () => {
    const me = await requireOwner();
    return data.updateCompany(getDb(), me.companyId, companySchema.parse(input));
  });
}

export async function upsertCustomerAction(input: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.upsertCustomer(getDb(), me.companyId, customerSchema.parse(input));
  });
}

export async function deleteCustomerAction(id: unknown) {
  return run(async () => {
    const me = await requireMe();
    await data.deleteCustomer(getDb(), me.companyId, idSchema.parse(id));
    return null;
  });
}

export async function upsertPricebookItemAction(input: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.upsertPricebookItem(getDb(), me.companyId, pricebookItemSchema.parse(input));
  });
}

export async function deletePricebookItemAction(id: unknown) {
  return run(async () => {
    const me = await requireMe();
    await data.deletePricebookItem(getDb(), me.companyId, idSchema.parse(id));
    return null;
  });
}

export async function upsertEstimateAction(input: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.upsertEstimate(getDb(), me.companyId, estimateSchema.parse(input));
  });
}

export async function deleteEstimateAction(id: unknown) {
  return run(async () => {
    const me = await requireMe();
    await data.deleteEstimate(getDb(), me.companyId, idSchema.parse(id));
    return null;
  });
}

export async function duplicateEstimateAction(id: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.duplicateEstimate(getDb(), me.companyId, idSchema.parse(id));
  });
}

export async function convertEstimateAction(id: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.convertEstimateToInvoice(getDb(), me.companyId, idSchema.parse(id));
  });
}

export async function requestDepositAction(estimateId: unknown, percent: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.createDepositInvoice(
      getDb(),
      me.companyId,
      idSchema.parse(estimateId),
      z.number().finite().parse(percent)
    );
  });
}

const EMAILS_PER_DAY = Number(process.env.EMAIL_DAILY_LIMIT || 100);

/** Email an estimate or invoice PDF to the customer. */
export async function sendDocumentAction(input: unknown) {
  return run(async () => {
    const me = await requireMe();
    if (!emailConfigured()) throw new UserError("Sending email isn't set up yet. Use Share instead.");
    const msg = sendDocumentSchema.parse(input);
    const db = getDb();
    const doc = await data.getDocumentForEmail(db, me.companyId, msg.documentType, msg.documentId);
    if (!doc) throw new UserError("That document was deleted on another device.");
    if (!msg.pdfBase64.startsWith("JVBER")) throw new UserError("That attachment isn't a PDF.");
    const snapshot = await data.loadSnapshot(db, me.companyId);
    // Take a slot under the daily limit first, so parallel sends can't exceed it.
    const logId = await data.reserveEmailSlot(
      db,
      me.companyId,
      { sentBy: me.id, documentType: msg.documentType, documentId: msg.documentId, toEmail: msg.to },
      EMAILS_PER_DAY
    );
    let sent: { id?: string };
    try {
      sent = await sendEmail({
        to: msg.to,
        subject: msg.subject,
        text: msg.message,
        replyTo: snapshot.company.email || me.email,
        fromName: snapshot.company.name,
        attachment: { filename: `${doc.number}.pdf`, base64: msg.pdfBase64 },
      });
    } catch {
      await data.releaseEmailSlot(db, me.companyId, logId);
      throw new UserError("The email couldn't be sent. Check the address and try again, or use Share.");
    }
    await data.confirmEmailSent(db, me.companyId, logId, {
      documentType: msg.documentType,
      documentId: msg.documentId,
      providerId: sent.id,
    });
    return null;
  });
}

export async function updateInvoiceAction(input: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.updateInvoice(getDb(), me.companyId, invoiceUpdateSchema.parse(input));
  });
}

export async function deleteInvoiceAction(id: unknown) {
  return run(async () => {
    const me = await requireMe();
    await data.deleteInvoice(getDb(), me.companyId, idSchema.parse(id));
    return null;
  });
}

export async function upsertScheduleBlockAction(input: unknown) {
  return run(async () => {
    const me = await requireMe();
    return data.upsertScheduleBlock(getDb(), me.companyId, scheduleBlockSchema.parse(input));
  });
}

export async function moveScheduleBlockAction(id: unknown, start: unknown) {
  return run(async () => {
    const me = await requireMe();
    await data.moveScheduleBlock(
      getDb(),
      me.companyId,
      idSchema.parse(id),
      z.iso.datetime({ offset: true }).parse(start)
    );
    return null;
  });
}

export async function deleteScheduleBlockAction(id: unknown) {
  return run(async () => {
    const me = await requireMe();
    await data.deleteScheduleBlock(getDb(), me.companyId, idSchema.parse(id));
    return null;
  });
}

export async function replaceWithTestDataAction() {
  return run(async () => {
    const me = await requireOwner();
    await data.replaceWithTestData(getDb(), me.companyId);
    return data.loadSnapshot(getDb(), me.companyId);
  });
}

// ---------------------------------------------------------------------------
// Team (Owner only)
// ---------------------------------------------------------------------------

export async function getTeamAction() {
  return run(async () => {
    const me = await requireOwner();
    const [members, invites] = await Promise.all([
      data.listMembers(getDb(), me.companyId),
      data.listPendingInvites(getDb(), me.companyId),
    ]);
    return { members, invites };
  });
}

export async function createInviteAction(input: unknown) {
  return run(async () => {
    const me = await requireOwner();
    const { email, role } = inviteSchema.parse(input);
    const { token, invite } = await data.createInvite(getDb(), me.companyId, {
      email,
      role,
      createdBy: me.id,
    });
    const base = process.env.BETTER_AUTH_URL || (await originFromHeaders());
    return { invite, link: `${base}/invite/${token}` };
  });
}

export async function revokeInviteAction(id: unknown) {
  return run(async () => {
    const me = await requireOwner();
    await data.revokeInvite(getDb(), me.companyId, idSchema.parse(id));
    return null;
  });
}

export async function removeMemberAction(userId: unknown) {
  return run(async () => {
    const me = await requireOwner();
    const target = idSchema.parse(userId);
    if (target === me.id) throw new UserError("You can't remove yourself.");
    await data.removeMember(getDb(), me.companyId, target);
    return null;
  });
}

export async function setMemberPasswordAction(userId: unknown, password: unknown) {
  return run(async () => {
    const me = await requireOwner();
    const target = idSchema.parse(userId);
    const members = await data.listMembers(getDb(), me.companyId);
    if (!members.some((m) => m.userId === target)) throw new UserError("That person isn't on this account.");
    await setPasswordFor(target, z.string().parse(password));
    return null;
  });
}

// ---------------------------------------------------------------------------
// Sign in / out, first-time setup, invites, own password
// ---------------------------------------------------------------------------

export type FormState = { error?: string; ok?: boolean } | undefined;

async function originFromHeaders() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function signIn(email: string, password: string) {
  await getAuth().api.signInEmail({ body: { email, password }, headers: await headers() });
}

/** Only same-site paths, never another domain. */
function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  try {
    await signIn(email, password);
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 429) return { error: "Too many attempts. Wait a minute and try again." };
    return { error: "Email or password is incorrect." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signOutAction() {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    // Already signed out.
  }
  return { ok: true as const };
}

/** First-time setup: creates the Owner login and the company. Only works once. */
export async function setupOwnerAction(_: FormState, form: FormData): Promise<FormState> {
  const result = await run(async () => {
    const db = getDb();
    if ((await data.countCompanies(db)) > 0) {
      throw new UserError("Bid Builder is already set up. Sign in instead.");
    }
    checkSetupCode(String(form.get("setupCode") ?? ""));
    const email = ownerEmail();
    const companyName = String(form.get("companyName") ?? "").trim().slice(0, 160);
    if (!companyName) throw new UserError("Enter your company name.");
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) throw new UserError("The passwords don't match.");
    const created = await createLogin({ email, name: String(form.get("name") ?? ""), password });
    await data.createCompany(db, { name: companyName, ownerUserId: created.id });
    await signIn(email, password);
    return null;
  });
  if (!result.ok) return { error: result.error };
  redirect("/settings?welcome=1");
}

/** Joining from an invite link: the email comes from the invite, not the form. */
export async function acceptInviteAction(_: FormState, form: FormData): Promise<FormState> {
  const result = await run(async () => {
    const db = getDb();
    const invite = await data.findOpenInvite(db, String(form.get("token") ?? ""));
    if (!invite) throw new UserError("This invite link has expired or was already used. Ask for a new one.");
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) throw new UserError("The passwords don't match.");
    const created = await createLogin({ email: invite.email, name: String(form.get("name") ?? ""), password });
    await data.acceptInvite(db, invite.id, invite.companyId, created.id, invite.role);
    await signIn(invite.email, password);
    return null;
  });
  if (!result.ok) return { error: result.error };
  redirect("/");
}

export async function changeOwnPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const result = await run(async () => {
    await requireMe();
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) throw new UserError("The new passwords don't match.");
    try {
      await getAuth().api.changePassword({
        body: {
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (error) {
      const message = (error as { body?: { message?: string } })?.body?.message;
      throw new UserError(
        /password/i.test(message ?? "") && /invalid|incorrect/i.test(message ?? "")
          ? "Your current password is incorrect."
          : message || "Couldn't change the password."
      );
    }
    return null;
  });
  return result.ok ? { ok: true } : { error: result.error };
}
