"use client";

import { use } from "react";
import { InvoiceView } from "@/components/invoices/invoice-view";
import { ButtonLink } from "@/components/ui/button-link";
import { useStore } from "@/lib/store";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, ready } = useStore();
  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;

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
