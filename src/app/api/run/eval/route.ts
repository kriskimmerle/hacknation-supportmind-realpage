import { NextResponse } from "next/server";

import { runRetrievalEval } from "@/lib/eval";
import { audit, writeJson, projectDataPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST() {
  const metrics = runRetrievalEval([1, 3, 5]);
  writeJson(projectDataPath("reports", "retrieval_metrics.json"), metrics);
  audit({ type: "retrieve", payload: metrics });
  return NextResponse.json(metrics);
}
