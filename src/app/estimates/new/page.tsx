"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import { useStore } from "@/lib/store";

function NewEstimateInner() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer") || undefined;
  return <EstimateBuilder initialCustomerId={customerId} />;
}

export default function NewEstimatePage() {
  const { ready } = useStore();
  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;
  return (
    <Suspense fallback={<div className="animate-pulse p-8 text-muted-foreground">Loading…</div>}>
      <NewEstimateInner />
    </Suspense>
  );
}
