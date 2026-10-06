import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SummaryScreen } from "./SummaryScreen";
import { useBill } from "@/context/BillContext";

vi.mock("@/context/BillContext", () => ({
  useBill: vi.fn(),
}));

function mockSummaryContext(overrides: Record<string, unknown> = {}) {
  const { bill: billOverrides, split: splitOverrides, ...contextOverrides } = overrides;
  return {
    bill: {
      id: "bill-2",
      title: "Shared lunch",
      joinCode: "XYZ123",
      ownerId: "owner-1",
      people: [{ id: "person-1", name: "Ada" }],
      items: [],
      gstMode: "none",
      gstRate: 0,
      tipAmount: 0,
      serviceFeeAmount: 0,
      settledPersonIds: [],
      createdAt: Date.now(),
      version: 1,
      ...((billOverrides as Record<string, unknown> | undefined) ?? {}),
    },
    split: {
      personTotals: [
        {
          personId: "person-1",
          itemsSubtotal: 8,
          gstShare: 0,
          tipShare: 0,
          serviceFeeShare: 0,
          total: 8,
        },
      ],
      unassignedSubtotal: 4,
      grandTotal: 12,
      ...((splitOverrides as Record<string, unknown> | undefined) ?? {}),
    },
    readOnly: false,
    loading: false,
    error: null,
    clearError: vi.fn(),
    setGstMode: vi.fn(),
    setTipAmount: vi.fn(),
    setServiceFeeAmount: vi.fn(),
    setPersonSettled: vi.fn(),
    setBillPaid: vi.fn(),
    leaveBill: vi.fn(),
    ...contextOverrides,
  } as any;
}

describe("SummaryScreen", () => {
  it("shows totals and lets the user mark people and the bill as paid", () => {
    const setPersonSettled = vi.fn();
    const setBillPaid = vi.fn();
    const leaveBill = vi.fn();
    const onRestart = vi.fn();

    vi.mocked(useBill).mockReturnValue({
      bill: {
        id: "bill-1",
        title: "Dinner",
        joinCode: "ABCD12",
        ownerId: "owner-1",
        people: [
          { id: "person-1", name: "Ada" },
          { id: "person-2", name: "Ben" },
        ],
        items: [
          { id: "item-1", name: "Pasta", price: 28.5, quantity: 1, assignedTo: ["person-1"] },
        ],
        gstMode: "none",
        gstRate: 0,
        tipAmount: 0,
        serviceFeeAmount: 0,
        settledPersonIds: [],
        createdAt: Date.now(),
        version: 1,
        paidAt: null,
      } as any,
      split: {
        personTotals: [
          {
            personId: "person-1",
            itemsSubtotal: 28.5,
            gstShare: 0,
            tipShare: 0,
            serviceFeeShare: 0,
            total: 28.5,
          },
          {
            personId: "person-2",
            itemsSubtotal: 0,
            gstShare: 0,
            tipShare: 0,
            serviceFeeShare: 0,
            total: 0,
          },
        ],
        unassignedSubtotal: 0,
        grandTotal: 28.5,
      } as any,
      readOnly: false,
      loading: false,
      error: null,
      clearError: vi.fn(),
      setGstMode: vi.fn(),
      setTipAmount: vi.fn(),
      setServiceFeeAmount: vi.fn(),
      setPersonSettled,
      setBillPaid,
      leaveBill,
      onRestart,
    } as any);

    render(<SummaryScreen onRestart={onRestart} />);

    expect(screen.getByText("The split")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.getByText("TOTAL")).toBeInTheDocument();
    expect(screen.getAllByText("$28.50").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText("Mark as paid")[0]);
    expect(setPersonSettled).toHaveBeenCalledWith("person-1", true);

    fireEvent.click(screen.getByRole("button", { name: "Mark bill as paid" }));
    expect(setBillPaid).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Start a new split" }));
    expect(leaveBill).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("shows unassigned charges and hides editing actions in read-only mode", () => {
    vi.mocked(useBill).mockReturnValue(
      mockSummaryContext({
        readOnly: true,
        split: {
          personTotals: [
            {
              personId: "person-1",
              itemsSubtotal: 8,
              gstShare: 0,
              tipShare: 0,
              serviceFeeShare: 0,
              total: 8,
            },
          ],
          unassignedSubtotal: 4,
          grandTotal: 12,
        },
      })
    );

    render(<SummaryScreen onRestart={vi.fn()} />);

    expect(screen.getByText("Read-only view from the split code.")).toBeInTheDocument();
    expect(screen.getByText(/\$4\.00 of items still unassigned/)).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
    expect(screen.queryByText("GST")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark bill as paid" })).not.toBeInTheDocument();
    expect(screen.queryByText("Mark as paid")).not.toBeInTheDocument();
  });

  it("offers to reopen a paid bill and clears invalid tip and fee entries", () => {
    const setTipAmount = vi.fn();
    const setServiceFeeAmount = vi.fn();
    const setBillPaid = vi.fn();
    vi.mocked(useBill).mockReturnValue(
      mockSummaryContext({
        bill: { paidAt: 1234 },
        split: { unassignedSubtotal: 0 },
        setTipAmount,
        setServiceFeeAmount,
        setBillPaid,
      })
    );

    render(<SummaryScreen onRestart={vi.fn()} />);

    const [tipInput, feeInput] = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(tipInput, { target: { value: "-5" } });
    fireEvent.blur(tipInput);
    fireEvent.change(feeInput, { target: { value: "not a number" } });
    fireEvent.blur(feeInput);

    expect(setTipAmount).toHaveBeenCalledWith(0);
    expect(setServiceFeeAmount).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "Move back to active bills" }));
    expect(setBillPaid).toHaveBeenCalledWith(false);
  });
});
