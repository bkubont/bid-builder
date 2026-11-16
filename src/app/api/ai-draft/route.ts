import { NextResponse } from "next/server";
import { draftWithOpenAI, mockDraftFromPricebook } from "@/lib/ai-draft";
import type { LineCategory, PricebookItem, Trade } from "@/lib/types";
import { TRADES } from "@/lib/trades";

// Phase 2 adds login + per-account limits. Until then, cap what one request
// can send so a stranger can't run up a large OpenAI bill in one call.
const MAX_DESCRIPTION = 2000;
const MAX_PRICEBOOK = 400;
const CATEGORIES: LineCategory[] = ["labor", "material", "equipment", "other"];

function cleanPricebook(raw: unknown): PricebookItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_PRICEBOOK).flatMap((p): PricebookItem[] => {
    if (!p || typeof p !== "object") return [];
    const item = p as Record<string, unknown>;
    const name = String(item.name ?? "").slice(0, 120);
    if (!item.id || !name) return [];
    return [
      {
        id: String(item.id).slice(0, 64),
        name,
        category: CATEGORIES.includes(item.category as LineCategory)
          ? (item.category as LineCategory)
          : "other",
        trade: TRADES.some((t) => t.value === item.trade) ? (item.trade as Trade) : "general",
        unit: String(item.unit ?? "ea").slice(0, 12) || "ea",
        unitCost: Math.max(0, Number(item.unitCost) || 0),
        keywords: Array.isArray(item.keywords)
          ? item.keywords.slice(0, 20).map((k) => String(k).slice(0, 40).toLowerCase())
          : [],
      },
    ];
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const description = String(body.description || "").trim().slice(0, MAX_DESCRIPTION);
  if (!description) {
    return NextResponse.json({ error: "Job description is required." }, { status: 400 });
  }
  const trade: Trade = TRADES.some((t) => t.value === body.trade)
    ? (body.trade as Trade)
    : "general";
  const markupPercent = Math.min(500, Math.max(0, Number(body.markupPercent ?? 20) || 0));
  const req = { description, trade, markupPercent, pricebook: cleanPricebook(body.pricebook) };

  try {
    const ai = await draftWithOpenAI(req);
    if (ai) return NextResponse.json(ai);

    const local = mockDraftFromPricebook(req);
    if (process.env.OPENAI_API_KEY) {
      local.summary = `AI was unavailable, so this is a local draft. ${local.summary}`;
    }
    return NextResponse.json(local);
  } catch (error) {
    console.error("Draft failed", error);
    return NextResponse.json({ error: "Could not draft estimate." }, { status: 500 });
  }
}
