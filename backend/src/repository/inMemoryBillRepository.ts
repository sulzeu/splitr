import { Bill } from "../schemas/bills";
import { BillRepository } from "./billRepository";

/**
 * MVP data store: plain in-memory Maps. Not persistent — restarting the
 * server loses all bills. That's fine for now (see repository interface
 * doc comment); this exists purely so the API surface and business logic
 * can be built and tested end-to-end before committing to a database.
 */
export class InMemoryBillRepository implements BillRepository {
  private billsById = new Map<string, Bill>();
  private billIdByJoinCode = new Map<string, string>();

  async create(bill: Bill, joinCode: string): Promise<void> {
    this.billsById.set(bill.id, bill);
    this.billIdByJoinCode.set(joinCode, bill.id);
  }

  async getById(billId: string): Promise<Bill | undefined> {
    return this.billsById.get(billId);
  }

  async getIdByJoinCode(joinCode: string): Promise<string | undefined> {
    return this.billIdByJoinCode.get(joinCode.toUpperCase());
  }

  async listByOwner(ownerId: string, paid: boolean): Promise<Bill[]> {
    return [...this.billsById.values()].filter((bill) => bill.ownerId === ownerId && Boolean(bill.paidAt) === paid);
  }

  async save(bill: Bill): Promise<void> {
    this.billsById.set(bill.id, bill);
  }
}
