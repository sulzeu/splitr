import { json, Request, Router } from "express";
import { BillService } from "../services/billService";
import { asyncHandler } from "../middleware/asyncHandler";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { AccountService } from "../services/accountService";
import { unauthorized } from "../utils/httpError";
import { extractReceipt } from "../services/receiptService";
import {
  addItemSchema,
  addPersonSchema,
  createBillSchema,
  paidSchema,
  setSettledSchema,
  toggleAssignmentSchema,
  updateItemSchema,
  updateBillSettingsSchema,
} from "../schemas/bills";
import { requestedReceiptSchema } from "../schemas/receipt";

export function createBillsRouter(
  billService: BillService,
  accountService: AccountService
): Router {
  const router = Router();
  const auth = requireAuth(accountService);
  const accountId = (req: Request): string => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.accountId) throw unauthorized();
    return authReq.accountId;
  };

  router.post(
    "/",
    auth,
    asyncHandler(async (req, res) => {
      const body = createBillSchema.parse(req.body ?? {});
      const ownerId = accountId(req);
      const account = await accountService.getAccount(ownerId);
      const bill = await billService.createBill(ownerId, body.title, account.displayName);
      res.status(201).json(bill);
    })
  );

  router.get(
    "/by-code/:joinCode/join",
    asyncHandler(async (req, res) => {
      res.json(await billService.getBillAndSplitByJoinCode(req.params.joinCode));
    })
  );

  router.get(
    "/by-code/:joinCode",
    asyncHandler(async (req, res) => {
      const bill = await billService.getBillByJoinCode(req.params.joinCode);
      res.json(bill);
    })
  );

  router.post(
    "/:billId/receipt",
    auth,
    json({ limit: "16mb" }),
    asyncHandler(async (req, res) => {
      const { imageBase64, mimeType, referenceImageBase64, referenceMimeType } =
        requestedReceiptSchema.parse(req.body);
      const extraction = referenceImageBase64
        ? await extractReceipt(imageBase64, mimeType, referenceImageBase64, referenceMimeType)
        : await extractReceipt(imageBase64, mimeType);
      const bill = await billService.importReceipt(req.params.billId, accountId(req), extraction);
      res.json({ bill, extraction });
    })
  );

  router.get(
    "/by-code/:joinCode/split",
    asyncHandler(async (req, res) => {
      res.json(await billService.getSplitByJoinCode(req.params.joinCode));
    })
  );

  router.get(
    "/:billId",
    auth,
    asyncHandler(async (req, res) => {
      const bill = await billService.getBill(req.params.billId, accountId(req));
      res.json(bill);
    })
  );

  router.patch(
    "/:billId",
    auth,
    asyncHandler(async (req, res) => {
      const patch = updateBillSettingsSchema.parse(req.body);
      const bill = await billService.updateSettings(req.params.billId, accountId(req), patch);
      res.json(bill);
    })
  );

  router.patch(
    "/:billId/paid",
    auth,
    asyncHandler(async (req, res) => {
      const { paid } = paidSchema.parse(req.body);
      res.json(await billService.setPaid(req.params.billId, accountId(req), paid));
    })
  );

  router.get(
    "/:billId/split",
    auth,
    asyncHandler(async (req, res) => {
      const split = await billService.getSplit(req.params.billId, accountId(req));
      res.json(split);
    })
  );

  // --- People ---

  router.post(
    "/:billId/people",
    auth,
    asyncHandler(async (req, res) => {
      const { name } = addPersonSchema.parse(req.body);
      const bill = await billService.addPerson(req.params.billId, accountId(req), name);
      res.status(201).json(bill);
    })
  );

  router.delete(
    "/:billId/people/:personId",
    auth,
    asyncHandler(async (req, res) => {
      const bill = await billService.removePerson(
        req.params.billId,
        accountId(req),
        req.params.personId
      );
      res.json(bill);
    })
  );

  router.patch(
    "/:billId/people/:personId/settled",
    auth,
    asyncHandler(async (req, res) => {
      const { settled } = setSettledSchema.parse(req.body);
      const bill = await billService.setPersonSettled(
        req.params.billId,
        accountId(req),
        req.params.personId,
        settled
      );
      res.json(bill);
    })
  );

  // --- Items ---

  router.post(
    "/:billId/items",
    auth,
    asyncHandler(async (req, res) => {
      const item = addItemSchema.parse(req.body);
      const bill = await billService.addItem(req.params.billId, accountId(req), item);
      res.status(201).json(bill);
    })
  );

  router.patch(
    "/:billId/items/:itemId",
    auth,
    asyncHandler(async (req, res) => {
      const patch = updateItemSchema.parse(req.body);
      const bill = await billService.updateItem(
        req.params.billId,
        accountId(req),
        req.params.itemId,
        patch
      );
      res.json(bill);
    })
  );

  router.delete(
    "/:billId/items/:itemId",
    auth,
    asyncHandler(async (req, res) => {
      const bill = await billService.removeItem(
        req.params.billId,
        accountId(req),
        req.params.itemId
      );
      res.json(bill);
    })
  );

  router.post(
    "/:billId/items/:itemId/assignments",
    auth,
    asyncHandler(async (req, res) => {
      const { personId } = toggleAssignmentSchema.parse(req.body);
      const bill = await billService.toggleAssignment(
        req.params.billId,
        accountId(req),
        req.params.itemId,
        personId
      );
      res.json(bill);
    })
  );

  return router;
}
