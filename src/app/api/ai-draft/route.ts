import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { draftWithOpenAI, mockDraftFromPricebook } from "@/lib/ai-draft";
import type { Trade } from "@/lib/types";
import { TRADES } from "@/lib/trades";
import { toDateOnly } from "@/lib/utils";
import { listPricebook, takeAiDraft } from "@/server/data";
import { getMe } from "@/server/session";

const MAX_DESCRIPTION = 2000;

export async function POST(request: Request) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Sign in to draft estimates." }, { status: 401 });

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
  const trade: Trade = TRADES.some((t) => t.value === body.trade) ? (body.trade as Trade) : "general";
  const markupPercent = Math.min(500, Math.max(0, Number(body.markupPercent ?? 20) || 0));

  try {
    // The pricebook comes from the database, not from the browser.
    const db = getDb();
    const req = { description, trade, markupPercent, pricebook: await listPricebook(db, me.companyId) };

    let limited = false;
    if (process.env.OPENAI_API_KEY) {
      const limit = Number(process.env.AI_DAILY_LIMIT || 50);
      const allowed = await takeAiDraft(db, me.companyId, toDateOnly(new Date()), limit);
      if (allowed) {
        const ai = await draftWithOpenAI(req);
        if (ai) return NextResponse.json(ai);
      } else {
        limited = true;
      }
    }

    const local = mockDraftFromPricebook(req);
    if (limited) {
      local.summary = `Today's AI draft limit is used up, so this is a local draft. ${local.summary}`;
    } else if (process.env.OPENAI_API_KEY) {
      local.summary = `AI was unavailable, so this is a local draft. ${local.summary}`;
    }
    return NextResponse.json(local);
  } catch (error) {
    console.error("Draft failed", error);
    return NextResponse.json({ error: "Could not draft estimate." }, { status: 500 });
  }
}
