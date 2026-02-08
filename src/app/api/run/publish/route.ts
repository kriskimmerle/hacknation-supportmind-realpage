import { NextResponse } from "next/server";

import fs from "node:fs";

import { projectDataPath, writeJson, appendJsonl, audit } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    ticketNumber: string;
    decision: "approved" | "rejected" | "needs_changes";
    reviewerRole?: string;
    notes?: string;
    source?: "manual" | "autopilot";
  };

  const draftPath = projectDataPath("kb_drafts", `${body.ticketNumber}.json`);
  if (!fs.existsSync(draftPath)) {
    return NextResponse.json({ error: "No draft found for this ticket" }, { status: 404 });
  }

  const draftPayload = JSON.parse(fs.readFileSync(draftPath, "utf-8"));
  const record = {
    ticketNumber: body.ticketNumber,
    decision: body.decision,
    reviewerRole: body.reviewerRole || "",
    notes: body.notes || "",
    source: body.source || "manual",
    at: new Date().toISOString(),
    draft: draftPayload.draft,
    guardrails: draftPayload.guardrails,
  };

  appendJsonl(projectDataPath("governance", "decisions.jsonl"), record);

  let publishedPath = "";
  let lineageEdges = 0;

  if (body.decision === "approved") {
    publishedPath = projectDataPath("kb_published", `${body.ticketNumber}.json`);
    writeJson(publishedPath, record);
    // also emit lineage rows
    const lineage = (draftPayload.draft?.lineage || []) as Array<Record<string, unknown>>;
    lineageEdges = lineage.length;
    for (const row of lineage) {
      appendJsonl(projectDataPath("lineage", "kb_lineage.jsonl"), row);
    }
  }

  audit({
    type: "kb_publish",
    ticketNumber: body.ticketNumber,
    ok: true,
    summary: body.decision === "approved" ? `Published KB (lineage edges: ${lineageEdges})` : `Governance: ${body.decision}`,
    payload: {
      decision: body.decision,
      reviewerRole: body.reviewerRole || "",
      source: body.source || "manual",
      draftId: String(draftPayload?.draft?.kbDraftId || ""),
      lineageEdges,
      publishedPath,
      governanceLogPath: projectDataPath("governance", "decisions.jsonl"),
    },
  });
  return NextResponse.json({ ok: true, record });
}
