"use client";

import Link from "next/link";
import { ArrowRight, FileText, Receipt, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EstimateStatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { useStore } from "@/lib/store";
import { grandTotal } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function HomePage() {
  const { data, ready } = useStore();
  if (!ready) {
    return <div className="animate-pulse p-8 text-muted-foreground">Loading Bid Builder…</div>;
  }

  const openEstimates = data.estimates.filter((e) =>
    ["draft", "sent", "accepted"].includes(e.status)
  );
  const unpaidInvoices = data.invoices.filter((i) => i.status !== "paid");
  const pipeline = openEstimates.reduce(
    (sum, e) => sum + grandTotal(e.lineItems, e.taxPercent),
    0
  );
  const recent = [...data.estimates]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-hero px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-10 -top-10 size-56 rounded-full bg-attention/25 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 size-40 rounded-full bg-brand/15 blur-2xl" />
        <p className="font-display text-sm uppercase tracking-[0.18em] text-brand">
          Square This Up · Bid Builder
        </p>
        <h1 className="mt-2 max-w-xl font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          Price the job on the tablet. Block the hours before you leave the site.
        </h1>
        <p className="mt-3 max-w-lg text-base text-muted-foreground">
          Estimates, pricebook, AI draft, customers, invoices, and a drag-and-drop
          timeblock schedule sized to labor hours — built for tablets, phones, and desktop.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink
            href="/estimates/new"
            className="h-12 rounded-xl bg-attention px-5 text-attention-foreground hover:bg-attention/90"
          >
            New estimate
            <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink
            href="/schedule"
            variant="outline"
            className="h-12 rounded-xl bg-white/60"
          >
            Open schedule
          </ButtonLink>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<FileText className="size-5" />}
          label="Open estimates"
          value={String(openEstimates.length)}
          detail={`${formatCurrency(pipeline)} in pipeline`}
        />
        <Stat
          icon={<Users className="size-5" />}
          label="Customers"
          value={String(data.customers.length)}
          detail={`${data.pricebook.length} pricebook items`}
        />
        <Stat
          icon={<Receipt className="size-5" />}
          label="Unpaid invoices"
          value={String(unpaidInvoices.length)}
          detail={
            unpaidInvoices.length
              ? formatCurrency(
                  unpaidInvoices.reduce(
                    (s, i) => s + grandTotal(i.lineItems, i.taxPercent),
                    0
                  )
                )
              : "All clear"
          }
        />
      </div>

      <div>
        <PageHeader
          title="Recent estimates"
          description="Pick up where you left off."
          actions={
            <ButtonLink href="/estimates" variant="outline" className="h-11 rounded-xl">
              View all
            </ButtonLink>
          }
        />
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No estimates yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recent.map((estimate) => {
              const customer = data.customers.find((c) => c.id === estimate.customerId);
              return (
                <Link
                  key={estimate.id}
                  href={`/estimates/${estimate.id}`}
                  className="rounded-3xl border border-border bg-white/70 p-4 transition hover:border-brand hover:bg-brand-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {estimate.number}
                      </p>
                      <h2 className="font-display text-xl text-foreground">
                        {estimate.jobTitle}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {customer?.name || "No customer"} ·{" "}
                        {formatDate(estimate.updatedAt)}
                      </p>
                    </div>
                    <EstimateStatusBadge status={estimate.status} />
                  </div>
                  <p className="mt-4 text-right text-lg font-semibold tabular-nums">
                    {formatCurrency(
                      grandTotal(estimate.lineItems, estimate.taxPercent)
                    )}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-white/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
