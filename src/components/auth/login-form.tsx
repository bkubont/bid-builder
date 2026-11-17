"use client";

import { useActionState } from "react";
import { signInAction } from "@/server/actions";
import { FormError, SubmitButton, TextField, keepValuesOnSubmit } from "./fields";

export function LoginForm({ next }: { next: string }) {
  const [state, action, busy] = useActionState(signInAction, undefined);

  return (
    <form onSubmit={keepValuesOnSubmit(action)} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />
      <TextField name="email" label="Email" type="email" autoComplete="username" required autoFocus />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
      <SubmitButton busy={busy} busyLabel="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        Forgot your password? Ask the account Owner to set a new one for you in Settings.
      </p>
    </form>
  );
}
