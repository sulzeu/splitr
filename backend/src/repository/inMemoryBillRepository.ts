import { Bill } from "../schemas/bills";
import { BillRepository } from "./billRepository";

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
    return [...this.billsById.values()].filter(
      (bill) => bill.ownerId === ownerId && Boolean(bill.paidAt) === paid
    );
  }

  async save(bill: Bill): Promise<void> {
    this.billsById.set(bill.id, bill);
  }
}
