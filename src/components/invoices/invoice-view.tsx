"use client";

import { useRouter } from "next/navigation";
import { FileDown, CheckCircle2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { grandTotal, lineTotal, subtotal, taxAmount } from "@/lib/types";
import { downloadDocumentPdf } from "@/lib/pdf";
import { formatCurrency, formatDate } from "@/lib/utils";

export function InvoiceView({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const { data, upsertInvoice, deleteInvoice, markInvoicePaid } = useStore();
  const customer = data.customers.find((c) => c.id === invoice.customerId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={invoice.number}
        description={invoice.jobTitle}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() =>
                downloadDocumentPdf({
                  kind: "Invoice",
                  number: invoice.number,
                  company: data.company,
                  customer,
                  jobTitle: invoice.jobTitle,
                  jobAddress: invoice.jobAddress,
                  lineItems: invoice.lineItems,
                  taxPercent: invoice.taxPercent,
                  notes: invoice.notes,
                  dateLabel: "Due",
                  dateValue: invoice.dueDate,
                })
              }
            >
              <FileDown className="size-4" />
              PDF
            </Button>
            {invoice.status !== "paid" ? (
              <Button
                type="button"
                className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
                onClick={() => markInvoicePaid(invoice.id)}
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
            <Select
              value={invoice.status}
              onValueChange={(v) =>
                upsertInvoice({
                  ...invoice,
                  status: (v || invoice.status) as InvoiceStatus,
                })
              }
            >
              <SelectTrigger className="h-11 w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["draft", "sent", "paid", "overdue"] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bill to
              </p>
              <p className="mt-1 font-medium">{customer?.name || "—"}</p>
              <p className="text-sm text-muted-foreground">{customer?.address}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Job
              </p>
              <p className="mt-1 font-medium">{invoice.jobTitle}</p>
              <p className="text-sm text-muted-foreground">{invoice.jobAddress}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Due
              </p>
              <p className="mt-1">{formatDate(invoice.dueDate)}</p>
            </div>
            {invoice.estimateId ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  From estimate
                </p>
                <p className="mt-1">
                  {data.estimates.find((e) => e.id === invoice.estimateId)?.number ||
                    "—"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Description</th>
                  <th className="py-2 pr-3 font-semibold">Qty</th>
                  <th className="py-2 pr-3 font-semibold">Rate</th>
                  <th className="py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-ink/5">
                    <td className="py-3 pr-3">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs capitalize text-muted-foreground">{item.category}</p>
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {formatCurrency(item.unitCost)}
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(lineTotal(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invoice.notes ? (
            <p className="mt-5 text-sm text-muted-foreground">{invoice.notes}</p>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-border bg-brand p-5 text-brand-foreground">
            <p className="text-sm text-white/60">Amount due</p>
            <p className="font-display text-4xl">
              {formatCurrency(grandTotal(invoice.lineItems, invoice.taxPercent))}
            </p>
            <dl className="mt-4 space-y-2 text-sm text-white/75">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatCurrency(subtotal(invoice.lineItems))}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tax</dt>
                <dd>
                  {formatCurrency(taxAmount(invoice.lineItems, invoice.taxPercent))}
                </dd>
              </div>
            </dl>
          </section>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-xl text-rose-700 hover:bg-rose-50"
            onClick={() => {
              deleteInvoice(invoice.id);
              router.push("/invoices");
            }}
          >
            <Trash2 className="size-4" />
            Delete invoice
          </Button>
        </aside>
      </div>
    </div>
  );
}
