import { NextResponse } from "next/server";

import { getCaseByTicketNumber, loadWorkbook } from "@/lib/dataset";
import { retrieveEvidence } from "@/lib/agents/retrieve";
import { draftKnowledgeArticle } from "@/lib/agents/kbDraft";
import { patchKnowledgeArticle } from "@/lib/agents/kbPatch";
import { runGuardrails } from "@/lib/agents/guardrails";
import { audit, writeJson, projectDataPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { ticketNumber: string; mode?: "new" | "patch" };
  const ticketNumber = body.ticketNumber;
  const mode = body.mode === "patch" ? "patch" : "new";
  const { ticket, conversation } = getCaseByTicketNumber(ticketNumber);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const query = [ticket.Subject, ticket.Description, conversation?.Transcript || ""].filter(Boolean).join("\n");
  const evidence = [
    ...retrieveEvidence({ query, corpus: "KB", k: 5 }),
    ...retrieveEvidence({ query, corpus: "SCRIPT", k: 5 }),
    ...retrieveEvidence({ query, corpus: "TICKET_RESOLUTION", k: 3 }),
  ];

  // Pull script text if script id exists
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

  if (mode === "patch") {
    const baseKbId = (ticket.KB_Article_ID || "").trim();
    if (!baseKbId) return NextResponse.json({ error: "No KB_Article_ID on ticket; cannot patch" }, { status: 400 });
    const kbRows = wb.sheets["Knowledge_Articles"] || [];
    const kbRow = kbRows.find((r) => (r.KB_Article_ID || "").trim() === baseKbId) || null;

    const patched = await patchKnowledgeArticle({
      ticketNumber,
      kbArticleId: baseKbId,
      existingTitle: (kbRow?.Title || "").trim(),
      existingBody: (kbRow?.Body || "").trim(),
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

  // Patch conversation id into lineage if available
  if (conversation?.Conversation_ID) {
    for (const l of draft.lineage) {
      if (l.sourceType === "Conversation" && !l.sourceId) l.sourceId = conversation.Conversation_ID;
    }
  }

  const guard = await runGuardrails({
    content: `${draft.title}\n\n${draft.bodyMarkdown}`,
    context: { ticketNumber, kbDraftId: draft.kbDraftId, scriptId: ticket.Script_ID || "" },
  });

  const out = { draft, guardrails: guard, evidence, mode, patch: patchMeta };

  writeJson(projectDataPath("kb_drafts", `${ticketNumber}.json`), out);
  audit({
    type: "guardrail",
    ticketNumber,
    ok: guard.ok,
    summary: guard.ok ? "Guardrails passed" : `Guardrails blocked: ${guard.reasons.join("; ")}`,
    payload: { context: { ticketNumber, kbDraftId: draft.kbDraftId }, ...guard },
  });
  audit({
    type: "kb_draft",
    ticketNumber,
    ok: guard.ok,
    summary: `Drafted KB (${guard.ok ? "guardrails ok" : "blocked"})`,
    payload: {
      ...out,
      artifacts: {
        kbDraftPath: projectDataPath("kb_drafts", `${ticketNumber}.json`),
      },
      inputs: {
        scriptId: ticket.Script_ID || "",
        kbArticleIdProposed: ticket.Generated_KB_Article_ID || "",
      },
    },
  });
  return NextResponse.json(out);
}
