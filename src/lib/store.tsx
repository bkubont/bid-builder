"use client";

/**
 * Browser-local data store (interim until the Phase 2 database).
 *
 * State lives in a module-level variable and every change is applied
 * synchronously, so an action can return what it just saved and two actions
 * in the same click (save, then convert) see each other's changes. Changes
 * made in another tab arrive through the `storage` event, so tabs no longer
 * overwrite each other.
 */

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import { createSeedData } from "./seed";
import type {
  AppData,
  CompanySettings,
  Customer,
  Estimate,
  Invoice,
  LineItem,
  PricebookItem,
  ScheduleBlock,
} from "./types";
import { dateOnlyFromToday, toDateOnly } from "./utils";

export const STORAGE_KEY = "bid-builder-v2";

// ---------------------------------------------------------------------------
// External store
// ---------------------------------------------------------------------------

let state: AppData | null = null;
const listeners = new Set<() => void>();
let warnedSaveFailure = false;

function normalizeData(raw: Partial<AppData> | null): AppData {
  const seed = createSeedData();
  if (!raw) return seed;
  return {
    company: { ...seed.company, ...(raw.company || {}) },
    customers: raw.customers ?? seed.customers,
    pricebook: raw.pricebook ?? seed.pricebook,
    estimates: (raw.estimates ?? seed.estimates).map((e) => ({
      ...e,
      validUntil: toDateOnly(e.validUntil),
    })),
    invoices: (raw.invoices ?? seed.invoices).map((i) => ({
      ...i,
      dueDate: toDateOnly(i.dueDate),
    })),
    scheduleBlocks: raw.scheduleBlocks ?? [],
    counters: { ...seed.counters, ...(raw.counters || {}) },
  };
}

function readStorage(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedData();
    return normalizeData(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return createSeedData();
  }
}

function writeStorage(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Bid Builder could not save to this browser", error);
    if (!warnedSaveFailure) {
      warnedSaveFailure = true;
      window.alert(
        "Bid Builder couldn't save your last change on this device (browser storage is full or blocked). Keep this tab open and don't refresh."
      );
    }
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  try {
    state = event.newValue
      ? normalizeData(JSON.parse(event.newValue) as Partial<AppData>)
      : createSeedData();
    emit();
  } catch {
    // Ignore a malformed write from another tab; keep what we have.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): AppData {
  if (state === null) {
    state = readStorage();
    // Persist the seed on first run so other tabs share the same data.
    writeStorage(state);
  }
  return state;
}

function getServerSnapshot(): AppData | null {
  return null;
}

/** Apply a change synchronously, persist it, notify subscribers. */
function commit<T>(change: (prev: AppData) => { next: AppData; result: T }): T {
  const { next, result } = change(getSnapshot());
  if (next !== state) {
    state = next;
    writeStorage(next);
    emit();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type EstimateInput = Omit<Estimate, "id" | "number" | "createdAt" | "updatedAt"> & {
  id?: string;
  number?: string;
};

type InvoiceInput = Omit<Invoice, "id" | "number" | "createdAt"> & {
  id?: string;
  number?: string;
};

const actions = {
  updateCompany(patch: Partial<CompanySettings>) {
    commit((prev) => ({
      next: { ...prev, company: { ...prev.company, ...patch } },
      result: undefined,
    }));
  },

  upsertCustomer(customer: Omit<Customer, "id" | "createdAt"> & { id?: string }): Customer {
    return commit((prev) => {
      const existing = customer.id
        ? prev.customers.find((c) => c.id === customer.id)
        : undefined;
      const saved: Customer = {
        id: existing?.id ?? uuid(),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      const customers = existing
        ? prev.customers.map((c) => (c.id === existing.id ? saved : c))
        : [...prev.customers, saved];
      return { next: { ...prev, customers }, result: saved };
    });
  },

  deleteCustomer(id: string) {
    commit((prev) => ({
      next: { ...prev, customers: prev.customers.filter((c) => c.id !== id) },
      result: undefined,
    }));
  },

  upsertPricebookItem(item: Omit<PricebookItem, "id"> & { id?: string }): PricebookItem {
    return commit((prev) => {
      const saved: PricebookItem = { ...item, id: item.id ?? uuid() };
      const exists = prev.pricebook.some((p) => p.id === saved.id);
      return {
        next: {
          ...prev,
          pricebook: exists
            ? prev.pricebook.map((p) => (p.id === saved.id ? saved : p))
            : [...prev.pricebook, saved],
        },
        result: saved,
      };
    });
  },

  deletePricebookItem(id: string) {
    commit((prev) => ({
      next: { ...prev, pricebook: prev.pricebook.filter((p) => p.id !== id) },
      result: undefined,
    }));
  },

  upsertEstimate(estimate: EstimateInput): Estimate {
    return commit((prev) => {
      const existing = estimate.id
        ? prev.estimates.find((e) => e.id === estimate.id)
        : undefined;
      const now = new Date().toISOString();
      const counter = existing ? prev.counters.estimate : prev.counters.estimate + 1;
      const saved: Estimate = {
        id: existing?.id ?? uuid(),
        number: existing?.number ?? estimate.number ?? `EST-${counter}`,
        customerId: estimate.customerId,
        jobTitle: estimate.jobTitle,
        jobAddress: estimate.jobAddress,
        trade: estimate.trade,
        status: estimate.status,
        lineItems: estimate.lineItems,
        taxPercent: estimate.taxPercent,
        notes: estimate.notes,
        validUntil: estimate.validUntil,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      return {
        next: {
          ...prev,
          estimates: existing
            ? prev.estimates.map((e) => (e.id === existing.id ? saved : e))
            : [...prev.estimates, saved],
          counters: { ...prev.counters, estimate: counter },
        },
        result: saved,
      };
    });
  },

  deleteEstimate(id: string) {
    commit((prev) => ({
      next: {
        ...prev,
        estimates: prev.estimates.filter((e) => e.id !== id),
        scheduleBlocks: prev.scheduleBlocks.filter((b) => b.estimateId !== id),
      },
      result: undefined,
    }));
  },

  duplicateEstimate(id: string): Estimate | null {
    return commit((prev) => {
      const source = prev.estimates.find((e) => e.id === id);
      if (!source) return { next: prev, result: null };
      const counter = prev.counters.estimate + 1;
      const now = new Date().toISOString();
      const copy: Estimate = {
        ...source,
        id: uuid(),
        number: `EST-${counter}`,
        status: "draft",
        jobTitle: `${source.jobTitle} (copy)`,
        lineItems: source.lineItems.map((li) => ({ ...li, id: uuid() })),
        validUntil: dateOnlyFromToday(30),
        createdAt: now,
        updatedAt: now,
      };
      return {
        next: {
          ...prev,
          estimates: [...prev.estimates, copy],
          counters: { ...prev.counters, estimate: counter },
        },
        result: copy,
      };
    });
  },

  /**
   * Create an invoice from an estimate. If one already exists for this
   * estimate it is returned instead, so a double tap can't bill twice.
   */
  convertEstimateToInvoice(estimateId: string): Invoice | null {
    return commit((prev) => {
      const already = prev.invoices.find((i) => i.estimateId === estimateId);
      if (already) return { next: prev, result: already };
      const estimate = prev.estimates.find((e) => e.id === estimateId);
      if (!estimate) return { next: prev, result: null };
      const counter = prev.counters.invoice + 1;
      const now = new Date().toISOString();
      const invoice: Invoice = {
        id: uuid(),
        number: `INV-${counter}`,
        estimateId: estimate.id,
        customerId: estimate.customerId,
        jobTitle: estimate.jobTitle,
        jobAddress: estimate.jobAddress,
        status: "draft",
        lineItems: estimate.lineItems.map((li) => ({ ...li, id: uuid() })),
        taxPercent: estimate.taxPercent,
        notes: estimate.notes,
        dueDate: dateOnlyFromToday(14),
        createdAt: now,
      };
      return {
        next: {
          ...prev,
          estimates: prev.estimates.map((e) =>
            e.id === estimateId ? { ...e, status: "converted", updatedAt: now } : e
          ),
          invoices: [...prev.invoices, invoice],
          counters: { ...prev.counters, invoice: counter },
        },
        result: invoice,
      };
    });
  },

  upsertInvoice(invoice: InvoiceInput): Invoice {
    return commit((prev) => {
      const existing = invoice.id
        ? prev.invoices.find((i) => i.id === invoice.id)
        : undefined;
      const counter = existing ? prev.counters.invoice : prev.counters.invoice + 1;
      const saved: Invoice = {
        id: existing?.id ?? uuid(),
        number: existing?.number ?? invoice.number ?? `INV-${counter}`,
        estimateId: invoice.estimateId,
        customerId: invoice.customerId,
        jobTitle: invoice.jobTitle,
        jobAddress: invoice.jobAddress,
        status: invoice.status,
        lineItems: invoice.lineItems,
        taxPercent: invoice.taxPercent,
        notes: invoice.notes,
        dueDate: invoice.dueDate,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        // Only a paid invoice keeps a paid date.
        paidAt:
          invoice.status === "paid"
            ? invoice.paidAt ?? existing?.paidAt ?? new Date().toISOString()
            : undefined,
      };
      return {
        next: {
          ...prev,
          invoices: existing
            ? prev.invoices.map((i) => (i.id === existing.id ? saved : i))
            : [...prev.invoices, saved],
          counters: { ...prev.counters, invoice: counter },
        },
        result: saved,
      };
    });
  },

  deleteInvoice(id: string) {
    commit((prev) => ({
      next: { ...prev, invoices: prev.invoices.filter((i) => i.id !== id) },
      result: undefined,
    }));
  },

  markInvoicePaid(id: string) {
    const now = new Date().toISOString();
    commit((prev) => ({
      next: {
        ...prev,
        invoices: prev.invoices.map((i) =>
          i.id === id ? { ...i, status: "paid" as const, paidAt: now } : i
        ),
      },
      result: undefined,
    }));
  },

  upsertScheduleBlock(block: Omit<ScheduleBlock, "id"> & { id?: string }): ScheduleBlock {
    return commit((prev) => {
      const saved: ScheduleBlock = { ...block, id: block.id ?? uuid() };
      const exists = prev.scheduleBlocks.some((b) => b.id === saved.id);
      return {
        next: {
          ...prev,
          scheduleBlocks: exists
            ? prev.scheduleBlocks.map((b) => (b.id === saved.id ? saved : b))
            : [...prev.scheduleBlocks, saved],
        },
        result: saved,
      };
    });
  },

  moveScheduleBlock(id: string, start: string) {
    commit((prev) => ({
      next: {
        ...prev,
        scheduleBlocks: prev.scheduleBlocks.map((b) => (b.id === id ? { ...b, start } : b)),
      },
      result: undefined,
    }));
  },

  deleteScheduleBlock(id: string) {
    commit((prev) => ({
      next: { ...prev, scheduleBlocks: prev.scheduleBlocks.filter((b) => b.id !== id) },
      result: undefined,
    }));
  },

  resetDemoData() {
    commit(() => ({ next: createSeedData(), result: undefined }));
  },
};

// ---------------------------------------------------------------------------
// React bindings
// ---------------------------------------------------------------------------

type StoreContextValue = typeof actions & {
  /** False during server render / first hydration pass. */
  ready: boolean;
  data: AppData;
};

const StoreContext = createContext<StoreContextValue | null>(null);

// Placeholder shown only while not ready; pages render a loading state then.
const EMPTY: AppData = createSeedData();

export function StoreProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = useMemo(
    () => ({ ...actions, ready: snapshot !== null, data: snapshot ?? EMPTY }),
    [snapshot]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function newLineItem(partial?: Partial<LineItem>, defaultMarkup = 20): LineItem {
  return {
    id: uuid(),
    description: "",
    category: "labor",
    quantity: 1,
    unit: "ea",
    unitCost: 0,
    markupPercent: defaultMarkup,
    ...partial,
  };
}
