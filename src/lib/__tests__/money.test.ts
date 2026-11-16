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
