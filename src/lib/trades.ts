import type { LineCategory, Trade } from "./types";

export const TRADES: { value: Trade; label: string }[] = [
  { value: "general", label: "General" },
  { value: "carpentry", label: "Carpentry" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "roofing", label: "Roofing" },
  { value: "painting", label: "Painting" },
  { value: "concrete", label: "Concrete" },
];

export const CATEGORIES: { value: LineCategory; label: string }[] = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];
