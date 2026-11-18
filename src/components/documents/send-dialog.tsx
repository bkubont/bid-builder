"use client";

import { useState } from "react";
import { Download, Mail, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PdfOptions } from "@/lib/pdf";
import { useSafe, useStore } from "@/lib/store";
import { documentTotals } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "estimate" | "invoice";
  documentId: string;
  pdf: PdfOptions;
  /** Called after the app emailed the document (drafts are now "sent"). */
  onSent?: () => void;
};

function defaultMessage(pdf: PdfOptions, companyPhone: string) {
  const t = documentTotals(pdf);
  const greeting = pdf.customer?.name ? `Hi ${pdf.customer.name},` : "Hello,";
  const sign = [pdf.company.name, companyPhone].filter(Boolean).join("\n");
  const body =
    pdf.kind === "Estimate"
      ? `Attached is estimate ${pdf.number} for ${pdf.jobTitle}. The total is ${formatCurrency(t.total)}, and it's valid until ${formatDate(pdf.dateValue)}.`
      : `Attached is ${pdf.invoiceKind === "deposit" ? "deposit invoice" : "invoice"} ${pdf.number} for ${pdf.jobTitle}. The amount due is ${formatCurrency(t.balanceDue)}, due ${formatDate(pdf.dateValue)}.`;
  return `${greeting}\n\n${body}\n\nReply to this email with any questions.\n\n${sign}`;
}

export function SendDialog({ open, onOpenChange, documentType, documentId, pdf, onSent }: Props) {
  const { emailEnabled, sendDocument, notify } = useStore();
  const safe = useSafe();
  const label = pdf.kind === "Estimate" ? "Estimate" : pdf.invoiceKind === "deposit" ? "Deposit invoice" : "Invoice";
  const [to, setTo] = useState(pdf.customer?.email ?? "");
  const [subject, setSubject] = useState(`${label} ${pdf.number} from ${pdf.company.name}`);
  const [message, setMessage] = useState(() => defaultMessage(pdf, pdf.company.phone));
  const [busy, setBusy] = useState(false);
  const canShareFiles =
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] });

  async function sendEmail() {
    setBusy(true);
    const { documentPdfBase64 } = await import("@/lib/pdf");
    const ok = await safe(
      () => sendDocument({ documentType, documentId, to: to.trim(), subject, message, pdfBase64: documentPdfBase64(pdf) }),
      `Sent to ${to.trim()}`
    );
    setBusy(false);
    if (ok) {
      onSent?.();
      onOpenChange(false);
    }
  }

  async function share() {
    const { documentPdfFile } = await import("@/lib/pdf");
    try {
      await navigator.share({ files: [documentPdfFile(pdf)], title: subject, text: message });
      onOpenChange(false);
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") notify("Couldn't open sharing on this device.", "error");
    }
  }

  async function downloadAndMail() {
    const { downloadDocumentPdf } = await import("@/lib/pdf");
    downloadDocumentPdf(pdf);
    const href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `${message}\n\n(${pdf.number}.pdf is attached.)`
    )}`;
    window.open(href, "_self");
    notify(`Downloaded ${pdf.number}.pdf. Attach it to the email that opened.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Send {label.toLowerCase()} {pdf.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="send-to">To</Label>
            <Input id="send-to" type="email" className="h-11 rounded-xl" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="send-subject">Subject</Label>
            <Input id="send-subject" className="h-11 rounded-xl" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="send-message">Message</Label>
            <Textarea id="send-message" className="min-h-40 rounded-xl" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">{pdf.number}.pdf is attached.</p>

          <div className="flex flex-col gap-2 pt-1">
            {emailEnabled ? (
              <Button
                type="button"
                disabled={busy || !to.trim()}
                className="h-12 rounded-xl bg-attention text-foreground hover:bg-attention/90"
                onClick={sendEmail}
              >
                <Send className="size-4" />
                {busy ? "Sending…" : "Send email"}
              </Button>
            ) : null}
            {canShareFiles ? (
              <Button
                type="button"
                variant={emailEnabled ? "outline" : "default"}
                className={emailEnabled ? "h-12 rounded-xl" : "h-12 rounded-xl bg-attention text-foreground hover:bg-attention/90"}
                onClick={share}
              >
                <Share2 className="size-4" />
                Share PDF (Mail, Messages…)
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={downloadAndMail}>
                <Mail className="size-4" />
                Download PDF and open my email app
              </Button>
            )}
            {canShareFiles ? (
              <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={downloadAndMail}>
                <Download className="size-4" />
                Download PDF and open my email app
              </Button>
            ) : null}
            {!emailEnabled ? (
              <p className="text-xs text-muted-foreground">
                Sending straight from Bid Builder turns on when email is set up on the server.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
