import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssignScreen } from "./AssignScreen";
import { useBill } from "@/context/BillContext";

vi.mock("@/context/BillContext", () => ({
  useBill: vi.fn(),
}));

describe("AssignScreen", () => {
  it("lets the user assign items and continue to the summary", () => {
    const toggleAssignment = vi.fn();
    const onNext = vi.fn();

    vi.mocked(useBill).mockReturnValue({
      bill: {
        id: "bill-1",
        ownerId: "owner-1",
        title: "Dinner",
        joinCode: "ABCD12",
        people: [
          { id: "person-1", name: "Ada" },
          { id: "person-2", name: "Ben" },
        ],
        items: [
          { id: "item-1", name: "Pasta", price: 28.5, quantity: 1, assignedTo: [] },
          { id: "item-2", name: "Cake", price: 12, quantity: 1, assignedTo: ["person-2"] },
        ],
        gstMode: "none",
        gstRate: 0,
        tipAmount: 0,
        serviceFeeAmount: 0,
        settledPersonIds: [],
        createdAt: Date.now(),
        version: 1,
      } as any,
      readOnly: false,
      loading: false,
      error: null,
      clearError: vi.fn(),
      toggleAssignment,
    } as any);

    render(<AssignScreen onNext={onNext} />);

    expect(screen.getByText("Who had what?")).toBeInTheDocument();
    expect(screen.getByText("1 item unassigned — see summary anyway")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.getByText("Cake")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Ada" })[0]);

    expect(toggleAssignment).toHaveBeenCalledWith("item-1", "person-1");

    fireEvent.click(screen.getAllByRole("button", { name: "Ben" })[0]);
    expect(toggleAssignment).toHaveBeenCalledWith("item-1", "person-2");

    fireEvent.click(screen.getByRole("button", { name: /see summary anyway/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
