import { AuthCard } from "./auth-card";
import { SignOutButton } from "./sign-out-button";

export function NoCompany({ email }: { email: string }) {
  return (
    <AuthCard
      title="No company access"
      description={
        <>
          {email} isn&apos;t part of a company on Bid Builder anymore. Ask the account Owner to invite you
          again.
        </>
      }
    >
      <SignOutButton className="border border-border" />
    </AuthCard>
  );
}
