import { Bill } from "../schemas/bills";

export class JoinCodeConflictError extends Error {
  constructor() {
    super("Join code already exists");
    this.name = "JoinCodeConflictError";
  }
}

export interface BillRepository {
  create(bill: Bill): Promise<void>;
  getById(billId: string): Promise<Bill | undefined>;
  getByJoinCode(joinCode: string): Promise<Bill | undefined>;
  listByOwner(ownerId: string, paid: boolean): Promise<Bill[]>;
  save(bill: Bill): Promise<void>;
}
