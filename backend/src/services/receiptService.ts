import { execFile } from "child_process";
import path from "path";
import { receiptExtractionSchema } from "../schemas/receipt";
import type { ReceiptExtraction } from "../schemas/receipt";

export async function extractReceipt(imageBase64: string, mimeType?: string): Promise<ReceiptExtraction> {
  const scriptPath = process.env.SPLITRECEIPT_INFERENCE_SCRIPT ??
    path.resolve(process.cwd(), "../model/receipt_inference.py");
  const python = process.env.SPLITRECEIPT_PYTHON ?? "python3";

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(python, [scriptPath], {
        maxBuffer: 1024 * 1024,
        timeout: 120_000,
      }, (error, output, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(output);
      });
      child.stdin?.end(JSON.stringify({ imageBase64, mimeType }));
    });
    return receiptExtractionSchema.parse(JSON.parse(stdout));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Receipt model extraction failed: ${message}`);
  }
}