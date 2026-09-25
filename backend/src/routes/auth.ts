import { Router } from "express";
import { AccountService } from "../services/accountService";
import { requireAuth, getBearerToken } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { unauthorized } from "../utils/httpError";
import { BillService } from "../services/billService";
import { credentialsSchema, registerSchema } from "../schemas/auth";
import { oauthLoginSchema } from "../schemas/auth";

export function createAuthRouter(accountService: AccountService, billService: BillService): Router {
  const router = Router();

  router.post("/register", asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    res.status(201).json(await accountService.register(body.email, body.password, body.displayName));
  }));

  router.post("/login", asyncHandler(async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    res.json(await accountService.login(body.email, body.password));
  }));

  router.post("/oauth", asyncHandler(async (req, res) => {
    const body = oauthLoginSchema.parse(req.body);
    res.json(await accountService.loginWithOAuth(body.accessToken));
  }));

  router.get("/me", requireAuth(accountService), asyncHandler(async (req, res) => {
    if (!req.accountId) throw unauthorized();
    res.json(await accountService.getAccount(req.accountId));
  }));

  router.get("/me/bills", requireAuth(accountService), asyncHandler(async (req, res) => {
    if (!req.accountId) throw unauthorized();
    res.json({ active: await billService.listBills(req.accountId, false), paid: await billService.listBills(req.accountId, true) });
  }));

  router.post("/logout", requireAuth(accountService), asyncHandler(async (req, res) => {
    const token = getBearerToken(req);
    if (token) await accountService.logout(token);
    res.status(204).send();
  }));

  return router;
}