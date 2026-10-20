import { describe, expect, it } from "vitest";
import { AccountRecord } from "../src/repository/accountRepository";
import { InMemoryAccountRepository } from "../src/repository/inMemoryAccountRepository";

function account(id: string, email: string): AccountRecord {
  return {
    id,
    email,
    displayName: id,
    createdAt: Date.now(),
    passwordHash: "hash",
  };
}

describe("InMemoryAccountRepository", () => {
  it("rejects duplicate email without overwriting the existing account", async () => {
    const repository = new InMemoryAccountRepository();
    const existing = account("account-1", "person@example.com");
    await repository.create(existing);

    await expect(repository.create(account("account-2", "PERSON@example.com"))).rejects.toThrow(
      "Account email already exists"
    );

    expect(await repository.getById(existing.id)).toEqual(existing);
    expect(await repository.getById("account-2")).toBeUndefined();
    expect(await repository.getByEmail("person@example.com")).toEqual(existing);
  });

  it("rejects duplicate ID without adding a new email index", async () => {
    const repository = new InMemoryAccountRepository();
    const existing = account("account-1", "person@example.com");
    await repository.create(existing);

    await expect(repository.create(account("account-1", "other@example.com"))).rejects.toThrow(
      "Account ID already exists"
    );

    expect(await repository.getById(existing.id)).toEqual(existing);
    expect(await repository.getByEmail("other@example.com")).toBeUndefined();
    expect(await repository.getByEmail("person@example.com")).toEqual(existing);
  });
});
