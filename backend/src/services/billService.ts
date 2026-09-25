import { randomUUID } from "crypto";
import { Bill, BillItem, GstMode } from "../schemas/bills";
import { calculateSplit } from "../domain/splitCalculator";
import { BillRepository } from "../repository/billRepository";
import { generateJoinCode } from "../utils/joinCode";
import { forbidden, notFound } from "../utils/httpError";
import { ExtractedReceipt } from "../schemas/receipt";

const AU_GST_RATE = 0.1;
const MAX_JOIN_CODE_ATTEMPTS = 5;

export class BillService {
  constructor(private repo: BillRepository) {}

  private async requireBill(billId: string, ownerId?: string): Promise<Bill> {
    const bill = await this.repo.getById(billId);
    if (!bill) throw notFound("Bill");
    if (ownerId && bill.ownerId !== ownerId) throw forbidden();
    return bill;
  }

  async createBill(ownerId: string, title?: string): Promise<Bill> {
    let joinCode = "";
    for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
      const candidate = generateJoinCode();
      if (!(await this.repo.getIdByJoinCode(candidate))) {
        joinCode = candidate;
        break;
      }
    }
    if (!joinCode) throw new Error("Could not generate a unique join code");

    const bill: Bill = {
      id: randomUUID(),
      ownerId,
      joinCode,
      createdAt: Date.now(),
      title: title?.trim() || "New split",
      people: [],
      items: [],
      gstMode: "inclusive",
      gstRate: AU_GST_RATE,
      tipAmount: 0,
      serviceFeeAmount: 0,
      settledPersonIds: [],
      version: 1,
    };
    await this.repo.create(bill, joinCode);
    return bill;
  }

  async getBill(billId: string, ownerId: string): Promise<Bill> {
    return this.requireBill(billId, ownerId);
  }

  async getBillByJoinCode(joinCode: string): Promise<Bill> {
    const billId = await this.repo.getIdByJoinCode(joinCode);
    if (!billId) throw notFound("Bill");
    return this.requireBill(billId);
  }

  async getSplitByJoinCode(joinCode: string) {
    const bill = await this.getBillByJoinCode(joinCode);
    return calculateSplit(bill);
  }

  async listBills(ownerId: string, paid: boolean): Promise<Bill[]> {
    return this.repo.listByOwner(ownerId, paid);
  }

  async setPaid(billId: string, ownerId: string, paid: boolean): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const updated: Bill = { ...bill, paidAt: paid ? bill.paidAt ?? Date.now() : undefined };
    await this.repo.save(updated);
    return updated;
  }

  async updateSettings(
    billId: string,
    ownerId: string,
    patch: Partial<Pick<Bill, "title" | "gstMode" | "gstRate" | "tipAmount" | "serviceFeeAmount">>
  ): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const updated: Bill = { ...bill, ...patch };
    await this.repo.save(updated);
    return updated;
  }

  async addPerson(billId: string, ownerId: string, name: string): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const updated: Bill = {
      ...bill,
      people: [...bill.people, { id: randomUUID(), name: name.trim() }],
    };
    await this.repo.save(updated);
    return updated;
  }

  async removePerson(billId: string, ownerId: string, personId: string): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const updated: Bill = {
      ...bill,
      people: bill.people.filter((p) => p.id !== personId),
      items: bill.items.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((id) => id !== personId),
      })),
      settledPersonIds: bill.settledPersonIds.filter((id) => id !== personId),
    };
    await this.repo.save(updated);
    return updated;
  }

  async setPersonSettled(billId: string, ownerId: string, personId: string, settled: boolean): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    if (!bill.people.some((p) => p.id === personId)) throw notFound("Person");
    const already = bill.settledPersonIds.includes(personId);
    let settledPersonIds = bill.settledPersonIds;
    if (settled && !already) settledPersonIds = [...bill.settledPersonIds, personId];
    if (!settled && already) settledPersonIds = bill.settledPersonIds.filter((id) => id !== personId);
    const updated: Bill = { ...bill, settledPersonIds };
    await this.repo.save(updated);
    return updated;
  }

  async addItem(
    billId: string,
    ownerId: string,
    item: { name: string; price: number; quantity?: number }
  ): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const newItem: BillItem = {
      id: randomUUID(),
      name: item.name.trim(),
      price: item.price,
      assignedTo: [],
    };
    const updated: Bill = { ...bill, items: [...bill.items, newItem] };
    await this.repo.save(updated);
    return updated;
  }

  async importReceipt(billId: string, ownerId: string, extraction: ExtractedReceipt): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const importedItems: BillItem[] = extraction.items.map((item) => ({
      id: randomUUID(),
      name: item.name.trim(),
      price: item.price,
      quantity: item.quantity,
      assignedTo: [],
    }));
    const updated: Bill = {
      ...bill,
      items: [...bill.items, ...importedItems],
      receiptTotal: extraction.total,
    };
    await this.repo.save(updated);
    return updated;
  }

  async updateItem(
    billId: string,
    ownerId: string,
    itemId: string,
    patch: Partial<Pick<BillItem, "name" | "price">>
  ): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    if (!bill.items.some((i) => i.id === itemId)) throw notFound("Item");
    const updated: Bill = {
      ...bill,
      items: bill.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    };
    await this.repo.save(updated);
    return updated;
  }

  async removeItem(billId: string, ownerId: string, itemId: string): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const updated: Bill = { ...bill, items: bill.items.filter((i) => i.id !== itemId) };
    await this.repo.save(updated);
    return updated;
  }

  async toggleAssignment(billId: string, ownerId: string, itemId: string, personId: string): Promise<Bill> {
    const bill = await this.requireBill(billId, ownerId);
    const item = bill.items.find((i) => i.id === itemId);
    if (!item) throw notFound("Item");
    if (!bill.people.some((p) => p.id === personId)) throw notFound("Person");

    const isAssigned = item.assignedTo.includes(personId);
    const updated: Bill = {
      ...bill,
      items: bill.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              assignedTo: isAssigned
                ? i.assignedTo.filter((id) => id !== personId)
                : [...i.assignedTo, personId],
            }
          : i
      ),
    };
    await this.repo.save(updated);
    return updated;
  }

  async getSplit(billId: string, ownerId: string) {
    const bill = await this.requireBill(billId, ownerId);
    return calculateSplit(bill);
  }
}

export const GST_MODES: GstMode[] = ["inclusive", "exclusive", "none"];
