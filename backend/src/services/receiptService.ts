import { execFile, ExecFileException } from "child_process";
import path from "path";
import { extractedReceiptSchema, ExtractedReceipt } from "../schemas/receipt";

const INFERENCE_TIMEOUT_MS = 10 * 60 * 1000;

export function receiptProcessFailureMessage(error: ExecFileException): string {
  if (error.killed) {
    return `Inference process timed out after ${INFERENCE_TIMEOUT_MS / 60_000} minutes`;
  }
  if (typeof error.code === "number") {
    return `Inference process exited with code ${error.code}`;
  }
  if (error.signal) {
    return `Inference process stopped by signal ${error.signal}`;
  }
  return error.message;
}

export function receiptProcessErrorMessage(
  stdout: string,
  stderr: string,
  fallbackMessage: string
): string {
  const parseError = (text: string): string | undefined => {
    try {
      const output: unknown = JSON.parse(text);
      if (
        typeof output === "object" &&
        output !== null &&
        "error" in output &&
        typeof output.error === "string"
      ) {
        return output.error;
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const stdoutError =
    parseError(stdout) ??
    stdout
      .split(/\r?\n/)
      .reverse()
      .map((line) => parseError(line.trim()))
      .find((message) => message !== undefined);
  if (stdoutError) return stdoutError;

  const errorMarker = "SPLITRECEIPT_ERROR:";
  for (const line of stderr.split(/\r?\n/).reverse()) {
    const markerIndex = line.lastIndexOf(errorMarker);
    if (markerIndex < 0) continue;
    const markedError = parseError(line.slice(markerIndex + errorMarker.length).trim());
    if (markedError) return markedError;
  }

  const usefulStderr = stderr
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line && !/Fetching\s+\d+\s+files?:/.test(line))
    .join("\n");
  return usefulStderr || fallbackMessage;
}

export async function extractReceipt(
  imageBase64: string,
  mimeType?: string
): Promise<ExtractedReceipt> {
  const scriptPath =
    process.env.SPLITRECEIPT_INFERENCE_SCRIPT ??
    path.resolve(process.cwd(), "../model/receipt_inference.py");
  const python = process.env.SPLITRECEIPT_PYTHON ?? "python3";

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        python,
        [scriptPath],
        {
          maxBuffer: 1024 * 1024,
          timeout: INFERENCE_TIMEOUT_MS,
        },
        (error, output, stderr) => {
          if (error) {
            const fallbackMessage = receiptProcessFailureMessage(error);
            reject(new Error(receiptProcessErrorMessage(output, stderr, fallbackMessage)));
            return;
          }
          resolve(output);
        }
      );
      child.stdin?.end(JSON.stringify({ imageBase64, mimeType }));
    });
    return extractedReceiptSchema.parse(JSON.parse(stdout));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Receipt model extraction failed: ${message}`);
  }
}
