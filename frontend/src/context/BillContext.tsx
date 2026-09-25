import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Bill, GstMode, SplitResult } from "@/types";
import { api, ApiError } from "@/api/client";

const STORAGE_KEY = "splitreceipt.activeBillId";

type BillContextValue = {
  bill: Bill | null;
  split: SplitResult | null;
  readOnly: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;

  createBill: (title?: string) => Promise<boolean>;
  joinBill: (joinCode: string) => Promise<boolean>;
  openBill: (billId: string) => Promise<boolean>;
  leaveBill: () => void;

  setTitle: (title: string) => Promise<void>;
  addPerson: (name: string) => Promise<void>;
  removePerson: (personId: string) => Promise<void>;
  setPersonSettled: (personId: string, settled: boolean) => Promise<void>;
  addItem: (item: { name: string; price: number; quantity?: number }) => Promise<void>;
  importReceipt: (imageBase64: string, mimeType?: string) => Promise<void>;
  updateItem: (itemId: string, patch: { name?: string; price?: number; quantity?: number }) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  toggleAssignment: (itemId: string, personId: string) => Promise<void>;
  setGstMode: (mode: GstMode) => Promise<void>;
  setTipAmount: (amount: number) => Promise<void>;
  setServiceFeeAmount: (amount: number) => Promise<void>;
  setBillPaid: (paid: boolean) => Promise<void>;
};

const BillContext = createContext<BillContextValue | undefined>(undefined);

export function BillProvider({ children, ownerId }: { children: ReactNode; ownerId: string }) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [split, setSplit] = useState<SplitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readOnly = Boolean(bill && bill.ownerId !== ownerId);

  // On first load, try to restore whatever bill the user was last working on.
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) return;
    setLoading(true);
    api
      .getBill(savedId)
      .then(async (b) => {
        setBill(b);
        setSplit(await api.getSplit(b.id));
      })
      .catch(() => {
        // Bill no longer exists on the server (or server restarted, since
        // the backend is in-memory for now) — silently drop the stale id.
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const openBill = useCallback(async (billId: string) => {
    setLoading(true);
    setError(null);
    try {
      const opened = await api.getBill(billId);
      localStorage.setItem(STORAGE_KEY, opened.id);
      setBill(opened);
      setSplit(await api.getSplit(opened.id));
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't open that bill.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handle = useCallback(async (fn: () => Promise<Bill>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await fn();
      setBill(updated);
      const newSplit = await api.getSplit(updated.id);
      setSplit(newSplit);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const createBill = useCallback(async (title?: string) => {
    setLoading(true);
    setError(null);
    try {
      const b = await api.createBill(title);
      localStorage.setItem(STORAGE_KEY, b.id);
      setBill(b);
      setSplit(await api.getSplit(b.id));
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start a new split. Try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const joinBill = useCallback(async (joinCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const b = await api.getBillByJoinCode(joinCode.trim());
      localStorage.setItem(STORAGE_KEY, b.id);
      setBill(b);
      setSplit(await api.getSplitByJoinCode(joinCode.trim()));
      return true;
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? "No split found with that code — double check it and try again."
          : e instanceof ApiError
            ? e.message
            : "Couldn't join that split. Try again."
      );
          return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const leaveBill = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setBill(null);
    setSplit(null);
    setError(null);
  }, []);

  const value: BillContextValue = {
    bill,
    split,
    readOnly,
    loading,
    error,
    clearError: () => setError(null),
    createBill,
    joinBill,
    openBill,
    leaveBill,
    setTitle: (title) => handle(() => api.updateSettings(bill!.id, { title })),
    addPerson: (name) => handle(() => api.addPerson(bill!.id, name)),
    removePerson: (personId) => handle(() => api.removePerson(bill!.id, personId)),
    setPersonSettled: (personId, settled) => handle(() => api.setPersonSettled(bill!.id, personId, settled)),
    addItem: (item) => handle(() => api.addItem(bill!.id, item)),
    importReceipt: (imageBase64, mimeType) => handle(async () => (await api.importReceipt(bill!.id, imageBase64, mimeType)).bill),
    updateItem: (itemId, patch) => handle(() => api.updateItem(bill!.id, itemId, patch)),
    removeItem: (itemId) => handle(() => api.removeItem(bill!.id, itemId)),
    toggleAssignment: (itemId, personId) => handle(() => api.toggleAssignment(bill!.id, itemId, personId)),
    setGstMode: (mode) => handle(() => api.updateSettings(bill!.id, { gstMode: mode })),
    setTipAmount: (amount) => handle(() => api.updateSettings(bill!.id, { tipAmount: amount })),
    setServiceFeeAmount: (amount) => handle(() => api.updateSettings(bill!.id, { serviceFeeAmount: amount })),
    setBillPaid: (paid) => handle(() => api.setBillPaid(bill!.id, paid)),
  };

  return <BillContext.Provider value={value}>{children}</BillContext.Provider>;
}

export function useBill(): BillContextValue {
  const ctx = useContext(BillContext);
  if (!ctx) throw new Error("useBill must be used within a BillProvider");
  return ctx;
}
