/**
 * Local test setup: creates an Owner and a team member login plus a company,
 * then fills it with the fictional test data. If a company already exists,
 * it only replaces that company's data with the test data.
 *
 *   npm run db:seed
 *
 * Logins (local only): OWNER_EMAIL or owner@example.com, and field@example.com,
 * both with password SEED_PASSWORD (default "change-me-please").
 * Refuses to run when NODE_ENV=production; on the live site use
 * Settings -> Test data instead.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:seed is for local development. Use Settings → Test data on the live site.");
  }
  const { getDb } = await import("../src/db");
  const { getAuth } = await import("../src/lib/auth");
  const data = await import("../src/server/data");
  const { companies } = await import("../src/db/schema");

  const db = getDb();
  const [existing] = await db.select().from(companies).limit(1);
  if (existing) {
    await data.replaceWithTestData(db, existing.id);
    console.log(`Replaced data for "${existing.name}" with test data.`);
    return;
  }

  const ctx = await getAuth().$context;
  const password = process.env.SEED_PASSWORD || "change-me-please";
  const makeLogin = async (email: string, name: string) => {
    const user = await ctx.internalAdapter.createUser({ email, name, emailVerified: false }, { method: "admin" });
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
    return user;
  };

  const ownerEmail = (process.env.OWNER_EMAIL || "owner@example.com").toLowerCase();
  const owner = await makeLogin(ownerEmail, "Test Owner");
  const field = await makeLogin("field@example.com", "Test Field");
  const companyId = await data.createCompany(db, { name: "F&G Home Maintenance", ownerUserId: owner.id });
  const { memberships } = await import("../src/db/schema");
  await db.insert(memberships).values({ companyId, userId: field.id, role: "member", createdAt: new Date() });
  await data.replaceWithTestData(db, companyId);
  console.log(`Created company with test data.\n  Owner:  ${ownerEmail}\n  Member: field@example.com\n  Password for both: ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
