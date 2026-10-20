import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { Bill } from "../src/schemas/bills";
import { SupabaseBillRepository } from "../src/repository/supabaseBillRepository";

const bill: Bill = {
  id: "bill-1",
  ownerId: "owner-1",
  joinCode: "ABC123",
  createdAt: 1_700_000_000_000,
  title: "Dinner",
  people: [{ id: "person-1", name: "Person" }],
  items: [
    { id: "item-1", name: "Meal", price: 10, quantity: 1, assignedTo: ["person-1"] },
  ],
  gstMode: "inclusive",
  gstRate: 0.1,
  tipAmount: 2,
  serviceFeeAmount: 1,
  receiptTotal: 13,
  settledPersonIds: ["person-1"],
  paidAt: 1_700_000_100_000,
  version: 2,
};

function createRepository(fetch: typeof globalThis.fetch) {
  const client = createClient("http://localhost:54321", "test-key", {
    global: { fetch },
  });
  return new SupabaseBillRepository(client);
}

describe("SupabaseBillRepository", () => {
  it("maps snake_case rows to validated bills", async () => {
    const row = {
      id: bill.id,
      owner_id: bill.ownerId,
      join_code: bill.joinCode,
      created_at: bill.createdAt,
      title: bill.title,
      people: bill.people,
      items: [{ ...bill.items[0], quantity: undefined }],
      gst_mode: bill.gstMode,
      gst_rate: bill.gstRate,
      tip_amount: bill.tipAmount,
      service_fee_amount: bill.serviceFeeAmount,
      receipt_total: bill.receiptTotal,
      settled_person_ids: bill.settledPersonIds,
      paid_at: bill.paidAt,
      version: bill.version,
    };
    const repository = createRepository(async () =>
      new Response(JSON.stringify([row]), {
        status: 200,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
      })
    );

    await expect(repository.getById(bill.id)).resolves.toEqual(bill);
  });

  it("writes the version field when creating a bill", async () => {
    let requestBody: string | null | undefined;
    const repository = createRepository(async (_input, init) => {
      requestBody = init?.body as string | null | undefined;
      return new Response(null, { status: 201 });
    });

    await repository.create(bill);

    expect(JSON.parse(requestBody ?? "{}")).toMatchObject({
      id: bill.id,
      owner_id: bill.ownerId,
      version: bill.version,
    });
  });
});
