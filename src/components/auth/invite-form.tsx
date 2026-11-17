"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/server/actions";
import { FormError, SubmitButton, TextField, keepValuesOnSubmit } from "./fields";

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [state, action, busy] = useActionState(acceptInviteAction, undefined);

  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.error} />
      <TextField name="email" label="Email" value={email} readOnly disabled />
      <TextField name="name" label="Your name" autoComplete="name" required autoFocus />
      <TextField name="password" label="Choose a password" type="password" autoComplete="new-password" minLength={10} required hint="At least 10 characters." />
      <TextField name="confirm" label="Confirm password" type="password" autoComplete="new-password" minLength={10} required />
      <SubmitButton busy={busy} busyLabel="Joining…">Join</SubmitButton>
    </form>
  );
}
