import { z } from "zod";
import { accountSchema, personSchema } from "../shared/contracts";

export { accountSchema, personSchema };
export type { Account, Person } from "../shared/contracts";

export const authMethodSchema = z.enum(["password", "oauth"]);
export type AuthMethod = z.infer<typeof authMethodSchema>;

export const accountRecordSchema = accountSchema.extend({
  passwordHash: z.string(),
  authMethod: authMethodSchema,
});
export type AccountRecord = z.infer<typeof accountRecordSchema>;

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(100),
});

export const oauthLoginSchema = z.object({ accessToken: z.string().min(1) });
