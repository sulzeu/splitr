import express, { Express } from "express";
import cors from "cors";
import { createBillsRouter } from "./routes/bills";
import { BillService } from "./services/billService";
import { BillRepository } from "./repository/billRepository";
import { errorHandler } from "./middleware/errorHandler";
import { AccountRepository } from "./repository/accountRepository";
import { InMemoryAccountRepository } from "./repository/inMemoryAccountRepository";
import { AccountService } from "./services/accountService";
import { createAuthRouter } from "./routes/auth";
import { OAuthVerifier } from "./services/accountService";

export function createApp(
  repo: BillRepository,
  accountRepo: AccountRepository = new InMemoryAccountRepository(),
  verifyOAuthToken?: OAuthVerifier
): Express {
  const app = express();
  const billService = new BillService(repo);
  const accountService = new AccountService(accountRepo, verifyOAuthToken);

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", createAuthRouter(accountService, billService));
  app.use("/api/bills", createBillsRouter(billService, accountService));

  app.use(errorHandler);

  return app;
}
