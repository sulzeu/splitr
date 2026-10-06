import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import { BillProvider, useBill } from "@/context/BillContext";
import type { Bill, SplitResult } from "@/types";
import { AssignScreen } from "./AssignScreen";
import { ItemsScreen } from "./ItemsScreen";
import { PeopleScreen } from "./PeopleScreen";
import { SummaryScreen } from "./SummaryScreen";

vi.mock("@/api/client", () => ({
  api: {
    getBill: vi.fn(),
    getSplit: vi.fn(),
    addPerson: vi.fn(),
    removePerson: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    toggleAssignment: vi.fn(),
    importReceipt: vi.fn(),
    updateSettings: vi.fn(),
    setPersonSettled: vi.fn(),
    setBillPaid: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function calculateSplit(bill: Bill): SplitResult {
  const subtotals = new Map(bill.people.map((person) => [person.id, 0]));
  let unassignedSubtotal = 0;

  for (const item of bill.items) {
    if (item.assignedTo.length === 0) {
      unassignedSubtotal += item.price * item.quantity;
      continue;
    }

    const itemCents = Math.round(item.price * item.quantity * 100);
    const cents = Math.round(itemCents / item.assignedTo.length);
    let remainder = itemCents - cents * item.assignedTo.length;
    item.assignedTo.forEach((personId) => {
      const share = cents + (remainder-- > 0 ? 1 : 0);
      subtotals.set(personId, (subtotals.get(personId) ?? 0) + share / 100);
    });
  }

  const personTotals = bill.people.map((person) => {
    const itemsSubtotal = subtotals.get(person.id) ?? 0;
    return {
      personId: person.id,
      itemsSubtotal,
      gstShare: 0,
      tipShare: 0,
      serviceFeeShare: 0,
      total: itemsSubtotal,
    };
  });

  return {
    personTotals,
    unassignedSubtotal,
    grandTotal: personTotals.reduce((total, person) => total + person.total, 0),
  };
}

function BillEditingFlow() {
  const { openBill } = useBill();
  const [step, setStep] = useState<"open" | "people" | "items" | "assign" | "summary">("open");

  if (step === "open") {
    return (
      <button
        onClick={() => {
          void openBill("bill-1").then((opened) => {
            if (opened) setStep("people");
          });
        }}
      >
        Open test bill
      </button>
    );
  }
  if (step === "people") return <PeopleScreen onNext={() => setStep("items")} />;
  if (step === "items") return <ItemsScreen onNext={() => setStep("assign")} />;
  if (step === "assign") return <AssignScreen onNext={() => setStep("summary")} />;
  return <SummaryScreen onRestart={() => setStep("open")} />;
}

describe("bill editing flow", () => {
  it("carries a bill through people, items, assignments, and the final split", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    let bill: Bill = {
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
    let nextPersonId = 1;
    let nextItemId = 1;

    vi.mocked(api.getBill).mockImplementation(async () => clone(bill));
    vi.mocked(api.getSplit).mockImplementation(async () => calculateSplit(bill));
    vi.mocked(api.addPerson).mockImplementation(async (_billId, name) => {
      bill = {
        ...bill,
        people: [...bill.people, { type: "GUEST", id: `person-${nextPersonId++}`, name }],
      };
      return clone(bill);
    });
    vi.mocked(api.removePerson).mockImplementation(async (_billId, personId) => {
      bill = {
        ...bill,
        people: bill.people.filter((person) => person.id !== personId),
      };
      return clone(bill);
    });
    vi.mocked(api.addItem).mockImplementation(async (_billId, item) => {
      bill = {
        ...bill,
        items: [
          ...bill.items,
          {
            id: `item-${nextItemId++}`,
            name: item.name,
            price: item.price,
            quantity: 1,
            assignedTo: [],
          },
        ],
      };
      return clone(bill);
    });
    vi.mocked(api.importReceipt).mockImplementation(async () => ({
      bill: clone(bill),
      extraction: { items: [], total: 0 },
    }));
    vi.mocked(api.importReceipt).mockImplementationOnce(async () => {
      throw new Error("Model returned invalid or incomplete JSON");
    });
    vi.mocked(api.removeItem).mockImplementation(async (_billId, itemId) => {
      bill = {
        ...bill,
        items: bill.items.filter((item) => item.id !== itemId),
      };
      return clone(bill);
    });
    vi.mocked(api.toggleAssignment).mockImplementation(async (_billId, itemId, personId) => {
      bill = {
        ...bill,
        items: bill.items.map((item) => ({
          ...item,
          assignedTo:
            item.id !== itemId
              ? item.assignedTo
              : item.assignedTo.includes(personId)
                ? item.assignedTo.filter((id) => id !== personId)
                : [...item.assignedTo, personId],
        })),
      };
      return clone(bill);
    });
    vi.mocked(api.updateSettings).mockImplementation(async (_billId, settings) => {
      bill = { ...bill, ...settings };
      return clone(bill);
    });
    vi.mocked(api.setPersonSettled).mockImplementation(async (_billId, personId, settled) => {
      const settledPersonIds = new Set(bill.settledPersonIds);
      if (settled) settledPersonIds.add(personId);
      else settledPersonIds.delete(personId);
      bill = { ...bill, settledPersonIds: [...settledPersonIds] };
      return clone(bill);
    });
    vi.mocked(api.setBillPaid).mockImplementation(async (_billId, paid) => {
      bill = { ...bill, paidAt: paid ? Date.now() : undefined };
      return clone(bill);
    });

    render(
      <BillProvider ownerId="owner-1">
        <BillEditingFlow />
      </BillProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open test bill" }));
    await screen.findByText("Who's splitting?");

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Ada");

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Ben" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Ben");

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Chris" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Chris");
    const chrisRow = screen.getByText("Chris").parentElement;
    fireEvent.click(within(chrisRow as HTMLElement).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("Chris")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Next — add items (2 people)" }));
    await screen.findByText("What was ordered?");

    const receiptInput = document.querySelector('input[type="file"]');
    fireEvent.change(receiptInput as HTMLInputElement, {
      target: { files: [new File(["receipt"], "receipt.png", { type: "image/png" })] },
    });
    await screen.findByRole("dialog", { name: "Check receipt crop" });
    fireEvent.click(screen.getByRole("button", { name: "Scan full image" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Model returned invalid or incomplete JSON"
    );
    expect(screen.getByRole("dialog", { name: "Check receipt crop" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Scan full image" }));
    await waitFor(() => expect(api.importReceipt).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Check receipt crop" })).not.toBeInTheDocument()
    );

    fireEvent.change(screen.getByPlaceholderText("Item name"), {
      target: { value: "Pasta" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "30.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Pasta");

    fireEvent.change(screen.getByPlaceholderText("Item name"), {
      target: { value: "Lemonade" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "10.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Lemonade");

    fireEvent.change(screen.getByPlaceholderText("Item name"), {
      target: { value: "Side dish" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "3.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Side dish");
    const sideDishRow = screen.getByText("Side dish").parentElement;
    fireEvent.click(within(sideDishRow as HTMLElement).getByRole("button", { name: "✕" }));
    await waitFor(() => expect(screen.queryByText("Side dish")).not.toBeInTheDocument());

    expect(screen.getByText("$40.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next — assign items" }));

    await screen.findByText("Who had what?");
    fireEvent.click(screen.getAllByRole("button", { name: "Ada" })[0]);
    await waitFor(() => expect(api.toggleAssignment).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByRole("button", { name: "Ada" })[1]);
    await waitFor(() => expect(api.toggleAssignment).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getAllByRole("button", { name: "Ben" })[1]);
    await waitFor(() => expect(api.toggleAssignment).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole("button", { name: "See the split" }));
    await screen.findByText("The split");

    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.getByText("$35.00")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No GST" }));
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith("bill-1", { gstMode: "none" })
    );
    const [tipInput, feeInput] = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(tipInput, { target: { value: "4.00" } });
    fireEvent.blur(tipInput);
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith("bill-1", { tipAmount: 4 })
    );
    fireEvent.change(feeInput, { target: { value: "2.00" } });
    fireEvent.blur(feeInput);
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith("bill-1", { serviceFeeAmount: 2 })
    );

    fireEvent.click(screen.getAllByText("Mark as paid")[0]);
    await waitFor(() =>
      expect(api.setPersonSettled).toHaveBeenCalledWith("bill-1", "person-1", true)
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark bill as paid" }));
    await waitFor(() => expect(api.setBillPaid).toHaveBeenCalledWith("bill-1", true));

    expect(api.addPerson).toHaveBeenNthCalledWith(1, "bill-1", "Ada");
    expect(api.addPerson).toHaveBeenNthCalledWith(2, "bill-1", "Ben");
    expect(api.addPerson).toHaveBeenNthCalledWith(3, "bill-1", "Chris");
    expect(api.removePerson).toHaveBeenCalledWith("bill-1", "person-3");
    expect(api.addItem).toHaveBeenNthCalledWith(1, "bill-1", {
      name: "Pasta",
      price: 30,
      quantity: 1,
    });
    expect(api.addItem).toHaveBeenNthCalledWith(2, "bill-1", {
      name: "Lemonade",
      price: 10,
      quantity: 1,
    });
    expect(api.addItem).toHaveBeenNthCalledWith(3, "bill-1", {
      name: "Side dish",
      price: 3,
      quantity: 1,
    });
    expect(api.removeItem).toHaveBeenCalledWith("bill-1", "item-3");
    expect(api.toggleAssignment).toHaveBeenNthCalledWith(1, "bill-1", "item-1", "person-1");
    expect(api.toggleAssignment).toHaveBeenNthCalledWith(2, "bill-1", "item-2", "person-1");
    expect(api.toggleAssignment).toHaveBeenNthCalledWith(3, "bill-1", "item-2", "person-2");
  });
});
