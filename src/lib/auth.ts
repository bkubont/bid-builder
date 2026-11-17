/**
 * Better Auth: email + password accounts and sessions.
 *
 * Public sign-up is switched off. Accounts are only created by our own
 * server code (src/server/accounts.ts): first-time Owner setup with the
 * setup code, or an invite link created by an Owner.
 *
 * Created lazily so `next build` doesn't need DATABASE_URL or secrets.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import { account, session, user, verification } from "@/db/schema";

export const MIN_PASSWORD_LENGTH = 10;

function createAuth() {
  const baseURL = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3847";
  if (!process.env.BETTER_AUTH_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is not set. See .env.example.");
  }
  return betterAuth({
    appName: "Bid Builder",
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET || "local-development-secret-not-for-production",
    trustedOrigins: [baseURL],
    database: drizzleAdapter(getDb(), {
      provider: "mysql",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // stay signed in on the tablet for 30 days
      updateAge: 60 * 60 * 24, // extend the session once a day while in use
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
    },
    // Must be last: lets server actions set the session cookie.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __bidBuilderAuth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.__bidBuilderAuth) globalForAuth.__bidBuilderAuth = createAuth();
  return globalForAuth.__bidBuilderAuth;
}
