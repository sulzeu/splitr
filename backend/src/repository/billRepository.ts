import { Bill } from "../schemas/bills";
import { HttpError } from "../utils/httpError";

export class JoinCodeConflictError extends Error {
  constructor() {
    super("Join code already exists");
    this.name = "JoinCodeConflictError";
  }
}

export class BillNotFoundError extends HttpError {
  constructor(billId: string) {
    super(404, `Bill ${billId} not found`);
    this.name = "BillNotFoundError";
  }
}

export interface BillRepository {
  create(bill: Bill): Promise<void>;
  getById(billId: string): Promise<Bill | undefined>;
  getByJoinCode(joinCode: string): Promise<Bill | undefined>;
  listByOwner(ownerId: string, paid: boolean): Promise<Bill[]>;
  save(bill: Bill): Promise<void>;
}
