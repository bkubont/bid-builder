"use client";

/**
 * App data on the client. The server is the source of truth: every change
 * goes through a server action and the result is merged into local state.
 *
 * - The page loads with the company's data already rendered by the server.
 * - A copy is kept on this device so the app can still be *viewed* offline.
 * - Data refreshes when the app comes back into view, so changes made on
 *   another device show up.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import { hardNavigate } from "./utils";
import * as actions from "@/server/actions";
import type { ActionResult } from "@/server/actions";
import type {
  AppData,
  CompanySettings,
  Customer,
  Estimate,
  Invoice,
  InvoiceStatus,
  LineItem,
  MeInfo,
  PricebookItem,
  ScheduleBlock,
} from "./types";

const CACHE_PREFIX = "bid-builder-cache:v1:";
const REFRESH_MS = 2 * 60 * 1000;

export const OFFLINE_MESSAGE = "You're offline. You can look around, but changes can't be saved until you're back online.";

type Toast = { id: number; message: string; tone: "info" | "error" };

/** The tax rule is set by the server when an estimate is created, so it isn't sent. */
type EstimateInput = Omit<Estimate, "id" | "number" | "createdAt" | "updatedAt" | "taxableCategories"> & { id?: string };

function readCache(userId: string): { savedAt: number; data: AppData } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, data: AppData) {
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Storage full or blocked: offline viewing just won't have the latest copy.
  }
}

/** Remove everything this app stored on the device (used on sign-out). */
export async function clearDeviceData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("bid-builder"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("bid-builder")).map((k) => caches.delete(k)));
    }
  } catch {}
}

/** Unwrap a server action result, turning failures into readable errors. */
async function call<T>(fn: () => Promise<ActionResult<T>>): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error(OFFLINE_MESSAGE);
  let result: ActionResult<T>;
  try {
    result = await fn();
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    if (/Server Action/i.test(text)) {
      throw new Error("Bid Builder was just updated. Reload the page to keep working.");
    }
    throw new Error(navigator.onLine ? "Couldn't reach the server. Try again." : OFFLINE_MESSAGE);
  }
  if (!result.ok) {
    if (/session has ended/i.test(result.error)) {
      hardNavigate("/login");
    }
    throw new Error(result.error);
  }
  return result.data;
}

function upsertById<T extends { id: string }>(list: T[], item: T, atStart = false): T[] {
  const exists = list.some((x) => x.id === item.id);
  if (exists) return list.map((x) => (x.id === item.id ? item : x));
  return atStart ? [item, ...list] : [...list, item];
}

function useStoreValue(initialData: AppData, loadedAt: number, me: MeInfo, emailEnabled: boolean) {
  const [data, setData] = useState<AppData>(() => {
    // If the server copy came from the offline page cache, a newer copy saved
    // on this device wins.
    if (typeof window === "undefined") return initialData;
    const cached = readCache(me.id);
    return cached && cached.savedAt > loadedAt ? cached.data : initialData;
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [online, setOnline] = useState(true);
  const pending = useRef(0);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 2500);
  }, []);

  // Keep the device copy current for offline viewing.
  useEffect(() => {
    writeCache(me.id, data);
  }, [data, me.id]);

  const refresh = useCallback(async () => {
    if (pending.current > 0 || !navigator.onLine) return;
    try {
      const result = await actions.getSnapshotAction();
      if (result.ok && pending.current === 0) setData(result.data);
      else if (!result.ok && /session has ended/i.test(result.error)) hardNavigate("/login");
    } catch {
      // Offline or server unreachable: keep showing what we have.
    }
  }, []);

  // Refresh when the app comes back into view, and every few minutes while open.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    const onOnline = () => {
      update();
      refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", update);
    const timer = window.setInterval(() => document.visibilityState === "visible" && refresh(), REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", update);
      window.clearInterval(timer);
    };
  }, [refresh]);

  /** Run a server change; refreshes pause while it's in flight. */
  const mutate = useCallback(async <T,>(fn: () => Promise<ActionResult<T>>): Promise<T> => {
    pending.current++;
    try {
      return await call(fn);
    } finally {
      pending.current--;
    }
  }, []);

  const api = useMemo(
    () => ({
      async updateCompany(company: CompanySettings) {
        const saved = await mutate(() => actions.updateCompanyAction(company));
        setData((d) => ({ ...d, company: saved }));
        return true as const;
      },

      async upsertCustomer(input: Omit<Customer, "id" | "createdAt"> & { id?: string }) {
        const saved = await mutate(() => actions.upsertCustomerAction(input));
        setData((d) => ({
          ...d,
          customers: upsertById(d.customers, saved).sort((a, b) => a.name.localeCompare(b.name)),
        }));
        return saved;
      },

      async deleteCustomer(id: string) {
        await mutate(() => actions.deleteCustomerAction(id));
        setData((d) => ({
          ...d,
          customers: d.customers.filter((c) => c.id !== id),
          // The database clears the link; mirror it locally.
          estimates: d.estimates.map((e) => (e.customerId === id ? { ...e, customerId: "" } : e)),
          invoices: d.invoices.map((i) => (i.customerId === id ? { ...i, customerId: "" } : i)),
        }));
        return true as const;
      },

      async upsertPricebookItem(input: Omit<PricebookItem, "id"> & { id?: string }) {
        const saved = await mutate(() => actions.upsertPricebookItemAction(input));
        setData((d) => ({ ...d, pricebook: upsertById(d.pricebook, saved) }));
        return saved;
      },

      async deletePricebookItem(id: string) {
        await mutate(() => actions.deletePricebookItemAction(id));
        setData((d) => ({ ...d, pricebook: d.pricebook.filter((p) => p.id !== id) }));
        return true as const;
      },

      async upsertEstimate(input: EstimateInput) {
        const saved = await mutate(() => actions.upsertEstimateAction(input));
        setData((d) => ({ ...d, estimates: upsertById(d.estimates, saved, true) }));
        return saved;
      },

      async deleteEstimate(id: string) {
        await mutate(() => actions.deleteEstimateAction(id));
        setData((d) => ({
          ...d,
          estimates: d.estimates.filter((e) => e.id !== id),
          scheduleBlocks: d.scheduleBlocks.filter((b) => b.estimateId !== id),
          invoices: d.invoices.map((i) => (i.estimateId === id ? { ...i, estimateId: undefined } : i)),
        }));
        return true as const;
      },

      async duplicateEstimate(id: string) {
        const copy = await mutate(() => actions.duplicateEstimateAction(id));
        setData((d) => ({ ...d, estimates: [copy, ...d.estimates] }));
        return copy;
      },

      async convertEstimateToInvoice(estimateId: string): Promise<Invoice> {
        const { invoice, estimate } = await mutate(() => actions.convertEstimateAction(estimateId));
        setData((d) => ({
          ...d,
          estimates: upsertById(d.estimates, estimate),
          invoices: upsertById(d.invoices, invoice, true),
        }));
        return invoice;
      },

      async requestDeposit(estimateId: string, percent: number): Promise<Invoice> {
        const { invoice, estimate } = await mutate(() => actions.requestDepositAction(estimateId, percent));
        setData((d) => ({
          ...d,
          estimates: upsertById(d.estimates, estimate),
          invoices: upsertById(d.invoices, invoice, true),
        }));
        return invoice;
      },

      /** Email a document; drafts become "sent". */
      async sendDocument(input: {
        documentType: "estimate" | "invoice";
        documentId: string;
        to: string;
        subject: string;
        message: string;
        pdfBase64: string;
      }) {
        await mutate(() => actions.sendDocumentAction(input));
        const sent = <T extends { id: string; status: string }>(list: T[]) =>
          list.map((x) => (x.id === input.documentId && x.status === "draft" ? { ...x, status: "sent" } : x));
        setData((d) =>
          input.documentType === "estimate"
            ? { ...d, estimates: sent(d.estimates) }
            : { ...d, invoices: sent(d.invoices) }
        );
        return true as const;
      },

      async updateInvoice(input: { id: string; status: InvoiceStatus; dueDate?: string; notes?: string }) {
        const saved = await mutate(() => actions.updateInvoiceAction(input));
        setData((d) => ({ ...d, invoices: upsertById(d.invoices, saved) }));
        return saved;
      },

      async markInvoicePaid(id: string) {
        const saved = await mutate(() => actions.updateInvoiceAction({ id, status: "paid" }));
        setData((d) => ({ ...d, invoices: upsertById(d.invoices, saved) }));
        return saved;
      },

      async deleteInvoice(id: string) {
        await mutate(() => actions.deleteInvoiceAction(id));
        setData((d) => ({ ...d, invoices: d.invoices.filter((i) => i.id !== id) }));
        return true as const;
      },

      async upsertScheduleBlock(input: Omit<ScheduleBlock, "id"> & { id?: string }) {
        const saved = await mutate(() => actions.upsertScheduleBlockAction(input));
        setData((d) => ({ ...d, scheduleBlocks: upsertById(d.scheduleBlocks, saved) }));
        return saved;
      },

      /** Moves show immediately; undone if the server refuses. */
      /**
       * Move, resize or reassign a block. Shows immediately; undone if the
       * server refuses.
       */
      async updateScheduleBlock(
        id: string,
        patch: { start?: string; durationMinutes?: number; assignedUserId?: string | null; title?: string }
      ) {
        let previous: ScheduleBlock | undefined;
        setData((d) => ({
          ...d,
          scheduleBlocks: d.scheduleBlocks.map((b) => {
            if (b.id !== id) return b;
            previous = b;
            return { ...b, ...patch };
          }),
        }));
        try {
          const saved = await mutate(() => actions.updateScheduleBlockAction(id, patch));
          setData((d) => ({ ...d, scheduleBlocks: upsertById(d.scheduleBlocks, saved) }));
          return saved;
        } catch (error) {
          setData((d) => ({
            ...d,
            scheduleBlocks: d.scheduleBlocks.map((b) => (b.id === id && previous ? previous : b)),
          }));
          throw error;
        }
      },

      async deleteScheduleBlock(id: string) {
        await mutate(() => actions.deleteScheduleBlockAction(id));
        setData((d) => ({ ...d, scheduleBlocks: d.scheduleBlocks.filter((b) => b.id !== id) }));
        return true as const;
      },

      async replaceWithTestData() {
        const snapshot = await mutate(() => actions.replaceWithTestDataAction());
        setData(snapshot);
        return true as const;
      },
    }),
    [mutate]
  );

  return { ready: true as const, data, me, online, refresh, notify, toasts, emailEnabled, ...api };
}

type StoreValue = ReturnType<typeof useStoreValue>;
const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({
  initialData,
  loadedAt,
  me,
  emailEnabled,
  children,
}: {
  initialData: AppData;
  loadedAt: number;
  me: MeInfo;
  /** Whether the server can send email (RESEND_API_KEY + EMAIL_FROM). */
  emailEnabled: boolean;
  children: ReactNode;
}) {
  const value = useStoreValue(initialData, loadedAt, me, emailEnabled);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/** Show an action's error as a toast instead of throwing. Returns undefined on failure. */
export function useSafe() {
  const { notify } = useStore();
  return useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const result = await fn();
        if (success) notify(success);
        return result;
      } catch (error) {
        notify(error instanceof Error ? error.message : "Something went wrong.", "error");
        return undefined;
      }
    },
    [notify]
  );
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
