import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthCard } from "@/components/auth/auth-card";
import { InviteForm } from "@/components/auth/invite-form";
import { ButtonLink } from "@/components/ui/button-link";
import { getDb } from "@/db";
import { findOpenInvite } from "@/server/data";

export const metadata: Metadata = { title: "Join — Bid Builder" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await connection(); // needs the database: render per request, not at build time
  const { token } = await params;
  const invite = await findOpenInvite(getDb(), token);
  if (!invite) {
    return (
      <AuthCard
        title="Invite link not valid"
        description="This link has expired or was already used. Ask the account Owner to send a new one."
      >
        <ButtonLink href="/login" variant="outline" className="h-11 w-full rounded-xl">
          Go to sign in
        </ButtonLink>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={`Join ${invite.companyName}`}
      description={`You've been invited as ${invite.role === "owner" ? "an Owner" : "a team member"}.`}
    >
      <InviteForm token={token} email={invite.email} />
    </AuthCard>
  );
}
