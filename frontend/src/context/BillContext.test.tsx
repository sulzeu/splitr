import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/api/client";
import { BillProvider, useBill } from "./BillContext";
import type { Bill, SplitResult } from "@/types";

vi.mock("@/api/client", () => ({
  api: {
    getBill: vi.fn(),
    getSplit: vi.fn(),
    getSplitByJoinCode: vi.fn(),
    createBill: vi.fn(),
    addPerson: vi.fn(),
    importReceipt: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
    }
  },
}));

const bill: Bill = {
  id: "bill-1",
  ownerId: "owner-1",
  joinCode: "ABCD12",
  createdAt: 1,
  title: "Dinner",
  people: [],
  items: [],
  gstMode: "none",
  gstRate: 0,
  tipAmount: 0,
  serviceFeeAmount: 0,
  settledPersonIds: [],
  version: 1,
};

const split: SplitResult = {
  personTotals: [],
  unassignedSubtotal: 0,
  grandTotal: 0,
};

function ContextProbe() {
  const context = useBill();
  const [receiptImportStatus, setReceiptImportStatus] = useState("not attempted");
  return (
    <div>
      <output data-testid="bill">{context.bill?.title ?? "no bill"}</output>
      <output data-testid="split">{context.split ? "split loaded" : "no split"}</output>
      <output data-testid="loading">{String(context.loading)}</output>
      <output data-testid="error">{context.error ?? "no error"}</output>
      <output data-testid="read-only">{String(context.readOnly)}</output>
      <output data-testid="receipt-import-status">{receiptImportStatus}</output>
      <button onClick={() => void context.createBill("New dinner")}>Create</button>
      <button onClick={() => void context.addPerson("Ada")}>Add person</button>
      <button
        onClick={() =>
          void context.importReceipt("image-data", "image/jpeg").then(
            () => setReceiptImportStatus("succeeded"),
            () => setReceiptImportStatus("failed")
          )
        }
      >
        Import receipt
      </button>
      <button onClick={() => context.clearError()}>Clear error</button>
    </div>
  );
}

function renderProvider(ownerId = "owner-1") {
  return render(
    <BillProvider ownerId={ownerId}>
      <ContextProbe />
    </BillProvider>
  );
}

describe("BillProvider", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  it("restores the saved bill and its split", async () => {
    storage.set("splitreceipt.activeBillId", bill.id);
    vi.mocked(api.getBill).mockResolvedValue(bill);
    vi.mocked(api.getSplit).mockResolvedValue(split);

    renderProvider();

    expect(await screen.findByText("Dinner")).toBeInTheDocument();
    expect(screen.getByTestId("split")).toHaveTextContent("split loaded");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(api.getBill).toHaveBeenCalledWith(bill.id);
    expect(api.getSplit).toHaveBeenCalledWith(bill.id);
  });

  it("clears an expired saved bill id when restoration fails", async () => {
    storage.set("splitreceipt.activeBillId", bill.id);
    vi.mocked(api.getBill).mockRejectedValue(new ApiError(404, "Bill not found"));

    renderProvider();

    await waitFor(() => {
      expect(storage.has("splitreceipt.activeBillId")).toBe(false);
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("bill")).toHaveTextContent("no bill");
  });

  it("surfaces create failures and allows the error to be cleared", async () => {
    vi.mocked(api.createBill).mockRejectedValue(new ApiError(503, "Service unavailable"));
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Service unavailable")
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Clear error" }));
    expect(screen.getByTestId("error")).toHaveTextContent("no error");
  });

  it("uses a safe fallback message for unexpected mutation errors", async () => {
    vi.mocked(api.addPerson).mockRejectedValue(new Error("database internals"));
    vi.mocked(api.getBill).mockResolvedValue(bill);
    vi.mocked(api.getSplit).mockResolvedValue(split);
    storage.set("splitreceipt.activeBillId", bill.id);
    renderProvider();
    await screen.findByText("Dinner");

    fireEvent.click(screen.getByRole("button", { name: "Add person" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Something went wrong. Try again.")
    );
    expect(screen.getByTestId("error")).not.toHaveTextContent("database internals");
  });

  it("propagates receipt import failures so the caller can offer a retry", async () => {
    vi.mocked(api.getBill).mockResolvedValue(bill);
    vi.mocked(api.getSplit).mockResolvedValue(split);
    vi.mocked(api.importReceipt).mockRejectedValue(
      new ApiError(500, "Model returned invalid JSON")
    );
    storage.set("splitreceipt.activeBillId", bill.id);
    renderProvider();
    await screen.findByText("Dinner");

    fireEvent.click(screen.getByRole("button", { name: "Import receipt" }));

    await waitFor(() => {
      expect(screen.getByTestId("receipt-import-status")).toHaveTextContent("failed");
      expect(screen.getByTestId("error")).toHaveTextContent("Model returned invalid JSON");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
  });

  it("marks bills opened from another owner as read-only", async () => {
    vi.mocked(api.getBill).mockResolvedValue(bill);
    vi.mocked(api.getSplit).mockResolvedValue(split);
    storage.set("splitreceipt.activeBillId", bill.id);

    renderProvider("different-owner");

    await screen.findByText("Dinner");
    expect(screen.getByTestId("read-only")).toHaveTextContent("true");
  });
});
