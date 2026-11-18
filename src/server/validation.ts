/**
 * Input validation for everything the browser sends. Shapes only: ownership
 * checks (does this id belong to the caller's company?) live in data.ts.
 */
import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);
const id = z.string().min(1).max(64);
const finite = z.number().finite();

export const TRADE = z.enum([
  "general",
  "carpentry",
  "electrical",
  "plumbing",
  "hvac",
  "roofing",
  "painting",
  "concrete",
]);
export const CATEGORY = z.enum(["labor", "material", "equipment", "other"]);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const lineItemSchema = z.object({
  id,
  pricebookItemId: id.optional(),
  description: shortText(300),
  category: CATEGORY,
  quantity: finite.min(0).max(1_000_000),
  unit: shortText(16),
  unitCost: finite.min(0).max(10_000_000),
  markupPercent: finite.min(-100).max(1000),
  sectionId: id.optional(),
});

export const sectionSchema = z.object({ id, name: shortText(80) });

export const companySchema = z.object({
  name: shortText(160).min(1, "Company name is required"),
  email: shortText(254),
  phone: shortText(40),
  address: shortText(255),
  licenseNumber: shortText(80),
  defaultMarkup: finite.min(-100).max(1000),
  defaultTax: finite.min(0).max(100),
  terms: shortText(5000),
  taxableCategories: z.array(CATEGORY).max(4).transform((c) => [...new Set(c)]),
  depositPercent: finite.min(0).max(100),
});

export const customerSchema = z.object({
  id: id.optional(),
  name: shortText(160).min(1, "Name is required"),
  email: shortText(254),
  phone: shortText(40),
  address: shortText(255),
  notes: shortText(5000),
});

export const pricebookItemSchema = z.object({
  id: id.optional(),
  name: shortText(160).min(1, "Name is required"),
  category: CATEGORY,
  trade: TRADE,
  unit: shortText(16).min(1),
  unitCost: finite.min(0).max(10_000_000),
  keywords: z.array(shortText(40)).max(30),
});

export const estimateSchema = z.object({
  id: id.optional(),
  customerId: id,
  jobTitle: shortText(200).min(1, "Add a job title"),
  jobAddress: shortText(255),
  trade: TRADE,
  status: z.enum(["draft", "sent", "accepted", "declined", "converted"]),
  lineItems: z.array(lineItemSchema).max(300),
  sections: z.array(sectionSchema).max(50).default([]),
  taxPercent: finite.min(0).max(100),
  notes: shortText(5000),
  validUntil: dateOnly,
});

export const invoiceUpdateSchema = z.object({
  id,
  status: z.enum(["draft", "sent", "paid", "overdue"]),
  dueDate: dateOnly.optional(),
  notes: shortText(5000).optional(),
});

export const scheduleBlockSchema = z.object({
  id: id.optional(),
  estimateId: id,
  lineItemIds: z.array(id).max(300).optional(),
  title: shortText(255).min(1),
  start: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(24 * 60 * 7),
});

export const inviteSchema = z.object({
  email: z.email("Enter a valid email").max(254).transform((e) => e.trim().toLowerCase()),
  role: z.enum(["owner", "member"]),
});

export type CompanyInput = z.infer<typeof companySchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type PricebookItemInput = z.infer<typeof pricebookItemSchema>;
export type EstimateInput = z.infer<typeof estimateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type ScheduleBlockInput = z.infer<typeof scheduleBlockSchema>;

export const sendDocumentSchema = z.object({
  documentType: z.enum(["estimate", "invoice"]),
  documentId: id,
  to: z.email("Enter a valid email address").max(254),
  subject: shortText(200).min(1, "Add a subject"),
  message: shortText(5000),
  /** The PDF, made in the browser, as base64. */
  pdfBase64: z.string().min(100).max(1_300_000, "That PDF is too large to email"),
});
export type SendDocumentInput = z.infer<typeof sendDocumentSchema>;
