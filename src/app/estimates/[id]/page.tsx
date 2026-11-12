"use client";

import { use } from "react";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import { ButtonLink } from "@/components/ui/button-link";
import { useStore } from "@/lib/store";

export default function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, ready } = useStore();
  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;

  const exists = data.estimates.some((e) => e.id === id);
  if (!exists) {
    return (
      <div className="rounded-3xl border border-border bg-white/70 p-8">
        <h1 className="font-display text-2xl">Estimate not found</h1>
        <ButtonLink
          href="/estimates"
          className="mt-4 h-11 rounded-xl bg-attention text-foreground hover:bg-attention/90"
        >
          Back to estimates
        </ButtonLink>
      </div>
    );
  }

  return <EstimateBuilder estimateId={id} />;
}
