"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { clearDeviceData } from "@/lib/store";
import { signOutAction } from "@/server/actions";
import { cn, hardNavigate } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium", className)}
      onClick={async () => {
        setBusy(true);
        await signOutAction().catch(() => null);
        // Don't leave customer data on a shared or lost device.
        await clearDeviceData();
        hardNavigate("/login");
      }}
    >
      <LogOut className="size-4" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
