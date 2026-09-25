import { Bill, PersonTotal, SplitResult } from "../schemas/types";

const toCents = (dollars: number): number => Math.round(dollars * 100);
const fromCents = (cents: number): number => Math.round(cents) / 100;

/**
 * Distributes an amount proportionally based on given weights.
 * @param totalCents 
 * @param weights 
 * @returns an array of amounts in cents, same length as weights, summing to totalCents. 
 * Each amount is rounded to the nearest cent, with any rounding remainder distributed to the largest weights.
 */
function distributeProportionally(totalCents: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0 || totalCents === 0) return weights.map(() => 0);

  // Calculate the raw proportional shares in cents, then floor them to get whole cents.
  const raw = weights.map((w) => (w / weightSum) * totalCents);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = totalCents - floored.reduce((a, b) => a + b, 0);

  // Give the leftover cents to the entries with the largest fractional remainder.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
    result[order[k].i] += 1;
  }
  return result;
}

/**
 * Calculates the split for a given bill, distributing the total amount among the people based on their assigned items.
 * @param bill 
 * @returns the split result for the given bill, including each person's subtotal, GST share, tip share, service fee share, and total.
 */
export function calculateSplit(bill: Bill): SplitResult {
  const people = bill.people;
  const personSubtotalCents: Record<string, number> = Object.fromEntries(
    people.map((p) => [p.id, 0])
  );

  let unassignedCents = 0;

  // Calculate each person's subtotal from the items
  for (const item of bill.items) {
    const itemCents = toCents(item.price);
    if (item.assignedTo.length === 0) {
      unassignedCents += itemCents;
      continue;
    }

    // Split this single item's price evenly among whoever it's assigned to,
    // cent-exact (e.g. a $10.01 item shared by 3 people: 334 + 334 + 333).
    const shares = distributeProportionally(
      itemCents,
      item.assignedTo.map(() => 1)
    );
    item.assignedTo.forEach((personId, idx) => {
      personSubtotalCents[personId] = (personSubtotalCents[personId] ?? 0) + shares[idx];
    });
  }

  const subtotalWeights = people.map((p) => personSubtotalCents[p.id]);
  const totalSubtotalCents = subtotalWeights.reduce((a, b) => a + b, 0);
  
  // GST 
  let gstShareCents: number[];
  if (bill.gstMode === "inclusive") {
    gstShareCents = subtotalWeights.map((cents) =>
      Math.round(cents - cents / (1 + bill.gstRate))
    );
  } else if (bill.gstMode === "exclusive") {
    const totalGstCents = Math.round(totalSubtotalCents * bill.gstRate);
    gstShareCents = distributeProportionally(totalGstCents, subtotalWeights);
  } else {
    gstShareCents = people.map(() => 0);
  }

  // Tip & service fee
  const tipShareCents = distributeProportionally(toCents(bill.tipAmount), subtotalWeights);
  const serviceFeeShareCents = distributeProportionally(
    toCents(bill.serviceFeeAmount),
    subtotalWeights
  );

  const gstOnTopCents = bill.gstMode === "exclusive" ? gstShareCents : people.map(() => 0);

  const personTotals: PersonTotal[] = people.map((p, i) => {
    const total =
      subtotalWeights[i] + gstOnTopCents[i] + tipShareCents[i] + serviceFeeShareCents[i];
    return {
      personId: p.id,
      itemsSubtotal: fromCents(subtotalWeights[i]),
      gstShare: fromCents(gstShareCents[i]),
      tipShare: fromCents(tipShareCents[i]),
      serviceFeeShare: fromCents(serviceFeeShareCents[i]),
      total: fromCents(total),
    };
  });

  const grandTotalCents =
    totalSubtotalCents +
    (bill.gstMode === "exclusive" ? Math.round(totalSubtotalCents * bill.gstRate) : 0) +
    toCents(bill.tipAmount) +
    toCents(bill.serviceFeeAmount);

  return {
    personTotals,
    unassignedSubtotal: fromCents(unassignedCents),
    grandTotal: fromCents(grandTotalCents),
  };
}
