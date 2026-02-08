import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai";
import { retrieveEvidence } from "@/lib/agents/retrieve";
import { audit } from "@/lib/storage";
import { datasetHealth, getCaseByTicketNumber } from "@/lib/dataset";
import { readAutopilotEvents } from "@/lib/autopilot";
import { loadSimTickets, loadSimConversations } from "@/lib/sim";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { message: string };
  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  const ticketNumber = extractTicketNumber(message);
  const caseData = ticketNumber ? getCaseByTicketNumber(ticketNumber) : null;
  const countIntent = isCountQuestion(message);

  const healthEvidence = countIntent
    ? [
        {
          sourceType: "KB" as const,
          sourceId: "DATASET:HEALTH",
          score: 999,
          snippet: datasetHealthSnippet(),
          title: "Dataset Health",
        },
      ]
    : [];
  const wantsOpsExplanation =
    /auto\-publish|autopublish|publish|llm judge|judge|why.*publish/i.test(message) ||
    /\bgap_detect\b|\bkb_draft\b|\bqa_eval\b|\bqa_eval_started\b|\bpublish_started\b|\bneeds_review\b|\bautopilot\b/i.test(
      message
    ) ||
    /\blineage\s+completeness\b|\bknowledge\s+engine\b|\bkpi\b|\bmetrics\b/i.test(message);

  const directTicketEvidence =
    ticketNumber && caseData?.ticket
      ? [
          {
            sourceType: "TICKET_RESOLUTION" as const,
            sourceId: ticketNumber,
            score: 999,
            snippet: makeTicketSnippet(caseData.ticket, caseData.conversation),
            title: (caseData.ticket.Subject || "").trim(),
          },
        ]
      : [];

  const opsEvidence =
    wantsOpsExplanation
      ? [
          {
            sourceType: "KB" as const,
            sourceId: "AUTOPILOT:GLOSSARY",
            score: 999,
            snippet: autopilotGlossarySnippet(),
            title: "Autopilot Glossary",
          },
          {
            sourceType: "KB" as const,
            sourceId: "KPI:GLOSSARY",
            score: 999,
            snippet: kpiGlossarySnippet(),
            title: "KPI Glossary",
          },
          ...(ticketNumber
            ? [
                {
                  sourceType: "KB" as const,
                  sourceId: `AUTOPILOT:${ticketNumber}`,
                  score: 999,
                  snippet: summarizeAutopilot(ticketNumber),
                  title: "Autopilot Timeline",
                },
              ]
            : []),
        ]
      : [];

  const evidence = [
    ...directTicketEvidence,
    ...healthEvidence,
    ...opsEvidence,
    ...retrieveEvidence({ query: message, corpus: "KB", k: 4 }),
    ...retrieveEvidence({ query: message, corpus: "SCRIPT", k: 4 }),
    ...retrieveEvidence({ query: message, corpus: "TICKET_RESOLUTION", k: 2 }),
  ];

  const client = getOpenAI();
  const prompt = `You are SupportMind, a self-learning support intelligence agent.

You must:
- Answer using ONLY the evidence provided.
- Never invent IDs, scripts, KB articles, or steps.
- If evidence is insufficient, ask 2-3 clarifying questions and propose an escalation path.
- If the user provides a Ticket_Number (e.g., CS-12345678) and ticket evidence is present, summarize the case: Subject, Priority, Tier, Category, Script_ID, KB_Article_ID, Generated_KB_Article_ID, and Resolution (if available). Keep it concise.
- Provide a short answer, then a "Citations" list with the exact IDs used.

If DATASET:HEALTH evidence is present and the user asks for totals (tickets, KB articles, scripts, conversations), answer using those counts. Do not guess from partial retrieval.

User message:
${message}

Evidence:
${evidence.map((e) => `- [${e.sourceType}] ${e.sourceId}: ${e.snippet}`).join("\n")}
`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const answer = resp.output_text.trim();
  audit({
    type: "retrieve",
    ticketNumber: ticketNumber || undefined,
    ok: true,
    summary: ticketNumber ? `Chat retrieve for ${ticketNumber}` : "Chat retrieve",
    payload: {
      mode: "chat",
      message,
      ticketNumber,
      evidence,
      model: "gpt-4.1-mini",
      evidenceCount: evidence.length,
    },
  });

  return NextResponse.json({
    answer,
    citations: evidence.map((e) => ({ sourceType: e.sourceType, sourceId: e.sourceId, score: e.score })),
  });
}

function isCountQuestion(text: string): boolean {
  const t = text.toLowerCase();
  if (!/(how many|total|count)/.test(t)) return false;
  return /(ticket|tickets|case|cases|kb|knowledge|article|articles|script|scripts|conversation|conversations|questions)/.test(
    t
  );
}

function datasetHealthSnippet(): string {
  const h = datasetHealth();
  const simTickets = loadSimTickets().length;
  const simConvs = loadSimConversations().length;
  const tickets = Number(h.sheetCounts["Tickets"] || 0);
  const conv = Number(h.sheetCounts["Conversations"] || 0);
  const kb = Number(h.sheetCounts["Knowledge_Articles"] || 0);
  const scripts = Number(h.sheetCounts["Scripts_Master"] || 0);
  const questions = Number(h.sheetCounts["Questions"] || 0);
  return [
    `Dataset totals (SupportMind__Final_Data.xlsx):`,
    `- Tickets: ${tickets} (plus sim: ${simTickets})`,
    `- Conversations: ${conv} (plus sim: ${simConvs})`,
    `- Knowledge_Articles: ${kb}`,
    `- Scripts_Master: ${scripts}`,
    `- Questions (eval): ${questions}`,
    `\nNote: "sim" items are locally generated via Autopilot seeding and stored in .data/sim/*.jsonl.`,
  ].join("\n");
}

function extractTicketNumber(text: string): string | null {
  // Common dataset format: CS-########
  const m = text.match(/\bCS-\d{8}\b/);
  if (m) return m[0];
  // Fallback: any CS- token
  const m2 = text.match(/\bCS-[A-Z0-9]+\b/);
  return m2 ? m2[0] : null;
}

function makeTicketSnippet(ticket: Record<string, string>, conv: Record<string, string> | null) {
  const parts = [
    `Ticket_Number: ${(ticket.Ticket_Number || "").trim()}`,
    ticket.Subject ? `Subject: ${(ticket.Subject || "").trim()}` : "",
    ticket.Priority ? `Priority: ${(ticket.Priority || "").trim()}` : "",
    ticket.Tier ? `Tier: ${(ticket.Tier || "").trim()}` : "",
    ticket.Category ? `Category: ${(ticket.Category || "").trim()}` : "",
    ticket.Module ? `Module: ${(ticket.Module || "").trim()}` : "",
    ticket.Script_ID ? `Script_ID: ${(ticket.Script_ID || "").trim()}` : "",
    ticket.KB_Article_ID ? `KB_Article_ID: ${(ticket.KB_Article_ID || "").trim()}` : "",
    ticket.Generated_KB_Article_ID ? `Generated_KB_Article_ID: ${(ticket.Generated_KB_Article_ID || "").trim()}` : "",
    ticket.Resolution ? `Resolution: ${(ticket.Resolution || "").trim()}` : "",
    conv?.Issue_Summary ? `Issue_Summary: ${(conv.Issue_Summary || "").trim()}` : "",
  ].filter(Boolean);
  return parts.join(" | ").slice(0, 600);
}

function summarizeAutopilot(ticketNumber: string): string {
  const evs = readAutopilotEvents(200)
    .filter((e) => e.ticketNumber === ticketNumber)
    .slice(-12);
  if (evs.length === 0) return `No autopilot events found for ${ticketNumber}.`;

  const last = evs[evs.length - 1];
  const lines = evs.map((e) => `${e.stage} ok=${e.ok} :: ${e.summary}`);
  return `Autopilot timeline for ${ticketNumber}. Last stage: ${last.stage} (ok=${last.ok}).\n` + lines.join("\n");
}

function autopilotGlossarySnippet(): string {
  return [
    "SupportMind Autopilot stages (internal pipeline vocabulary):",
    "- seeded: new ticket+transcript created (simulated live feed)",
    "- gap_detect: LLM judge decides whether knowledge work is needed (draft_new_kb | patch_existing_kb | no_action)",
    "- kb_draft: KB draft generated with required inputs + lineage/provenance",
    "- guardrail: safety/compliance checks applied; blocks unsafe drafts",
    "- qa_eval_started: QA rubric evaluation started (can take time / rate-limit)",
    "- qa_eval: QA rubric evaluated; JSON stored as artifact",
    "- publish_started: autopublish started (writing KB + lineage)",
    "- published: KB published locally; corpus updated",
    "- needs_review: autopilot stopped for human review (e.g., guardrails block, QA timeout, rate limit)",
    "- failed: unexpected error; see debug report",
    "\nIf you ask about a stage (e.g., gap_detect), explain what it means and what comes next.",
  ].join("\n");
}

function kpiGlossarySnippet(): string {
  return [
    "SupportMind KPI definitions (for dashboard / knowledge engine):",
    "- lineage completeness: percent of published KB drafts that include all three provenance edges (Ticket + Conversation + Script) in local lineage logs (.data/lineage/kb_lineage.jsonl).",
    "- guardrail block rate: fraction of KB drafts blocked by safety/compliance checks.",
    "- gap detection rate: fraction of evaluated cases where the judge recommends knowledge work (draft/patch).",
    "- hit@k: deterministic retrieval accuracy computed from Questions.Answer_Type + Target_ID ground truth.",
    "\nIf you ask what a KPI means, explain the definition and where it’s computed/logged.",
  ].join("\n");
}
