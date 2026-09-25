import { z } from "zod";

export const personSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(100),
});
export type Person = z.infer<typeof personSchema>;

export const accountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(100),
  createdAt: z.number(),
});
export type Account = z.infer<typeof accountSchema>;

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