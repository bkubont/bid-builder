"use client";

import { useActionState } from "react";
import { setupOwnerAction } from "@/server/actions";
import { FormError, SubmitButton, TextField, keepValuesOnSubmit } from "./fields";

export function SetupForm({ email }: { email: string }) {
  const [state, action, busy] = useActionState(setupOwnerAction, undefined);

  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="space-y-4">
      <FormError message={state?.error} />
      <TextField name="email" label="Owner email" value={email} readOnly disabled />
      <TextField
        name="setupCode"
        label="Setup code"
        autoComplete="off"
        required
        hint="The SETUP_CODE set on the server. Only needed this once."
      />
      <TextField name="name" label="Your name" autoComplete="name" required />
      <TextField name="companyName" label="Company name" defaultValue="F&G Home Maintenance" required />
      <TextField name="password" label="Password" type="password" autoComplete="new-password" minLength={10} required hint="At least 10 characters." />
      <TextField name="confirm" label="Confirm password" type="password" autoComplete="new-password" minLength={10} required />
      <SubmitButton busy={busy} busyLabel="Setting up…">Create Owner account</SubmitButton>
    </form>
  );
}
