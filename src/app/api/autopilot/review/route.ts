import { NextResponse } from "next/server";

import fs from "node:fs";

import { readAutopilotEvents } from "@/lib/autopilot";
import { projectDataPath, writeJson, appendJsonl } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    ticketNumber: string;
    decision: "approved" | "rejected" | "needs_changes";
    reviewerRole?: string;
    notes?: string;
  };

  const ticketNumber = (body.ticketNumber || "").trim();
  if (!ticketNumber) return NextResponse.json({ error: "Missing ticketNumber" }, { status: 400 });

  // Find latest kb_draft artifact path from autopilot events
  const evs = readAutopilotEvents(200)
    .filter((e) => e.ticketNumber === ticketNumber)
    .slice()
    .reverse();

  const kbDraftEv = evs.find((e) => e.stage === "kb_draft" && e.artifactPaths?.kbDraft);
  const kbDraftPath = kbDraftEv?.artifactPaths?.kbDraft;
  if (!kbDraftPath || !fs.existsSync(kbDraftPath)) {
    return NextResponse.json({ error: "No autopilot draft artifact found for this ticket" }, { status: 404 });
  }

  const payload = JSON.parse(fs.readFileSync(kbDraftPath, "utf-8")) as Record<string, unknown>;
  const draft = payload.draft && typeof payload.draft === "object" ? (payload.draft as Record<string, unknown>) : null;
  const guardrails =
    payload.guardrails && typeof payload.guardrails === "object"
      ? (payload.guardrails as Record<string, unknown>)
      : null;
  const qa = payload.qa && typeof payload.qa === "object" ? payload.qa : null;
  const record = {
    ticketNumber,
    decision: body.decision,
    reviewerRole: body.reviewerRole || "Human Reviewer",
    notes: body.notes || "",
    source: "autopilot_review",
    at: new Date().toISOString(),
    draft,
    guardrails,
    qa,
    artifactSource: kbDraftPath,
  };

  appendJsonl(projectDataPath("governance", "decisions.jsonl"), record);

  if (body.decision === "approved") {
    const publishPath = projectDataPath("kb_published", `${ticketNumber}.json`);
    writeJson(publishPath, record);

    // emit lineage
    const lineage =
      draft && Array.isArray((draft as Record<string, unknown>).lineage)
        ? (((draft as Record<string, unknown>).lineage as unknown[]) as Array<Record<string, unknown>>)
        : [];
    for (const row of lineage) {
      appendJsonl(projectDataPath("lineage", "kb_lineage.jsonl"), row);
    }
  }

  return NextResponse.json({ ok: true, record });
}
