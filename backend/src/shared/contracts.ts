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

export const gstModeSchema = z.enum(["inclusive", "exclusive", "none"]);
export type GstMode = z.infer<typeof gstModeSchema>;

export const billItemSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(200),
  price: z.number().min(0),
  quantity: z.number().int().min(1).max(1000).default(1),
  assignedTo: z.array(z.string()),
});
export type BillItem = z.infer<typeof billItemSchema>;

export const billSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  joinCode: z.string(),
  createdAt: z.number(),
  title: z.string().trim().min(1).max(200),
  people: z.array(personSchema),
  items: z.array(billItemSchema),
  gstMode: gstModeSchema,
  gstRate: z.number().min(0).max(1),
  tipAmount: z.number().min(0),
  serviceFeeAmount: z.number().min(0),
  receiptTotal: z.number().min(0).optional(),
  settledPersonIds: z.array(z.string()),
  paidAt: z.number().optional(),
  version: z.number().int().min(1),
});
export type Bill = z.infer<typeof billSchema>;

export const personTotalSchema = z.object({
  personId: z.string(),
  itemsSubtotal: z.number(),
  gstShare: z.number(),
  tipShare: z.number(),
  serviceFeeShare: z.number(),
  total: z.number(),
});
export type PersonTotal = z.infer<typeof personTotalSchema>;

export const splitResultSchema = z.object({
  personTotals: z.array(personTotalSchema),
  unassignedSubtotal: z.number(),
  grandTotal: z.number(),
});
export type SplitResult = z.infer<typeof splitResultSchema>;
