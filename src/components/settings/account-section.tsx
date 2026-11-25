"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormError, SubmitButton, TextField, keepValuesOnSubmit } from "@/components/auth/fields";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useStore } from "@/lib/store";
import { changeOwnPasswordAction } from "@/server/actions";

export function AccountSection() {
  const { me, notify } = useStore();
  const [state, action, busy] = useActionState(changeOwnPasswordAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      notify("Password changed. Other devices were signed out.");
      formRef.current?.reset();
    }
  }, [state, notify]);

  return (
    <section className="rounded-3xl border border-border bg-white/70 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">Your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {me.name} · {me.email} · {me.role === "owner" ? "Owner" : "Team member"}
          </p>
        </div>
        <SignOutButton className="border border-border hover:bg-muted" />
      </div>
      <form ref={formRef} onSubmit={keepValuesOnSubmit(action)} className="mt-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Change password</h3>
        <FormError message={state?.error} />
        <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" minLength={10} required />
          <TextField name="confirm" label="Confirm new password" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <div className="sm:w-56">
          <SubmitButton busy={busy} busyLabel="Changing…">Change password</SubmitButton>
        </div>
      </form>
    </section>
  );
}
