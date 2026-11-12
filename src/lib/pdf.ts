import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanySettings, Customer, LineItem } from "./types";
import { grandTotal, lineTotal, subtotal, taxAmount } from "./types";
import { formatCurrency, formatDate } from "./utils";

type DocKind = "Estimate" | "Invoice";

export function downloadDocumentPdf(opts: {
  kind: DocKind;
  number: string;
  company: CompanySettings;
  customer?: Customer;
  jobTitle: string;
  jobAddress: string;
  lineItems: LineItem[];
  taxPercent: number;
  notes: string;
  dateLabel: string;
  dateValue: string;
}) {
  const doc = new jsPDF();
  const margin = 14;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.company.name || "Your Company", margin, y);
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text(opts.kind.toUpperCase(), 196, y, { align: "right" });
  doc.setTextColor(0);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const companyLines = [
    opts.company.address,
    opts.company.phone,
    opts.company.email,
    opts.company.licenseNumber ? `License ${opts.company.licenseNumber}` : "",
  ].filter(Boolean);
  companyLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 4.5;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${opts.kind} ${opts.number}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${opts.dateLabel}: ${formatDate(opts.dateValue)}`, 196, y, {
    align: "right",
  });

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Bill to", margin, y);
  doc.text("Job", 110, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const left = [
    opts.customer?.name || "No customer",
    opts.customer?.address,
    opts.customer?.phone,
    opts.customer?.email,
  ].filter(Boolean) as string[];
  const right = [opts.jobTitle, opts.jobAddress].filter(Boolean);
  const rows = Math.max(left.length, right.length);
  for (let i = 0; i < rows; i++) {
    if (left[i]) doc.text(left[i], margin, y);
    if (right[i]) doc.text(right[i], 110, y);
    y += 4.5;
  }

  autoTable(doc, {
    startY: y + 6,
    head: [["Description", "Cat", "Qty", "Unit", "Rate", "Markup", "Total"]],
    body: opts.lineItems.map((item) => [
      item.description || "—",
      item.category,
      String(item.quantity),
      item.unit,
      formatCurrency(item.unitCost),
      `${item.markupPercent}%`,
      formatCurrency(lineTotal(item)),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      2: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  const finalY =
    (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    y + 40;
  let totalsY = finalY + 10;
  const sub = subtotal(opts.lineItems);
  const tax = taxAmount(opts.lineItems, opts.taxPercent);
  const total = grandTotal(opts.lineItems, opts.taxPercent);

  doc.setFontSize(9);
  doc.text(`Subtotal: ${formatCurrency(sub)}`, 196, totalsY, { align: "right" });
  totalsY += 5;
  doc.text(`Tax (${opts.taxPercent}%): ${formatCurrency(tax)}`, 196, totalsY, {
    align: "right",
  });
  totalsY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: ${formatCurrency(total)}`, 196, totalsY, { align: "right" });

  totalsY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Notes / Terms", margin, totalsY);
  totalsY += 5;
  doc.setFont("helvetica", "normal");
  const notes = [opts.notes, opts.company.terms].filter(Boolean).join("\n\n");
  const split = doc.splitTextToSize(notes || "—", 180);
  doc.text(split, margin, totalsY);

  doc.save(`${opts.number}.pdf`);
}
