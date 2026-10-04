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

function normalizeBearerToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const header = value.trim();
  if (!header.toLowerCase().startsWith("bearer ")) return undefined;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

export function requireAuth(accountService: AccountService): RequestHandler {
  return async (req, _res, next) => {
    const token = normalizeBearerToken(req.header("authorization"));
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
  return normalizeBearerToken(req.header("authorization"));
}