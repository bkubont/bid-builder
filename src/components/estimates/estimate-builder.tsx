"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, FileDown, FolderPlus, HandCoins, Plus, Receipt, Send, Sparkles, Trash2 } from "lucide-react";
import { v4 as uuid } from "uuid";
import { SendDialog } from "@/components/documents/send-dialog";
import type { PdfOptions } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { newLineItem, useSafe, useStore } from "@/lib/store";
import type { Estimate, EstimateSection, EstimateStatus, LineCategory, LineItem, Trade } from "@/lib/types";
import { describeTaxable, documentTotals, groupBySection, lineTotal, unitPrice } from "@/lib/types";
import {
  CATEGORIES,
  ESTIMATE_STATUS_LABELS,
  TRADES,
  categoryLabel,
  tradeLabel,
} from "@/lib/trades";
import { dateOnlyFromToday, formatCurrency, toDateOnly } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

type PendingDraft = { lineItems: LineItem[]; sections: EstimateSection[]; message: string };

/** A line counts as "filled in" if it has a description or a price. */
function hasContent(item: LineItem) {
  return item.description.trim() !== "" || item.unitCost > 0;
}

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
    requestDeposit,
  } = useStore();

  const existing = estimateId ? data.estimates.find((e) => e.id === estimateId) : undefined;
  const invoice = existing
    ? data.invoices.find((i) => i.estimateId === existing.id && i.kind === "final")
    : undefined;
  const depositInvoice = existing
    ? data.invoices.find((i) => i.estimateId === existing.id && i.kind === "deposit")
    : undefined;

  const seedCustomerId = existing?.customerId || initialCustomerId || "";
  const [customerId, setCustomerId] = useState(seedCustomerId);
  const [jobTitle, setJobTitle] = useState(existing?.jobTitle || "");
  const [jobAddress, setJobAddress] = useState(
    () =>
      existing?.jobAddress ||
      data.customers.find((c) => c.id === seedCustomerId)?.address ||
      ""
  );
  const [trade, setTrade] = useState<Trade>(existing?.trade || "general");
  const [status, setStatus] = useState<EstimateStatus>(existing?.status || "draft");
  const [taxPercent, setTaxPercent] = useState(existing?.taxPercent ?? data.company.defaultTax);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [validUntil, setValidUntil] = useState(() =>
    existing?.validUntil ? toDateOnly(existing.validUntil) : dateOnlyFromToday(30)
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(() =>
    existing?.lineItems?.length
      ? existing.lineItems
      : [newLineItem({}, data.company.defaultMarkup)]
  );
  const [sections, setSections] = useState<EstimateSection[]>(() => existing?.sections ?? []);
  /** Section the pricebook adds into ("" = Other work). */
  const [targetSection, setTargetSection] = useState("");
  const [sendPdf, setSendPdf] = useState<PdfOptions | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  // Tax rule: kept from when the estimate was made; new ones follow company settings.
  const taxable = existing ? existing.taxableCategories : data.company.taxableCategories;
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pricebookFilter, setPricebookFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const safe = useSafe();

  const customer = data.customers.find((c) => c.id === customerId);
  const totals = useMemo(() => {
    const t = documentTotals({ lineItems, taxPercent, taxableCategories: taxable });
    return { sub: t.subtotal, tax: t.tax, grand: t.total };
  }, [lineItems, taxPercent, taxable]);

  // Warn before leaving the page (reload, close tab) with unsaved changes.
  const formSnapshot = JSON.stringify([customerId, jobTitle, jobAddress, trade, status, taxPercent, notes, validUntil, lineItems.filter(hasContent), sections]);
  const [initialSnapshot] = useState(formSnapshot);
  const dirty = formSnapshot !== (savedSnapshot ?? initialSnapshot);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const filteredPricebook = data.pricebook.filter((item) => {
    const q = pricebookFilter.trim().toLowerCase();
    if (!q) return trade === "general" || item.trade === trade || item.trade === "general";
    return item.name.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q));
  });

  // "Converted" is set by converting, not picked by hand.
  const statusOptions = (Object.keys(ESTIMATE_STATUS_LABELS) as EstimateStatus[]).filter(
    (s) => s !== "converted" || status === "converted"
  );

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((m) => (m === message ? null : m)), 2500);
  }

  function updateLine(id: string, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  }

  function addFromPricebook(id: string) {
    const item = data.pricebook.find((p) => p.id === id);
    if (!item) return;
    setLineItems((prev) => [
      // Replace the starter blank line instead of leaving it behind.
      ...prev.filter(hasContent),
      newLineItem(
        {
          pricebookItemId: item.id,
          description: item.name,
          category: item.category,
          quantity: 1,
          unit: item.unit,
          unitCost: item.unitCost,
          sectionId: targetSection || undefined,
        },
        data.company.defaultMarkup
      ),
    ]);
    const where = sections.find((x) => x.id === targetSection)?.name;
    flash(`Added ${item.name}${where ? ` to ${where}` : ""}`);
  }

  function addSection() {
    const section = { id: uuid(), name: "" };
    setSections((prev) => [...prev, section]);
    setTargetSection(section.id);
  }

  function renameSection(id: string, name: string) {
    setSections((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)));
  }

  function moveSection(id: string, delta: -1 | 1) {
    setSections((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeSection(section: EstimateSection) {
    const count = lineItems.filter((l) => l.sectionId === section.id).length;
    if (count && !window.confirm(`Remove the "${section.name || "Untitled"}" section? Its ${count} line${count === 1 ? "" : "s"} move to Other work.`)) return;
    setSections((prev) => prev.filter((x) => x.id !== section.id));
    setLineItems((prev) => prev.map((l) => (l.sectionId === section.id ? { ...l, sectionId: undefined } : l)));
    if (targetSection === section.id) setTargetSection("");
  }

  function addLine(sectionId?: string) {
    setLineItems((prev) => [...prev, newLineItem({ sectionId }, data.company.defaultMarkup)]);
  }

  function applyDraft(mode: "replace" | "append", draft: PendingDraft) {
    if (mode === "replace") {
      setSections(draft.sections);
      setLineItems(draft.lineItems);
    } else {
      // Reuse sections with the same name; add the rest.
      const idFor = new Map<string, string>();
      const added: EstimateSection[] = [];
      for (const s of draft.sections) {
        const same = sections.find((x) => x.name.trim().toLowerCase() === s.name.trim().toLowerCase());
        if (same) idFor.set(s.id, same.id);
        else added.push(s);
      }
      setSections((prev) => [...prev, ...added]);
      setLineItems((prev) => [
        ...prev.filter(hasContent),
        ...draft.lineItems.map((l) => (l.sectionId && idFor.has(l.sectionId) ? { ...l, sectionId: idFor.get(l.sectionId) } : l)),
      ]);
    }
    setAiMessage(draft.message);
    setPendingDraft(null);
  }

  async function runAiDraft() {
    if (!aiPrompt.trim()) {
      setAiMessage("Describe the job first.");
      return;
    }
    setAiBusy(true);
    setAiMessage(null);
    setPendingDraft(null);
    try {
      const res = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: aiPrompt,
          trade,
          markupPercent: data.company.defaultMarkup,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Draft failed");
      if (!jobTitle.trim()) setJobTitle(aiPrompt.trim().split(/[.\n]/)[0].slice(0, 80));
      const draft: PendingDraft = {
        lineItems: json.lineItems,
        sections: json.sections ?? [],
        message: `${json.summary}${json.source === "openai" ? " (AI)" : ""}`,
      };
      if (draft.lineItems.length === 0) {
        setAiMessage(draft.message);
      } else if (lineItems.some(hasContent)) {
        setPendingDraft(draft); // ask before touching lines already entered
      } else {
        applyDraft("replace", draft);
      }
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setAiBusy(false);
    }
  }

  /** Validate and save. Returns the saved estimate, or null if it didn't save. */
  async function save(nextStatus?: EstimateStatus): Promise<Estimate | null> {
    setError(null);
    if (!customerId || !customer) {
      setError("Pick a customer.");
      return null;
    }
    if (!jobTitle.trim()) {
      setError("Add a job title.");
      return null;
    }
    setBusy(true);
    const saved = await safe(() =>
      upsertEstimate({
      id: existing?.id,
      customerId,
      jobTitle: jobTitle.trim(),
      jobAddress: jobAddress.trim() || customer.address || "",
      trade,
      status: nextStatus || status,
      lineItems: lineItems.filter(hasContent),
      sections: sections.map((x) => ({ ...x, name: x.name.trim() || "Untitled section" })),
      taxPercent,
      notes,
      validUntil,
      })
    );
    setBusy(false);
    if (!saved) return null;
    setStatus(saved.status);
    setSavedSnapshot(formSnapshot);
    if (!existing) router.replace(`/estimates/${saved.id}`);
    else flash("Saved");
    return saved;
  }

  function pdfOptions(saved: Estimate): PdfOptions {
    return {
      kind: "Estimate",
      number: saved.number,
      company: data.company,
      customer: data.customers.find((c) => c.id === saved.customerId),
      jobTitle: saved.jobTitle,
      jobAddress: saved.jobAddress,
      lineItems: saved.lineItems,
      sections: saved.sections,
      taxPercent: saved.taxPercent,
      taxableCategories: saved.taxableCategories,
      notes: saved.notes,
      dateLabel: "Valid until",
      dateValue: saved.validUntil,
    };
  }

  async function handlePdf() {
    const saved = await save();
    if (!saved) return; // don't print an old version when the save failed
    const { downloadDocumentPdf } = await import("@/lib/pdf");
    downloadDocumentPdf(pdfOptions(saved));
  }

  async function handleSend() {
    const saved = await save();
    if (saved) setSendPdf(pdfOptions(saved));
  }

  async function handleDeposit() {
    if (!existing) return;
    if (depositInvoice) {
      router.push(`/invoices/${depositInvoice.id}`);
      return;
    }
    const answer = window.prompt(
      "Deposit as a percent of the estimate total:",
      String(data.company.depositPercent)
    );
    if (answer === null) return;
    const percent = Number(answer.replace("%", "").trim());
    if (!(percent > 0 && percent <= 100)) {
      setError("Enter a deposit between 1 and 100 percent.");
      return;
    }
    if (!(await save())) return;
    setBusy(true);
    const inv = await safe(() => requestDeposit(existing.id, percent), "Deposit invoice created");
    setBusy(false);
    if (inv) router.push(`/invoices/${inv.id}`);
  }

  async function handleConvert() {
    if (!existing) return;
    if (invoice) {
      router.push(`/invoices/${invoice.id}`);
      return;
    }
    if (!(await save("accepted"))) return;
    setBusy(true);
    const inv = await safe(() => convertEstimateToInvoice(existing.id));
    setBusy(false);
    if (inv) router.push(`/invoices/${inv.id}`);
  }

  async function handleDuplicate() {
    if (!existing || !(await save())) return;
    setBusy(true);
    const copy = await safe(() => duplicateEstimate(existing.id), "Copy created");
    setBusy(false);
    if (copy) router.push(`/estimates/${copy.id}`);
  }

  async function handleDelete() {
    if (!existing) return;
    const kept = [depositInvoice?.number, invoice?.number].filter(Boolean).join(" and ");
    const extra = kept ? ` Its invoice${kept.includes(" and ") ? "s" : ""} ${kept} will be kept.` : "";
    if (!window.confirm(`Delete ${existing.number} (${existing.jobTitle})? This can't be undone.${extra}`)) return;
    setBusy(true);
    const ok = await safe(() => deleteEstimate(existing.id), "Estimate deleted");
    setBusy(false);
    if (ok) router.push("/estimates");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={existing ? existing.number : "New estimate"}
        description="Build materials + labor lines from your pricebook or draft from a job description."
        actions={
          <>
            <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={handlePdf}>
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={handleSend}>
              <Send className="size-4" />
              Send
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
              disabled={busy}
              onClick={() => save()}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
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
                  value={customerId || null}
                  onValueChange={(v) => {
                    const id = (v as string | null) || "";
                    setCustomerId(id);
                    const c = data.customers.find((x) => x.id === id);
                    if (c && !jobAddress) setJobAddress(c.address);
                  }}
                >
                  <SelectTrigger id="customer" className="h-12 rounded-xl">
                    <SelectValue>
                      {(v: string | null) =>
                        data.customers.find((c) => c.id === v)?.name ?? (
                          <span className="text-muted-foreground">Select customer</span>
                        )
                      }
                    </SelectValue>
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
                <Label htmlFor="trade">Trade</Label>
                <Select value={trade} onValueChange={(v) => setTrade((v || "general") as Trade)}>
                  <SelectTrigger id="trade" className="h-12 rounded-xl">
                    <SelectValue>{(v: string) => tradeLabel(v)}</SelectValue>
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
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus((v || "draft") as EstimateStatus)}
                >
                  <SelectTrigger id="status" className="h-12 rounded-xl">
                    <SelectValue>
                      {(v: EstimateStatus) => ESTIMATE_STATUS_LABELS[v] ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ESTIMATE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Tax %</Label>
                <NumberInput
                  id="tax"
                  className="h-12 rounded-xl"
                  value={taxPercent}
                  onValueChange={setTaxPercent}
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
            {pendingDraft ? (
              <div className="mt-3 rounded-2xl border border-brand/30 bg-brand-muted p-3">
                <p className="text-sm text-foreground">
                  Draft ready: {pendingDraft.lineItems.length} line
                  {pendingDraft.lineItems.length === 1 ? "" : "s"}. You already have lines on this
                  estimate — what should we do?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-10 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
                    onClick={() => applyDraft("append", pendingDraft)}
                  >
                    Add to my lines
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={() => applyDraft("replace", pendingDraft)}
                  >
                    Replace my lines
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 rounded-xl"
                    onClick={() => setPendingDraft(null)}
                  >
                    Discard draft
                  </Button>
                </div>
              </div>
            ) : null}
            {aiMessage ? <p className="mt-2 text-sm text-muted-foreground">{aiMessage}</p> : null}
          </section>

          <section className="rounded-3xl border border-border bg-white/70 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg text-foreground">Line items</h2>
                <p className="text-xs text-muted-foreground">
                  {sections.length
                    ? "Customers see each section's name and total, not the lines inside."
                    : "Add sections (Demo, Framing…) to show customers a total per section."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={addSection}>
                  <FolderPlus className="size-4" />
                  Add section
                </Button>
                {sections.length === 0 ? (
                  <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => addLine()}>
                    <Plus className="size-4" />
                    Add line
                  </Button>
                ) : null}
              </div>
            </div>

            {lineItems.length === 0 && sections.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No lines yet. Add one, pick from the pricebook, or draft from a description.
              </p>
            ) : sections.length === 0 ? (
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <LineItemCard
                    key={item.id}
                    item={item}
                    index={index}
                    sections={sections}
                    onChange={(patch) => updateLine(item.id, patch)}
                    onRemove={() => setLineItems((prev) => prev.filter((x) => x.id !== item.id))}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {groupBySection(lineItems, sections).map((group, gi, all) => {
                  const section = sections.find((x) => x.id === group.id);
                  return (
                    <div key={group.id || "other"} className="rounded-2xl border border-brand/20 bg-brand-muted/40 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {section ? (
                          <Input
                            aria-label="Section name"
                            className="h-11 min-w-0 basis-full rounded-xl bg-white font-semibold sm:basis-0 sm:flex-1"
                            value={section.name}
                            placeholder="Section name (e.g. Framing)"
                            onChange={(e) => renameSection(section.id, e.target.value)}
                          />
                        ) : (
                          <p className="flex-1 px-1 font-semibold text-foreground">Other work</p>
                        )}
                        <span className="ml-auto px-1 text-sm font-semibold tabular-nums sm:ml-0">{formatCurrency(group.total)}</span>
                        {section ? (
                          <div className="flex">
                            <Button type="button" variant="ghost" size="icon" className="size-10" disabled={gi === 0} onClick={() => moveSection(section.id, -1)} aria-label="Move section up">
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="size-10" disabled={gi >= sections.length - 1 || !all[gi + 1]?.id} onClick={() => moveSection(section.id, 1)} aria-label="Move section down">
                              <ArrowDown className="size-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="size-10 text-rose-700" onClick={() => removeSection(section)} aria-label="Remove section">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-3">
                        {group.lines.map((item) => (
                          <LineItemCard
                            key={item.id}
                            item={item}
                            index={lineItems.indexOf(item)}
                            sections={sections}
                            onChange={(patch) => updateLine(item.id, patch)}
                            onRemove={() => setLineItems((prev) => prev.filter((x) => x.id !== item.id))}
                          />
                        ))}
                      </div>
                      <Button type="button" variant="ghost" className="mt-2 h-10 rounded-xl text-brand" onClick={() => addLine(section?.id)}>
                        <Plus className="size-4" />
                        Add line{section?.name ? ` to ${section.name}` : ""}
                      </Button>
                    </div>
                  );
                })}
                {sections.length > 0 && !lineItems.some((l) => !l.sectionId) ? (
                  <Button type="button" variant="ghost" className="h-10 rounded-xl text-muted-foreground" onClick={() => addLine()}>
                    <Plus className="size-4" />
                    Add a line outside sections
                  </Button>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-3xl border border-border bg-brand p-5 text-brand-foreground">
            <p className="text-sm text-white/60">Estimate total</p>
            <p className="font-display text-4xl tracking-tight">{formatCurrency(totals.grand)}</p>
            <dl className="mt-4 space-y-2 text-sm text-white/75">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(totals.sub)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Tax ({taxPercent}% on {describeTaxable(taxable)})</dt>
                <dd className="tabular-nums">{formatCurrency(totals.tax)}</dd>
              </div>
            </dl>
            {existing ? (
              <div className="mt-5 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-white/20 bg-transparent text-brand-foreground hover:bg-white/10"
                  disabled={busy}
                  onClick={handleDuplicate}
                >
                  <Copy className="size-4" />
                  Duplicate
                </Button>
                {!invoice || depositInvoice ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-white/20 bg-transparent text-brand-foreground hover:bg-white/10"
                    disabled={busy}
                    onClick={handleDeposit}
                  >
                    <HandCoins className="size-4" />
                    {depositInvoice
                      ? `View deposit ${depositInvoice.number}`
                      : `Request deposit (${data.company.depositPercent}%)`}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
                  disabled={busy}
                  onClick={handleConvert}
                >
                  <Receipt className="size-4" />
                  {invoice
                    ? `View invoice ${invoice.number}`
                    : depositInvoice
                      ? "Create final invoice"
                      : "Convert to invoice"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-xl text-rose-200 hover:bg-white/10 hover:text-rose-100"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  Delete estimate
                </Button>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-border bg-white/70 p-4">
            <h2 className="font-display text-lg text-foreground">Pricebook</h2>
            <p className="text-xs text-muted-foreground">Tap an item to add it as a line.</p>
            {sections.length ? (
              <div className="mt-3 space-y-1">
                <Label htmlFor="pb-target" className="text-xs text-muted-foreground">Add to section</Label>
                <Select value={targetSection} onValueChange={(v) => setTargetSection((v as string) ?? "")}>
                  <SelectTrigger id="pb-target" className="h-11 rounded-xl">
                    <SelectValue>{(v: string) => sections.find((x) => x.id === v)?.name || (v ? "Untitled section" : "Other work")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((x) => (
                      <SelectItem key={x.id} value={x.id}>{x.name || "Untitled section"}</SelectItem>
                    ))}
                    <SelectItem value="">Other work</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
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
                      <span className="block text-sm font-medium text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {categoryLabel(item.category)} · {tradeLabel(item.trade)} · {item.unit}
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

      {/* Total + Save stay in reach while scrolling on phones and tablets. */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 flex items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-3 text-brand-foreground shadow-lg lg:bottom-4 xl:hidden">
        <div>
          <p className="text-xs text-white/60">Total</p>
          <p className="font-display text-xl tabular-nums">{formatCurrency(totals.grand)}</p>
        </div>
        <Button
          type="button"
          className="h-11 rounded-xl bg-attention px-6 text-foreground hover:bg-attention/90"
          disabled={busy}
          onClick={() => save()}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>

      {sendPdf && existing ? (
        <SendDialog
          open
          onOpenChange={(open) => !open && setSendPdf(null)}
          documentType="estimate"
          documentId={existing.id}
          pdf={sendPdf}
        />
      ) : null}

      {notice ? (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2 text-sm text-background shadow-lg"
        >
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 space-y-1 ${className ?? ""}`}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function LineItemCard({
  item,
  index,
  sections,
  onChange,
  onRemove,
}: {
  item: LineItem;
  index: number;
  sections: EstimateSection[];
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
}) {
  const price = unitPrice(item);
  return (
    <div className="@container rounded-2xl border border-border bg-muted/60 p-3">
      <div className="flex items-end gap-2">
        <Field label={`Line ${index + 1}`} className="flex-1">
          <Input
            className="h-11 rounded-xl bg-white"
            value={item.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description"
          />
        </Field>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-rose-700"
          onClick={onRemove}
          aria-label={`Remove line ${index + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 @md:grid-cols-3 @3xl:grid-cols-[8rem_repeat(4,minmax(0,1fr))_minmax(8rem,auto)]">
        <Field label="Category">
          <Select
            value={item.category}
            onValueChange={(v) => onChange({ category: (v || "labor") as LineCategory })}
          >
            <SelectTrigger className="h-11 w-full rounded-xl bg-white" aria-label="Category">
              <SelectValue>{(v: string) => categoryLabel(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Qty">
          <NumberInput
            className="h-11 rounded-xl bg-white"
            value={item.quantity}
            onValueChange={(quantity) => onChange({ quantity })}
          />
        </Field>
        <Field label="Unit">
          <Input
            className="h-11 rounded-xl bg-white"
            value={item.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="ea, hr, ft…"
          />
        </Field>
        <Field label="Your cost / unit">
          <NumberInput
            className="h-11 rounded-xl bg-white"
            value={item.unitCost}
            onValueChange={(unitCost) => onChange({ unitCost })}
          />
        </Field>
        <Field label="Markup %">
          <NumberInput
            className="h-11 rounded-xl bg-white"
            value={item.markupPercent}
            onValueChange={(markupPercent) => onChange({ markupPercent })}
          />
        </Field>
        {sections.length ? (
          <Field label="Section">
            <Select value={item.sectionId ?? ""} onValueChange={(v) => onChange({ sectionId: (v as string) || undefined })}>
              <SelectTrigger className="h-11 w-full rounded-xl bg-white" aria-label="Section">
                <SelectValue>{(v: string) => sections.find((x) => x.id === v)?.name || (v ? "Untitled section" : "Other work")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sections.map((x) => (
                  <SelectItem key={x.id} value={x.id}>{x.name || "Untitled section"}</SelectItem>
                ))}
                <SelectItem value="">Other work</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <div className="flex min-w-0 flex-col justify-end rounded-xl bg-white/80 px-3 py-1.5 text-right">
          <span className="text-xs text-muted-foreground">
            {formatCurrency(price)} / {item.unit || "unit"}
          </span>
          <span className="font-semibold tabular-nums">{formatCurrency(lineTotal(item))}</span>
        </div>
      </div>
    </div>
  );
}
