import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstimateStatus, InvoiceStatus } from "@/lib/types";

const ESTIMATE_STYLES: Record<EstimateStatus, string> = {
  draft: "bg-slate-200 text-slate-800",
  sent: "bg-sky-100 text-sky-900",
  accepted: "bg-emerald-100 text-emerald-900",
  declined: "bg-rose-100 text-rose-900",
  converted: "bg-attention/30 text-attention-foreground",
};

const INVOICE_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-slate-200 text-slate-800",
  sent: "bg-sky-100 text-sky-900",
  paid: "bg-emerald-100 text-emerald-900",
  overdue: "bg-rose-100 text-rose-900",
};

export function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  return (
    <Badge className={cn("rounded-lg border-0 capitalize", ESTIMATE_STYLES[status])}>
      {status}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge className={cn("rounded-lg border-0 capitalize", INVOICE_STYLES[status])}>
      {status}
    </Badge>
  );
}
