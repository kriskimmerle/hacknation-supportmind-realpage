import { NextResponse } from "next/server";

import { readAuditEvents } from "@/lib/storage";
import { buildXRayReport } from "@/lib/xray";
import { readAutopilotEvents } from "@/lib/autopilot";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticketNumber = (url.searchParams.get("ticketNumber") || "").trim();
  const limit = Number(url.searchParams.get("limit") || "80") || 80;

  if (!ticketNumber) {
    return NextResponse.json({ error: "Missing ticketNumber" }, { status: 400 });
  }

  const events = readAuditEvents({ ticketNumber, limit });
  const xray = buildXRayReport(ticketNumber);
  const autopilotEvents = readAutopilotEvents(250).filter((e) => e.ticketNumber === ticketNumber).slice(-60);

  return NextResponse.json({ ticketNumber, xray, events, autopilotEvents });
}
