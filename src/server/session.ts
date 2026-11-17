import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { getMembershipForUser, UserError, type Role } from "./data";

export type CurrentUser = { id: string; name: string; email: string };
export type Me = CurrentUser & { companyId: string; companyName: string; role: Role };

/** The signed-in user, or null. Cached for the length of one request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read the request first: this marks the page as per-request (never prerendered).
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
});

/** The signed-in user plus their company and role, or null. */
export const getMe = cache(async (): Promise<Me | null> => {
  const current = await getCurrentUser();
  if (!current) return null;
  const membership = await getMembershipForUser(getDb(), current.id);
  if (!membership) return null;
  return { ...current, ...membership };
});

/** For server actions: the caller must be signed in to a company. */
export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) throw new UserError("Your session has ended. Sign in again.");
  return me;
}

/** For server actions that change company-wide settings or people. */
export async function requireOwner(): Promise<Me> {
  const me = await requireMe();
  if (me.role !== "owner") throw new UserError("Only an Owner can do that.");
  return me;
}
