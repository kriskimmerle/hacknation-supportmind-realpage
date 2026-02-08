import { NextResponse } from "next/server";

import fs from "node:fs";

import { getCaseByTicketNumber, loadWorkbook } from "@/lib/dataset";
import { detectGap } from "@/lib/agents/gapDetector";
import { retrieveEvidence } from "@/lib/agents/retrieve";
import { draftKnowledgeArticle } from "@/lib/agents/kbDraft";
import { patchKnowledgeArticle } from "@/lib/agents/kbPatch";
import { runGuardrails } from "@/lib/agents/guardrails";
import { runQaEvaluation } from "@/lib/agents/qaEval";
import { logAutopilotEvent } from "@/lib/autopilot";
import { projectDataPath, writeJson, appendJsonl } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { ticketNumber: string };
  const ticketNumber = (body.ticketNumber || "").trim();
  if (!ticketNumber) return NextResponse.json({ error: "Missing ticketNumber" }, { status: 400 });

  const { ticket, conversation } = getCaseByTicketNumber(ticketNumber);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const id = `auto-${ticketNumber}-${Date.now()}`;
  const artifacts: Record<string, string> = {};

  try {
    const gap = await detectGap({
      ticketNumber,
      subject: ticket.Subject,
      description: ticket.Description,
      resolution: ticket.Resolution,
      transcript: conversation?.Transcript,
      scriptId: ticket.Script_ID,
      kbId: ticket.KB_Article_ID,
      generatedKbId: ticket.Generated_KB_Article_ID,
    });

    const gapPath = projectDataPath("autopilot", "runs", id, "gap.json");
    writeJson(gapPath, gap);
    artifacts.gap = gapPath;
    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "gap_detect",
      ok: true,
      summary: `${gap.action}: ${gap.reason}`,
      artifactPaths: { ...artifacts },
    });

    if (gap.action === "no_action") {
      logAutopilotEvent({
        id,
        ticketNumber,
        stage: "needs_review",
        ok: true,
        summary: "No action recommended (auto-publish skipped).",
        artifactPaths: { ...artifacts },
      });
      return NextResponse.json({ ok: true, id, gap, published: false });
    }

    const query = [ticket.Subject, ticket.Description, conversation?.Transcript || ""].filter(Boolean).join("\n");
    const evidence = [
      ...retrieveEvidence({ query, corpus: "KB", k: 5 }),
      ...retrieveEvidence({ query, corpus: "SCRIPT", k: 5 }),
      ...retrieveEvidence({ query, corpus: "TICKET_RESOLUTION", k: 3 }),
    ];

    const wb = loadWorkbook();
    const scripts = wb.sheets["Scripts_Master"] || [];
    const scriptRow = ticket.Script_ID
      ? scripts.find((r) => (r.Script_ID || "").trim() === (ticket.Script_ID || "").trim())
      : null;

    // Add direct script evidence when ticket links a script.
    if (ticket.Script_ID && scriptRow) {
      evidence.unshift({
        sourceType: "SCRIPT",
        sourceId: (ticket.Script_ID || "").trim(),
        score: 999,
        snippet: (scriptRow.Script_Purpose || scriptRow.Script_Text_Sanitized || "").slice(0, 220),
        title: (scriptRow.Script_Title || "").trim(),
      });
    }

    let draft;
    let patchMeta: Record<string, unknown> | null = null;
    if (gap.action === "patch_existing_kb") {
      const baseKbId = (ticket.KB_Article_ID || "").trim();
      const kbRows = wb.sheets["Knowledge_Articles"] || [];
      const kbRow = baseKbId ? kbRows.find((r) => (r.KB_Article_ID || "").trim() === baseKbId) || null : null;
      if (!baseKbId || !kbRow) {
        logAutopilotEvent({
          id,
          ticketNumber,
          stage: "needs_review",
          ok: false,
          summary: "Patch requested but KB_Article_ID missing/unresolvable; routed to human review",
          artifactPaths: { ...artifacts },
        });
        return NextResponse.json({ ok: true, id, gap, published: false, reason: "missing_base_kb" });
      }

      const patched = await patchKnowledgeArticle({
        ticketNumber,
        kbArticleId: baseKbId,
        existingTitle: (kbRow.Title || "").trim(),
        existingBody: (kbRow.Body || "").trim(),
        subject: ticket.Subject,
        description: ticket.Description,
        resolution: ticket.Resolution,
        transcript: conversation?.Transcript,
        scriptId: ticket.Script_ID,
        scriptText: scriptRow?.Script_Text_Sanitized,
        evidence,
      });
      draft = patched.draft;
      patchMeta = { baseKbId, changeLog: patched.changeLog };
    } else {
      draft = await draftKnowledgeArticle({
        ticketNumber,
        subject: ticket.Subject,
        description: ticket.Description,
        resolution: ticket.Resolution,
        transcript: conversation?.Transcript,
        scriptId: ticket.Script_ID,
        scriptText: scriptRow?.Script_Text_Sanitized,
        evidence,
        kbArticleIdProposed: ticket.Generated_KB_Article_ID || undefined,
      });
    }
    if (conversation?.Conversation_ID) {
      for (const l of draft.lineage) {
        if (l.sourceType === "Conversation" && !l.sourceId) l.sourceId = conversation.Conversation_ID;
      }
    }

    const guard = await runGuardrails({
      content: `${draft.title}\n\n${draft.bodyMarkdown}`,
      context: { ticketNumber, kbDraftId: draft.kbDraftId, scriptId: ticket.Script_ID || "" },
    });

    const draftPath = projectDataPath("autopilot", "runs", id, "kb_draft.json");
    writeJson(draftPath, { draft, guardrails: guard, evidence, patch: patchMeta, mode: gap.action === "patch_existing_kb" ? "patch" : "new" });
    artifacts.kbDraft = draftPath;
    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "kb_draft",
      ok: true,
      summary: `Drafted KB (${guard.ok ? "guardrails ok" : "guardrails blocked"})`,
      artifactPaths: { ...artifacts },
    });

    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "guardrail",
      ok: guard.ok,
      summary: guard.ok ? "Guardrails passed" : `Guardrails blocked: ${guard.reasons.join("; ")}`,
      artifactPaths: { ...artifacts },
    });

    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "qa_eval_started",
      ok: true,
      summary: "QA rubric evaluation started",
      artifactPaths: { ...artifacts },
    });

    let qa: unknown = null;
    try {
      qa = await withTimeout(
        runQaEvaluation({
          ticketNumber,
          transcript: conversation?.Transcript,
          ticketFields: ticket,
        }),
        45_000
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const errPath = projectDataPath("autopilot", "runs", id, "error.json");
      writeJson(errPath, { step: "qa_eval", message, at: new Date().toISOString() });
      artifacts.error = errPath;

      logAutopilotEvent({
        id,
        ticketNumber,
        stage: "needs_review",
        ok: false,
        summary: isRateLimited(message)
          ? "LLM judge rate-limited during QA; routed to human review"
          : message.includes("Timeout")
            ? "QA timed out; routed to human review"
            : `QA failed; routed to human review: ${message}`,
        artifactPaths: { ...artifacts },
      });

      return NextResponse.json({ ok: true, id, gap, draft, guardrails: guard, qa: null, published: false });
    }

    const qaPath = projectDataPath("autopilot", "runs", id, "qa.json");
    writeJson(qaPath, qa);
    artifacts.qa = qaPath;

    // Also write the canonical QA artifact so KPIs include autopilot QA runs.
    try {
      writeJson(projectDataPath("qa", `${ticketNumber}.json`), qa);
    } catch {
      // ignore
    }
    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "qa_eval",
      ok: true,
      summary: "QA rubric evaluated",
      artifactPaths: { ...artifacts },
    });

    if (!guard.ok) {
      logAutopilotEvent({
        id,
        ticketNumber,
        stage: "needs_review",
        ok: false,
        summary: `Blocked by guardrails: ${guard.reasons.join("; ")}`,
        artifactPaths: { ...artifacts },
      });
      return NextResponse.json({ ok: true, id, gap, draft, guardrails: guard, qa, published: false });
    }

    // QA must gate autopublish (trust interface): block on red flags or low score.
    const qaGate = qaAllowsPublish(qa);
    if (!qaGate.ok) {
      logAutopilotEvent({
        id,
        ticketNumber,
        stage: "needs_review",
        ok: false,
        summary: `Blocked by QA gate: ${qaGate.reason}`,
        artifactPaths: { ...artifacts },
      });
      return NextResponse.json({ ok: true, id, gap, draft, guardrails: guard, qa, published: false, qaGate });
    }

    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "publish_started",
      ok: true,
      summary: "Auto-publish started (LLM judge)",
      artifactPaths: { ...artifacts },
    });

    // Auto-publish by calling the existing publish endpoint logic: write artifacts + lineage.
    const publishPath = projectDataPath("kb_published", `${ticketNumber}.json`);
    writeJson(publishPath, {
      ticketNumber,
      decision: "approved",
      reviewerRole: "LLM_JUDGE",
      notes: "Auto-published by LLM judge (guardrails passed)",
      at: new Date().toISOString(),
      draft,
      guardrails: guard,
      qa,
    });
    artifacts.published = publishPath;

    // Record governance decision so dashboard reflects auto-publishes.
    appendJsonl(projectDataPath("governance", "decisions.jsonl"), {
      ticketNumber,
      decision: "approved",
      reviewerRole: "LLM_JUDGE",
      notes: "Auto-published by LLM judge (guardrails passed)",
      source: "autopilot",
      at: new Date().toISOString(),
      draft,
      guardrails: guard,
      qa,
    });

    // emit lineage
    const lineagePath = projectDataPath("lineage", "kb_lineage.jsonl");
    fs.mkdirSync(projectDataPath("lineage"), { recursive: true });
    for (const row of draft.lineage) {
      fs.appendFileSync(lineagePath, JSON.stringify(row) + "\n");
    }

    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "published",
      ok: true,
      summary: "Auto-published KB (LLM judge)",
      artifactPaths: { ...artifacts },
    });

    return NextResponse.json({ ok: true, id, gap, draft, guardrails: guard, qa, published: true });
  } catch (e: unknown) {
    logAutopilotEvent({
      id,
      ticketNumber,
      stage: "failed",
      ok: false,
      summary: e instanceof Error ? e.message : String(e),
      artifactPaths: { ...artifacts },
    });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function qaAllowsPublish(qa: unknown): { ok: boolean; reason: string; overall: number | null; redFlagsYes: number } {
  const obj = qa && typeof qa === "object" ? (qa as any) : null;
  const overallRaw = typeof obj?.Overall_Weighted_Score === "string" ? obj.Overall_Weighted_Score : "";
  const m = overallRaw.match(/(\d+(?:\.\d+)?)%/);
  const overall = m ? Number(m[1]) : null;

  const red = obj?.Red_Flags && typeof obj.Red_Flags === "object" ? obj.Red_Flags : {};
  const redFlagsYes = Object.values(red).filter((v: any) => String(v?.score || "").toLowerCase() === "yes").length;
  if (redFlagsYes > 0) return { ok: false, reason: `red flags triggered (${redFlagsYes})`, overall, redFlagsYes };

  const threshold = 80;
  if (overall === null) return { ok: false, reason: "missing Overall_Weighted_Score", overall, redFlagsYes };
  if (overall < threshold) return { ok: false, reason: `score below threshold (${overall}% < ${threshold}%)`, overall, redFlagsYes };

  return { ok: true, reason: "ok", overall, redFlagsYes };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function isRateLimited(message: string): boolean {
  return /\b429\b/.test(message) || /rate limit/i.test(message);
}
