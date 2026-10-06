import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../backend/src/app";
import { InMemoryBillRepository } from "../../../backend/src/repository/inMemoryBillRepository";
import { extractReceipt } from "../../../backend/src/services/receiptService";

vi.mock("../../../backend/src/services/receiptService", () => ({
  extractReceipt: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

describe("frontend API client with the backend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the real HTTP contract through the full bill lifecycle", async () => {
    const server = createApp(new InMemoryBillRepository()).listen(0, "127.0.0.1");

    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Test server did not bind to a TCP port");
      }

      const values = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      });
      vi.stubEnv("VITE_API_BASE_URL", `http://127.0.0.1:${address.port}`);
      vi.resetModules();

      const { api, authToken, ApiError } = await import("./client");
      const registered = await api.register({
        email: "integration@example.com",
        password: "password123",
        displayName: "Integration User",
      });
      expect(registered.account.email).toBe("integration@example.com");
      authToken.set(registered.token);

      expect(await api.getMe()).toMatchObject({
        id: registered.account.id,
        email: "integration@example.com",
      });

      const bill = await api.createBill("API integration dinner");
      expect(bill).toMatchObject({
        title: "API integration dinner",
        ownerId: registered.account.id,
        people: [{ id: registered.account.id, name: registered.account.displayName }],
        items: [],
      });
      const receiptResult = await api.importReceipt(bill.id, "cropped-image", "image/jpeg", {
        imageBase64: "full-image",
        mimeType: "image/png",
      });
      expect(receiptResult.extraction).toEqual({ items: [], total: 0 });
      expect(extractReceipt).toHaveBeenCalledWith(
        "cropped-image",
        "image/jpeg",
        "full-image",
        "image/png"
      );

      const ownerId = bill.people[0].id;
      const ada = await api.addPerson(bill.id, "Ada");
      const adaId = ada.people[1].id;
      const ben = await api.addPerson(bill.id, "Ben");
      const benId = ben.people[2].id;

      const pastaBill = await api.addItem(bill.id, { name: "Pasta", price: 20 });
      const pastaId = pastaBill.items[0].id;
      const sharedDrinkBill = await api.addItem(bill.id, { name: "Shared drink", price: 10 });
      const drinkId = sharedDrinkBill.items[1].id;
      await api.updateItem(bill.id, pastaId, { name: "Pasta", price: 20 });
      await api.toggleAssignment(bill.id, pastaId, adaId);
      await api.toggleAssignment(bill.id, drinkId, adaId);
      await api.toggleAssignment(bill.id, drinkId, benId);
      await api.updateSettings(bill.id, { tipAmount: 3, serviceFeeAmount: 0 });

      const byId = await api.getBill(bill.id);
      expect(byId.items.find((item) => item.id === drinkId)?.assignedTo).toEqual([adaId, benId]);
      expect(await api.getBillByJoinCode(bill.joinCode)).toMatchObject({ id: bill.id });

      const split = await api.getSplit(bill.id);
      expect(split).toEqual({
        personTotals: [
          expect.objectContaining({
            personId: ownerId,
            itemsSubtotal: 0,
            tipShare: 0,
            total: 0,
          }),
          expect.objectContaining({
            personId: adaId,
            itemsSubtotal: 25,
            tipShare: 2.5,
            total: 27.5,
          }),
          expect.objectContaining({ personId: benId, itemsSubtotal: 5, tipShare: 0.5, total: 5.5 }),
        ],
        unassignedSubtotal: 0,
        grandTotal: 33,
      });
      expect(await api.getSplitByJoinCode(bill.joinCode)).toEqual(split);

      const settledBill = await api.setPersonSettled(bill.id, adaId, true);
      expect(settledBill.settledPersonIds).toContain(adaId);
      const paidBill = await api.setBillPaid(bill.id, true);
      expect(paidBill.paidAt).toEqual(expect.any(Number));
      expect(await api.getAccountBills()).toMatchObject({
        active: [],
        paid: [expect.objectContaining({ id: bill.id })],
      });

      const removedItemBill = await api.addItem(bill.id, { name: "Temporary", price: 1 });
      const temporaryItemId = removedItemBill.items[2].id;
      expect((await api.removeItem(bill.id, temporaryItemId)).items).toHaveLength(2);

      const temporaryPersonBill = await api.addPerson(bill.id, "Temporary person");
      const temporaryPersonId = temporaryPersonBill.people[2].id;
      expect((await api.removePerson(bill.id, temporaryPersonId)).people).toHaveLength(3);

      await api.logout();
      await expect(api.getMe()).rejects.toMatchObject({
        status: 401,
        name: ApiError.name,
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
