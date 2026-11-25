"use client";

import { use, useEffect, useState } from "react";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import { ButtonLink } from "@/components/ui/button-link";
import { useStore } from "@/lib/store";

export default function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, ready, refresh } = useStore();
  const found = data.estimates.some((x) => x.id === id);
  const [checked, setChecked] = useState(found);
  // Made on another device and not here yet? Fetch the latest before saying "not found".
  useEffect(() => {
    if (found || checked) return;
    void refresh().finally(() => setChecked(true));
  }, [found, checked, refresh]);
  if (!ready || (!found && !checked)) {
    return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;
  }

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
