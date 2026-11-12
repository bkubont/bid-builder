"use client";

import { StoreProvider } from "@/lib/store";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore SW registration failures in local/dev edge cases.
      });
    }
  }, []);

  return <StoreProvider>{children}</StoreProvider>;
}
