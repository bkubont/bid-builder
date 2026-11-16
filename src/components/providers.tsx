"use client";

import { StoreProvider } from "@/lib/store";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // A cached app shell makes local development confusing; remove it.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration can fail in private windows; the app still works online.
    });
  }, []);

  return <StoreProvider>{children}</StoreProvider>;
}
