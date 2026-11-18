"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileDown, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { SendDialog } from "@/components/documents/send-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PdfOptions } from "@/lib/pdf";
import { useSafe, useStore } from "@/lib/store";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { describeTaxable, documentTotals, groupBySection, lineTotal, unitPrice } from "@/lib/types";
import { INVOICE_STATUS_LABELS, categoryLabel } from "@/lib/trades";
import { formatCurrency, isPastDate } from "@/lib/utils";

export function InvoiceView({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const { data, updateInvoice, deleteInvoice, markInvoicePaid } = useStore();
  const safe = useSafe();
  const [sending, setSending] = useState(false);
  const customer = data.customers.find((c) => c.id === invoice.customerId);
  const estimate = data.estimates.find((e) => e.id === invoice.estimateId);
  const sibling = invoice.estimateId
    ? data.invoices.find((i) => i.estimateId === invoice.estimateId && i.id !== invoice.id)
    : undefined;
  const totals = documentTotals(invoice);
  const groups = groupBySection(invoice.lineItems, invoice.sections);
  const isDeposit = invoice.kind === "deposit";
  const pastDue = invoice.status !== "paid" && isPastDate(invoice.dueDate);

  const pdf: PdfOptions = {
    kind: "Invoice",
    invoiceKind: invoice.kind,
    number: invoice.number,
    company: data.company,
    customer,
    jobTitle: invoice.jobTitle,
    jobAddress: invoice.jobAddress,
    lineItems: invoice.lineItems,
    sections: invoice.sections,
    taxPercent: invoice.taxPercent,
    taxableCategories: invoice.taxableCategories,
    depositApplied: invoice.depositApplied,
    notes: invoice.notes,
    dateLabel: "Due",
    dateValue: invoice.dueDate,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${isDeposit ? "Deposit " : ""}${invoice.number}`}
        description={invoice.jobTitle}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={async () => (await import("@/lib/pdf")).downloadDocumentPdf(pdf)}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setSending(true)}>
              <Send className="size-4" />
              Send
            </Button>
            {invoice.status !== "paid" ? (
              <Button
                type="button"
                className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
                onClick={() => safe(() => markInvoicePaid(invoice.id), "Marked paid")}
              >
                <CheckCircle2 className="size-4" />
                Mark paid
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="rounded-3xl border border-border bg-white/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <InvoiceStatusBadge status={invoice.status} />
            {isDeposit ? (
              <span className="rounded-lg bg-brand-muted px-2 py-0.5 text-xs font-semibold text-brand">Deposit</span>
            ) : null}
            {pastDue && invoice.status !== "overdue" ? (
              <span className="text-sm font-medium text-rose-700">Past due</span>
            ) : null}
            <Select
              value={invoice.status}
              onValueChange={(v) =>
                safe(
                  () => updateInvoice({ id: invoice.id, status: (v || invoice.status) as InvoiceStatus }),
                  "Status updated"
                )
              }
            >
              <SelectTrigger className="h-11 w-40 rounded-xl" aria-label="Invoice status">
                <SelectValue>{(v: InvoiceStatus) => INVOICE_STATUS_LABELS[v] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {INVOICE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p>
              <p className="mt-1 font-medium">{customer?.name || "—"}</p>
              <p className="text-sm text-muted-foreground">{customer?.address}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job</p>
              <p className="mt-1 font-medium">{invoice.jobTitle}</p>
              <p className="text-sm text-muted-foreground">{invoice.jobAddress}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="due" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Due
              </Label>
              <Input
                id="due"
                type="date"
                className="h-11 w-48 rounded-xl"
                defaultValue={invoice.dueDate}
                key={invoice.dueDate}
                onBlur={(e) => {
                  const dueDate = e.target.value;
                  if (dueDate && dueDate !== invoice.dueDate) {
                    void safe(() => updateInvoice({ id: invoice.id, status: invoice.status, dueDate }), "Due date updated");
                  }
                }}
              />
            </div>
            <div className="space-y-1 text-sm">
              {estimate ? (
                <p>
                  <span className="text-muted-foreground">From estimate </span>
                  <Link className="font-medium text-brand underline-offset-2 hover:underline" href={`/estimates/${estimate.id}`}>
                    {estimate.number}
                  </Link>
                </p>
              ) : null}
              {sibling ? (
                <p>
                  <span className="text-muted-foreground">{sibling.kind === "deposit" ? "Deposit invoice " : "Final invoice "}</span>
                  <Link className="font-medium text-brand underline-offset-2 hover:underline" href={`/invoices/${sibling.id}`}>
                    {sibling.number}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Description</th>
                  <th className="py-2 pr-3 font-semibold">Qty</th>
                  <th className="py-2 pr-3 font-semibold">Price</th>
                  <th className="py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.id || "all"}>
                  {invoice.sections.length ? (
                    <tr className="bg-brand-muted/60">
                      <td colSpan={3} className="px-2 py-2 font-semibold text-foreground">{group.name}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatCurrency(group.total)}</td>
                    </tr>
                  ) : null}
                  {group.lines.map((item) => (
                    <tr key={item.id} className="border-b border-ink/5">
                      <td className="py-3 pr-3">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{categoryLabel(item.category)}</p>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{formatCurrency(unitPrice(item))}</td>
                      <td className="py-3 text-right font-semibold tabular-nums">{formatCurrency(lineTotal(item))}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          {invoice.notes ? <p className="mt-5 text-sm text-muted-foreground">{invoice.notes}</p> : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-border bg-brand p-5 text-brand-foreground">
            <p className="text-sm text-white/60">{totals.depositApplied ? "Balance due" : "Amount due"}</p>
            <p className="font-display text-4xl">{formatCurrency(totals.balanceDue)}</p>
            <dl className="mt-4 space-y-2 text-sm text-white/75">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd>
              </div>
              {invoice.taxPercent > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt>
                    Tax ({invoice.taxPercent}% on {describeTaxable(invoice.taxableCategories)})
                  </dt>
                  <dd className="tabular-nums">{formatCurrency(totals.tax)}</dd>
                </div>
              ) : null}
              {totals.depositApplied ? (
                <>
                  <div className="flex justify-between">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatCurrency(totals.total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Less deposit</dt>
                    <dd className="tabular-nums">-{formatCurrency(totals.depositApplied)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </section>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-xl text-rose-700 hover:bg-rose-50"
            onClick={() => {
              if (!window.confirm(`Delete invoice ${invoice.number}? This can't be undone.`)) return;
              void safe(() => deleteInvoice(invoice.id), "Invoice deleted").then((ok) => ok && router.push("/invoices"));
            }}
          >
            <Trash2 className="size-4" />
            Delete invoice
          </Button>
        </aside>
      </div>

      {sending ? (
        <SendDialog open onOpenChange={setSending} documentType="invoice" documentId={invoice.id} pdf={pdf} />
      ) : null}
    </div>
  );
}
