import { SupabaseClient } from "@supabase/supabase-js";
import { Bill } from "../schemas/bills";
import { BillRepository, JoinCodeConflictError } from "./billRepository";

export class SupabaseBillRepository implements BillRepository {
  constructor(private client: SupabaseClient) {}

  async create(bill: Bill): Promise<void> {
    const { error } = await this.client.from("bills").insert(this.toRow(bill));
    if (error) {
      if (error.code === "23505" && /join_code/i.test(`${error.message} ${error.details ?? ""}`)) {
        throw new JoinCodeConflictError();
      }
      throw error;
    }
  }

  async getById(billId: string): Promise<Bill | undefined> {
    const { data, error } = await this.client
      .from("bills")
      .select("*")
      .eq("id", billId)
      .maybeSingle();
    if (error) throw error;
    return data ? this.fromRow(data as Bill) : undefined;
  }

  async getByJoinCode(joinCode: string): Promise<Bill | undefined> {
    const { data, error } = await this.client
      .from("bills")
      .select("*")
      .eq("join_code", joinCode.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data ? this.fromRow(data as Bill) : undefined;
  }

  async listByOwner(ownerId: string, paid: boolean): Promise<Bill[]> {
    const query = this.client
      .from("bills")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    const { data, error } = paid
      ? await query.not("paid_at", "is", null)
      : await query.is("paid_at", null);
    if (error) throw error;
    return (data ?? []).map((row) => this.fromRow(row as Bill));
  }

  async save(bill: Bill): Promise<void> {
    const { error } = await this.client
      .from("bills")
      .update(this.toRow(bill))
      .eq("id", bill.id);
    if (error) throw error;
  }

  private toRow(bill: Bill) {
    return {
      id: bill.id,
      owner_id: bill.ownerId,
      join_code: bill.joinCode,
      created_at: bill.createdAt,
      title: bill.title,
      people: bill.people,
      items: bill.items,
      gst_mode: bill.gstMode,
      gst_rate: bill.gstRate,
      tip_amount: bill.tipAmount,
      service_fee_amount: bill.serviceFeeAmount,
      receipt_total: bill.receiptTotal ?? null,
      settled_person_ids: bill.settledPersonIds,
      paid_at: bill.paidAt ?? null,
      version: bill.version ?? 1,
    };
  }

  private fromRow(row: Bill): Bill {
    return {
      id: row.id,
      ownerId: row.ownerId,
      joinCode: row.joinCode,
      createdAt: row.createdAt,
      title: row.title,
      people: row.people,
      items: row.items.map((item) => ({ ...item, quantity: item.quantity ?? 1 })),
      gstMode: row.gstMode,
      gstRate: row.gstRate,
      tipAmount: row.tipAmount,
      serviceFeeAmount: row.serviceFeeAmount,
      receiptTotal: row.receiptTotal ?? undefined,
      settledPersonIds: row.settledPersonIds,
      paidAt: row.paidAt ?? undefined,
      version: row.version ?? 1,
    };
  }
}
