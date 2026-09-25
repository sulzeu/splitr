import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { Account } from "../schemas/types";
import { AccountRecord, AccountRepository } from "../repository/accountRepository";
import { badRequest, conflict, unauthorized } from "../utils/httpError";

const PASSWORD_MIN_LENGTH = 8;

export type OAuthProfile = {
  id: string;
  email: string;
  displayName?: string;
};

export type OAuthVerifier = (accessToken: string) => Promise<OAuthProfile | undefined>;

export class AccountService {
  private static readonly SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(private repo: AccountRepository, private verifyOAuthToken?: OAuthVerifier) {}

  async register(email: string, password: string, displayName: string): Promise<{ account: Account; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (await this.repo.getByEmail(normalizedEmail)) throw conflict("An account with that email already exists");

    const account: AccountRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      displayName: displayName.trim(),
      createdAt: Date.now(),
      passwordHash: this.hashPassword(password),
    };
    await this.repo.create(account);
    return { account: this.publicAccount(account), token: await this.createSession(account.id) };
  }

  async login(email: string, password: string): Promise<{ account: Account; token: string }> {
    const account = await this.repo.getByEmail(email.trim().toLowerCase());
    if (!account || !this.verifyPassword(password, account.passwordHash)) {
      throw unauthorized("Invalid email or password");
    }
    return { account: this.publicAccount(account), token: await this.createSession(account.id) };
  }

  async loginWithOAuth(accessToken: string): Promise<{ account: Account; token: string }> {
    const profile = await this.verifyOAuthToken?.(accessToken);
    if (!profile) throw unauthorized("OAuth authentication is not configured");
    const email = profile.email.trim().toLowerCase();
    let account = await this.repo.getByEmail(email);
    if (!account) {
      account = {
        id: profile.id,
        email,
        displayName: profile.displayName?.trim() || email.split("@")[0],
        createdAt: Date.now(),
        passwordHash: this.hashPassword(randomBytes(32).toString("hex")),
      };
      await this.repo.create(account);
    }
    return { account: this.publicAccount(account), token: await this.createSession(account.id) };
  }

  async getAccount(accountId: string): Promise<Account> {
    const account = await this.repo.getById(accountId);
    if (!account) throw unauthorized("Invalid session");
    return this.publicAccount(account);
  }

  async getAccountIdForToken(token: string): Promise<string | undefined> {
    return this.repo.getAccountIdBySession(this.hashToken(token));
  }

  async logout(token: string): Promise<void> {
    await this.repo.deleteSession(this.hashToken(token));
  }

  private async createSession(accountId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await this.repo.createSession(this.hashToken(token), accountId, Date.now() + AccountService.SESSION_TTL_MS);
    return token;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private publicAccount(account: AccountRecord): Account {
    const { passwordHash: _passwordHash, ...publicAccount } = account;
    return publicAccount;
  }
}