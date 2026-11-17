"use client";

import { startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TextField({
  name,
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { name: string; label: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-12 rounded-xl" {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({
  children,
  busy,
  busyLabel,
}: {
  children: React.ReactNode;
  busy: boolean;
  busyLabel: string;
}) {
  return (
    <Button
      type="submit"
      disabled={busy}
      className="h-12 w-full rounded-xl bg-attention text-foreground hover:bg-attention/90"
    >
      {busy ? busyLabel : children}
    </Button>
  );
}

/**
 * Submit handler for a server-action form that keeps what the person typed
 * when there's an error (React's default form action clears every field).
 */
export function keepValuesOnSubmit(action: (form: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {message}
    </p>
  );
}
