"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, addMinutes, format, isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Phone, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { personColor, personName } from "@/lib/team";
import { groupBySection } from "@/lib/types";
import type { Customer, Estimate, ScheduleBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The day's work, for the phone: times, where to go, who to call, and what
 * to do. Pages opened once stay viewable without signal.
 */
export default function TodayPage() {
  const { data, me } = useStore();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const onTeam = data.team.some((m) => m.id === me.id);
  const [scope, setScope] = useState<"mine" | "all">(onTeam ? "mine" : "all");

  const dayBlocks = data.scheduleBlocks
    .filter((b) => isSameDay(new Date(b.start), day))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const shown = scope === "mine" ? dayBlocks.filter((b) => b.assignedUserId === me.id) : dayBlocks;
  const othersCount = dayBlocks.length - dayBlocks.filter((b) => b.assignedUserId === me.id).length;
  const isToday = isSameDay(day, new Date());

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={isToday ? "Today" : format(day, "EEEE")}
        description={format(day, "EEEE, MMMM d")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-11 rounded-xl" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl px-4" onClick={() => setDay(startOfDay(new Date()))}>
          Today
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <div className="ml-auto flex rounded-xl border border-border bg-white p-1" role="group" aria-label="Whose work">
          {(["mine", "all"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={scope === v}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-semibold",
                scope === v ? "bg-brand text-brand-foreground" : "text-muted-foreground"
              )}
              onClick={() => setScope(v)}
            >
              {v === "mine" ? "Mine" : "Everyone"}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-white/60 px-5 py-10 text-center">
          <p className="font-display text-lg text-foreground">Nothing scheduled{scope === "mine" ? " for you" : ""}.</p>
          {scope === "mine" && othersCount > 0 ? (
            <button type="button" className="mt-2 text-sm font-semibold text-brand" onClick={() => setScope("all")}>
              See {othersCount} block{othersCount === 1 ? "" : "s"} for the rest of the team
            </button>
          ) : (
            <Link href="/schedule" className="mt-2 inline-block text-sm font-semibold text-brand">
              Open the schedule
            </Link>
          )}
        </div>
      ) : (
        <ol className="space-y-3">
          {shown.map((block) => {
            const estimate = data.estimates.find((e) => e.id === block.estimateId);
            const customer = data.customers.find((c) => c.id === estimate?.customerId);
            return <JobVisit key={block.id} block={block} estimate={estimate} customer={customer} showWho={scope === "all"} />;
          })}
        </ol>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Tip: open this page before heading somewhere without signal. What you&apos;ve opened stays viewable offline.
      </p>
    </div>
  );
}

function JobVisit({
  block,
  estimate,
  customer,
  showWho,
}: {
  block: ScheduleBlock;
  estimate?: Estimate;
  customer?: Customer;
  showWho: boolean;
}) {
  const { data } = useStore();
  const start = new Date(block.start);
  const end = addMinutes(start, block.durationMinutes);
  const address = estimate?.jobAddress || customer?.address || "";
  const lines = estimate
    ? block.lineItemIds?.length
      ? estimate.lineItems.filter((l) => block.lineItemIds!.includes(l.id))
      : estimate.lineItems
    : [];
  // Only sections with work in this block.
  const groups = estimate ? groupBySection(lines, estimate.sections).filter((g) => g.lines.length > 0) : [];

  return (
    <li className="overflow-hidden rounded-3xl border border-border bg-white/80">
      <div className="flex items-stretch">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: personColor(block.assignedUserId, data.team) }} />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-semibold text-brand">
            {format(start, "h:mm a")} – {format(end, "h:mm a")}
            {showWho ? <span className="font-normal text-muted-foreground"> · {personName(block.assignedUserId, data.team)}</span> : null}
          </p>
          <h2 className="mt-0.5 font-display text-xl leading-tight text-foreground">{block.title}</h2>
          {customer ? <p className="mt-1 text-sm text-muted-foreground">{customer.name}</p> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium"
              >
                <MapPin className="size-4 text-brand" />
                <span className="truncate">{address}</span>
              </a>
            ) : null}
            {customer?.phone ? (
              <a
                href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium"
              >
                <Phone className="size-4 text-brand" />
                {customer.phone}
              </a>
            ) : null}
          </div>

          {groups.length ? (
            <div className="mt-4 space-y-3">
              {groups.map((g) => (
                <div key={g.id || "all"}>
                  {estimate?.sections.length ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.name}</p>
                  ) : null}
                  <ul className="mt-1 space-y-1">
                    {g.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0">{l.description || "Untitled line"}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {l.quantity} {l.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          {estimate?.notes || customer?.notes ? (
            <div className="mt-4 flex gap-2 rounded-2xl bg-attention/15 p-3 text-sm text-foreground">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-attention-foreground" />
              <div className="space-y-1">
                {estimate?.notes ? <p>{estimate.notes}</p> : null}
                {customer?.notes ? <p className="text-muted-foreground">Customer: {customer.notes}</p> : null}
              </div>
            </div>
          ) : null}

          {estimate ? (
            <Link href={`/estimates/${estimate.id}`} className="mt-3 inline-block text-sm font-semibold text-brand">
              Open {estimate.number}
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
