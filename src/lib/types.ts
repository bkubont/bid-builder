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

export function lineTotal(item: LineItem): number {
  const base = item.quantity * item.unitCost;
  return base * (1 + (item.markupPercent || 0) / 100);
}

export function subtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function taxAmount(items: LineItem[], taxPercent: number): number {
  return subtotal(items) * ((taxPercent || 0) / 100);
}

export function grandTotal(items: LineItem[], taxPercent: number): number {
  return subtotal(items) + taxAmount(items, taxPercent);
}
