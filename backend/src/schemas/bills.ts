import { z } from "zod";

import { personSchema } from "./auth";

const gstModeSchema = z.enum(["inclusive", "exclusive", "none"]);
export type GstMode = z.infer<typeof gstModeSchema>;

export const billItemSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(200),
  price: z.number().min(0),
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

export const createBillSchema = z.object({ title: z.string().min(1).max(200).optional() });

export const updateBillSettingsSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    gstMode: gstModeSchema.optional(),
    gstRate: z.number().min(0).max(1).optional(),
    tipAmount: z.number().min(0).optional(),
    serviceFeeAmount: z.number().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields provided" });

export type UpdateSettingsInput = z.infer<typeof updateBillSettingsSchema>;

export const addPersonSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const setSettledSchema = z.object({ settled: z.boolean() });

export const addItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().min(0),
});
export type AddItemInput = z.infer<typeof addItemSchema>;

export const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    price: z.number().min(0).optional(),
    quantity: z.number().int().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields provided" });
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const toggleAssignmentSchema = z.object({ personId: z.string().min(1) });

export const paidSchema = z.object({ paid: z.boolean() });