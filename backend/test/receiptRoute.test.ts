import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { InMemoryAccountRepository } from "../src/repository/inMemoryAccountRepository";
import { InMemoryBillRepository } from "../src/repository/inMemoryBillRepository";
import { extractReceipt } from "../src/services/receiptService";

vi.mock("../src/services/receiptService", () => ({
  extractReceipt: vi.fn(),
}));

async function setup() {
  const app = createApp(new InMemoryBillRepository(), new InMemoryAccountRepository());
  const registration = await request(app).post("/api/auth/register").send({
    email: "receipt@example.com",
    password: "password123",
    displayName: "Receipt User",
  });
  const billResponse = await request(app)
    .post("/api/bills")
    .set("Authorization", `Bearer ${registration.body.token}`)
    .send({});

  return {
    app,
    token: registration.body.token as string,
    billId: billResponse.body.id as string,
  };
}

describe("receipt upload body size", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractReceipt).mockResolvedValue({ items: [], total: 0 });
  });

  it("accepts receipt JSON larger than the default 100 KB parser limit", async () => {
    const { app, token, billId } = await setup();
    const imageBase64 = "A".repeat(200_000);

    const response = await request(app)
      .post(`/api/bills/${billId}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send({ imageBase64, mimeType: "image/png" });

    expect(response.status).toBe(200);
    expect(extractReceipt).toHaveBeenCalledWith(imageBase64, "image/png");
  });

  it("passes a full reference image with the selected crop for extraction", async () => {
    const { app, token, billId } = await setup();
    const imageBase64 = "Y3JvcA==";
    const referenceImageBase64 = "ZnVsbA==";

    const response = await request(app)
      .post(`/api/bills/${billId}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        imageBase64,
        mimeType: "image/jpeg",
        referenceImageBase64,
        referenceMimeType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(extractReceipt).toHaveBeenCalledWith(
      imageBase64,
      "image/jpeg",
      referenceImageBase64,
      "image/png"
    );
  });

  it("rejects a pair of images over the combined limit", async () => {
    const { app, token, billId } = await setup();

    const response = await request(app)
      .post(`/api/bills/${billId}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        imageBase64: "A".repeat(7_600_000),
        referenceImageBase64: "B".repeat(7_600_000),
      });

    expect(response.status).toBe(400);
    expect(extractReceipt).not.toHaveBeenCalled();
  });

  it("returns a clean 413 when the receipt body exceeds the upload limit", async () => {
    const { app, token, billId } = await setup();

    const response = await request(app)
      .post(`/api/bills/${billId}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send({ imageBase64: "A".repeat(16 * 1024 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "Request body too large" });
    expect(extractReceipt).not.toHaveBeenCalled();
  });

  it("keeps the default JSON size limit for other endpoints", async () => {
    const { app, token } = await setup();

    const response = await request(app)
      .post("/api/bills")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "x".repeat(200_000) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "Request body too large" });
  });
});
