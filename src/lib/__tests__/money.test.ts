import { describe, expect, it } from "vitest";
import {
  grandTotal,
  lineCost,
  lineTotal,
  subtotal,
  taxAmount,
  unitPrice,
  type LineItem,
} from "../types";

const line = (p: Partial<LineItem>): LineItem => ({
  id: "x",
  description: "",
  category: "material",
  quantity: 1,
  unit: "ea",
  unitCost: 0,
  markupPercent: 0,
  ...p,
});

describe("money math", () => {
  it("prices a line as qty x (cost + markup)", () => {
    const l = line({ quantity: 3, unitCost: 110, markupPercent: 20 });
    expect(unitPrice(l)).toBe(132);
    expect(lineTotal(l)).toBe(396);
    expect(lineCost(l)).toBe(330);
  });

  it("rounds the unit price to cents so qty x price always equals the total", () => {
    const l = line({ quantity: 7, unitCost: 0.85, markupPercent: 17 });
    // 0.85 * 1.17 = 0.9945 -> $0.99 each
    expect(unitPrice(l)).toBe(0.99);
    expect(lineTotal(l)).toBe(6.93);
  });

  it("avoids floating point drift", () => {
    const items = [line({ unitCost: 0.1 }), line({ unitCost: 0.2 })];
    expect(subtotal(items)).toBe(0.3);
  });

  it("taxes the subtotal and rounds to cents", () => {
    const items = [
      line({ quantity: 3, unitCost: 110, markupPercent: 20 }),
      line({ quantity: 1, unitCost: 185, markupPercent: 20 }),
    ];
    expect(subtotal(items)).toBe(618);
    expect(taxAmount(items, 6)).toBe(37.08);
    expect(grandTotal(items, 6)).toBe(655.08);
  });

  it("treats blank or bad numbers as zero instead of NaN", () => {
    const l = line({ quantity: Number("") as number, unitCost: NaN });
    expect(lineTotal(l)).toBe(0);
    expect(grandTotal([l], NaN)).toBe(0);
  });
});

import { describeTaxable, documentTotals, groupBySection } from "../types";

describe("tax by category", () => {
  const items = [
    line({ category: "labor", quantity: 10, unitCost: 100, markupPercent: 0 }), // 1000
    line({ category: "material", quantity: 1, unitCost: 500, markupPercent: 20 }), // 600
    line({ category: "equipment", quantity: 1, unitCost: 200, markupPercent: 0 }), // 200
  ];

  it("taxes only materials when set to materials", () => {
    const t = documentTotals({ lineItems: items, taxPercent: 6, taxableCategories: ["material"] });
    expect(t.subtotal).toBe(1800);
    expect(t.taxableSubtotal).toBe(600);
    expect(t.tax).toBe(36);
    expect(t.total).toBe(1836);
  });

  it("taxes every line on older documents with no setting (null)", () => {
    const t = documentTotals({ lineItems: items, taxPercent: 6, taxableCategories: null });
    expect(t.tax).toBe(108);
  });

  it("taxes nothing when no categories are taxable", () => {
    expect(documentTotals({ lineItems: items, taxPercent: 6, taxableCategories: [] }).tax).toBe(0);
  });

  it("describes the tax rule in words", () => {
    expect(describeTaxable(["material"])).toBe("materials");
    expect(describeTaxable(["labor", "material"])).toBe("labor and materials");
    expect(describeTaxable(null)).toBe("all lines");
  });
});

describe("deposits", () => {
  it("subtracts a deposit already billed from the balance due", () => {
    const items = [line({ quantity: 1, unitCost: 1000, markupPercent: 0, category: "material" })];
    const t = documentTotals({ lineItems: items, taxPercent: 6, taxableCategories: ["material"], depositApplied: 530 });
    expect(t.total).toBe(1060);
    expect(t.balanceDue).toBe(530);
  });

  it("ignores a negative or missing deposit", () => {
    const items = [line({ quantity: 1, unitCost: 100 })];
    expect(documentTotals({ lineItems: items, taxPercent: 0, depositApplied: -50 }).balanceDue).toBe(100);
  });
});

describe("sections", () => {
  const a = line({ id: "a", sectionId: "s1", quantity: 1, unitCost: 100 });
  const b = line({ id: "b", sectionId: "s2", quantity: 2, unitCost: 50 });
  const c = line({ id: "c", quantity: 1, unitCost: 25 }); // no section
  const d = line({ id: "d", sectionId: "deleted", quantity: 1, unitCost: 5 }); // section removed

  it("groups lines in section order with section totals", () => {
    const groups = groupBySection([a, b, c, d], [{ id: "s2", name: "Framing" }, { id: "s1", name: "Demo" }]);
    expect(groups.map((g) => [g.name, g.total])).toEqual([
      ["Framing", 100],
      ["Demo", 100],
      ["Other work", 30],
    ]);
  });

  it("falls back to category groups for customer estimates without sections", () => {
    const labor = line({ category: "labor", quantity: 2, unitCost: 50 });
    const mat = line({ category: "material", quantity: 1, unitCost: 10 });
    const groups = groupBySection([mat, labor], [], { fallbackToCategories: true });
    expect(groups.map((g) => [g.name, g.total])).toEqual([
      ["Labor", 100],
      ["Materials", 10],
    ]);
  });

  it("section totals add up to the subtotal", () => {
    const groups = groupBySection([a, b, c, d], [{ id: "s1", name: "Demo" }, { id: "s2", name: "Framing" }]);
    const sum = groups.reduce((s, g) => s + g.total, 0);
    expect(sum).toBe(documentTotals({ lineItems: [a, b, c, d], taxPercent: 0 }).subtotal);
  });
});
