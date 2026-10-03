import { Bill } from "../schemas/bills";

export interface BillRepository {
  create(bill: Bill, joinCode: string): Promise<void>;
  getById(billId: string): Promise<Bill | undefined>;
  getIdByJoinCode(joinCode: string): Promise<string | undefined>;
  listByOwner(ownerId: string, paid: boolean): Promise<Bill[]>;
  save(bill: Bill): Promise<void>;
}
