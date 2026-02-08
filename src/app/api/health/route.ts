import { NextResponse } from "next/server";

import { datasetHealth } from "@/lib/dataset";
import { audit } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const health = datasetHealth();
  audit({ type: "health", payload: health });
  return NextResponse.json(health);
}
