"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
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
import { addDays, addMinutes, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSafe, useStore } from "@/lib/store";
import type { Estimate, ScheduleBlock, TeamMember } from "@/lib/types";
import {
  blockTitle,
  estimateLaborHours,
  hoursToMinutes,
  layoutLanes,
  lineHours,
  resizedMinutes,
  scheduledLineIds,
  selectionHours,
  snapToQuarterHour,
  type DragPayload,
} from "@/lib/schedule";
import { initials, personColor, personName } from "@/lib/team";
import { cn, toDateOnly } from "@/lib/utils";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 64;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

type PersonFilter = "all" | "unassigned" | string;

/** True on phone-width screens (one-day view). */
function useIsPhone() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false
  );
}

export function TimeblockCalendar() {
  const { data, me, upsertScheduleBlock, updateScheduleBlock, deleteScheduleBlock } = useStore();
  const safe = useSafe();
  const isPhone = useIsPhone();
  const [chosenView, setChosenView] = useState<"day" | "week" | null>(null);
  const view = chosenView ?? (isPhone ? "day" : "week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  // Team members start on their own work; Owners see everyone.
  const [person, setPerson] = useState<PersonFilter>(() =>
    me.role === "member" && data.team.some((m) => m.id === me.id) ? me.id : "all"
  );
  const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [trayChoice, setTrayOpen] = useState<boolean | null>(null);
  const trayOpen = trayChoice ?? !isPhone; // collapsed on phones until opened
  const [editing, setEditing] = useState<ScheduleBlock | null>(null);
  const lastDragEnd = useRef(0);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const monday = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [view, anchor]);
  const step = view === "day" ? 1 : 7;

  const visibleBlocks = data.scheduleBlocks.filter((b) =>
    person === "all" ? true : person === "unassigned" ? !b.assignedUserId : b.assignedUserId === person
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  function placeAt(day: Date, hour: number, minute: number, payload: DragPayload) {
    const start = snapToQuarterHour(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0));

    if (payload.kind === "block") {
      void safe(() => updateScheduleBlock(payload.blockId, { start: start.toISOString() }));
      return;
    }

    const estimate = data.estimates.find((e) => e.id === payload.estimateId);
    if (!estimate) return;
    const lineItemIds = payload.kind === "line" ? [payload.lineItemId] : undefined;
    const hours = selectionHours(estimate, lineItemIds);
    // New work goes to whoever the schedule is showing.
    const assignedUserId = person !== "all" && person !== "unassigned" ? person : null;
    void safe(
      () =>
        upsertScheduleBlock({
          estimateId: estimate.id,
          lineItemIds,
          title: blockTitle(estimate, lineItemIds),
          start: start.toISOString(),
          durationMinutes: hoursToMinutes(hours),
          assignedUserId,
        }),
      `Added to schedule${assignedUserId ? ` for ${personName(assignedUserId, data.team)}` : ""}`
    );
  }

  function onDragStart(event: DragStartEvent) {
    setActivePayload(event.active.data.current as DragPayload);
  }

  function onDragEnd(event: DragEndEvent) {
    const payload = event.active.data.current as DragPayload | undefined;
    const overId = event.over?.id;
    setActivePayload(null);
    lastDragEnd.current = Date.now();
    if (!payload || !overId) return;
    const match = String(overId).match(/^slot:(.+):(\d+):(\d+)$/);
    if (!match) return;
    placeAt(new Date(match[1]), Number(match[2]), Number(match[3]), payload);
  }

  function openBlock(block: ScheduleBlock) {
    // A drag ends with a click on the same block; don't treat that as a tap.
    if (Date.now() - lastDragEnd.current < 300) return;
    setEditing(block);
  }

  const rangeLabel =
    view === "day"
      ? format(anchor, "EEEE, MMM d")
      : `${format(days[0], "MMM d")} – ${format(days[6], days[0].getMonth() === days[6].getMonth() ? "d" : "MMM d")}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedule"
        description="Drag jobs or labor lines onto the calendar. Tap a block to change its time or who's doing it; drag its bottom edge to resize."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" className="h-11 rounded-xl" aria-label="Previous" onClick={() => setAnchor(addDays(anchor, -step))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl px-4" onClick={() => setAnchor(startOfDay(new Date()))}>
            Today
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl" aria-label="Next" onClick={() => setAnchor(addDays(anchor, step))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <p className="order-first min-w-0 basis-full font-display text-lg text-foreground sm:order-none sm:basis-0 sm:flex-1">
          {rangeLabel}
        </p>
        <div className="flex rounded-xl border border-border bg-white p-1" role="group" aria-label="View">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-semibold capitalize",
                view === v ? "bg-brand text-brand-foreground" : "text-muted-foreground"
              )}
              onClick={() => setChosenView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <Select value={person} onValueChange={(v) => setPerson((v as string) || "all")}>
          <SelectTrigger className="h-11 w-44 rounded-xl bg-white" aria-label="Whose schedule">
            <SelectValue>
              {(v: string) => (v === "all" ? "Everyone" : v === "unassigned" ? "Unassigned" : personName(v, data.team))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {data.team.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
                {m.id === me.id ? " (you)" : ""}
              </SelectItem>
            ))}
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={cn("grid gap-4", view === "week" && "xl:grid-cols-[20rem_minmax(0,1fr)]")}>
          <aside className={cn("rounded-3xl border border-border bg-card p-3", view === "day" && "order-last")}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-1 text-left"
              onClick={() => setTrayOpen(!trayOpen)}
              aria-expanded={trayOpen}
            >
              <span className="font-display text-lg text-foreground">Jobs to schedule</span>
              <span className="text-xs font-semibold text-brand">{trayOpen ? "Hide" : "Show"}</span>
            </button>
            {trayOpen ? (
              <>
                <p className="mb-3 px-1 text-xs text-muted-foreground">
                  Drag a whole job, or show its lines and drag one onto the calendar
                  {person !== "all" && person !== "unassigned" ? ` — it'll be assigned to ${personName(person, data.team)}` : ""}.
                </p>
                <div className="max-h-[60dvh] space-y-2 overflow-y-auto pr-1">
                  {data.estimates.filter((e) => e.status !== "declined").length === 0 ? (
                    <p className="px-2 py-6 text-sm text-muted-foreground">No estimates yet. Create one first.</p>
                  ) : (
                    data.estimates
                      .filter((e) => e.status !== "declined")
                      .map((estimate) => {
                        const customer = data.customers.find((c) => c.id === estimate.customerId);
                        const scheduled = scheduledLineIds(data.scheduleBlocks, estimate.id);
                        const open = expanded[estimate.id];
                        return (
                          <div key={estimate.id} className="rounded-2xl border border-border bg-background/80">
                            <JobCard
                              estimate={estimate}
                              subtitle={`${customer?.name || "No customer"} · ${estimateLaborHours(estimate)}h labor`}
                              scheduledWhole={scheduled.has("__whole__")}
                            />
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-brand"
                              onClick={() => setExpanded((prev) => ({ ...prev, [estimate.id]: !prev[estimate.id] }))}
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
                                      meta={`${line.category} · ${line.quantity} ${line.unit}${h ? ` · ${h}h` : ""}`}
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
              </>
            ) : null}
          </aside>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
            >
              <div className="border-r border-border" />
              {days.map((day) => (
                <button
                  type="button"
                  key={day.toISOString()}
                  className={cn(
                    "border-r border-border px-2 py-3 text-center last:border-r-0",
                    isSameDay(day, new Date()) && "bg-brand-muted"
                  )}
                  onClick={() => {
                    setAnchor(day);
                    setChosenView("day");
                  }}
                  aria-label={`Open ${format(day, "EEEE MMM d")} in day view`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{format(day, "EEE")}</p>
                  <p className="font-display text-xl text-foreground">{format(day, "d")}</p>
                </button>
              ))}
            </div>

            <div className="max-h-[70dvh] overflow-auto">
              <div
                className="relative grid"
                style={{
                  height: HOURS.length * HOUR_HEIGHT,
                  gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="relative border-r border-border">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-1 text-[10px] font-medium text-muted-foreground"
                      style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT + 2 }}
                    >
                      {format(new Date(2000, 0, 1, hour), "ha")}
                    </div>
                  ))}
                </div>

                {days.map((day) => (
                  <DayColumn
                    key={day.toISOString()}
                    day={day}
                    blocks={visibleBlocks.filter((b) => isSameDay(new Date(b.start), day))}
                    team={data.team}
                    roomy={view === "day"}
                    onOpen={openBlock}
                    onResize={(block, durationMinutes) =>
                      void safe(() => updateScheduleBlock(block.id, { durationMinutes }))
                    }
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

      {editing ? (
        <BlockDialog
          key={editing.id}
          block={editing}
          estimate={data.estimates.find((e) => e.id === editing.estimateId)}
          team={data.team}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            const ok = await safe(() => updateScheduleBlock(editing.id, patch), "Timeblock updated");
            if (ok) setEditing(null);
          }}
          onDelete={async () => {
            if (!window.confirm(`Remove "${editing.title}" from the schedule?`)) return;
            const ok = await safe(() => deleteScheduleBlock(editing.id), "Removed from schedule");
            if (ok) setEditing(null);
          }}
        />
      ) : null}
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

function JobCard({ estimate, subtitle, scheduledWhole }: { estimate: Estimate; subtitle: string; scheduledWhole: boolean }) {
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
        "flex cursor-grab touch-none items-start gap-2 rounded-2xl px-3 py-3 active:cursor-grabbing",
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
        {scheduledWhole ? <p className="mt-1 text-[11px] font-medium text-attention">Whole job scheduled</p> : null}
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
    data: { kind: "line", estimateId, lineItemId: lineId } satisfies DragPayload,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab touch-none items-start gap-2 rounded-xl bg-muted/60 px-2 py-2 active:cursor-grabbing",
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
  team,
  roomy,
  onOpen,
  onResize,
}: {
  day: Date;
  blocks: ScheduleBlock[];
  team: TeamMember[];
  roomy: boolean;
  onOpen: (block: ScheduleBlock) => void;
  onResize: (block: ScheduleBlock, durationMinutes: number) => void;
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

      {layoutLanes(blocks).map(({ item, lane, lanes }) => (
        <ScheduledBlock
          key={item.id}
          block={item}
          lane={lane}
          lanes={lanes}
          team={team}
          roomy={roomy}
          onOpen={onOpen}
          onResize={onResize}
        />
      ))}
    </div>
  );
}

function DropSlot({ day, hour, minute, className }: { day: Date; hour: number; minute: number; className?: string }) {
  const id = `slot:${startOfDay(day).toISOString()}:${hour}:${minute}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={cn("absolute inset-x-0 h-1/2", className, isOver && "bg-brand/15")} />;
}

function ScheduledBlock({
  block,
  lane,
  lanes,
  team,
  roomy,
  onOpen,
  onResize,
}: {
  block: ScheduleBlock;
  lane: number;
  lanes: number;
  team: TeamMember[];
  roomy: boolean;
  onOpen: (block: ScheduleBlock) => void;
  onResize: (block: ScheduleBlock, durationMinutes: number) => void;
}) {
  const [previewMinutes, setPreviewMinutes] = useState<number | null>(null);
  const resizeFrom = useRef<number | null>(null);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { kind: "block", blockId: block.id } satisfies DragPayload,
  });

  const start = new Date(block.start);
  const minutesFromStart = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
  if (minutesFromStart < 0 || minutesFromStart >= (DAY_END_HOUR - DAY_START_HOUR) * 60) return null;

  const duration = previewMinutes ?? block.durationMinutes;
  const top = (minutesFromStart / 60) * HOUR_HEIGHT;
  const maxMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60 - minutesFromStart;
  const height = Math.max(28, (Math.min(duration, maxMinutes) / 60) * HOUR_HEIGHT);
  const end = addMinutes(start, duration);
  const color = personColor(block.assignedUserId, team);
  const who = personName(block.assignedUserId, team);
  const width = 100 / lanes;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={`${block.title}, ${format(start, "h:mm a")} to ${format(end, "h:mm a")}, ${who}`}
      onClick={() => onOpen(block)}
      className={cn(
        "absolute z-10 overflow-hidden rounded-xl px-2 py-1 text-white shadow-sm",
        !block.assignedUserId && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(255,255,255,0.12)_6px,rgba(255,255,255,0.12)_12px)]",
        isDragging && "opacity-40"
      )}
      style={{
        top,
        height,
        left: `calc(${lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        backgroundColor: color,
      }}
    >
      <div className="flex items-start gap-1.5">
        {roomy || lanes === 1 ? (
          <span
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold"
            title={who}
          >
            {block.assignedUserId ? initials(who) : "?"}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold leading-tight">{block.title}</p>
          <p className="truncate text-[10px] opacity-85">
            {format(start, "h:mm")}–{format(end, "h:mm a")} · {(duration / 60).toFixed(duration % 60 ? 2 : 0)}h
            {roomy ? ` · ${who}` : ""}
          </p>
        </div>
      </div>
      {/* Drag the bottom edge to change the length. */}
      <div
        role="separator"
        aria-label="Resize"
        className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize touch-none items-end justify-center pb-0.5"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          resizeFrom.current = e.clientY;
        }}
        onPointerMove={(e) => {
          if (resizeFrom.current === null) return;
          setPreviewMinutes(resizedMinutes(block.durationMinutes, e.clientY - resizeFrom.current, HOUR_HEIGHT));
        }}
        onPointerUp={(e) => {
          if (resizeFrom.current === null) return;
          const next = resizedMinutes(block.durationMinutes, e.clientY - resizeFrom.current, HOUR_HEIGHT);
          resizeFrom.current = null;
          setPreviewMinutes(null);
          if (next !== block.durationMinutes) onResize(block, next);
        }}
        onPointerCancel={() => {
          resizeFrom.current = null;
          setPreviewMinutes(null);
        }}
      >
        <span className="h-1 w-6 rounded-full bg-white/60" />
      </div>
    </div>
  );
}

function BlockDialog({
  block,
  estimate,
  team,
  onClose,
  onSave,
  onDelete,
}: {
  block: ScheduleBlock;
  estimate?: Estimate;
  team: TeamMember[];
  onClose: () => void;
  onSave: (patch: { start: string; durationMinutes: number; assignedUserId: string | null; title: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const start = new Date(block.start);
  const [title, setTitle] = useState(block.title);
  const [day, setDay] = useState(toDateOnly(start));
  const [time, setTime] = useState(format(start, "HH:mm"));
  const [hours, setHours] = useState(block.durationMinutes / 60);
  const [assignee, setAssignee] = useState<string>(block.assignedUserId ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Timeblock</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const [y, m, d] = day.split("-").map(Number);
            const [hh, mm] = time.split(":").map(Number);
            if (!y || Number.isNaN(hh)) return;
            setBusy(true);
            await onSave({
              title: title.trim() || block.title,
              start: new Date(y, m - 1, d, hh, mm || 0).toISOString(),
              durationMinutes: Math.max(15, Math.round((hours * 60) / 15) * 15),
              assignedUserId: assignee || null,
            });
            setBusy(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="blk-title">Title</Label>
            <Input id="blk-title" className="h-11 rounded-xl" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blk-who">Who&apos;s doing it</Label>
            <Select value={assignee} onValueChange={(v) => setAssignee((v as string) ?? "")}>
              <SelectTrigger id="blk-who" className="h-11 rounded-xl">
                <SelectValue>{(v: string) => personName(v || null, team)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {team.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
                <SelectItem value="">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="blk-day">Day</Label>
              <Input id="blk-day" type="date" className="h-11 rounded-xl" value={day} onChange={(e) => setDay(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blk-time">Start</Label>
              <Input id="blk-time" type="time" step={900} className="h-11 rounded-xl" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blk-hours">Length (hours)</Label>
            <NumberInput id="blk-hours" className="h-11 rounded-xl" value={hours} onValueChange={setHours} />
            <p className="text-xs text-muted-foreground">Rounded to 15 minutes.</p>
          </div>
          {estimate ? (
            <p className="text-sm">
              <Link className="font-medium text-brand underline-offset-2 hover:underline" href={`/estimates/${estimate.id}`}>
                Open {estimate.number} · {estimate.jobTitle}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={busy} className="h-11 flex-1 rounded-xl bg-attention text-foreground hover:bg-attention/90">
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" className="h-11 rounded-xl text-rose-700" onClick={onDelete}>
              Remove
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
