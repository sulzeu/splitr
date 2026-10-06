import { Bill } from "../schemas/bills";
import { BillRepository, JoinCodeConflictError } from "./billRepository";

export class InMemoryBillRepository implements BillRepository {
  private billsById = new Map<string, Bill>();
  private billIdByJoinCode = new Map<string, string>();

  async create(bill: Bill): Promise<void> {
    const joinCode = bill.joinCode.toUpperCase();
    if (this.billIdByJoinCode.has(joinCode)) throw new JoinCodeConflictError();
    this.billsById.set(bill.id, bill);
    this.billIdByJoinCode.set(joinCode, bill.id);
  }

  async getById(billId: string): Promise<Bill | undefined> {
    return this.billsById.get(billId);
  }

  async getByJoinCode(joinCode: string): Promise<Bill | undefined> {
    const billId = this.billIdByJoinCode.get(joinCode.toUpperCase());
    return billId ? this.billsById.get(billId) : undefined;
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
