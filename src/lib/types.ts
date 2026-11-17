export type LineCategory = "labor" | "material" | "equipment" | "other";

export type Trade =
  | "general"
  | "carpentry"
  | "electrical"
  | "plumbing"
  | "hvac"
  | "roofing"
  | "painting"
  | "concrete";

export type EstimateStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "converted";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  licenseNumber: string;
  defaultMarkup: number;
  defaultTax: number;
  terms: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface PricebookItem {
  id: string;
  name: string;
  category: LineCategory;
  trade: Trade;
  unit: string;
  unitCost: number;
  keywords: string[];
}

export interface LineItem {
  id: string;
  pricebookItemId?: string;
  description: string;
  category: LineCategory;
  quantity: number;
  unit: string;
  unitCost: number;
  markupPercent: number;
}

/** validUntil / dueDate are local calendar dates: "YYYY-MM-DD". */
export interface Estimate {
  id: string;
  number: string;
  customerId: string;
  jobTitle: string;
  jobAddress: string;
  trade: Trade;
  status: EstimateStatus;
  lineItems: LineItem[];
  taxPercent: number;
  notes: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  estimateId?: string;
  customerId: string;
  jobTitle: string;
  jobAddress: string;
  status: InvoiceStatus;
  lineItems: LineItem[];
  taxPercent: number;
  notes: string;
  dueDate: string;
  createdAt: string;
  paidAt?: string;
}

/** Timeblock on the schedule. Empty/missing lineItemIds = whole job. */
export interface ScheduleBlock {
  id: string;
  estimateId: string;
  lineItemIds?: string[];
  title: string;
  start: string;
  durationMinutes: number;
}

export interface AppData {
  company: CompanySettings;
  customers: Customer[];
  pricebook: PricebookItem[];
  estimates: Estimate[];
  invoices: Invoice[];
  scheduleBlocks: ScheduleBlock[];
  counters: {
    estimate: number;
    invoice: number;
  };
}

/** Round to whole cents so every displayed number adds up exactly. */
export function roundCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Price per unit the customer pays (cost + markup), rounded to cents.
 * Customer-facing documents show this instead of cost and markup.
 */
export function unitPrice(item: LineItem): number {
  return roundCents((Number(item.unitCost) || 0) * (1 + (Number(item.markupPercent) || 0) / 100));
}

/** Line total = quantity x customer unit price, so "qty x price = total" always checks out. */
export function lineTotal(item: LineItem): number {
  return roundCents((Number(item.quantity) || 0) * unitPrice(item));
}

/** What the line costs you before markup. */
export function lineCost(item: LineItem): number {
  return roundCents((Number(item.quantity) || 0) * (Number(item.unitCost) || 0));
}

export function subtotal(items: LineItem[]): number {
  return roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0));
}

export function taxAmount(items: LineItem[], taxPercent: number): number {
  return roundCents(subtotal(items) * ((Number(taxPercent) || 0) / 100));
}

export function grandTotal(items: LineItem[], taxPercent: number): number {
  return roundCents(subtotal(items) + taxAmount(items, taxPercent));
}

/** The signed-in person, as the browser sees them. */
export interface MeInfo {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  companyName: string;
}
