import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getDb } from "@/db";
import { countCompanies } from "@/server/data";
import { getMe } from "@/server/session";

export const metadata: Metadata = { title: "Sign in — Bid Builder" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await connection(); // needs the database: render per request, not at build time
  if ((await countCompanies(getDb())) === 0) redirect("/setup");
  if (await getMe()) redirect("/");
  const { next } = await searchParams;
  // Only same-site paths, never another domain.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <AuthCard title="Sign in">
      <LoginForm next={safeNext} />
    </AuthCard>
  );
}
