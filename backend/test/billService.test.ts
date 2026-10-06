import { describe, expect, it } from "vitest";
import { BillService } from "../src/services/billService";
import { InMemoryBillRepository } from "../src/repository/inMemoryBillRepository";
import { JoinCodeConflictError } from "../src/repository/billRepository";
import type { Bill } from "../src/schemas/bills";

class ConflictThenSuccessRepository extends InMemoryBillRepository {
  createCalls = 0;

  constructor(private conflicts: number) {
    super();
  }

  override async create(bill: Bill): Promise<void> {
    this.createCalls++;
    if (this.createCalls <= this.conflicts) throw new JoinCodeConflictError();
    return super.create(bill);
  }
}

describe("BillService.createBill", () => {
  it("retries only join-code conflicts and succeeds on a later attempt", async () => {
    const repo = new ConflictThenSuccessRepository(2);
    const service = new BillService(repo);

    const bill = await service.createBill("owner-1", undefined, "Owner");

    expect(repo.createCalls).toBe(3);
    expect(await repo.getById(bill.id)).toEqual(bill);
  });

  it("stops after the configured number of join-code conflicts", async () => {
    const repo = new ConflictThenSuccessRepository(5);
    const service = new BillService(repo);

    await expect(service.createBill("owner-1", undefined, "Owner")).rejects.toThrow(
      "Could not generate a unique join code after 5 attempts"
    );
    expect(repo.createCalls).toBe(5);
  });

  it("propagates errors that are not join-code conflicts without retrying", async () => {
    const repo = new ConflictThenSuccessRepository(0);
    const error = new Error("database unavailable");
    repo.create = async () => {
      repo.createCalls++;
      throw error;
    };
    const service = new BillService(repo);

    await expect(service.createBill("owner-1", undefined, "Owner")).rejects.toBe(error);
    expect(repo.createCalls).toBe(1);
  });
});
