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
  /** Which line categories sales tax applies to on new estimates. */
  taxableCategories: LineCategory[];
  /** Default deposit for "Request deposit", as a percent of the estimate total. */
  depositPercent: number;
}

/** A named group of lines on an estimate (e.g. "Demo", "Framing"). */
export interface EstimateSection {
  id: string;
  name: string;
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
  /** Section this line belongs to; none = "Other work". */
  sectionId?: string;
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
  sections: EstimateSection[];
  taxPercent: number;
  /** Categories taxed on this document; null = every line (documents made before this setting). */
  taxableCategories: LineCategory[] | null;
  notes: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceKind = "final" | "deposit";

export interface Invoice {
  id: string;
  number: string;
  /** "deposit" invoices bill a share up front; the "final" invoice subtracts it. */
  kind: InvoiceKind;
  estimateId?: string;
  customerId: string;
  jobTitle: string;
  jobAddress: string;
  status: InvoiceStatus;
  lineItems: LineItem[];
  sections: EstimateSection[];
  taxPercent: number;
  taxableCategories: LineCategory[] | null;
  /** Deposit already billed, subtracted from this invoice's total. */
  depositApplied: number;
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

export type Taxable = LineCategory[] | null | undefined;

/** Lines the tax applies to. null/undefined = all lines. */
export function taxableSubtotal(items: LineItem[], taxable: Taxable): number {
  if (!taxable) return subtotal(items);
  return subtotal(items.filter((item) => taxable.includes(item.category)));
}

export function taxAmount(items: LineItem[], taxPercent: number, taxable?: Taxable): number {
  return roundCents(taxableSubtotal(items, taxable) * ((Number(taxPercent) || 0) / 100));
}

export function grandTotal(items: LineItem[], taxPercent: number, taxable?: Taxable): number {
  return roundCents(subtotal(items) + taxAmount(items, taxPercent, taxable));
}

export type DocumentTotals = {
  subtotal: number;
  taxableSubtotal: number;
  tax: number;
  total: number;
  depositApplied: number;
  /** What's left to pay: total minus any deposit already billed. */
  balanceDue: number;
};

/** All the totals for an estimate or invoice, computed one consistent way. */
export function documentTotals(doc: {
  lineItems: LineItem[];
  taxPercent: number;
  taxableCategories?: Taxable;
  depositApplied?: number;
}): DocumentTotals {
  const sub = subtotal(doc.lineItems);
  const taxedBase = taxableSubtotal(doc.lineItems, doc.taxableCategories);
  const tax = roundCents(taxedBase * ((Number(doc.taxPercent) || 0) / 100));
  const total = roundCents(sub + tax);
  const deposit = roundCents(Math.max(0, Number(doc.depositApplied) || 0));
  return {
    subtotal: sub,
    taxableSubtotal: taxedBase,
    tax,
    total,
    depositApplied: deposit,
    balanceDue: roundCents(total - deposit),
  };
}

export type SectionGroup = { id: string; name: string; lines: LineItem[]; total: number };

const CATEGORY_SECTION_NAMES: Record<LineCategory, string> = {
  labor: "Labor",
  material: "Materials",
  equipment: "Equipment",
  other: "Other",
};

/**
 * Lines grouped for display, in section order. Lines without a (known)
 * section go in "Other work" at the end. With no sections at all, lines are
 * grouped by category so customer estimates still show sections, not lines.
 */
export function groupBySection(
  items: LineItem[],
  sections: EstimateSection[],
  options: { fallbackToCategories?: boolean } = {}
): SectionGroup[] {
  const make = (id: string, name: string, lines: LineItem[]): SectionGroup => ({
    id,
    name,
    lines,
    total: subtotal(lines),
  });
  if (sections.length === 0) {
    if (!options.fallbackToCategories) return items.length ? [make("", "", items)] : [];
    return (Object.keys(CATEGORY_SECTION_NAMES) as LineCategory[])
      .map((c) => make(`category:${c}`, CATEGORY_SECTION_NAMES[c], items.filter((i) => i.category === c)))
      .filter((g) => g.lines.length > 0);
  }
  const known = new Set(sections.map((s) => s.id));
  const groups = sections.map((s) => make(s.id, s.name.trim() || "Untitled section", items.filter((i) => i.sectionId === s.id)));
  const loose = items.filter((i) => !i.sectionId || !known.has(i.sectionId));
  if (loose.length) groups.push(make("", "Other work", loose));
  return groups;
}

/** e.g. "materials", "labor and materials", "all lines" — for "Tax (6% on …)". */
export function describeTaxable(taxable: Taxable): string {
  if (!taxable) return "all lines";
  if (taxable.length === 0) return "nothing";
  if (taxable.length === 4) return "all lines";
  const names = taxable.map((c) => CATEGORY_SECTION_NAMES[c].toLowerCase());
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The signed-in person, as the browser sees them. */
export interface MeInfo {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  companyName: string;
}
