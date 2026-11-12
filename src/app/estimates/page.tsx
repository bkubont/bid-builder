"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { EstimateStatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { useStore } from "@/lib/store";
import { grandTotal } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function EstimatesPage() {
  const { data, ready } = useStore();
  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;

  const estimates = [...data.estimates].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  );

  return (
    <div>
      <PageHeader
        title="Estimates"
        description="Draft, send, and convert bids for every job."
        actions={
          <ButtonLink
            href="/estimates/new"
            className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
          >
            <Plus className="size-4" />
            New estimate
          </ButtonLink>
        }
      />

      {estimates.length === 0 ? (
        <EmptyState
          title="No estimates yet"
          description="Create your first bid with pricebook lines or an AI draft."
          action={
            <ButtonLink
              href="/estimates/new"
              className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
            >
              Start estimate
            </ButtonLink>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-white/70">
          <div className="hidden grid-cols-[7rem_1fr_1fr_7rem_7rem_6rem] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Number</span>
            <span>Job</span>
            <span>Customer</span>
            <span>Updated</span>
            <span className="text-right">Total</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-ink/8">
            {estimates.map((estimate) => {
              const customer = data.customers.find((c) => c.id === estimate.customerId);
              return (
                <li key={estimate.id}>
                  <Link
                    href={`/estimates/${estimate.id}`}
                    className="block px-4 py-4 transition hover:bg-brand-muted md:grid md:grid-cols-[7rem_1fr_1fr_7rem_7rem_6rem] md:items-center md:gap-3"
                  >
                    <div className="flex items-center justify-between md:block">
                      <span className="font-semibold text-foreground">{estimate.number}</span>
                      <span className="md:hidden">
                        <EstimateStatusBadge status={estimate.status} />
                      </span>
                    </div>
                    <div className="mt-1 md:mt-0">
                      <p className="font-medium text-foreground">{estimate.jobTitle}</p>
                      <p className="text-sm text-muted-foreground md:hidden">
                        {customer?.name || "No customer"}
                      </p>
                    </div>
                    <p className="hidden text-sm text-muted-foreground md:block">
                      {customer?.name || "—"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground md:mt-0">
                      {formatDate(estimate.updatedAt)}
                    </p>
                    <p className="mt-1 text-right font-semibold tabular-nums md:mt-0">
                      {formatCurrency(grandTotal(estimate.lineItems, estimate.taxPercent))}
                    </p>
                    <div className="hidden md:block">
                      <EstimateStatusBadge status={estimate.status} />
                    </div>
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
