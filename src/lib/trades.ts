import type { EstimateStatus, InvoiceStatus, LineCategory, Trade } from "./types";

export const TRADES: { value: Trade; label: string }[] = [
  { value: "general", label: "General" },
  { value: "carpentry", label: "Carpentry" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "roofing", label: "Roofing" },
  { value: "painting", label: "Painting" },
  { value: "concrete", label: "Concrete" },
];

export const CATEGORIES: { value: LineCategory; label: string }[] = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  converted: "Converted",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

export function tradeLabel(value: string | null | undefined): string {
  return TRADES.find((t) => t.value === value)?.label ?? "";
}

export function categoryLabel(value: string | null | undefined): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "";
}
