import { describe, expect, it } from "vitest";
import { layoutLanes, resizedMinutes, visibleHourRange } from "../schedule";
import { initials, personColor, personName } from "../team";

const at = (h: number, m = 0) => new Date(2026, 10, 20, h, m).toISOString();

describe("side-by-side layout", () => {
  it("gives a lone block the full width", () => {
    const [p] = layoutLanes([{ start: at(9), durationMinutes: 60 }]);
    expect([p.lane, p.lanes]).toEqual([0, 1]);
  });

  it("puts overlapping blocks next to each other and reuses freed lanes", () => {
    const a = { id: "a", start: at(9), durationMinutes: 120 }; // 9-11
    const b = { id: "b", start: at(10), durationMinutes: 60 }; // 10-11 overlaps a
    const c = { id: "c", start: at(11), durationMinutes: 60 }; // 11-12 after both: new cluster
    const out = Object.fromEntries(layoutLanes([c, b, a]).map((p) => [p.item.id, [p.lane, p.lanes]]));
    expect(out).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it("chains: a long block keeps a cluster open", () => {
    const long = { id: "l", start: at(8), durationMinutes: 480 }; // 8-16
    const x = { id: "x", start: at(9), durationMinutes: 60 };
    const y = { id: "y", start: at(13), durationMinutes: 60 }; // reuses x's lane
    const out = Object.fromEntries(layoutLanes([long, x, y]).map((p) => [p.item.id, [p.lane, p.lanes]]));
    expect(out).toEqual({ l: [0, 2], x: [1, 2], y: [1, 2] });
  });
});

describe("resizing", () => {
  it("snaps to 15 minutes and never goes below 15", () => {
    expect(resizedMinutes(60, 16, 64)).toBe(75); // one quarter-hour = 16px
    expect(resizedMinutes(60, 23, 64)).toBe(75);
    expect(resizedMinutes(60, -200, 64)).toBe(15);
    expect(resizedMinutes(60, 64 * 30, 64, 24 * 60)).toBe(24 * 60);
  });

  it("doesn't shrink a long block when nudged", () => {
    expect(resizedMinutes(2000, 16, 64)).toBe(2015);
  });
});

describe("visible hours", () => {
  const day = new Date(2026, 10, 20);
  it("is 6am–8pm by default", () => {
    expect(visibleHourRange([], [day])).toEqual({ startHour: 6, endHour: 20 });
  });
  it("stretches to show early and late blocks instead of hiding them", () => {
    const early = { start: new Date(2026, 10, 20, 5, 15).toISOString(), durationMinutes: 60 };
    const late = { start: new Date(2026, 10, 20, 20, 30).toISOString(), durationMinutes: 90 };
    expect(visibleHourRange([early, late], [day])).toEqual({ startHour: 5, endHour: 22 });
  });
  it("ignores blocks on other days and caps at midnight", () => {
    const otherDay = { start: new Date(2026, 10, 21, 2, 0).toISOString(), durationMinutes: 60 };
    const allNight = { start: new Date(2026, 10, 20, 22, 0).toISOString(), durationMinutes: 600 };
    expect(visibleHourRange([otherDay, allNight], [day])).toEqual({ startHour: 6, endHour: 24 });
  });
});

describe("people", () => {
  const team = [
    { id: "u1", name: "Brit Test", role: "owner" as const },
    { id: "u2", name: "Field", role: "member" as const },
  ];
  it("names, initials and colors", () => {
    expect(personName("u2", team)).toBe("Field");
    expect(personName(null, team)).toBe("Unassigned");
    expect(personName("gone", team)).toBe("Former team member");
    expect(initials("Brit Test")).toBe("BT");
    expect(initials("Field")).toBe("F");
    expect(personColor("u1", team)).not.toBe(personColor("u2", team));
    expect(personColor(null, team)).toBe(personColor("gone", team));
  });
});
