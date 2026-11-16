import { describe, expect, it } from "vitest";
import { dateOnlyFromToday, formatDate, isPastDate, toDateOnly } from "../utils";

describe("dates (America/Detroit)", () => {
  it("shows a picked calendar date as that same day (no off-by-one)", () => {
    expect(formatDate("2026-12-20")).toBe("Dec 20, 2026");
  });

  it("still formats full timestamps", () => {
    expect(formatDate("2026-12-20T17:00:00.000Z")).toBe("Dec 20, 2026");
  });

  it("converts old UTC-midnight values to the date they were meant to be", () => {
    // Late evening local time is the next day in UTC; keep the local day.
    expect(toDateOnly(new Date(2026, 11, 20, 23, 30))).toBe("2026-12-20");
  });

  it("adds days in local time", () => {
    expect(dateOnlyFromToday(14, new Date(2026, 10, 16, 22, 0))).toBe("2026-11-30");
  });

  it("knows when a due date has passed", () => {
    const now = new Date(2026, 10, 16, 9);
    expect(isPastDate("2026-11-15", now)).toBe(true);
    expect(isPastDate("2026-11-16", now)).toBe(false);
  });

  it("returns a dash for empty or invalid dates", () => {
    expect(formatDate("")).toBe("—");
    expect(formatDate("nope")).toBe("—");
  });
});
