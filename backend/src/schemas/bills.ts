import { z } from "zod";
import { gstModeSchema } from "../shared/contracts";

export {
  billItemSchema,
  billSchema,
  gstModeSchema,
  personTotalSchema,
  splitResultSchema,
} from "../shared/contracts";
export type { Bill, BillItem, GstMode, PersonTotal, SplitResult } from "../shared/contracts";

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
  quantity: z.number().int().min(1).max(1000).optional(),
});
export type AddItemInput = z.infer<typeof addItemSchema>;

export const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    price: z.number().min(0).optional(),
    quantity: z.number().int().min(1).max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields provided" });
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const toggleAssignmentSchema = z.object({ personId: z.string().min(1) });

export const paidSchema = z.object({ paid: z.boolean() });
