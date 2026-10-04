import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";
import { api } from "../api/client";
import { useBill } from "../context/BillContext";

vi.mock("../context/BillContext", () => ({
  useBill: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    getAccountBills: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

function mockBillContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    createBill: vi.fn(),
    joinBill: vi.fn(),
    openBill: vi.fn(),
    leaveBill: vi.fn(),
    setTitle: vi.fn(),
    addPerson: vi.fn(),
    removePerson: vi.fn(),
    setPersonSettled: vi.fn(),
    addItem: vi.fn(),
    importReceipt: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    toggleAssignment: vi.fn(),
    setGstMode: vi.fn(),
    setTipAmount: vi.fn(),
    setServiceFeeAmount: vi.fn(),
    setBillPaid: vi.fn(),
    bill: null,
    split: null,
    readOnly: false,
    loading: false,
    error: null,
    clearError: vi.fn(),
    ...overrides,
  } as any;
}

describe("HomeScreen", () => {
  beforeEach(() => {
    vi.mocked(api.getAccountBills).mockResolvedValue({ active: [], paid: [] });
  });

  it("creates a new split and enters the bill flow", async () => {
    const createBill = vi.fn().mockResolvedValue(true);
    const onEnterBill = vi.fn();
    vi.mocked(useBill).mockReturnValue(mockBillContext({ createBill }));

    render(<HomeScreen onEnterBill={onEnterBill} />);

    fireEvent.click(screen.getByRole("button", { name: "Start a new split" }));

    await waitFor(() => expect(createBill).toHaveBeenCalledTimes(1));
    expect(onEnterBill).toHaveBeenCalledTimes(1);
  });

  it("joins an existing split with a code", async () => {
    const joinBill = vi.fn().mockResolvedValue(true);
    const onEnterBill = vi.fn();
    vi.mocked(useBill).mockReturnValue(mockBillContext({ joinBill }));

    render(<HomeScreen onEnterBill={onEnterBill} />);

    fireEvent.click(screen.getByRole("button", { name: "Join a split with a code" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. H3HBHP"), { target: { value: "ABC123" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => expect(joinBill).toHaveBeenCalledWith("ABC123"));
    expect(onEnterBill).toHaveBeenCalledTimes(1);
  });

  it("opens a historical bill from the saved list", async () => {
    const bill = {
      id: "bill-1",
      createdAt: 1700000000000,
      joinCode: "ABCD12",
      ownerId: "owner-1",
      title: "Dinner",
      people: [],
      items: [],
      gstMode: "none",
      gstRate: 0,
      tipAmount: 0,
      serviceFeeAmount: 0,
      settledPersonIds: [],
      version: 1,
    } as any;
    vi.mocked(api.getAccountBills).mockResolvedValue({ active: [bill], paid: [] });
    const openBill = vi.fn().mockResolvedValue(true);
    const onEnterBill = vi.fn();
    vi.mocked(useBill).mockReturnValue(mockBillContext({ openBill }));

    render(<HomeScreen onEnterBill={onEnterBill} />);

    await waitFor(() => expect(screen.getByText("Dinner")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Dinner/i }));

    await waitFor(() => expect(openBill).toHaveBeenCalledWith("bill-1"));
  });
});
