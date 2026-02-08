import { NextResponse } from "next/server";

import fs from "node:fs";

import { getCaseByTicketNumber, loadWorkbook } from "@/lib/dataset";
import { detectGap } from "@/lib/agents/gapDetector";
import { retrieveEvidence } from "@/lib/agents/retrieve";
import { draftKnowledgeArticle } from "@/lib/agents/kbDraft";
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

    const draft = await draftKnowledgeArticle({
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
    if (conversation?.Conversation_ID) {
      for (const l of draft.lineage) {
        if (l.sourceType === "Conversation" && !l.sourceId) l.sourceId = conversation.Conversation_ID;
      }
    }

    const guard = await runGuardrails({
      content: `${draft.title}\n\n${draft.bodyMarkdown}`,
      context: { ticketNumber, kbDraftId: draft.kbDraftId },
    });

    const draftPath = projectDataPath("autopilot", "runs", id, "kb_draft.json");
    writeJson(draftPath, { draft, guardrails: guard });
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
