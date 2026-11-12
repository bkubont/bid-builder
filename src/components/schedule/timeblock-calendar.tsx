"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  addDays,
  addMinutes,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Estimate, ScheduleBlock } from "@/lib/types";
import {
  blockTitle,
  estimateLaborHours,
  hoursToMinutes,
  lineHours,
  scheduledLineIds,
  selectionHours,
  snapToQuarterHour,
  type DragPayload,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 64;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i
);

export function TimeblockCalendar() {
  const {
    data,
    upsertScheduleBlock,
    moveScheduleBlock,
    deleteScheduleBlock,
  } = useStore();
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  function placeAt(day: Date, hour: number, minute: number, payload: DragPayload) {
    const start = snapToQuarterHour(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hour,
        minute,
        0,
        0
      )
    );

    if (payload.kind === "block") {
      moveScheduleBlock(payload.blockId, start.toISOString());
      return;
    }

    const estimate = data.estimates.find((e) => e.id === payload.estimateId);
    if (!estimate) return;

    const lineItemIds =
      payload.kind === "line" ? [payload.lineItemId] : undefined;
    const hours = selectionHours(estimate, lineItemIds);
    upsertScheduleBlock({
      estimateId: estimate.id,
      lineItemIds,
      title: blockTitle(estimate, lineItemIds),
      start: start.toISOString(),
      durationMinutes: hoursToMinutes(hours),
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActivePayload(event.active.data.current as DragPayload);
  }

  function onDragEnd(event: DragEndEvent) {
    const payload = event.active.data.current as DragPayload | undefined;
    const overId = event.over?.id;
    setActivePayload(null);
    if (!payload || !overId) return;
    const match = String(overId).match(/^slot:(.+):(\d+):(\d+)$/);
    if (!match) return;
    const day = new Date(match[1]);
    const hour = Number(match[2]);
    const minute = Number(match[3]);
    placeAt(day, hour, minute, payload);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedule"
        description="Timeblock jobs and individual labor lines. Duration follows hours on the estimate."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-4"
              onClick={() => setWeekAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-border bg-card p-3">
            <h2 className="px-1 font-display text-lg text-foreground">Jobs tray</h2>
            <p className="mb-3 px-1 text-xs text-muted-foreground">
              Drag a whole job card or expand and drag a single line onto the week.
            </p>
            <div className="max-h-[70dvh] space-y-2 overflow-y-auto pr-1">
              {data.estimates.length === 0 ? (
                <p className="px-2 py-6 text-sm text-muted-foreground">
                  No estimates yet. Create one first.
                </p>
              ) : (
                data.estimates.map((estimate) => {
                  const customer = data.customers.find((c) => c.id === estimate.customerId);
                  const hours = estimateLaborHours(estimate);
                  const scheduled = scheduledLineIds(data.scheduleBlocks, estimate.id);
                  const open = expanded[estimate.id];
                  return (
                    <div
                      key={estimate.id}
                      className="rounded-2xl border border-border bg-background/80"
                    >
                      <JobCard
                        estimate={estimate}
                        subtitle={`${customer?.name || "No customer"} · ${hours}h labor`}
                        scheduledWhole={scheduled.has("__whole__")}
                      />
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-brand"
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [estimate.id]: !prev[estimate.id],
                          }))
                        }
                      >
                        {open ? "Hide lines" : "Show lines"}
                      </button>
                      {open ? (
                        <div className="space-y-1 border-t border-border px-2 pb-2 pt-1">
                          {estimate.lineItems.map((line) => {
                            const h = lineHours(line);
                            return (
                              <LineCard
                                key={line.id}
                                estimateId={estimate.id}
                                lineId={line.id}
                                label={line.description || "Untitled line"}
                                meta={`${line.category} · ${line.quantity} ${line.unit}${
                                  h ? ` · ${h}h` : ""
                                }`}
                                scheduled={scheduled.has(line.id)}
                                disabled={h <= 0 && line.category !== "labor"}
                              />
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border">
              <div className="border-r border-border" />
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r border-border px-2 py-3 text-center last:border-r-0",
                    isSameDay(day, new Date()) && "bg-brand-muted"
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {format(day, "EEE")}
                  </p>
                  <p className="font-display text-xl text-foreground">{format(day, "d")}</p>
                </div>
              ))}
            </div>

            <div className="max-h-[70dvh] overflow-auto">
              <div
                className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]"
                style={{ height: HOURS.length * HOUR_HEIGHT }}
              >
                <div className="relative border-r border-border">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-1 -translate-y-1/2 text-[10px] font-medium text-muted-foreground"
                      style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
                    >
                      {format(new Date(2000, 0, 1, hour), "ha")}
                    </div>
                  ))}
                </div>

                {days.map((day) => (
                  <DayColumn
                    key={day.toISOString()}
                    day={day}
                    blocks={data.scheduleBlocks.filter((b) =>
                      isSameDay(new Date(b.start), day)
                    )}
                    onDelete={deleteScheduleBlock}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activePayload ? (
            <div className="rounded-xl border border-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground shadow-lg">
              {overlayLabel(activePayload, data.estimates)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function overlayLabel(payload: DragPayload, estimates: Estimate[]) {
  if (payload.kind === "block") return "Move timeblock";
  const est = estimates.find((e) => e.id === payload.estimateId);
  if (!est) return "Job";
  if (payload.kind === "job") return est.jobTitle;
  const line = est.lineItems.find((l) => l.id === payload.lineItemId);
  return line?.description || est.jobTitle;
}

function JobCard({
  estimate,
  subtitle,
  scheduledWhole,
}: {
  estimate: Estimate;
  subtitle: string;
  scheduledWhole: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `job:${estimate.id}`,
    data: { kind: "job", estimateId: estimate.id } satisfies DragPayload,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-start gap-2 rounded-2xl px-3 py-3 active:cursor-grabbing",
        isDragging && "opacity-40",
        scheduledWhole && "opacity-60"
      )}
    >
      <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {estimate.number} · {estimate.jobTitle}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {scheduledWhole ? (
          <p className="mt-1 text-[11px] font-medium text-attention">Whole job scheduled</p>
        ) : null}
      </div>
    </div>
  );
}

function LineCard({
  estimateId,
  lineId,
  label,
  meta,
  scheduled,
  disabled,
}: {
  estimateId: string;
  lineId: string;
  label: string;
  meta: string;
  scheduled: boolean;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `line:${estimateId}:${lineId}`,
    data: {
      kind: "line",
      estimateId,
      lineItemId: lineId,
    } satisfies DragPayload,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-start gap-2 rounded-xl bg-muted/60 px-2 py-2 active:cursor-grabbing",
        (isDragging || scheduled) && "opacity-50",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  blocks,
  onDelete,
}: {
  day: Date;
  blocks: ScheduleBlock[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative border-r border-border last:border-r-0">
      {HOURS.map((hour) => (
        <div key={hour} className="absolute inset-x-0" style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
          <DropSlot day={day} hour={hour} minute={0} />
          <DropSlot day={day} hour={hour} minute={30} className="top-1/2" />
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border/70" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/40" />
        </div>
      ))}

      {blocks.map((block) => (
        <ScheduledBlock key={block.id} block={block} day={day} onDelete={onDelete} />
      ))}
    </div>
  );
}

function DropSlot({
  day,
  hour,
  minute,
  className,
}: {
  day: Date;
  hour: number;
  minute: number;
  className?: string;
}) {
  const id = `slot:${startOfDay(day).toISOString()}:${hour}:${minute}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute inset-x-0 h-1/2",
        className,
        isOver && "bg-brand/15"
      )}
    />
  );
}

function ScheduledBlock({
  block,
  day,
  onDelete,
}: {
  block: ScheduleBlock;
  day: Date;
  onDelete: (id: string) => void;
}) {
  const start = new Date(block.start);
  const minutesFromStart =
    (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
  const top = (minutesFromStart / 60) * HOUR_HEIGHT;
  const height = Math.max(28, (block.durationMinutes / 60) * HOUR_HEIGHT);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { kind: "block", blockId: block.id } satisfies DragPayload,
  });

  if (!isSameDay(start, day)) return null;
  if (minutesFromStart < 0 || minutesFromStart > (DAY_END_HOUR - DAY_START_HOUR) * 60) {
    return null;
  }

  const end = addMinutes(start, block.durationMinutes);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute inset-x-1 z-10 overflow-hidden rounded-xl border border-brand/30 bg-brand px-2 py-1 text-brand-foreground shadow-sm",
        isDragging && "opacity-40"
      )}
      style={{ top, height }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold leading-tight">{block.title}</p>
          <p className="text-[10px] opacity-80">
            {format(start, "h:mm a")}–{format(end, "h:mm a")} ·{" "}
            {(block.durationMinutes / 60).toFixed(block.durationMinutes % 60 ? 2 : 0)}h
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-0.5 hover:bg-white/15"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          aria-label="Remove block"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
