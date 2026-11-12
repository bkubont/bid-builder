"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { useStore } from "@/lib/store";
import { grandTotal } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function InvoicesPage() {
  const { data, ready } = useStore();
  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;

  const invoices = [...data.invoices].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
  );

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Convert accepted estimates into invoices and track payment."
      />

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Open an accepted estimate and tap Convert to invoice."
          action={
            <ButtonLink
              href="/estimates"
              className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
            >
              Go to estimates
            </ButtonLink>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-white/70">
          <ul className="divide-y divide-ink/8">
            {invoices.map((invoice) => {
              const customer = data.customers.find((c) => c.id === invoice.customerId);
              return (
                <li key={invoice.id}>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="flex flex-col gap-2 px-4 py-4 transition hover:bg-brand-muted sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{invoice.number}</span>
                        <InvoiceStatusBadge status={invoice.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {invoice.jobTitle} · {customer?.name || "No customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(
                        grandTotal(invoice.lineItems, invoice.taxPercent)
                      )}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
