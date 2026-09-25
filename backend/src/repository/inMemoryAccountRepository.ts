import { AccountRecord, AccountRepository } from "./accountRepository";

export class InMemoryAccountRepository implements AccountRepository {
  private accountsById = new Map<string, AccountRecord>();
  private accountIdByEmail = new Map<string, string>();
  private accountIdBySession = new Map<string, { accountId: string; expiresAt: number }>();

  async create(account: AccountRecord): Promise<void> {
    this.accountsById.set(account.id, account);
    this.accountIdByEmail.set(account.email, account.id);
  }

  async getById(accountId: string): Promise<AccountRecord | undefined> {
    return this.accountsById.get(accountId);
  }

  async getByEmail(email: string): Promise<AccountRecord | undefined> {
    const accountId = this.accountIdByEmail.get(email.toLowerCase());
    return accountId ? this.accountsById.get(accountId) : undefined;
  }

  async createSession(tokenHash: string, accountId: string, expiresAt: number): Promise<void> {
    this.accountIdBySession.set(tokenHash, { accountId, expiresAt });
  }

  async getAccountIdBySession(tokenHash: string): Promise<string | undefined> {
    const session = this.accountIdBySession.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) {
      this.accountIdBySession.delete(tokenHash);
      return undefined;
    }
    return session.accountId;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.accountIdBySession.delete(tokenHash);
  }
}