import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SummaryScreen } from "./SummaryScreen";
import { useBill } from "@/context/BillContext";

vi.mock("@/context/BillContext", () => ({
  useBill: vi.fn(),
}));

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
});
