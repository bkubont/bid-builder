"use client";

import { TimeblockCalendar } from "@/components/schedule/timeblock-calendar";
import { useStore } from "@/lib/store";

export default function SchedulePage() {
  const { ready } = useStore();
  if (!ready) return <div className="animate-pulse p-8 text-muted-foreground">Loading…</div>;
  return <TimeblockCalendar />;
}
