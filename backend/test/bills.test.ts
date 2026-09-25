import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { InMemoryBillRepository } from "../src/repository/inMemoryBillRepository";

async function makeApp() {
  const app = createApp(new InMemoryBillRepository());
  const auth = await request(app).post("/api/auth/register").send({
    email: "owner@example.com",
    password: "password123",
    displayName: "Owner",
  });
  return { app, token: auth.body.token };
}

function api(app: ReturnType<typeof createApp>, token: string, method: "get" | "post" | "patch", path: string) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

describe("bills API", () => {
  it("requires an account and prevents another account from accessing a bill", async () => {
    const app = createApp(new InMemoryBillRepository());
    const unauthenticated = await request(app).post("/api/bills").send({});
    expect(unauthenticated.status).toBe(401);

    const owner = await request(app).post("/api/auth/register").send({
      email: "owner@example.com",
      password: "password123",
      displayName: "Owner",
    });
    const other = await request(app).post("/api/auth/register").send({
      email: "other@example.com",
      password: "password123",
      displayName: "Other",
    });
    const bill = await api(app, owner.body.token, "post", "/api/bills").send({});
    const forbidden = await api(app, other.body.token, "get", `/api/bills/${bill.body.id}`);
    expect(forbidden.status).toBe(403);
  });

  it("stores paid bills on the account history", async () => {
    const { app, token } = await makeApp();
    const created = await api(app, token, "post", "/api/bills").send({ title: "Paid dinner" });
    const before = await api(app, token, "get", "/api/auth/me/bills");
    expect(before.body.active).toHaveLength(1);
    expect(before.body.paid).toHaveLength(0);

    const paid = await api(app, token, "patch", `/api/bills/${created.body.id}/paid`).send({ paid: true });
    expect(paid.body.paidAt).toEqual(expect.any(Number));

    const after = await api(app, token, "get", "/api/auth/me/bills");
    expect(after.body.active).toHaveLength(0);
    expect(after.body.paid[0].id).toBe(created.body.id);
  });

  it("creates a bill with a unique 6-char join code", async () => {
    const { app, token } = await makeApp();
    const res = await api(app, token, "post", "/api/bills").send({ title: "Friday dinner" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Friday dinner");
    expect(res.body.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.people).toEqual([]);
    expect(res.body.items).toEqual([]);
  });

  it("can be fetched again by id and by join code", async () => {
    const { app, token } = await makeApp();
    const created = await api(app, token, "post", "/api/bills").send({});
    const byId = await api(app, token, "get", `/api/bills/${created.body.id}`);
    const byCode = await api(app, token, "get", `/api/bills/by-code/${created.body.joinCode}`);
    const splitByCode = await request(app).get(`/api/bills/by-code/${created.body.joinCode}/split`);
    expect(byId.status).toBe(200);
    expect(byCode.status).toBe(200);
    expect(splitByCode.status).toBe(200);
    expect(byId.body.id).toBe(created.body.id);
    expect(byCode.body.id).toBe(created.body.id);
  });

  it("join code lookup is case-insensitive", async () => {
    const { app, token } = await makeApp();
    const created = await api(app, token, "post", "/api/bills").send({});
    const res = await request(app).get(`/api/bills/by-code/${created.body.joinCode.toLowerCase()}`);
    expect(res.status).toBe(200);
  });

  it("404s for a bill that doesn't exist", async () => {
    const { app, token } = await makeApp();
    const res = await api(app, token, "get", "/api/bills/not-a-real-id");
    expect(res.status).toBe(404);
  });

  it("rejects invalid input with 400", async () => {
    const { app, token } = await makeApp();
    const created = await api(app, token, "post", "/api/bills").send({});
    const res = await api(app, token, "post", `/api/bills/${created.body.id}/items`)
      .send({ name: "", price: -5 });
    expect(res.status).toBe(400);
  });

  it("full flow: people, items, assignment, and a penny-exact split", async () => {
    const { app, token } = await makeApp();
    const created = await api(app, token, "post", "/api/bills").send({ title: "Test dinner" });
    const billId = created.body.id;

    const alice = await api(app, token, "post", `/api/bills/${billId}/people`).send({ name: "Alice" });
    const bob = await api(app, token, "post", `/api/bills/${billId}/people`).send({ name: "Bob" });
    const cara = await api(app, token, "post", `/api/bills/${billId}/people`).send({ name: "Cara" });
    const aliceId = alice.body.people.find((p: any) => p.name === "Alice").id;
    const bobId = bob.body.people.find((p: any) => p.name === "Bob").id;
    const caraId = cara.body.people.find((p: any) => p.name === "Cara").id;

    const steak = await api(app, token, "post", `/api/bills/${billId}/items`)
      .send({ name: "Steak", price: 34.5 });
    const steakId = steak.body.items[0].id;

    const wine = await api(app, token, "post", `/api/bills/${billId}/items`)
      .send({ name: "Bottle of wine", price: 10.01 });
    const wineId = wine.body.items.find((i: any) => i.name === "Bottle of wine").id;

    await api(app, token, "patch", `/api/bills/${billId}`)
      .send({ serviceFeeAmount: 2.5 });

    // Assign steak to Alice only
    await api(app, token, "post", `/api/bills/${billId}/items/${steakId}/assignments`)
      .send({ personId: aliceId });

    // Wine shared by all three
    await api(app, token, "post", `/api/bills/${billId}/items/${wineId}/assignments`)
      .send({ personId: aliceId });
    await api(app, token, "post", `/api/bills/${billId}/items/${wineId}/assignments`)
      .send({ personId: bobId });
    await api(app, token, "post", `/api/bills/${billId}/items/${wineId}/assignments`)
      .send({ personId: caraId });

    const splitRes = await api(app, token, "get", `/api/bills/${billId}/split`);
    expect(splitRes.status).toBe(200);

    const totals = splitRes.body.personTotals;
    const sumOfTotals = totals.reduce((s: number, p: any) => s + p.total, 0);

    // Matches the hand-verified scenario from the split-calculator design work:
    // steak (34.50, Alice only) + wine (10.01, split 3 ways) + $2.50 service fee
    // proportional to spend = $47.01 distributed with no missing/extra cent.
    expect(Math.round(sumOfTotals * 100) / 100).toBe(47.01);

    const alicePersonTotal = totals.find((p: any) => p.personId === aliceId);
    const bobPersonTotal = totals.find((p: any) => p.personId === bobId);
    const caraPersonTotal = totals.find((p: any) => p.personId === caraId);
    expect(alicePersonTotal.total).toBeGreaterThan(bobPersonTotal.total);
    // Wine (10.01 / 3) doesn't divide evenly in cents; the largest-remainder
    // method gives any leftover cent(s) to whoever comes first in the
    // item's assignedTo order (Bob here, assigned before Cara), so their
    // totals are within a cent of each other rather than exactly equal.
    expect(Math.abs(bobPersonTotal.total - caraPersonTotal.total)).toBeLessThanOrEqual(0.01);

    // Mark Alice as settled and confirm it sticks
    const settledRes = await api(app, token, "patch", `/api/bills/${billId}/people/${aliceId}/settled`)
      .send({ settled: true });
    expect(settledRes.body.settledPersonIds).toContain(aliceId);

    // Toggling assignment off removes the person's share
    await api(app, token, "post", `/api/bills/${billId}/items/${steakId}/assignments`)
      .send({ personId: aliceId }); // toggles OFF since already assigned
    const afterUnassign = await api(app, token, "get", `/api/bills/${billId}/split`);
    const unassignedSubtotal = afterUnassign.body.unassignedSubtotal;
    expect(unassignedSubtotal).toBeCloseTo(34.5, 2);
  });
});
