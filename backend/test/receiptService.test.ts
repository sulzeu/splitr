import { describe, expect, it } from "vitest";
import {
  receiptProcessErrorMessage,
  receiptProcessFailureMessage,
} from "../src/services/receiptService";

describe("receiptProcessErrorMessage", () => {
  it("uses the model error from stdout instead of unrelated download progress on stderr", () => {
    const message = receiptProcessErrorMessage(
      JSON.stringify({ error: "Adapter weights are missing" }),
      "Fetching 11 files: 100%|██████████| 11/11",
      "Process exited with code 1"
    );

    expect(message).toBe("Adapter weights are missing");
  });

  it("falls back to stderr when the process did not emit a structured error", () => {
    const message = receiptProcessErrorMessage(
      "not json",
      "ModuleNotFoundError: No module named 'mlx_vlm'",
      "Process exited with code 1"
    );

    expect(message).toBe("ModuleNotFoundError: No module named 'mlx_vlm'");
  });

  it("extracts the tagged Python error after model download progress", () => {
    const message = receiptProcessErrorMessage(
      "",
      [
        "Fetching 11 files: 100%|██████████| 11/11",
        `SPLITRECEIPT_ERROR: ${JSON.stringify({ error: "Adapter weights are incompatible" })}`,
      ].join("\n"),
      "Inference process exited with code 1"
    );

    expect(message).toBe("Adapter weights are incompatible");
  });

  it("does not report download progress as the extraction failure", () => {
    const message = receiptProcessErrorMessage(
      "",
      "Fetching 11 files: 100%|██████████| 11/11",
      "Inference process exited with code 1"
    );

    expect(message).toBe("Inference process exited with code 1");
  });

  it("uses the process error when neither output stream has useful diagnostics", () => {
    expect(receiptProcessErrorMessage("", "  ", "Process timed out")).toBe("Process timed out");
  });
});

describe("receiptProcessFailureMessage", () => {
  it("explains when the inference process is killed by its timeout", () => {
    expect(receiptProcessFailureMessage(Object.assign(new Error("killed"), { killed: true }))).toBe(
      "Inference process timed out after 10 minutes"
    );
  });

  it("preserves an external signal when the process was not killed by the timeout", () => {
    expect(
      receiptProcessFailureMessage(
        Object.assign(new Error("terminated"), {
          killed: false,
          signal: "SIGTERM" as NodeJS.Signals,
        })
      )
    ).toBe("Inference process stopped by signal SIGTERM");
  });
});
