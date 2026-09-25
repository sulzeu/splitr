import { SupabaseClient } from "@supabase/supabase-js";
import { Bill } from "../schemas/types";
import { BillRepository } from "./billRepository";

type BillRow = {
  id: string;
  owner_id: string;
  join_code: string;
  created_at: number;
  title: string;
  people: Bill["people"];
  items: Bill["items"];
  gst_mode: Bill["gstMode"];
  gst_rate: number;
  tip_amount: number;
  service_fee_amount: number;
  receipt_total: number | null;
  settled_person_ids: string[];
  paid_at: number | null;
};

export class SupabaseBillRepository implements BillRepository {
  constructor(private client: SupabaseClient) {}

  async create(bill: Bill, joinCode: string): Promise<void> {
    const { error } = await this.client.from("bills").insert(this.toRow(bill, joinCode));
    if (error) throw error;
  }

  async getById(billId: string): Promise<Bill | undefined> {
    const { data, error } = await this.client.from("bills").select("*").eq("id", billId).maybeSingle();
    if (error) throw error;
    return data ? this.fromRow(data as BillRow) : undefined;
  }

  async getIdByJoinCode(joinCode: string): Promise<string | undefined> {
    const { data, error } = await this.client
      .from("bills")
      .select("id")
      .eq("join_code", joinCode.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data?.id;
  }

  async listByOwner(ownerId: string, paid: boolean): Promise<Bill[]> {
    const query = this.client.from("bills").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false });
    const { data, error } = paid ? await query.not("paid_at", "is", null) : await query.is("paid_at", null);
    if (error) throw error;
    return (data ?? []).map((row) => this.fromRow(row as BillRow));
  }

  async save(bill: Bill): Promise<void> {
    const { error } = await this.client.from("bills").update(this.toRow(bill, bill.joinCode)).eq("id", bill.id);
    if (error) throw error;
  }

  private toRow(bill: Bill, joinCode: string) {
    return {
      id: bill.id,
      owner_id: bill.ownerId,
      join_code: joinCode,
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
    };
  }

  private fromRow(row: BillRow): Bill {
    return {
      id: row.id,
      ownerId: row.owner_id,
      joinCode: row.join_code,
      createdAt: row.created_at,
      title: row.title,
      people: row.people,
      items: row.items,
      gstMode: row.gst_mode,
      gstRate: row.gst_rate,
      tipAmount: row.tip_amount,
      serviceFeeAmount: row.service_fee_amount,
      receiptTotal: row.receipt_total ?? undefined,
      settledPersonIds: row.settled_person_ids,
      paidAt: row.paid_at ?? undefined,
    };
  }
}