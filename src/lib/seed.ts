import type {
  AppData,
  CompanySettings,
  Estimate,
  EstimateSection,
  Invoice,
  LineItem,
  PricebookItem,
  ScheduleBlock,
} from "./types";
import { documentTotals } from "./types";
import { dateOnlyFromToday } from "./utils";

export const SEED_PRICEBOOK: PricebookItem[] = [
  {
    id: "pb-carp-labor",
    name: "Carpenter labor",
    category: "labor",
    trade: "carpentry",
    unit: "hr",
    unitCost: 75,
    keywords: ["carpenter", "framing", "trim", "door", "deck", "wood"],
  },
  {
    id: "pb-2x4",
    name: '2x4 SPF stud 8\'',
    category: "material",
    trade: "carpentry",
    unit: "ea",
    unitCost: 4.25,
    keywords: ["stud", "2x4", "framing", "lumber"],
  },
  {
    id: "pb-plywood",
    name: '3/4" CDX plywood 4x8',
    category: "material",
    trade: "carpentry",
    unit: "sheet",
    unitCost: 48,
    keywords: ["plywood", "sheathing", "subfloor"],
  },
  {
    id: "pb-elec-labor",
    name: "Electrician labor",
    category: "labor",
    trade: "electrical",
    unit: "hr",
    unitCost: 95,
    keywords: ["electric", "outlet", "panel", "wiring", "light"],
  },
  {
    id: "pb-outlet",
    name: "Duplex receptacle + box",
    category: "material",
    trade: "electrical",
    unit: "ea",
    unitCost: 12.5,
    keywords: ["outlet", "receptacle", "plug"],
  },
  {
    id: "pb-romex",
    name: "12/2 NM-B Romex",
    category: "material",
    trade: "electrical",
    unit: "ft",
    unitCost: 1.15,
    keywords: ["wire", "romex", "cable", "wiring"],
  },
  {
    id: "pb-plumb-labor",
    name: "Plumber labor",
    category: "labor",
    trade: "plumbing",
    unit: "hr",
    unitCost: 110,
    keywords: ["plumb", "pipe", "faucet", "toilet", "drain", "water"],
  },
  {
    id: "pb-pex",
    name: '3/4" PEX tubing',
    category: "material",
    trade: "plumbing",
    unit: "ft",
    unitCost: 0.85,
    keywords: ["pex", "pipe", "water line"],
  },
  {
    id: "pb-faucet",
    name: "Kitchen faucet (mid-grade)",
    category: "material",
    trade: "plumbing",
    unit: "ea",
    unitCost: 185,
    keywords: ["faucet", "sink", "kitchen"],
  },
  {
    id: "pb-hvac-labor",
    name: "HVAC tech labor",
    category: "labor",
    trade: "hvac",
    unit: "hr",
    unitCost: 105,
    keywords: ["hvac", "ac", "furnace", "duct", "air"],
  },
  {
    id: "pb-filter",
    name: "16x25x1 furnace filter",
    category: "material",
    trade: "hvac",
    unit: "ea",
    unitCost: 14,
    keywords: ["filter", "furnace", "air"],
  },
  {
    id: "pb-roof-labor",
    name: "Roofer labor",
    category: "labor",
    trade: "roofing",
    unit: "sq",
    unitCost: 185,
    keywords: ["roof", "shingle", "tear-off", "flashing"],
  },
  {
    id: "pb-shingle",
    name: "Architectural shingles",
    category: "material",
    trade: "roofing",
    unit: "sq",
    unitCost: 125,
    keywords: ["shingle", "roof", "asphalt"],
  },
  {
    id: "pb-paint-labor",
    name: "Painter labor",
    category: "labor",
    trade: "painting",
    unit: "hr",
    unitCost: 55,
    keywords: ["paint", "primer", "wall", "ceiling"],
  },
  {
    id: "pb-paint-gal",
    name: "Interior latex paint",
    category: "material",
    trade: "painting",
    unit: "gal",
    unitCost: 42,
    keywords: ["paint", "latex", "interior"],
  },
  {
    id: "pb-concrete-labor",
    name: "Concrete crew labor",
    category: "labor",
    trade: "concrete",
    unit: "hr",
    unitCost: 68,
    keywords: ["concrete", "slab", "pour", "footing"],
  },
  {
    id: "pb-concrete-yd",
    name: "Ready-mix concrete",
    category: "material",
    trade: "concrete",
    unit: "yd",
    unitCost: 165,
    keywords: ["concrete", "ready-mix", "slab"],
  },
  {
    id: "pb-gc-labor",
    name: "General contractor labor",
    category: "labor",
    trade: "general",
    unit: "hr",
    unitCost: 65,
    keywords: ["demo", "cleanup", "general", "handyman", "install"],
  },
  {
    id: "pb-dumpster",
    name: "20-yard dumpster",
    category: "equipment",
    trade: "general",
    unit: "ea",
    unitCost: 475,
    keywords: ["dumpster", "debris", "haul", "demo"],
  },
  {
    id: "pb-permit",
    name: "Building permit allowance",
    category: "other",
    trade: "general",
    unit: "ea",
    unitCost: 250,
    keywords: ["permit", "inspection", "fee"],
  },
  {
    id: "pb-deck-board",
    name: "5/4x6 pressure-treated deck board 12'",
    category: "material",
    trade: "carpentry",
    unit: "ea",
    unitCost: 14.5,
    keywords: ["deck", "decking", "board"],
  },
  {
    id: "pb-joist-hanger",
    name: "2x8 joist hanger",
    category: "material",
    trade: "carpentry",
    unit: "ea",
    unitCost: 2.4,
    keywords: ["joist", "hanger", "deck", "framing"],
  },
  {
    id: "pb-trim",
    name: "Primed MDF baseboard trim",
    category: "material",
    trade: "carpentry",
    unit: "ft",
    unitCost: 1.35,
    keywords: ["trim", "baseboard", "casing", "molding"],
  },
  {
    id: "pb-door",
    name: "Interior prehung door",
    category: "material",
    trade: "carpentry",
    unit: "ea",
    unitCost: 215,
    keywords: ["door", "prehung", "interior door"],
  },
  {
    id: "pb-drywall",
    name: '1/2" drywall sheet 4x8',
    category: "material",
    trade: "carpentry",
    unit: "sheet",
    unitCost: 15,
    keywords: ["drywall", "sheetrock", "patch", "wall"],
  },
  {
    id: "pb-gfci",
    name: "GFCI receptacle",
    category: "material",
    trade: "electrical",
    unit: "ea",
    unitCost: 24,
    keywords: ["gfci", "bathroom outlet", "kitchen outlet"],
  },
  {
    id: "pb-can-light",
    name: '6" LED recessed light',
    category: "material",
    trade: "electrical",
    unit: "ea",
    unitCost: 32,
    keywords: ["recessed", "can light", "lighting", "led"],
  },
  {
    id: "pb-breaker",
    name: "20A single-pole breaker",
    category: "material",
    trade: "electrical",
    unit: "ea",
    unitCost: 18,
    keywords: ["breaker", "circuit", "panel"],
  },
  {
    id: "pb-toilet",
    name: "Standard toilet (installed kit)",
    category: "material",
    trade: "plumbing",
    unit: "ea",
    unitCost: 265,
    keywords: ["toilet", "commode"],
  },
  {
    id: "pb-disposal",
    name: "1/2 HP garbage disposal",
    category: "material",
    trade: "plumbing",
    unit: "ea",
    unitCost: 139,
    keywords: ["disposal", "garbage disposal"],
  },
  {
    id: "pb-water-heater",
    name: "40-gal gas water heater",
    category: "material",
    trade: "plumbing",
    unit: "ea",
    unitCost: 925,
    keywords: ["water heater", "hot water"],
  },
  {
    id: "pb-thermostat",
    name: "Programmable thermostat",
    category: "material",
    trade: "hvac",
    unit: "ea",
    unitCost: 89,
    keywords: ["thermostat"],
  },
  {
    id: "pb-tuneup",
    name: "Furnace tune-up service",
    category: "labor",
    trade: "hvac",
    unit: "ea",
    unitCost: 129,
    keywords: ["tune-up", "tuneup", "maintenance", "service"],
  },
  {
    id: "pb-ice-water",
    name: "Ice & water shield roll",
    category: "material",
    trade: "roofing",
    unit: "roll",
    unitCost: 95,
    keywords: ["ice and water", "ice & water", "underlayment"],
  },
  {
    id: "pb-drip-edge",
    name: "Aluminum drip edge 10'",
    category: "material",
    trade: "roofing",
    unit: "ea",
    unitCost: 11,
    keywords: ["drip edge", "edge"],
  },
  {
    id: "pb-primer",
    name: "Interior primer",
    category: "material",
    trade: "painting",
    unit: "gal",
    unitCost: 28,
    keywords: ["primer", "prime"],
  },
  {
    id: "pb-ext-paint",
    name: "Exterior acrylic paint",
    category: "material",
    trade: "painting",
    unit: "gal",
    unitCost: 58,
    keywords: ["exterior", "siding", "exterior paint"],
  },
  {
    id: "pb-caulk",
    name: "Paintable caulk tube",
    category: "material",
    trade: "painting",
    unit: "ea",
    unitCost: 6.5,
    keywords: ["caulk", "seal"],
  },
  {
    id: "pb-rebar",
    name: "#4 rebar 20'",
    category: "material",
    trade: "concrete",
    unit: "ea",
    unitCost: 16,
    keywords: ["rebar", "reinforcement"],
  },
  {
    id: "pb-skid",
    name: "Skid steer rental",
    category: "equipment",
    trade: "general",
    unit: "day",
    unitCost: 340,
    keywords: ["skid steer", "bobcat", "excavate", "grading"],
  },
  {
    id: "pb-cleanup",
    name: "Final cleanup",
    category: "other",
    trade: "general",
    unit: "ea",
    unitCost: 150,
    keywords: ["cleanup", "clean up"],
  },
];


export const DEFAULT_COMPANY: CompanySettings = {
  name: "F&G Home Maintenance",
  email: "estimates@fandg-llc.com",
  phone: "(231) 555-0142",
  address: "Petoskey, MI",
  licenseNumber: "",
  defaultMarkup: 20,
  defaultTax: 6,
  terms:
    "Estimate valid for 30 days. 50% deposit due on acceptance. Balance due on completion. Change orders billed separately. Materials subject to supplier price changes.",
  // Starting point only: confirm what's taxable with your accountant.
  taxableCategories: ["material"],
  depositPercent: 50,
};

// ---------------------------------------------------------------------------
// Test data. All people, emails and phone numbers are fictional.
// Dates are relative to "now" so the dashboard and schedule always look live.
// ---------------------------------------------------------------------------

const MARKUP = 20;

function li(
  id: string,
  pricebookId: string,
  quantity: number,
  overrides: Partial<LineItem> = {}
): LineItem {
  const item = SEED_PRICEBOOK.find((p) => p.id === pricebookId);
  if (!item) throw new Error(`Unknown seed pricebook item ${pricebookId}`);
  return {
    id,
    pricebookItemId: item.id,
    description: item.name,
    category: item.category,
    quantity,
    unit: item.unit,
    unitCost: item.unitCost,
    markupPercent: MARKUP,
    ...overrides,
  };
}

function daysAgoIso(days: number, now: Date): string {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

/** Local date-time `dayOffset` days from this week's Monday, at `hour`. */
function weekSlot(now: Date, dayOffset: number, hour: number, minute = 0): string {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (monday.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(monday.getDate() - dow);
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + dayOffset,
    hour,
    minute
  ).toISOString();
}

export function createSeedData(now: Date = new Date()): AppData {
  const iso = now.toISOString();
  const customers = [
    ["cust-1", "Maya Chen", "maya.chen@example.com", "(231) 555-0198", "114 Maple Ave, Petoskey, MI 49770", "Kitchen remodel lead from referral."],
    ["cust-2", "Rivera Property Group", "ops@riveraprops.example.com", "(231) 555-0177", "500 Bay St, Harbor Springs, MI 49740", "Multi-unit punch list work. Net 15."],
    ["cust-3", "Tom & Linda Brooks", "brooks.family@example.com", "(231) 555-0131", "2210 Lakeshore Dr, Charlevoix, MI 49720", "Cottage — only on site Fri–Sun."],
    ["cust-4", "Northside Dental", "office@northsidedental.example.com", "(231) 555-0109", "88 Mitchell St, Petoskey, MI 49770", "Work after 5pm only."],
    ["cust-5", "Grace Okafor", "grace.okafor@example.com", "(231) 555-0164", "47 Pine Ridge Rd, Boyne City, MI 49712", ""],
    ["cust-6", "Walloon Lake Rentals", "manager@walloonrentals.example.com", "(231) 555-0122", "9 Shore Rd, Walloon Lake, MI 49796", "Turnover work between guests."],
    ["cust-7", "Dave Kowalski", "dkowalski@example.com", "(231) 555-0150", "315 State St, Harbor Springs, MI 49740", "Prefers text."],
    ["cust-8", "Emmet County Habitat ReStore", "restore@example.org", "(231) 555-0186", "1260 US-31, Petoskey, MI 49770", "Nonprofit — ask about discount."],
  ].map(([id, name, email, phone, address, notes]) => ({
    id,
    name,
    email,
    phone,
    address,
    notes,
    createdAt: iso,
  }));

  const addr = (customerId: string) => customers.find((c) => c.id === customerId)!.address;

  const est = (
    n: number,
    customerId: string,
    jobTitle: string,
    trade: Estimate["trade"],
    status: Estimate["status"],
    lineItems: LineItem[],
    notes: string,
    ageDays: number,
    sections: EstimateSection[] = []
  ): Estimate => ({
    id: `est-${n}`,
    number: `EST-${1000 + n}`,
    customerId,
    jobTitle,
    jobAddress: addr(customerId),
    trade,
    status,
    lineItems,
    sections,
    taxPercent: 6,
    taxableCategories: ["material"],
    notes,
    validUntil: dateOnlyFromToday(30 - ageDays, now),
    createdAt: daysAgoIso(ageDays, now),
    updatedAt: daysAgoIso(Math.max(0, ageDays - 1), now),
  });

  const estimates: Estimate[] = [
    est(1, "cust-1", "Kitchen faucet + disposal swap", "plumbing", "sent", [
      li("e1-1", "pb-plumb-labor", 3),
      li("e1-2", "pb-faucet", 1),
      li("e1-3", "pb-disposal", 1),
    ], "Includes haul-away of old faucet and disposal.", 3),
    est(2, "cust-3", "Deck rebuild 12x16", "carpentry", "accepted", [
      li("e2-0", "pb-carp-labor", 6, { description: "Carpenter labor — tear-off", sectionId: "s2-demo" }),
      li("e2-5", "pb-dumpster", 1, { sectionId: "s2-demo" }),
      li("e2-1", "pb-carp-labor", 10, { description: "Carpenter labor — framing", sectionId: "s2-frame" }),
      li("e2-4", "pb-2x4", 20, { description: "2x8 PT joist 12'", unitCost: 18.75, sectionId: "s2-frame" }),
      li("e2-3", "pb-joist-hanger", 26, { sectionId: "s2-frame" }),
      li("e2-6", "pb-carp-labor", 8, { description: "Carpenter labor — decking", sectionId: "s2-deck" }),
      li("e2-2", "pb-deck-board", 48, { sectionId: "s2-deck" }),
    ], "Removes existing deck. Railing not included.", 10, [
      { id: "s2-demo", name: "Demo & haul-away" },
      { id: "s2-frame", name: "Framing" },
      { id: "s2-deck", name: "Decking" },
    ]),
    est(3, "cust-5", "Basement outlets + recessed lighting", "electrical", "draft", [
      li("e3-1", "pb-elec-labor", 10),
      li("e3-2", "pb-outlet", 6),
      li("e3-3", "pb-can-light", 8),
      li("e3-4", "pb-romex", 250),
      li("e3-5", "pb-breaker", 2),
      li("e3-6", "pb-permit", 1),
    ], "", 1),
    est(4, "cust-7", "Roof tear-off & reshingle (22 sq)", "roofing", "sent", [
      li("e4-1", "pb-roof-labor", 22),
      li("e4-2", "pb-shingle", 24),
      li("e4-3", "pb-ice-water", 4),
      li("e4-4", "pb-drip-edge", 22),
      li("e4-5", "pb-dumpster", 1),
      li("e4-6", "pb-permit", 1),
    ], "Decking replacement billed at $85/sheet if needed.", 6),
    est(5, "cust-2", "Unit 4B repaint", "painting", "converted", [
      li("e5-1", "pb-paint-labor", 16),
      li("e5-2", "pb-primer", 3),
      li("e5-3", "pb-paint-gal", 6),
      li("e5-4", "pb-caulk", 6),
    ], "Walls and trim, two coats. Ceilings excluded.", 14),
    est(6, "cust-4", "Parking pad slab pour", "concrete", "declined", [
      li("e6-1", "pb-concrete-labor", 14),
      li("e6-2", "pb-concrete-yd", 6),
      li("e6-3", "pb-rebar", 18),
      li("e6-4", "pb-skid", 1),
    ], "", 25),
    est(7, "cust-6", "Furnace tune-ups (3 cottages) + thermostat", "hvac", "converted", [
      li("e7-1", "pb-tuneup", 3),
      li("e7-2", "pb-filter", 3),
      li("e7-3", "pb-thermostat", 1),
      li("e7-4", "pb-hvac-labor", 1),
    ], "", 30),
    est(8, "cust-1", "Guest bath refresh", "general", "accepted", [
      li("e8-2", "pb-toilet", 1, { sectionId: "s8-plumb" }),
      li("e8-3", "pb-plumb-labor", 2, { sectionId: "s8-plumb" }),
      li("e8-4", "pb-gfci", 1, { sectionId: "s8-elec" }),
      li("e8-1", "pb-gc-labor", 14, { sectionId: "s8-finish" }),
      li("e8-5", "pb-trim", 36, { sectionId: "s8-finish" }),
      li("e8-6", "pb-paint-gal", 2, { sectionId: "s8-finish" }),
      li("e8-7", "pb-cleanup", 1, { sectionId: "s8-finish" }),
    ], "Tile not included — allowance to be agreed.", 5, [
      { id: "s8-plumb", name: "Plumbing" },
      { id: "s8-elec", name: "Electrical" },
      { id: "s8-finish", name: "Carpentry & finish" },
    ]),
    est(9, "cust-2", "Punch list — units 2A, 3C", "general", "converted", [
      li("e9-1", "pb-gc-labor", 9),
      li("e9-2", "pb-door", 1),
      li("e9-3", "pb-drywall", 3),
      li("e9-4", "pb-caulk", 4),
    ], "", 35),
  ];

  const inv = (
    n: number,
    estimateId: string,
    status: Invoice["status"],
    dueInDays: number,
    paidDaysAgo?: number
  ): Invoice => {
    const e = estimates.find((x) => x.id === estimateId)!;
    return {
      id: `inv-${n}`,
      number: `INV-${2000 + n}`,
      kind: "final",
      estimateId,
      customerId: e.customerId,
      jobTitle: e.jobTitle,
      jobAddress: e.jobAddress,
      status,
      lineItems: e.lineItems.map((l) => ({ ...l, id: `${l.id}-i` })),
      sections: e.sections,
      taxPercent: e.taxPercent,
      taxableCategories: e.taxableCategories,
      depositApplied: 0,
      notes: e.notes,
      dueDate: dateOnlyFromToday(dueInDays, now),
      createdAt: daysAgoIso(14 - dueInDays, now),
      paidAt: paidDaysAgo !== undefined ? daysAgoIso(paidDaysAgo, now) : undefined,
    };
  };

  // A paid 50% deposit on the accepted deck job.
  const deck = estimates.find((x) => x.id === "est-2")!;
  const deckDeposit = Math.round(documentTotals(deck).total * 0.5 * 100) / 100;
  const deposit: Invoice = {
    id: "inv-4",
    number: "INV-2004",
    kind: "deposit",
    estimateId: deck.id,
    customerId: deck.customerId,
    jobTitle: deck.jobTitle,
    jobAddress: deck.jobAddress,
    status: "paid",
    lineItems: [
      {
        id: "dep-4",
        description: `Deposit (50%) for ${deck.number} — ${deck.jobTitle}`,
        category: "other",
        quantity: 1,
        unit: "ea",
        unitCost: deckDeposit,
        markupPercent: 0,
      },
    ],
    sections: [],
    taxPercent: 0,
    taxableCategories: [],
    depositApplied: 0,
    notes: "Deposit due on acceptance. Applied to the final invoice.",
    dueDate: dateOnlyFromToday(-8, now),
    createdAt: daysAgoIso(9, now),
    paidAt: daysAgoIso(7, now),
  };

  const invoices: Invoice[] = [
    inv(1, "est-5", "sent", 7),
    inv(2, "est-7", "paid", -12, 15),
    inv(3, "est-9", "overdue", -10),
    deposit,
  ];

  const scheduleBlocks: ScheduleBlock[] = [
    { id: "blk-1", estimateId: "est-2", lineItemIds: ["e2-0"], title: "Deck rebuild 12x16: tear-off", start: weekSlot(now, 1, 8), durationMinutes: 480 },
    { id: "blk-2", estimateId: "est-2", lineItemIds: ["e2-1"], title: "Deck rebuild 12x16: framing", start: weekSlot(now, 2, 8), durationMinutes: 480 },
    { id: "blk-3", estimateId: "est-2", lineItemIds: ["e2-6"], title: "Deck rebuild 12x16: decking", start: weekSlot(now, 3, 8), durationMinutes: 480 },
    { id: "blk-4", estimateId: "est-1", title: "Kitchen faucet + disposal swap", start: weekSlot(now, 4, 13), durationMinutes: 180 },
    { id: "blk-5", estimateId: "est-8", title: "Guest bath refresh", start: weekSlot(now, 7, 9), durationMinutes: 480 },
    { id: "blk-6", estimateId: "est-8", lineItemIds: ["e8-3"], title: "Guest bath refresh: Plumber labor", start: weekSlot(now, 8, 9), durationMinutes: 120 },
  ];

  return {
    company: { ...DEFAULT_COMPANY },
    customers,
    pricebook: SEED_PRICEBOOK.map((p) => ({ ...p, keywords: [...p.keywords] })),
    estimates,
    invoices,
    scheduleBlocks,
    counters: { estimate: 1009, invoice: 2004 },
  };
}
