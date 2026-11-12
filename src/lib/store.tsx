"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

const STORAGE_KEY = "bid-builder-v1";

type StoreContextValue = {
  ready: boolean;
  data: AppData;
  updateCompany: (patch: Partial<CompanySettings>) => void;
  upsertCustomer: (customer: Omit<Customer, "id" | "createdAt"> & { id?: string }) => Customer;
  deleteCustomer: (id: string) => void;
  upsertPricebookItem: (
    item: Omit<PricebookItem, "id"> & { id?: string }
  ) => PricebookItem;
  deletePricebookItem: (id: string) => void;
  upsertEstimate: (
    estimate: Omit<Estimate, "id" | "number" | "createdAt" | "updatedAt"> & {
      id?: string;
      number?: string;
    }
  ) => Estimate;
  deleteEstimate: (id: string) => void;
  duplicateEstimate: (id: string) => Estimate | null;
  convertEstimateToInvoice: (estimateId: string) => Invoice | null;
  upsertInvoice: (
    invoice: Omit<Invoice, "id" | "number" | "createdAt"> & {
      id?: string;
      number?: string;
    }
  ) => Invoice;
  deleteInvoice: (id: string) => void;
  markInvoicePaid: (id: string) => void;
  upsertScheduleBlock: (
    block: Omit<ScheduleBlock, "id"> & { id?: string }
  ) => ScheduleBlock;
  moveScheduleBlock: (id: string, start: string) => void;
  deleteScheduleBlock: (id: string) => void;
  resetDemoData: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function normalizeData(raw: Partial<AppData> | null): AppData {
  const seed = createSeedData();
  if (!raw) return seed;
  return {
    ...seed,
    ...raw,
    company: { ...seed.company, ...(raw.company || {}) },
    customers: raw.customers || seed.customers,
    pricebook: raw.pricebook || seed.pricebook,
    estimates: raw.estimates || seed.estimates,
    invoices: raw.invoices || seed.invoices,
    scheduleBlocks: raw.scheduleBlocks || [],
    counters: { ...seed.counters, ...(raw.counters || {}) },
  };
}

function loadData(): AppData {
  if (typeof window === "undefined") return createSeedData();
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("bid-builder-legacy-v1");
    if (!raw) return createSeedData();
    return normalizeData(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return createSeedData();
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(createSeedData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, ready]);

  const updateCompany = useCallback((patch: Partial<CompanySettings>) => {
    setData((prev) => ({ ...prev, company: { ...prev.company, ...patch } }));
  }, []);

  const upsertCustomer = useCallback(
    (customer: Omit<Customer, "id" | "createdAt"> & { id?: string }) => {
      const now = new Date().toISOString();
      let saved: Customer = {
        id: customer.id ?? uuid(),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes,
        createdAt: now,
      };
      setData((prev) => {
        const existing = customer.id
          ? prev.customers.find((c) => c.id === customer.id)
          : undefined;
        saved = {
          ...saved,
          createdAt: existing?.createdAt ?? now,
        };
        const customers = existing
          ? prev.customers.map((c) => (c.id === existing.id ? saved : c))
          : [...prev.customers, saved];
        return { ...prev, customers };
      });
      return saved;
    },
    []
  );

  const deleteCustomer = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== id),
    }));
  }, []);

  const upsertPricebookItem = useCallback(
    (item: Omit<PricebookItem, "id"> & { id?: string }) => {
      const saved: PricebookItem = {
        id: item.id ?? uuid(),
        name: item.name,
        category: item.category,
        trade: item.trade,
        unit: item.unit,
        unitCost: item.unitCost,
        keywords: item.keywords,
      };
      setData((prev) => {
        const exists = prev.pricebook.some((p) => p.id === saved.id);
        return {
          ...prev,
          pricebook: exists
            ? prev.pricebook.map((p) => (p.id === saved.id ? saved : p))
            : [...prev.pricebook, saved],
        };
      });
      return saved;
    },
    []
  );

  const deletePricebookItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      pricebook: prev.pricebook.filter((p) => p.id !== id),
    }));
  }, []);

  const upsertEstimate = useCallback(
    (
      estimate: Omit<Estimate, "id" | "number" | "createdAt" | "updatedAt"> & {
        id?: string;
        number?: string;
      }
    ) => {
      const now = new Date().toISOString();
      let saved!: Estimate;
      setData((prev) => {
        const existing = estimate.id
          ? prev.estimates.find((e) => e.id === estimate.id)
          : undefined;
        const nextCounter = existing ? prev.counters.estimate : prev.counters.estimate + 1;
        saved = {
          id: estimate.id ?? uuid(),
          number: estimate.number ?? existing?.number ?? `EST-${nextCounter}`,
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
        const estimates = existing
          ? prev.estimates.map((e) => (e.id === existing.id ? saved : e))
          : [...prev.estimates, saved];
        return {
          ...prev,
          estimates,
          counters: { ...prev.counters, estimate: nextCounter },
        };
      });
      return saved;
    },
    []
  );

  const deleteEstimate = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      estimates: prev.estimates.filter((e) => e.id !== id),
      scheduleBlocks: prev.scheduleBlocks.filter((b) => b.estimateId !== id),
    }));
  }, []);

  const duplicateEstimate = useCallback((id: string) => {
    let copy: Estimate | null = null;
    setData((prev) => {
      const source = prev.estimates.find((e) => e.id === id);
      if (!source) return prev;
      const nextCounter = prev.counters.estimate + 1;
      const now = new Date().toISOString();
      copy = {
        ...source,
        id: uuid(),
        number: `EST-${nextCounter}`,
        status: "draft",
        lineItems: source.lineItems.map((li) => ({ ...li, id: uuid() })),
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...prev,
        estimates: [...prev.estimates, copy],
        counters: { ...prev.counters, estimate: nextCounter },
      };
    });
    return copy;
  }, []);

  const upsertInvoice = useCallback(
    (
      invoice: Omit<Invoice, "id" | "number" | "createdAt"> & {
        id?: string;
        number?: string;
      }
    ) => {
      const now = new Date().toISOString();
      let saved!: Invoice;
      setData((prev) => {
        const existing = invoice.id
          ? prev.invoices.find((i) => i.id === invoice.id)
          : undefined;
        const nextCounter = existing ? prev.counters.invoice : prev.counters.invoice + 1;
        saved = {
          id: invoice.id ?? uuid(),
          number: invoice.number ?? existing?.number ?? `INV-${nextCounter}`,
          estimateId: invoice.estimateId,
          customerId: invoice.customerId,
          jobTitle: invoice.jobTitle,
          jobAddress: invoice.jobAddress,
          status: invoice.status,
          lineItems: invoice.lineItems,
          taxPercent: invoice.taxPercent,
          notes: invoice.notes,
          dueDate: invoice.dueDate,
          createdAt: existing?.createdAt ?? now,
          paidAt: invoice.paidAt,
        };
        const invoices = existing
          ? prev.invoices.map((i) => (i.id === existing.id ? saved : i))
          : [...prev.invoices, saved];
        return {
          ...prev,
          invoices,
          counters: { ...prev.counters, invoice: nextCounter },
        };
      });
      return saved;
    },
    []
  );

  const convertEstimateToInvoice = useCallback((estimateId: string) => {
    let invoice: Invoice | null = null;
    setData((prev) => {
      const estimate = prev.estimates.find((e) => e.id === estimateId);
      if (!estimate) return prev;
      const nextCounter = prev.counters.invoice + 1;
      const now = new Date().toISOString();
      invoice = {
        id: uuid(),
        number: `INV-${nextCounter}`,
        estimateId: estimate.id,
        customerId: estimate.customerId,
        jobTitle: estimate.jobTitle,
        jobAddress: estimate.jobAddress,
        status: "draft",
        lineItems: estimate.lineItems.map((li) => ({ ...li, id: uuid() })),
        taxPercent: estimate.taxPercent,
        notes: estimate.notes,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        createdAt: now,
      };
      return {
        ...prev,
        estimates: prev.estimates.map((e) =>
          e.id === estimateId ? { ...e, status: "converted", updatedAt: now } : e
        ),
        invoices: [...prev.invoices, invoice],
        counters: { ...prev.counters, invoice: nextCounter },
      };
    });
    return invoice;
  }, []);

  const deleteInvoice = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((i) => i.id !== id),
    }));
  }, []);

  const markInvoicePaid = useCallback((id: string) => {
    const now = new Date().toISOString();
    setData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((i) =>
        i.id === id ? { ...i, status: "paid", paidAt: now } : i
      ),
    }));
  }, []);

  const upsertScheduleBlock = useCallback(
    (block: Omit<ScheduleBlock, "id"> & { id?: string }) => {
      const saved: ScheduleBlock = {
        id: block.id ?? uuid(),
        estimateId: block.estimateId,
        lineItemIds: block.lineItemIds,
        title: block.title,
        start: block.start,
        durationMinutes: block.durationMinutes,
      };
      setData((prev) => {
        const exists = prev.scheduleBlocks.some((b) => b.id === saved.id);
        return {
          ...prev,
          scheduleBlocks: exists
            ? prev.scheduleBlocks.map((b) => (b.id === saved.id ? saved : b))
            : [...prev.scheduleBlocks, saved],
        };
      });
      return saved;
    },
    []
  );

  const moveScheduleBlock = useCallback((id: string, start: string) => {
    setData((prev) => ({
      ...prev,
      scheduleBlocks: prev.scheduleBlocks.map((b) =>
        b.id === id ? { ...b, start } : b
      ),
    }));
  }, []);

  const deleteScheduleBlock = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      scheduleBlocks: prev.scheduleBlocks.filter((b) => b.id !== id),
    }));
  }, []);

  const resetDemoData = useCallback(() => {
    const seed = createSeedData();
    setData(seed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      data,
      updateCompany,
      upsertCustomer,
      deleteCustomer,
      upsertPricebookItem,
      deletePricebookItem,
      upsertEstimate,
      deleteEstimate,
      duplicateEstimate,
      convertEstimateToInvoice,
      upsertInvoice,
      deleteInvoice,
      markInvoicePaid,
      upsertScheduleBlock,
      moveScheduleBlock,
      deleteScheduleBlock,
      resetDemoData,
    }),
    [
      ready,
      data,
      updateCompany,
      upsertCustomer,
      deleteCustomer,
      upsertPricebookItem,
      deletePricebookItem,
      upsertEstimate,
      deleteEstimate,
      duplicateEstimate,
      convertEstimateToInvoice,
      upsertInvoice,
      deleteInvoice,
      markInvoicePaid,
      upsertScheduleBlock,
      moveScheduleBlock,
      deleteScheduleBlock,
      resetDemoData,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function newLineItem(
  partial?: Partial<LineItem>,
  defaultMarkup = 20
): LineItem {
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
