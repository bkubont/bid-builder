import type { Estimate, LineItem, ScheduleBlock } from "./types";

const HOUR_UNITS = new Set(["hr", "hrs", "hour", "hours", "h"]);

export function lineHours(item: LineItem): number {
  if (!HOUR_UNITS.has(item.unit.toLowerCase())) return 0;
  return Math.max(0, Number(item.quantity) || 0);
}

export function estimateLaborHours(estimate: Estimate): number {
  const hours = estimate.lineItems
    .filter((li) => li.category === "labor")
    .reduce((sum, li) => sum + lineHours(li), 0);
  return hours > 0 ? hours : 1;
}

export function selectionHours(
  estimate: Estimate,
  lineItemIds?: string[]
): number {
  if (!lineItemIds || lineItemIds.length === 0) {
    return estimateLaborHours(estimate);
  }
  const selected = estimate.lineItems.filter((li) => lineItemIds.includes(li.id));
  const hours = selected.reduce((sum, li) => {
    const h = lineHours(li);
    return sum + (h > 0 ? h : li.category === "labor" ? Number(li.quantity) || 1 : 0);
  }, 0);
  return hours > 0 ? hours : 1;
}

export function hoursToMinutes(hours: number): number {
  return Math.max(15, Math.round(hours * 60));
}

export function blockEndIso(startIso: string, durationMinutes: number): string {
  return new Date(new Date(startIso).getTime() + durationMinutes * 60000).toISOString();
}

export function snapToQuarterHour(date: Date): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const snapped = Math.round(minutes / 15) * 15;
  d.setMinutes(snapped % 60, 0, 0);
  if (snapped === 60) d.setHours(d.getHours() + 1);
  return d;
}

export type DragPayload =
  | {
      kind: "job";
      estimateId: string;
    }
  | {
      kind: "line";
      estimateId: string;
      lineItemId: string;
    }
  | {
      kind: "block";
      blockId: string;
    };

export function blockTitle(
  estimate: Estimate,
  lineItemIds?: string[]
): string {
  if (!lineItemIds || lineItemIds.length === 0) return estimate.jobTitle;
  const lines = estimate.lineItems.filter((li) => lineItemIds.includes(li.id));
  if (lines.length === 1) return `${estimate.jobTitle}: ${lines[0].description}`;
  return `${estimate.jobTitle} (${lines.length} lines)`;
}

export function overlaps(
  aStart: string,
  aMinutes: number,
  bStart: string,
  bMinutes: number
): boolean {
  const a0 = +new Date(aStart);
  const a1 = a0 + aMinutes * 60000;
  const b0 = +new Date(bStart);
  const b1 = b0 + bMinutes * 60000;
  return a0 < b1 && b0 < a1;
}

export function scheduledLineIds(
  blocks: ScheduleBlock[],
  estimateId: string
): Set<string> {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.estimateId !== estimateId) continue;
    if (!block.lineItemIds || block.lineItemIds.length === 0) {
      ids.add("__whole__");
    } else {
      block.lineItemIds.forEach((id) => ids.add(id));
    }
  }
  return ids;
}

export type Placed<T> = { item: T; lane: number; lanes: number };

/**
 * Side-by-side layout for one day: blocks that overlap in time share the
 * width (two people on two jobs at 9am sit next to each other).
 */
export function layoutLanes<T extends { start: string; durationMinutes: number }>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -Infinity;
  let laneEnds: number[] = [];
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach((p) => out.push({ ...p, lanes }));
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    const start = +new Date(item.start);
    const end = start + item.durationMinutes * 60000;
    if (start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ item, lane, lanes: 0 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}

/** Duration after dragging a block's bottom edge by `pixels`, snapped to 15 minutes. */
export function resizedMinutes(startMinutes: number, pixels: number, hourHeight: number, maxMinutes = 24 * 60): number {
  const deltaQuarters = Math.round(pixels / (hourHeight / 4));
  return Math.min(maxMinutes, Math.max(15, startMinutes + deltaQuarters * 15));
}
