import { Account, Bill, BillItem, GstMode, SplitResult } from "@/types";

// Configure via a .env file: VITE_API_BASE_URL=http://192.168.1.23:3001
// Defaults to localhost, which only works when the browser and backend are
// on the same machine — set this explicitly to test from a phone browser
// against a backend running on your laptop.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const TOKEN_KEY = "splitreceipt.authToken";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(localStorage.getItem(TOKEN_KEY) ? { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } : {}),
      },
      ...options,
    });
  } catch {
    throw new ApiError(0, `Couldn't reach the server at ${API_BASE}. Is the backend running?`);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: "PATCH", body: JSON.stringify(body) });

export const api = {
  register: (body: { email: string; password: string; displayName: string }) =>
    request<{ account: Account; token: string }>("/api/auth/register", json(body)),
  login: (body: { email: string; password: string }) =>
    request<{ account: Account; token: string }>("/api/auth/login", json(body)),
  loginWithOAuth: (body: { accessToken: string }) =>
    request<{ account: Account; token: string }>("/api/auth/oauth", json(body)),
  getMe: () => request<Account>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  getAccountBills: () => request<{ active: Bill[]; paid: Bill[] }>("/api/auth/me/bills"),
  setBillPaid: (billId: string, paid: boolean) => request<Bill>(`/api/bills/${billId}/paid`, patch({ paid })),
  createBill: (title?: string) => request<Bill>("/api/bills", { ...json({ title }), method: "POST" }),
  getBill: (billId: string) => request<Bill>(`/api/bills/${billId}`),
  getBillByJoinCode: (joinCode: string) => request<Bill>(`/api/bills/by-code/${joinCode}`),
  getSplitByJoinCode: (joinCode: string) => request<SplitResult>(`/api/bills/by-code/${joinCode}/split`),
  updateSettings: (
    billId: string,
    settings: Partial<Pick<Bill, "title" | "gstMode" | "gstRate" | "tipAmount" | "serviceFeeAmount">>
  ) => request<Bill>(`/api/bills/${billId}`, patch(settings)),
  getSplit: (billId: string) => request<SplitResult>(`/api/bills/${billId}/split`),
  importReceipt: (billId: string, imageBase64: string, mimeType?: string) =>
    request<{ bill: Bill; extraction: { items: Array<{ name: string; price: number; quantity: number }>; total: number } }>(
      `/api/bills/${billId}/receipt`,
      json({ imageBase64, mimeType })
    ),

  addPerson: (billId: string, name: string) =>
    request<Bill>(`/api/bills/${billId}/people`, json({ name })),
  removePerson: (billId: string, personId: string) =>
    request<Bill>(`/api/bills/${billId}/people/${personId}`, { method: "DELETE" }),
  setPersonSettled: (billId: string, personId: string, settled: boolean) =>
    request<Bill>(`/api/bills/${billId}/people/${personId}/settled`, patch({ settled })),

  addItem: (billId: string, item: { name: string; price: number; quantity?: number }) =>
    request<Bill>(`/api/bills/${billId}/items`, json(item)),
  updateItem: (billId: string, itemId: string, patchBody: Partial<Pick<BillItem, "name" | "price" | "quantity">>) =>
    request<Bill>(`/api/bills/${billId}/items/${itemId}`, patch(patchBody)),
  removeItem: (billId: string, itemId: string) =>
    request<Bill>(`/api/bills/${billId}/items/${itemId}`, { method: "DELETE" }),
  toggleAssignment: (billId: string, itemId: string, personId: string) =>
    request<Bill>(`/api/bills/${billId}/items/${itemId}/assignments`, json({ personId })),
};

export type { GstMode };
export { ApiError };
export const authToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};
