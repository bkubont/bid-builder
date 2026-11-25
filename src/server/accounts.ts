import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getAuth, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { UserError } from "./data";

/**
 * Creates an email + password login. Public sign-up is switched off, so this
 * is the only way accounts are made: first-time setup and invite links.
 */
export async function createLogin(input: { email: string; name: string; password: string }) {
  checkPassword(input.password);
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new UserError("Enter your name.");
  const ctx = await getAuth().$context;
  const email = input.email.trim().toLowerCase();
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new UserError("That email already has a login. Sign in instead.");
  }
  const created = await ctx.internalAdapter.createUser(
    { email, name, emailVerified: false },
    { method: "admin" }
  );
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(input.password),
  });
  return created;
}

/** Owner-set password for someone on their team; signs that person out everywhere. */
export async function setPasswordFor(userId: string, password: string) {
  checkPassword(password);
  const ctx = await getAuth().$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
  await ctx.internalAdapter.deleteUserSessions(userId);
}

export function checkPassword(password: string) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new UserError(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`);
  }
  if (password.length > 128) throw new UserError("That password is too long.");
}

// Slow down guessing of the one-time setup code (per server process).
const setupFailures: number[] = [];

export function checkSetupCode(given: string) {
  const expected = process.env.SETUP_CODE ?? "";
  if (expected.length < 12) {
    throw new UserError("Setup isn't configured on the server yet (SETUP_CODE, at least 12 characters).");
  }
  const hourAgo = Date.now() - 60 * 60 * 1000;
  while (setupFailures.length && setupFailures[0] < hourAgo) setupFailures.shift();
  if (setupFailures.length >= 10) {
    throw new UserError("Too many wrong setup codes. Try again in an hour.");
  }
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    setupFailures.push(Date.now());
    throw new UserError("That setup code isn't right.");
  }
}

export function ownerEmail(): string {
  const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    throw new UserError("Setup isn't configured on the server yet (OWNER_EMAIL).");
  }
  return email;
}
