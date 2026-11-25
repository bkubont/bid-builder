import type { EstimateSection, LineCategory, LineItem, PricebookItem, Trade } from "./types";
import { v4 as uuid } from "uuid";

export type DraftRequest = {
  description: string;
  trade: Trade;
  markupPercent: number;
  pricebook: PricebookItem[];
};

export type DraftResult = {
  lineItems: LineItem[];
  /** Suggested sections (AI drafts only); lines point at them by sectionId. */
  sections: EstimateSection[];
  source: "mock" | "openai";
  summary: string;
};

const CATEGORIES: LineCategory[] = ["labor", "material", "equipment", "other"];
const MAX_LINES = 8;

const HOUR_WORDS = "hours?|hrs?|h";
const HOUR_UNITS = new Set(["hr", "hrs", "hour", "hours", "h"]);
// Units that just mean "one of" — a bare number shouldn't be read as them.
const COUNT_UNITS = new Set(["ea", "each", "unit", "units", "pc", "pcs"]);

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word (or whole-phrase) match, so "ac" doesn't match "replace". */
function hasPhrase(text: string, phrase: string): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(p)}(?:$|[^a-z0-9])`, "i").test(text);
}

function nameWords(item: PricebookItem): string[] {
  return item.name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !["labor", "standard", "grade"].includes(w));
}

/** Score how well a pricebook item matches the description. 0 = not mentioned. */
export function scoreItem(item: PricebookItem, text: string): number {
  let score = 0;
  for (const keyword of item.keywords) {
    if (hasPhrase(text, keyword)) score += 4;
  }
  for (const word of nameWords(item)) {
    if (hasPhrase(text, word)) score += 2;
  }
  return score;
}

/**
 * Find a quantity written next to this item in the description, e.g.
 * "3 hours" for hourly labor, "250 ft of romex", "6 outlets".
 * Returns null when nothing specific is written.
 */
export function inferQuantity(text: string, item: PricebookItem): number | null {
  const num = "(\\d+(?:\\.\\d+)?)";
  const isHourly = HOUR_UNITS.has(item.unit.toLowerCase());

  if (isHourly) {
    const m = new RegExp(`${num}\\s*(?:${HOUR_WORDS})\\b`, "i").exec(text);
    return m ? Number(m[1]) : null;
  }

  const words = [...item.keywords, ...nameWords(item)].map((w) => escapeRegExp(w.toLowerCase()));
  if (!COUNT_UNITS.has(item.unit.toLowerCase())) words.unshift(escapeRegExp(item.unit.toLowerCase()));
  if (words.length === 0) return null;
  // number, an optional filler word ("6 new outlets", "250 ft of romex"), then the unit/keyword
  const m = new RegExp(
    `${num}\\s*(?:(?:of|new|more|extra|additional|x)\\s+)?(?:${words.join("|")})(?:s|es)?\\b`,
    "i"
  ).exec(text);
  return m ? Number(m[1]) : null;
}

function defaultQuantity(item: PricebookItem): number {
  return HOUR_UNITS.has(item.unit.toLowerCase()) ? 4 : 1;
}

/** Deterministic draft used when no LLM key is configured or the AI call fails. */
export function mockDraftFromPricebook(req: DraftRequest): DraftResult {
  const text = req.description.toLowerCase();
  const ranked = req.pricebook
    .map((item) => ({ item, score: scoreItem(item, text) }))
    .filter((r) => r.score > 0)
    // Prefer the job's trade when scores tie.
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.item.trade === req.trade) - Number(a.item.trade === req.trade)
    );

  const picked: PricebookItem[] = [];
  // Lead with the trade's labor line when the trade has one.
  const tradeLabor =
    ranked.find((r) => r.item.category === "labor" && r.item.trade === req.trade)?.item ??
    req.pricebook.find((p) => p.category === "labor" && p.trade === req.trade);
  if (tradeLabor) picked.push(tradeLabor);
  for (const { item } of ranked) {
    if (picked.length >= MAX_LINES) break;
    if (picked.some((p) => p.id === item.id)) continue;
    // Skip other trades' labor unless the description clearly names it.
    if (item.category === "labor" && item.trade !== req.trade && scoreItem(item, text) < 4) continue;
    picked.push(item);
  }

  let guessed = 0;
  const lineItems: LineItem[] = picked.map((item) => {
    const found = inferQuantity(text, item);
    if (found === null) guessed++;
    return {
      id: uuid(),
      pricebookItemId: item.id,
      description: item.name,
      category: item.category,
      quantity: found ?? defaultQuantity(item),
      unit: item.unit,
      unitCost: item.unitCost,
      markupPercent: req.markupPercent,
    };
  });

  return {
    lineItems,
    sections: [],
    source: "mock",
    summary:
      lineItems.length === 0
        ? "Nothing in your pricebook matched that description. Try naming materials or the type of work."
        : `Drafted ${lineItems.length} line${lineItems.length === 1 ? "" : "s"} from your pricebook.` +
          (guessed ? ` ${guessed} quantit${guessed === 1 ? "y was" : "ies were"} guessed — check before sending.` : ""),
  };
}

type AiItem = {
  section?: unknown;
  pricebookItemId?: string | null;
  description?: unknown;
  category?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitCost?: unknown;
};

/**
 * Turn the model's JSON into safe line items and sections.
 * Pricebook prices win over the model's.
 */
export function linesFromAi(items: AiItem[], req: DraftRequest): { lineItems: LineItem[]; sections: EstimateSection[] } {
  const sections: EstimateSection[] = [];
  const sectionFor = (raw: unknown): string | undefined => {
    const name = typeof raw === "string" ? raw.trim().slice(0, 80) : "";
    if (!name) return undefined;
    const found = sections.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (found) return found.id;
    if (sections.length >= 12) return undefined;
    const section = { id: uuid(), name };
    sections.push(section);
    return section.id;
  };
  const lineItems = items
    .slice(0, 25)
    .map((raw): LineItem | null => {
      const match = raw.pricebookItemId
        ? req.pricebook.find((p) => p.id === raw.pricebookItemId)
        : undefined;
      const description = String(raw.description ?? match?.name ?? "").trim().slice(0, 200);
      if (!description) return null;
      const category = CATEGORIES.includes(raw.category as LineCategory)
        ? (raw.category as LineCategory)
        : match?.category ?? "other";
      const quantity = Math.min(100000, Math.max(0, Number(raw.quantity) || 1));
      const unitCost = match
        ? match.unitCost
        : Math.min(1000000, Math.max(0, Number(raw.unitCost) || 0));
      return {
        id: uuid(),
        pricebookItemId: match?.id,
        description,
        category,
        quantity,
        unit: match?.unit ?? (String(raw.unit ?? "ea").slice(0, 12) || "ea"),
        unitCost,
        markupPercent: req.markupPercent,
        sectionId: sectionFor(raw.section),
      };
    })
    .filter((x): x is LineItem => x !== null);
  // Keep only sections that ended up with lines.
  const used = new Set(lineItems.map((l) => l.sectionId));
  return { lineItems, sections: sections.filter((x) => used.has(x.id)) };
}

/**
 * Draft with OpenAI. Returns null when no key is configured or anything goes
 * wrong (timeout, bad JSON, empty answer) so the caller can fall back.
 */
export async function draftWithOpenAI(req: DraftRequest): Promise<DraftResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const catalog = req.pricebook.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      trade: p.trade,
      unit: p.unit,
      unitCost: p.unitCost,
    }));

    const prompt = `You are an estimating assistant for a residential contractor.
Given a job description and the contractor's pricebook, return JSON only:
{"summary":"one short sentence","items":[{"section":"string","pricebookItemId":"id or null","description":"string","category":"labor|material|equipment|other","quantity":number,"unit":"string","unitCost":number}]}
Rules: group lines into 2-6 sections named by phase of work as a contractor would list them for a homeowner (e.g. "Demo & haul-away", "Framing", "Finish"); a small job may use one section. Use pricebook items wherever one fits (set pricebookItemId). Only invent a line when nothing in the pricebook fits, with a realistic cost. Use quantities stated in the description; otherwise estimate sensibly. Do not add other trades' labor unless the job needs it. Main trade: ${req.trade}.
Job description: ${req.description}
Pricebook: ${JSON.stringify(catalog)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI draft failed", response.status, await response.text().catch(() => ""));
      return null;
    }
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { summary?: unknown; items?: unknown };
    const items = Array.isArray(parsed.items) ? (parsed.items as AiItem[]) : [];
    const { lineItems, sections } = linesFromAi(items, req);
    if (lineItems.length === 0) return null;

    return {
      lineItems,
      sections,
      source: "openai",
      summary:
        (typeof parsed.summary === "string" && parsed.summary.slice(0, 300)) ||
        "AI draft ready for review.",
    };
  } catch (error) {
    console.error("OpenAI draft error", error);
    return null;
  }
}
