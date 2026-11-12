"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("bid-builder-install-dismissed") === "1") {
      setDismissed(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-attention/40 bg-attention/15 px-4 py-3">
      <Download className="mt-0.5 size-5 shrink-0 text-attention-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base text-foreground">Install Bid Builder</p>
        <p className="text-sm text-muted-foreground">
          Add it to your home screen for tablet and phone use offline-ready later.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-10 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={async () => {
              await deferred.prompt();
              setDeferred(null);
            }}
          >
            Install app
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-xl"
            onClick={() => {
              localStorage.setItem("bid-builder-install-dismissed", "1");
              setDismissed(true);
            }}
          >
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="rounded-lg p-1 text-muted-foreground hover:bg-brand/5"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem("bid-builder-install-dismissed", "1");
          setDismissed(true);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
