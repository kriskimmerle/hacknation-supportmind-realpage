import { NextResponse } from "next/server";

import fs from "node:fs";
import path from "node:path";

import { readAutopilotEvents } from "@/lib/autopilot";
import { projectDataPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticketNumber = (url.searchParams.get("ticketNumber") || "").trim();
  if (!ticketNumber) return NextResponse.json({ error: "Missing ticketNumber" }, { status: 400 });

  const all = readAutopilotEvents(200).filter((e) => e.ticketNumber === ticketNumber);
  const last = all[0] || null;

  // Find last run id from events
  const runId = last?.id?.startsWith("auto-") ? last.id : null;
  const runDir = runId ? projectDataPath("autopilot", "runs", runId) : null;

  const files = runDir
    ? ["gap.json", "kb_draft.json", "qa.json", "error.json"].reduce<Record<string, boolean>>((acc, f) => {
        acc[f] = fs.existsSync(path.join(runDir, f));
        return acc;
      }, {})
    : {};

  return NextResponse.json({
    ticketNumber,
    last,
    events: all.slice().reverse(),
    runId,
    runDir,
    runFiles: files,
  });
}
