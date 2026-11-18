import type { TeamMember } from "./types";

/** A distinct, readable color per person (white text on each). */
const PERSON_COLORS = ["#0504AA", "#0F766E", "#B45309", "#7C3AED", "#BE123C", "#1D4ED8"];
const UNASSIGNED = "#64748B";

export function personColor(userId: string | null | undefined, team: TeamMember[]): string {
  if (!userId) return UNASSIGNED;
  const index = team.findIndex((m) => m.id === userId);
  return index === -1 ? UNASSIGNED : PERSON_COLORS[index % PERSON_COLORS.length];
}

export function personName(userId: string | null | undefined, team: TeamMember[]): string {
  if (!userId) return "Unassigned";
  return team.find((m) => m.id === userId)?.name ?? "Former team member";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
