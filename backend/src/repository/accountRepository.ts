import { Account } from "../schemas/types";

export interface AccountRecord extends Account {
  passwordHash: string;
}

export interface AccountRepository {
  create(account: AccountRecord): Promise<void>;
  getById(accountId: string): Promise<AccountRecord | undefined>;
  getByEmail(email: string): Promise<AccountRecord | undefined>;
  createSession(tokenHash: string, accountId: string, expiresAt: number): Promise<void>;
  getAccountIdBySession(tokenHash: string): Promise<string | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
}