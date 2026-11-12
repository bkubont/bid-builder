import type { LineCategory, LineItem, PricebookItem, Trade } from "./types";
import { v4 as uuid } from "uuid";

export type DraftRequest = {
  description: string;
  trade: Trade;
  markupPercent: number;
  pricebook: PricebookItem[];
};

function scoreItem(item: PricebookItem, text: string, trade: Trade): number {
  let score = 0;
  if (item.trade === trade) score += 3;
  for (const keyword of item.keywords) {
    if (text.includes(keyword.toLowerCase())) score += 4;
  }
  if (text.includes(item.name.toLowerCase().split(" ")[0] || "")) score += 1;
  return score;
}

function inferQuantity(text: string, item: PricebookItem): number {
  const patterns = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${item.unit}|${item.keywords.join("|")})`, "i"),
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|sq|squares?|gallons?|gal|feet|ft|yards?|yd)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  if (item.category === "labor") return 4;
  if (item.category === "equipment") return 1;
  return 1;
}

/** Deterministic draft used when no LLM key is configured. */
export function mockDraftFromPricebook(req: DraftRequest): {
  lineItems: LineItem[];
  source: "mock";
  summary: string;
} {
  const text = req.description.toLowerCase();
  const ranked = req.pricebook
    .map((item) => ({ item, score: scoreItem(item, text, req.trade) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked = ranked.slice(0, 6).map(({ item }) => item);

  // Always include a labor line for the selected trade when possible.
  const labor =
    picked.find((p) => p.category === "labor" && p.trade === req.trade) ||
    req.pricebook.find((p) => p.category === "labor" && p.trade === req.trade);

  const materials = picked.filter((p) => p.id !== labor?.id);
  const items = [labor, ...materials].filter(Boolean) as PricebookItem[];

  if (items.length === 0) {
    items.push(
      ...req.pricebook.filter((p) => p.trade === req.trade).slice(0, 3)
    );
  }

  const lineItems: LineItem[] = items.map((item) => ({
    id: uuid(),
    pricebookItemId: item.id,
    description: item.name,
    category: item.category as LineCategory,
    quantity: inferQuantity(req.description, item),
    unit: item.unit,
    unitCost: item.unitCost,
    markupPercent: req.markupPercent,
  }));

  return {
    lineItems,
    source: "mock",
    summary:
      "Drafted from your pricebook using keywords in the job description. Review quantities before sending.",
  };
}

export async function draftWithOpenAI(req: DraftRequest): Promise<{
  lineItems: LineItem[];
  source: "openai";
  summary: string;
} | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const catalog = req.pricebook.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    trade: p.trade,
    unit: p.unit,
    unitCost: p.unitCost,
  }));

  const prompt = `You are an estimating assistant for contractors.
Given a job description and a pricebook, return JSON only:
{"summary":"short note","items":[{"pricebookItemId":"id or null","description":"string","category":"labor|material|equipment|other","quantity":number,"unit":"string","unitCost":number}]}
Prefer pricebook items. Invent only missing lines with realistic costs. Trade focus: ${req.trade}.
Job: ${req.description}
Pricebook: ${JSON.stringify(catalog)}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) return null;
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content) as {
    summary?: string;
    items?: Array<{
      pricebookItemId?: string | null;
      description: string;
      category: LineCategory;
      quantity: number;
      unit: string;
      unitCost: number;
    }>;
  };

  const lineItems: LineItem[] = (parsed.items || []).map((item) => ({
    id: uuid(),
    pricebookItemId: item.pricebookItemId || undefined,
    description: item.description,
    category: item.category,
    quantity: Number(item.quantity) || 1,
    unit: item.unit || "ea",
    unitCost: Number(item.unitCost) || 0,
    markupPercent: req.markupPercent,
  }));

  if (lineItems.length === 0) return null;

  return {
    lineItems,
    source: "openai",
    summary: parsed.summary || "AI draft ready for review.",
  };
}
