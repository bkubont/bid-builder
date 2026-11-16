import { describe, expect, it } from "vitest";
import { inferQuantity, linesFromAi, mockDraftFromPricebook, scoreItem } from "../ai-draft";
import { SEED_PRICEBOOK } from "../seed";
import type { PricebookItem } from "../types";

const pb = (id: string) => SEED_PRICEBOOK.find((p) => p.id === id)!;
const draft = (description: string, trade: PricebookItem["trade"]) =>
  mockDraftFromPricebook({ description, trade, markupPercent: 20, pricebook: SEED_PRICEBOOK });
const qtyOf = (r: ReturnType<typeof draft>, id: string) =>
  r.lineItems.find((l) => l.pricebookItemId === id)?.quantity;

describe("local draft", () => {
  const faucetJob = "Replace kitchen faucet, add disposal, ~3 hours plumbing, haul old fixtures.";

  it("puts the stated hours on labor only", () => {
    const r = draft(faucetJob, "plumbing");
    expect(qtyOf(r, "pb-plumb-labor")).toBe(3);
    expect(qtyOf(r, "pb-faucet")).toBe(1);
    expect(qtyOf(r, "pb-disposal")).toBe(1);
  });

  it("does not match keywords inside other words ('ac' in 'replace')", () => {
    expect(scoreItem(pb("pb-hvac-labor"), faucetJob.toLowerCase())).toBe(0);
    const r = draft(faucetJob, "plumbing");
    expect(r.lineItems.some((l) => l.pricebookItemId === "pb-hvac-labor")).toBe(false);
  });

  it("reads quantities written next to units or items", () => {
    const text = "add 6 new outlets, run 250 ft of romex, 8 recessed lights, 10 hours";
    expect(inferQuantity(text, pb("pb-outlet"))).toBe(6);
    expect(inferQuantity(text, pb("pb-romex"))).toBe(250);
    expect(inferQuantity(text, pb("pb-can-light"))).toBe(8);
    expect(inferQuantity(text, pb("pb-elec-labor"))).toBe(10);
  });

  it("does not crash on pricebook text with regex characters", () => {
    const weird: PricebookItem = {
      id: "w",
      name: "Pipe (1/2) [PVC]+",
      category: "material",
      trade: "plumbing",
      unit: "ft (pvc",
      unitCost: 2,
      keywords: ["c++", "(pipe"],
    };
    expect(() =>
      mockDraftFromPricebook({
        description: "12 ft (pvc of pipe",
        trade: "plumbing",
        markupPercent: 20,
        pricebook: [weird],
      })
    ).not.toThrow();
  });

  it("explains when nothing matches", () => {
    const r = mockDraftFromPricebook({
      description: "xyz",
      trade: "general",
      markupPercent: 20,
      pricebook: [],
    });
    expect(r.lineItems).toHaveLength(0);
    expect(r.summary).toMatch(/Nothing in your pricebook/);
  });
});

describe("AI response cleanup", () => {
  const req = { description: "", trade: "plumbing" as const, markupPercent: 25, pricebook: SEED_PRICEBOOK };

  it("uses pricebook prices instead of the model's", () => {
    const [line] = linesFromAi(
      [{ pricebookItemId: "pb-faucet", description: "Faucet", category: "material", quantity: 1, unitCost: 9999 }],
      req
    );
    expect(line.unitCost).toBe(185);
    expect(line.markupPercent).toBe(25);
  });

  it("drops junk and fixes bad fields", () => {
    const lines = linesFromAi(
      [
        { description: "" },
        { description: "Mystery", category: "weird", quantity: -5, unitCost: "abc" },
      ],
      req
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ category: "other", quantity: 0, unitCost: 0, unit: "ea" });
  });
});
