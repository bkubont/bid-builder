"use client";

import { use, useEffect, useState } from "react";
import { InvoiceView } from "@/components/invoices/invoice-view";
import { ButtonLink } from "@/components/ui/button-link";
import { useStore } from "@/lib/store";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, ready, refresh } = useStore();
  const found = data.invoices.some((x) => x.id === id);
  const [checked, setChecked] = useState(found);
  // Made on another device and not here yet? Fetch the latest before saying "not found".
  useEffect(() => {
    if (found || checked) return;
    void refresh().finally(() => setChecked(true));
  }, [found, checked, refresh]);
  if (!ready || (!found && !checked)) {
    return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;
  }

  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) {
    return (
      <div className="rounded-3xl border border-border bg-white/70 p-8">
        <h1 className="font-display text-2xl">Invoice not found</h1>
        <ButtonLink
          href="/invoices"
          className="mt-4 h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
        >
          Back to invoices
        </ButtonLink>
      </div>
    );
  }

  return <InvoiceView invoice={invoice} />;
}
