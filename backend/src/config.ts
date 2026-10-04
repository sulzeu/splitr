export type AppConfig = {
  port: number;
  corsOrigins: string[];
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  inferenceScriptPath: string;
  pythonExecutable: string;
};

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? "3001");
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return 3001;
  return parsed;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) return ["http://localhost:5173", "http://127.0.0.1:5173"];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = parsePort(env.PORT);
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  return {
    port,
    corsOrigins,
    supabaseUrl: env.SUPABASE_URL || undefined,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    inferenceScriptPath:
      env.SPLITRECEIPT_INFERENCE_SCRIPT ??
      require("node:path").resolve(process.cwd(), "../model/receipt_inference.py"),
    pythonExecutable: env.SPLITRECEIPT_PYTHON ?? "python3",
  };
}
