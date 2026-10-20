import { describe, expect, it } from "vitest";
import { Bill } from "../src/schemas/bills";
import {
  BillNotFoundError,
  JoinCodeConflictError,
} from "../src/repository/billRepository";
import { InMemoryBillRepository } from "../src/repository/inMemoryBillRepository";

function bill(id: string, joinCode: string): Bill {
  return {
    id,
    ownerId: "owner-1",
    joinCode,
    createdAt: Date.now(),
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
}

describe("InMemoryBillRepository.save", () => {
  it("updates an existing bill and moves its join-code index", async () => {
    const repository = new InMemoryBillRepository();
    const original = bill("bill-1", "ABC123");
    await repository.create(original);

    const updated = { ...original, joinCode: "DEF456", title: "Updated dinner" };
    await repository.save(updated);

    expect(await repository.getById(original.id)).toEqual(updated);
    expect(await repository.getByJoinCode("ABC123")).toBeUndefined();
    expect(await repository.getByJoinCode("def456")).toEqual(updated);
  });

  it("rejects saving a bill that does not exist", async () => {
    const repository = new InMemoryBillRepository();

    await expect(repository.save(bill("missing", "ABC123"))).rejects.toBeInstanceOf(
      BillNotFoundError
    );
    expect(await repository.getByJoinCode("ABC123")).toBeUndefined();
  });

  it("rejects a join code already used by another bill without changing the stored bill", async () => {
    const repository = new InMemoryBillRepository();
    const first = bill("bill-1", "ABC123");
    const second = bill("bill-2", "DEF456");
    await repository.create(first);
    await repository.create(second);

    await expect(repository.save({ ...first, joinCode: "def456" })).rejects.toBeInstanceOf(
      JoinCodeConflictError
    );

    expect(await repository.getById(first.id)).toEqual(first);
    expect(await repository.getByJoinCode("ABC123")).toEqual(first);
    expect(await repository.getByJoinCode("DEF456")).toEqual(second);
  });
});
