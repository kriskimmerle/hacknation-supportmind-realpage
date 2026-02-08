import { NextResponse } from "next/server";

import { datasetHealth } from "@/lib/dataset";
import { audit } from "@/lib/storage";
import { validateEnv } from "@/lib/envValidation";

export const runtime = "nodejs";

export async function GET() {
  const envResult = validateEnv();
  const health = datasetHealth();
  
  const response = {
    ...health,
    env: {
      valid: envResult.valid,
      config: envResult.config,
      errors: envResult.errors,
      warnings: envResult.warnings,
    },
  };
  
  audit({ type: "health", payload: response });
  return NextResponse.json(response);
}
