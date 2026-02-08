import { NextResponse } from "next/server";

import { getCaseByTicketNumber, loadWorkbook } from "@/lib/dataset";
import { retrieveEvidence } from "@/lib/agents/retrieve";
import { draftKnowledgeArticle } from "@/lib/agents/kbDraft";
import { runGuardrails } from "@/lib/agents/guardrails";
import { audit, writeJson, projectDataPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { ticketNumber: string };
  const ticketNumber = body.ticketNumber;
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

  // Patch conversation id into lineage if available
  if (conversation?.Conversation_ID) {
    for (const l of draft.lineage) {
      if (l.sourceType === "Conversation" && !l.sourceId) l.sourceId = conversation.Conversation_ID;
    }
  }

  const guard = await runGuardrails({
    content: `${draft.title}\n\n${draft.bodyMarkdown}`,
    context: { ticketNumber, kbDraftId: draft.kbDraftId },
  });

  const out = { draft, guardrails: guard };

  writeJson(projectDataPath("kb_drafts", `${ticketNumber}.json`), out);
  audit({ type: "kb_draft", ticketNumber, payload: out });
  return NextResponse.json(out);
}
