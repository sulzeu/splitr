import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { InMemoryAccountRepository } from "../src/repository/inMemoryAccountRepository";
import { InMemoryBillRepository } from "../src/repository/inMemoryBillRepository";

async function createAuthenticatedApp() {
  const app = createApp(new InMemoryBillRepository(), new InMemoryAccountRepository());
  const register = await request(app).post("/api/auth/register").send({
    email: "owner@example.com",
    password: "password123",
    displayName: "Owner",
  });

  return { app, token: register.body.token };
}

describe("auth guard", () => {
  it("rejects malformed bearer tokens", async () => {
    const app = createApp(new InMemoryBillRepository(), new InMemoryAccountRepository());
    const res = await request(app).get("/api/auth/me").set("Authorization", "Token bad-token");
    expect(res.status).toBe(401);
  });

  it("rejects expired sessions", async () => {
    const accountRepo = new InMemoryAccountRepository();
    const app = createApp(new InMemoryBillRepository(), accountRepo);

    const register = await request(app).post("/api/auth/register").send({
      email: "owner2@example.com",
      password: "password123",
      displayName: "Owner",
    });

    const tokenHash = createHash("sha256").update(register.body.token).digest("hex");
    const initialSession = await accountRepo.getAccountIdBySession(tokenHash);
    expect(initialSession).toBeDefined();

    await accountRepo.createSession(tokenHash, "missing-account", Date.now() - 1000);
    const expiredResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${register.body.token}`);
    expect(expiredResponse.status).toBe(401);
  });

  it("accepts a valid bearer token and exposes account info", async () => {
    const { app, token } = await createAuthenticatedApp();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("owner@example.com");
    expect(res.body.displayName).toBe("Owner");
  });
});
