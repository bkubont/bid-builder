import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { CompanySettings, Customer, EstimateSection, InvoiceKind, LineItem, Taxable } from "./types";
import { describeTaxable, documentTotals, groupBySection, lineTotal, unitPrice } from "./types";
import { formatCurrency, formatDate } from "./utils";

type DocKind = "Estimate" | "Invoice";

export type PdfOptions = {
  kind: DocKind;
  invoiceKind?: InvoiceKind;
  number: string;
  company: CompanySettings;
  customer?: Customer;
  jobTitle: string;
  jobAddress: string;
  lineItems: LineItem[];
  sections: EstimateSection[];
  taxPercent: number;
  taxableCategories: Taxable;
  depositApplied?: number;
  notes: string;
  dateLabel: string;
  dateValue: string;
};

const BRAND: [number, number, number] = [5, 4, 170];
const RIGHT = 196;
const MARGIN = 14;

/**
 * Customer-facing PDF.
 * - Estimates show each section's name and total only (no line prices).
 * - Invoices show every line (qty x price = total) under section headings.
 * Cost and markup never appear.
 */
export function buildDocumentPdf(opts: PdfOptions): jsPDF {
  const doc = new jsPDF();
  let y = 18;
  const title =
    opts.kind === "Invoice" && opts.invoiceKind === "deposit" ? "DEPOSIT INVOICE" : opts.kind.toUpperCase();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.company.name || "Your Company", MARGIN, y);
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text(title, RIGHT, y, { align: "right" });
  doc.setTextColor(0);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  [
    opts.company.address,
    opts.company.phone,
    opts.company.email,
    opts.company.licenseNumber ? `License ${opts.company.licenseNumber}` : "",
  ]
    .filter(Boolean)
    .forEach((line) => {
      doc.text(line, MARGIN, y);
      y += 4.5;
    });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${opts.kind} ${opts.number}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${opts.dateLabel}: ${formatDate(opts.dateValue)}`, RIGHT, y, { align: "right" });

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Bill to", MARGIN, y);
  doc.text("Job", 110, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const left = [opts.customer?.name || "", opts.customer?.address, opts.customer?.phone, opts.customer?.email].filter(
    Boolean
  ) as string[];
  const right = [opts.jobTitle, opts.jobAddress].filter(Boolean);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i]) doc.text(doc.splitTextToSize(left[i], 90)[0], MARGIN, y);
    if (right[i]) doc.text(doc.splitTextToSize(right[i], 86)[0], 110, y);
    y += 4.5;
  }

  const common = {
    startY: y + 6,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    margin: { left: MARGIN, right: 210 - RIGHT },
  } as const;

  if (opts.kind === "Estimate") {
    const groups = groupBySection(opts.lineItems, opts.sections, { fallbackToCategories: true });
    autoTable(doc, {
      ...common,
      head: [["Scope", "Amount"]],
      body: groups.map((g) => [g.name, formatCurrency(g.total)]),
      columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    });
  } else {
    const groups = groupBySection(opts.lineItems, opts.sections);
    const showHeadings = opts.sections.length > 0;
    const body: RowInput[] = [];
    for (const g of groups) {
      if (showHeadings) {
        body.push([
          {
            content: `${g.name}  ·  ${formatCurrency(g.total)}`,
            colSpan: 5,
            styles: { fontStyle: "bold", fillColor: [238, 240, 250], textColor: 20 },
          },
        ]);
      }
      for (const item of g.lines) {
        body.push([
          item.description || "—",
          String(item.quantity),
          item.unit,
          formatCurrency(unitPrice(item)),
          formatCurrency(lineTotal(item)),
        ]);
      }
    }
    autoTable(doc, {
      ...common,
      head: [["Description", "Qty", "Unit", "Price", "Total"]],
      body,
      columnStyles: {
        1: { halign: "right", cellWidth: 16 },
        2: { cellWidth: 16 },
        3: { halign: "right", cellWidth: 26 },
        4: { halign: "right", cellWidth: 28 },
      },
    });
  }

  const totals = documentTotals(opts);
  const finalY = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  let ty = finalY + 10;
  const row = (label: string, value: string, bold = false, size = 9) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(label, 150, ty, { align: "right" });
    doc.text(value, RIGHT, ty, { align: "right" });
    ty += size > 9 ? 7 : 5;
  };
  row("Subtotal", formatCurrency(totals.subtotal));
  if (totals.tax > 0 || opts.taxPercent > 0) {
    row(`Tax (${opts.taxPercent}% on ${describeTaxable(opts.taxableCategories)})`, formatCurrency(totals.tax));
  }
  if (totals.depositApplied > 0) {
    row("Total", formatCurrency(totals.total));
    row("Less deposit received", `-${formatCurrency(totals.depositApplied)}`);
    ty += 1;
    row("Balance due", formatCurrency(totals.balanceDue), true, 12);
  } else {
    ty += 1;
    row(opts.kind === "Invoice" ? "Amount due" : "Total", formatCurrency(totals.total), true, 12);
  }

  ty += 6;
  const notes = [opts.notes, opts.company.terms].filter(Boolean).join("\n\n");
  if (notes) {
    if (ty > 260) {
      doc.addPage();
      ty = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notes / Terms", MARGIN, ty);
    ty += 5;
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(notes, RIGHT - MARGIN), MARGIN, ty);
  }
  return doc;
}

export function downloadDocumentPdf(opts: PdfOptions) {
  buildDocumentPdf(opts).save(`${opts.number}.pdf`);
}

/** The PDF as a File, for sharing to Mail/Messages. */
export function documentPdfFile(opts: PdfOptions): File {
  const blob = buildDocumentPdf(opts).output("blob");
  return new File([blob], `${opts.number}.pdf`, { type: "application/pdf" });
}

/** The PDF as base64 (no data: prefix), for emailing through the server. */
export function documentPdfBase64(opts: PdfOptions): string {
  const uri = buildDocumentPdf(opts).output("datauristring");
  return uri.slice(uri.indexOf(",") + 1);
}
