import { Bill } from "../schemas/bills";

/**
 * Everything the rest of the app knows about persistence goes through this
 * interface. Swapping the in-memory implementation for Postgres/Prisma,
 * Redis, or anything else later is a matter of writing one new class that
 * implements this and changing a single line in services/billService.ts —
 * nothing in routes/ or domain/ needs to know or care.
 */
export interface BillRepository {
  create(bill: Bill, joinCode: string): Promise<void>;
  getById(billId: string): Promise<Bill | undefined>;
  getIdByJoinCode(joinCode: string): Promise<string | undefined>;
  listByOwner(ownerId: string, paid: boolean): Promise<Bill[]>;
  save(bill: Bill): Promise<void>;
}
