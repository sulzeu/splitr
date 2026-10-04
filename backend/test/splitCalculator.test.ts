import { describe, expect, it } from "vitest";
import { calculateSplit } from "../src/domain/splitCalculator";
import { Bill } from "../src/schemas/bills";

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    ownerId: "owner-1",
    joinCode: "ABC123",
    createdAt: Date.now(),
    title: "Dinner",
    people: [
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
    ],
    items: [],
    gstMode: "none",
    gstRate: 0.1,
    tipAmount: 0,
    serviceFeeAmount: 0,
    settledPersonIds: [],
    version: 1,
    ...overrides,
  };
}

describe("calculateSplit", () => {
  it("backs out inclusive GST from assigned item prices", () => {
    const bill = makeBill({
      gstMode: "inclusive",
      gstRate: 0.1,
      items: [{ id: "item-1", name: "Dessert", price: 10, assignedTo: ["alice"] }],
    });

    const result = calculateSplit(bill);

    expect(result.personTotals).toHaveLength(2);
    expect(result.personTotals[0].itemsSubtotal).toBeCloseTo(10, 2);
    expect(result.personTotals[0].gstShare).toBeCloseTo(0.91, 2);
    expect(result.personTotals[0].total).toBeCloseTo(10, 2);
    expect(result.grandTotal).toBeCloseTo(10, 2);
  });

  it("applies exclusive GST proportionally to each person's subtotal", () => {
    const bill = makeBill({
      gstMode: "exclusive",
      gstRate: 0.1,
      items: [
        { id: "item-1", name: "Steak", price: 10, assignedTo: ["alice"] },
        { id: "item-2", name: "Wine", price: 20, assignedTo: ["bob"] },
      ],
    });

    const result = calculateSplit(bill);

    expect(result.grandTotal).toBeCloseTo(33, 2);
    expect(result.personTotals[0].gstShare).toBeCloseTo(1, 2);
    expect(result.personTotals[1].gstShare).toBeCloseTo(2, 2);
    expect(result.personTotals[0].total).toBeCloseTo(11, 2);
    expect(result.personTotals[1].total).toBeCloseTo(22, 2);
  });

  it("tracks unassigned subtotal separately from assigned totals", () => {
    const bill = makeBill({
      items: [
        { id: "item-1", name: "Assigned", price: 10, assignedTo: ["alice"] },
        { id: "item-2", name: "Unassigned", price: 5, assignedTo: [] },
      ],
    });

    const result = calculateSplit(bill);

    expect(result.unassignedSubtotal).toBeCloseTo(5, 2);
    expect(result.personTotals[0].total).toBeCloseTo(10, 2);
    expect(result.personTotals[1].total).toBeCloseTo(0, 2);
  });
});
