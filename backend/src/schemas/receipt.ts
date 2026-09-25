import { z } from "zod";

export const requestedReceiptSchema = z.object({
  imageBase64: z.string().min(1).max(15_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
});

export type RequestReceipt = z.infer<typeof requestedReceiptSchema>

export const extractedReceiptSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().trim().min(1),
      price: z.number().finite().min(0),
      quantity: z.number().int().min(1).default(1),
    })
  ),
  total: z.number().finite().min(0),
});

export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>;