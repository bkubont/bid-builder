"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileDown,
  Plus,
  Sparkles,
  Trash2,
  Copy,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { newLineItem, useStore } from "@/lib/store";
import type {
  Estimate,
  EstimateStatus,
  LineCategory,
  LineItem,
  Trade,
} from "@/lib/types";
import { grandTotal, lineTotal, subtotal, taxAmount } from "@/lib/types";
import { CATEGORIES, TRADES } from "@/lib/trades";
import { formatCurrency } from "@/lib/utils";
import { downloadDocumentPdf } from "@/lib/pdf";
import { PageHeader } from "@/components/page-header";

export function EstimateBuilder({
  estimateId,
  initialCustomerId,
}: {
  estimateId?: string;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const {
    data,
    upsertEstimate,
    deleteEstimate,
    duplicateEstimate,
    convertEstimateToInvoice,
  } = useStore();

  const existing = estimateId
    ? data.estimates.find((e) => e.id === estimateId)
    : undefined;

  const seedCustomerId = existing?.customerId || initialCustomerId || "";
  const [customerId, setCustomerId] = useState(seedCustomerId);
  const [jobTitle, setJobTitle] = useState(existing?.jobTitle || "");
  const [jobAddress, setJobAddress] = useState(() => {
    if (existing?.jobAddress) return existing.jobAddress;
    const fromSeed = seedCustomerId
      ? data.customers.find((c) => c.id === seedCustomerId)
      : undefined;
    return fromSeed?.address || "";
  });
  const [trade, setTrade] = useState<Trade>(existing?.trade || "general");
  const [status, setStatus] = useState<EstimateStatus>(existing?.status || "draft");
  const [taxPercent, setTaxPercent] = useState(
    existing?.taxPercent ?? data.company.defaultTax
  );
  const [notes, setNotes] = useState(existing?.notes || "");
  const [validUntil, setValidUntil] = useState(
    existing?.validUntil?.slice(0, 10) ||
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    existing?.lineItems?.length
      ? existing.lineItems
      : [newLineItem({}, data.company.defaultMarkup)]
  );
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricebookFilter, setPricebookFilter] = useState("");

  const customer = data.customers.find((c) => c.id === customerId);
  const totals = useMemo(
    () => ({
      sub: subtotal(lineItems),
      tax: taxAmount(lineItems, taxPercent),
      grand: grandTotal(lineItems, taxPercent),
    }),
    [lineItems, taxPercent]
  );

  const filteredPricebook = data.pricebook.filter((item) => {
    const q = pricebookFilter.toLowerCase();
    if (!q) return trade === "general" || item.trade === trade || item.trade === "general";
    return (
      item.name.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
    );
  });

  function updateLine(id: string, patch: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, ...patch } : li))
    );
  }

  function addFromPricebook(id: string) {
    const item = data.pricebook.find((p) => p.id === id);
    if (!item) return;
    setLineItems((prev) => [
      ...prev,
      newLineItem(
        {
          pricebookItemId: item.id,
          description: item.name,
          category: item.category,
          quantity: 1,
          unit: item.unit,
          unitCost: item.unitCost,
        },
        data.company.defaultMarkup
      ),
    ]);
  }

  async function runAiDraft() {
    if (!aiPrompt.trim()) {
      setAiMessage("Describe the job first.");
      return;
    }
    setAiBusy(true);
    setAiMessage(null);
    try {
      const res = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: aiPrompt,
          trade,
          markupPercent: data.company.defaultMarkup,
          pricebook: data.pricebook,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Draft failed");
      setLineItems(json.lineItems);
      if (!jobTitle) {
        setJobTitle(aiPrompt.slice(0, 80));
      }
      setAiMessage(
        `${json.summary}${json.source === "mock" ? " (local draft)" : " (AI)"}`
      );
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setAiBusy(false);
    }
  }

  function save(nextStatus?: EstimateStatus) {
    setError(null);
    if (!customerId) {
      setError("Pick a customer.");
      return null;
    }
    if (!jobTitle.trim()) {
      setError("Add a job title.");
      return null;
    }
    const saved = upsertEstimate({
      id: existing?.id,
      number: existing?.number,
      customerId,
      jobTitle: jobTitle.trim(),
      jobAddress: jobAddress.trim() || customer?.address || "",
      trade,
      status: nextStatus || status,
      lineItems,
      taxPercent,
      notes,
      validUntil: new Date(validUntil).toISOString(),
    });
    setStatus(saved.status);
    if (!existing) router.replace(`/estimates/${saved.id}`);
    return saved;
  }

  function handlePdf(saved?: Estimate | null) {
    const est = saved || existing;
    if (!est && !customerId) {
      const result = save();
      if (!result) return;
      downloadDocumentPdf({
        kind: "Estimate",
        number: result.number,
        company: data.company,
        customer,
        jobTitle: result.jobTitle,
        jobAddress: result.jobAddress,
        lineItems: result.lineItems,
        taxPercent: result.taxPercent,
        notes: result.notes,
        dateLabel: "Valid until",
        dateValue: result.validUntil,
      });
      return;
    }
    const result = save() || existing;
    if (!result) return;
    downloadDocumentPdf({
      kind: "Estimate",
      number: result.number,
      company: data.company,
      customer: data.customers.find((c) => c.id === result.customerId),
      jobTitle: result.jobTitle,
      jobAddress: result.jobAddress,
      lineItems: result.lineItems,
      taxPercent: result.taxPercent,
      notes: result.notes,
      dateLabel: "Valid until",
      dateValue: result.validUntil,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={existing ? existing.number : "New estimate"}
        description="Build materials + labor lines from your pricebook or draft from a job description."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => handlePdf()}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
              onClick={() => save()}
            >
              Save
            </Button>
          </>
        }
      />

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-border bg-white/70 p-4 sm:p-5">
            <h2 className="font-display text-lg text-foreground">Job details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer">Customer</Label>
                <Select
                  value={customerId || undefined}
                  onValueChange={(v) => {
                    setCustomerId(v || "");
                    const c = data.customers.find((x) => x.id === v);
                    if (c && !jobAddress) setJobAddress(c.address);
                  }}
                >
                  <SelectTrigger id="customer" className="h-12 rounded-xl">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Job title</Label>
                <Input
                  id="title"
                  className="h-12 rounded-xl"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Kitchen remodel — phase 1"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Job address</Label>
                <Input
                  id="address"
                  className="h-12 rounded-xl"
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                  placeholder="Street, city, state"
                />
              </div>
              <div className="space-y-2">
                <Label>Trade</Label>
                <Select value={trade} onValueChange={(v) => setTrade((v || "general") as Trade)}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus((v || "draft") as EstimateStatus)}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["draft", "sent", "accepted", "declined", "converted"] as const).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Tax %</Label>
                <Input
                  id="tax"
                  type="number"
                  className="h-12 rounded-xl"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid">Valid until</Label>
                <Input
                  id="valid"
                  type="date"
                  className="h-12 rounded-xl"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  className="min-h-24 rounded-xl"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Exclusions, allowances, schedule notes…"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-white/70 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg text-foreground">AI / quick draft</h2>
                <p className="text-sm text-muted-foreground">
                  Describe the job. We draft editable lines from your pricebook.
                </p>
              </div>
              <Button
                type="button"
                className="h-11 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={aiBusy}
                onClick={runAiDraft}
              >
                <Sparkles className="size-4" />
                {aiBusy ? "Drafting…" : "Draft lines"}
              </Button>
            </div>
            <Textarea
              className="mt-3 min-h-24 rounded-xl"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Example: Replace kitchen faucet, add disposal, ~3 hours plumbing, haul old fixtures."
            />
            {aiMessage ? (
              <p className="mt-2 text-sm text-muted-foreground">{aiMessage}</p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-border bg-white/70 p-4 sm:p-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg text-foreground">Line items</h2>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() =>
                  setLineItems((prev) => [
                    ...prev,
                    newLineItem({}, data.company.defaultMarkup),
                  ])
                }
              >
                <Plus className="size-4" />
                Add line
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-2xl border border-border bg-muted/60 p-3 sm:grid-cols-[1.4fr_7rem_5rem_6rem_5rem_6rem_auto]"
                >
                  <Input
                    className="h-11 rounded-xl sm:col-span-1"
                    value={item.description}
                    onChange={(e) =>
                      updateLine(item.id, { description: e.target.value })
                    }
                    placeholder="Description"
                  />
                  <Select
                    value={item.category}
                    onValueChange={(v) =>
                      updateLine(item.id, {
                        category: (v || "labor") as LineCategory,
                      })
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="h-11 rounded-xl"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLine(item.id, {
                        quantity: Number(e.target.value) || 0,
                      })
                    }
                    aria-label="Quantity"
                  />
                  <Input
                    className="h-11 rounded-xl"
                    value={item.unit}
                    onChange={(e) => updateLine(item.id, { unit: e.target.value })}
                    aria-label="Unit"
                  />
                  <Input
                    type="number"
                    className="h-11 rounded-xl"
                    value={item.unitCost}
                    onChange={(e) =>
                      updateLine(item.id, {
                        unitCost: Number(e.target.value) || 0,
                      })
                    }
                    aria-label="Unit cost"
                  />
                  <Input
                    type="number"
                    className="h-11 rounded-xl"
                    value={item.markupPercent}
                    onChange={(e) =>
                      updateLine(item.id, {
                        markupPercent: Number(e.target.value) || 0,
                      })
                    }
                    aria-label="Markup %"
                  />
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(lineTotal(item))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 text-rose-700"
                      onClick={() =>
                        setLineItems((prev) => prev.filter((x) => x.id !== item.id))
                      }
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-3xl border border-border bg-brand p-5 text-brand-foreground">
            <p className="text-sm text-white/60">Estimate total</p>
            <p className="font-display text-4xl tracking-tight">
              {formatCurrency(totals.grand)}
            </p>
            <dl className="mt-4 space-y-2 text-sm text-white/75">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(totals.sub)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tax</dt>
                <dd className="tabular-nums">{formatCurrency(totals.tax)}</dd>
              </div>
            </dl>
            {existing ? (
              <div className="mt-5 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-white/20 bg-transparent text-brand-foreground hover:bg-white/10"
                  onClick={() => {
                    const copy = duplicateEstimate(existing.id);
                    if (copy) router.push(`/estimates/${copy.id}`);
                  }}
                >
                  <Copy className="size-4" />
                  Duplicate
                </Button>
                {existing.status !== "converted" ? (
                  <Button
                    type="button"
                    className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
                    onClick={() => {
                      save("accepted");
                      const inv = convertEstimateToInvoice(existing.id);
                      if (inv) router.push(`/invoices/${inv.id}`);
                    }}
                  >
                    <Receipt className="size-4" />
                    Convert to invoice
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-xl text-rose-200 hover:bg-white/10 hover:text-rose-100"
                  onClick={() => {
                    deleteEstimate(existing.id);
                    router.push("/estimates");
                  }}
                >
                  Delete estimate
                </Button>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-border bg-white/70 p-4">
            <h2 className="font-display text-lg text-foreground">Pricebook</h2>
            <Input
              className="mt-3 h-11 rounded-xl"
              placeholder="Search items…"
              value={pricebookFilter}
              onChange={(e) => setPricebookFilter(e.target.value)}
            />
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredPricebook.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching items.</p>
              ) : (
                filteredPricebook.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addFromPricebook(item.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-border bg-muted/50 px-3 py-3 text-left transition hover:border-brand hover:bg-brand-muted"
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {item.category} · {item.trade} · {item.unit}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(item.unitCost)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
