import { NextResponse } from "next/server";
import { draftWithOpenAI, mockDraftFromPricebook } from "@/lib/ai-draft";
import type { PricebookItem, Trade } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const description = String(body.description || "").trim();
    const trade = (body.trade || "general") as Trade;
    const markupPercent = Number(body.markupPercent ?? 20);
    const pricebook = (body.pricebook || []) as PricebookItem[];

    if (!description) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 }
      );
    }

    const openai = await draftWithOpenAI({
      description,
      trade,
      markupPercent,
      pricebook,
    });

    if (openai) {
      return NextResponse.json(openai);
    }

    const mock = mockDraftFromPricebook({
      description,
      trade,
      markupPercent,
      pricebook,
    });
    return NextResponse.json(mock);
  } catch {
    return NextResponse.json(
      { error: "Could not draft estimate." },
      { status: 500 }
    );
  }
}
