import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a stored date. "YYYY-MM-DD" is a calendar date and is read in local
 * time (new Date("2026-12-20") would be UTC midnight and show as Dec 19 in
 * the US). Full ISO timestamps are parsed normally.
 */
export function parseDate(value: string): Date {
  const m = DATE_ONLY.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Local calendar date as "YYYY-MM-DD" (for <input type="date"> and storage). */
export function toDateOnly(value: Date | string): string {
  const date = typeof value === "string" ? parseDate(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's local date plus N days, as "YYYY-MM-DD". */
export function dateOnlyFromToday(days: number, now: Date = new Date()): string {
  return toDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

/** True when a stored "YYYY-MM-DD" date is before today. */
export function isPastDate(value: string, now: Date = new Date()): boolean {
  if (!value) return false;
  return toDateOnly(value) < toDateOnly(now);
}
