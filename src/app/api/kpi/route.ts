import { NextResponse } from "next/server";

import { buildKPIReport } from "@/lib/kpi";

export const runtime = "nodejs";

export async function GET() {
  const report = buildKPIReport();
  return NextResponse.json(report);
}
