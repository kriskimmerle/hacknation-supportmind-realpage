import { NextResponse } from "next/server";

import { readAutopilotEvents } from "@/lib/autopilot";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "40") || 40;
  return NextResponse.json({ events: readAutopilotEvents(limit) });
}
