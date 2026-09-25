import { Request, RequestHandler } from "express";
import { AccountService } from "../services/accountService";
import { unauthorized } from "../utils/httpError";

declare global {
  namespace Express {
    interface Request {
      accountId?: string;
    }
  }
}

export function requireAuth(accountService: AccountService): RequestHandler {
  return async (req, _res, next) => {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    try {
      const accountId = token ? await accountService.getAccountIdForToken(token) : undefined;
      if (!accountId) return next(unauthorized());
      req.accountId = accountId;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function getBearerToken(req: Request): string | undefined {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}