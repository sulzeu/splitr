import { SupabaseClient } from "@supabase/supabase-js";
import { AccountRecord, AccountRepository } from "./accountRepository";

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: number;
  password_hash: string;
};

export class SupabaseAccountRepository implements AccountRepository {
  constructor(private client: SupabaseClient) {}

  async create(account: AccountRecord): Promise<void> {
    const { error } = await this.client.from("accounts").insert({
      id: account.id,
      email: account.email,
      display_name: account.displayName,
      created_at: account.createdAt,
      password_hash: account.passwordHash,
    });
    if (error) throw error;
  }

  async getById(accountId: string): Promise<AccountRecord | undefined> {
    const { data, error } = await this.client.from("accounts").select("*").eq("id", accountId).maybeSingle();
    if (error) throw error;
    return data ? this.toAccount(data as AccountRow) : undefined;
  }

  async getByEmail(email: string): Promise<AccountRecord | undefined> {
    const { data, error } = await this.client.from("accounts").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    return data ? this.toAccount(data as AccountRow) : undefined;
  }

  async createSession(tokenHash: string, accountId: string, expiresAt: number): Promise<void> {
    const { error } = await this.client.from("sessions").insert({
      token_hash: tokenHash,
      account_id: accountId,
      expires_at: expiresAt,
    });
    if (error) throw error;
  }

  async getAccountIdBySession(tokenHash: string): Promise<string | undefined> {
    const { data, error } = await this.client
      .from("sessions")
      .select("account_id, expires_at")
      .eq("token_hash", tokenHash)
      .gt("expires_at", Date.now())
      .maybeSingle();
    if (error) throw error;
    return data?.account_id;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    const { error } = await this.client.from("sessions").delete().eq("token_hash", tokenHash);
    if (error) throw error;
  }

  private toAccount(row: AccountRow): AccountRecord {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.created_at,
      passwordHash: row.password_hash,
    };
  }
}