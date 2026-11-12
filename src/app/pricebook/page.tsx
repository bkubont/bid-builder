"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { LineCategory, PricebookItem, Trade } from "@/lib/types";
import { CATEGORIES, TRADES } from "@/lib/trades";
import { formatCurrency } from "@/lib/utils";

export default function PricebookPage() {
  const { data, upsertPricebookItem, deletePricebookItem, ready } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PricebookItem | undefined>();
  const [query, setQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState<string>("all");

  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;

  const items = data.pricebook.filter((item) => {
    const matchesTrade = tradeFilter === "all" || item.trade === tradeFilter;
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q));
    return matchesTrade && matchesQuery;
  });

  return (
    <div>
      <PageHeader
        title="Pricebook"
        description="Labor and material rates used for manual adds and AI drafts."
        actions={
          <Button
            className="h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add item
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          className="h-12 rounded-xl sm:max-w-sm"
          placeholder="Search pricebook…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={tradeFilter} onValueChange={(v) => setTradeFilter(v || "all")}>
          <SelectTrigger className="h-12 rounded-xl sm:w-48">
            <SelectValue placeholder="Trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trades</SelectItem>
            {TRADES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-white/70">
        <ul className="divide-y divide-ink/8">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-sm capitalize text-muted-foreground">
                  {item.category} · {item.trade} · /{item.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">
                  {formatCurrency(item.unitCost)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={() => {
                    setEditing(item);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 text-rose-700"
                  onClick={() => deletePricebookItem(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing ? "Edit item" : "New pricebook item"}
            </DialogTitle>
          </DialogHeader>
          <PricebookForm
            item={editing}
            onSave={(values) => {
              upsertPricebookItem({ ...values, id: editing?.id });
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PricebookForm({
  item,
  onSave,
}: {
  item?: PricebookItem;
  onSave: (values: Omit<PricebookItem, "id">) => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState<LineCategory>(item?.category || "labor");
  const [trade, setTrade] = useState<Trade>(item?.trade || "general");
  const [unit, setUnit] = useState(item?.unit || "ea");
  const [unitCost, setUnitCost] = useState(item?.unitCost ?? 0);
  const [keywords, setKeywords] = useState(item?.keywords.join(", ") || "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: name.trim(),
          category,
          trade,
          unit: unit.trim() || "ea",
          unitCost: Number(unitCost) || 0,
          keywords: keywords
            .split(",")
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean),
        });
      }}
    >
      <div className="space-y-2">
        <Label>Name</Label>
        <Input className="h-12 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory((v || "labor") as LineCategory)}>
            <SelectTrigger className="h-12 rounded-xl">
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
          <Label>Unit</Label>
          <Input className="h-12 rounded-xl" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Unit cost</Label>
          <Input
            type="number"
            className="h-12 rounded-xl"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Keywords (comma-separated)</Label>
        <Input
          className="h-12 rounded-xl"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="faucet, kitchen, plumbing"
        />
      </div>
      <Button type="submit" className="h-12 rounded-xl bg-attention text-foreground hover:bg-attention/90">
        Save item
      </Button>
    </form>
  );
}
