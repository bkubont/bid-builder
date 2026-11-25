import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SetupForm } from "@/components/auth/setup-form";
import { getDb } from "@/db";
import { countCompanies } from "@/server/data";

export const metadata: Metadata = { title: "Set up — Bid Builder" };

/** First-run only: creates the Owner login and company. */
export default async function SetupPage() {
  await connection(); // needs the database: render per request, not at build time
  if ((await countCompanies(getDb())) > 0) redirect("/login");
  const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!email || !process.env.SETUP_CODE) {
    return (
      <AuthCard
        title="Almost ready"
        description="Bid Builder needs OWNER_EMAIL and SETUP_CODE set in the server's environment variables before the first account can be created."
      >
        <p className="text-sm text-muted-foreground">Add them in hPanel, redeploy, then reload this page.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Set up Bid Builder" description="Create the Owner account. This page only works once.">
      <SetupForm email={email} />
    </AuthCard>
  );
}
