import fs from "node:fs";

import { loadWorkbook, getCaseByTicketNumber } from "@/lib/dataset";
import { projectDataPath } from "@/lib/storage";
import { loadSimTickets, loadSimConversations } from "@/lib/sim";

export type XRayJoin = {
  from: string;
  to: string;
  on: string;
  value: string;
  ok: boolean;
};

export type XRaySource = {
  label: string;
  ref: string;
  details?: Record<string, string | number | boolean>;
};

export type XRayReport = {
  ticketNumber: string;
  datasetPath: string;
  datasetLoadedAt: string;
  sources: XRaySource[];
  joins: XRayJoin[];
  aggregation: {
    caseContext: Record<string, unknown>;
    steps: Array<{ name: string; showYourWork: string; artifacts?: Record<string, string> }>;
  };
};

export function buildXRayReport(ticketNumber: string): XRayReport {
  const tn = (ticketNumber || "").trim();
  const wb = loadWorkbook();
  const { ticket, conversation } = getCaseByTicketNumber(tn);

  const sources: XRaySource[] = [];
  const joins: XRayJoin[] = [];
  const steps: Array<{ name: string; showYourWork: string; artifacts?: Record<string, string> }> = [];

  // Sim vs workbook
  const simTickets = loadSimTickets();
  const simConvs = loadSimConversations();
  const simTicketIdx = simTickets.findIndex((t) => (t.Ticket_Number || "").trim() === tn);
  const simConvIdx = simConvs.findIndex((c) => (c.Ticket_Number || "").trim() === tn);
  const isSim = simTicketIdx !== -1;

  if (isSim) {
    sources.push({
      label: "Sim Ticket (local)",
      ref: projectDataPath("sim", "tickets.jsonl"),
      details: { line: simTicketIdx + 1, key: "Ticket_Number", value: tn },
    });
    if (simConvIdx !== -1) {
      sources.push({
        label: "Sim Conversation (local)",
        ref: projectDataPath("sim", "conversations.jsonl"),
        details: { line: simConvIdx + 1, key: "Ticket_Number", value: tn },
      });
      joins.push({
        from: "sim.tickets",
        to: "sim.conversations",
        on: "Ticket_Number",
        value: tn,
        ok: true,
      });
    }

    const seedArtifact = projectDataPath("autopilot", "seed", `${tn}.json`);
    if (fs.existsSync(seedArtifact)) {
      sources.push({
        label: "Seed Artifact (LLM raw)",
        ref: seedArtifact,
        details: { kind: "autopilot/seed", ticketNumber: tn },
      });
    }
  } else {
    const ticketRows = wb.sheets["Tickets"] || [];
    const convRows = wb.sheets["Conversations"] || [];

    const tIdx = ticketRows.findIndex((r) => (r.Ticket_Number || "").trim() === tn);
    const cIdx = convRows.findIndex((r) => (r.Ticket_Number || "").trim() === tn);

    sources.push({
      label: "Ticket Record (workbook)",
      ref: `${wb.path}#Tickets`,
      details: { key: "Ticket_Number", value: tn, rowApprox: tIdx === -1 ? 0 : tIdx + 2 },
    });
    sources.push({
      label: "Conversation Transcript (workbook)",
      ref: `${wb.path}#Conversations`,
      details: { key: "Ticket_Number", value: tn, rowApprox: cIdx === -1 ? 0 : cIdx + 2 },
    });
    joins.push({
      from: "Tickets",
      to: "Conversations",
      on: "Ticket_Number",
      value: tn,
      ok: tIdx !== -1 && cIdx !== -1,
    });
  }

  const scriptId = (ticket?.Script_ID || "").trim();
  if (scriptId) {
    const rows = wb.sheets["Scripts_Master"] || [];
    const sIdx = rows.findIndex((r) => (r.Script_ID || "").trim() === scriptId);
    sources.push({
      label: "Tier-3 Script (workbook)",
      ref: `${wb.path}#Scripts_Master`,
      details: { key: "Script_ID", value: scriptId, rowApprox: sIdx === -1 ? 0 : sIdx + 2 },
    });
    joins.push({
      from: isSim ? "sim.tickets" : "Tickets",
      to: "Scripts_Master",
      on: "Script_ID",
      value: scriptId,
      ok: sIdx !== -1,
    });
  }

  const kbId = (ticket?.KB_Article_ID || "").trim();
  if (kbId) {
    const rows = wb.sheets["Knowledge_Articles"] || [];
    const kIdx = rows.findIndex((r) => (r.KB_Article_ID || "").trim() === kbId);
    sources.push({
      label: "KB Article (workbook)",
      ref: `${wb.path}#Knowledge_Articles`,
      details: { key: "KB_Article_ID", value: kbId, rowApprox: kIdx === -1 ? 0 : kIdx + 2 },
    });
    joins.push({
      from: isSim ? "sim.tickets" : "Tickets",
      to: "Knowledge_Articles",
      on: "KB_Article_ID",
      value: kbId,
      ok: kIdx !== -1,
    });
  }

  const generatedKbId = (ticket?.Generated_KB_Article_ID || "").trim();
  if (generatedKbId) {
    const rows = wb.sheets["Knowledge_Articles"] || [];
    const gIdx = rows.findIndex((r) => (r.KB_Article_ID || "").trim() === generatedKbId);
    sources.push({
      label: "Generated KB Article ID (workbook)",
      ref: `${wb.path}#Knowledge_Articles`,
      details: { key: "KB_Article_ID", value: generatedKbId, rowApprox: gIdx === -1 ? 0 : gIdx + 2 },
    });
  }

  const publishedPath = projectDataPath("kb_published", `${tn}.json`);
  if (fs.existsSync(publishedPath)) {
    sources.push({
      label: "Published KB Artifact (local)",
      ref: publishedPath,
      details: { ticketNumber: tn, kind: "kb_published" },
    });
  }

  const draftPath = projectDataPath("kb_drafts", `${tn}.json`);
  if (fs.existsSync(draftPath)) {
    sources.push({
      label: "KB Draft Artifact (local)",
      ref: draftPath,
      details: { ticketNumber: tn, kind: "kb_drafts" },
    });
  }

  const qaPath = projectDataPath("qa", `${tn}.json`);
  if (fs.existsSync(qaPath)) {
    sources.push({
      label: "QA Artifact (local)",
      ref: qaPath,
      details: { ticketNumber: tn, kind: "qa" },
    });
  }

  // Note: transcript/script are used to build the "case" presented to agents.
  sources.push({
    label: "Case Aggregation", 
    ref: "getCaseByTicketNumber(Ticket_Number)",
    details: {
      ticketFound: !!ticket,
      conversationFound: !!conversation,
      joinKey: "Ticket_Number",
      fieldsUsed: "Tickets.Subject + Tickets.Description + Tickets.Resolution + Conversations.Transcript (preview/truncated) + Tickets.Script_ID/KB IDs",
      transcriptChars: conversation?.Transcript ? conversation.Transcript.length : 0,
      subject: (ticket?.Subject || "").slice(0, 120),
      hasResolution: Boolean((ticket?.Resolution || "").trim()),
    },
  });

  // Show-your-work aggregation steps used across agents.
  steps.push({
    name: "Aggregate case context",
    showYourWork:
      "Load ticket + conversation via getCaseByTicketNumber(Ticket_Number). Prefer local sim feed if present; otherwise use workbook tabs. Trim fields and use Transcript (preview/truncated) as evidence input.",
  });
  steps.push({
    name: "Build retrieval query",
    showYourWork:
      "Construct query = Subject + Description + Transcript. Use BM25 retrieval over corpora: Knowledge_Articles (+ local published KB), Scripts_Master, Tickets (+ sim tickets).",
  });
  steps.push({
    name: "Gap detection",
    showYourWork:
      "Retrieve top hits from KB/SCRIPT/TICKET_RESOLUTION using the query (Transcript truncated to ~1200 chars). Send case + evidence snippets to LLM judge to choose: draft_new_kb | patch_existing_kb | no_action.",
  });
  steps.push({
    name: "KB draft",
    showYourWork:
      "Retrieve evidence again (KB/SCRIPT/TICKET_RESOLUTION). Load Script_Text_Sanitized from Scripts_Master when Script_ID present. Send case + script + evidence to LLM to draft governed KB JSON (includes required inputs + references).",
  });
  steps.push({
    name: "Guardrails",
    showYourWork:
      "Run OpenAI moderation on KB draft content and perform lightweight sensitive-data checks (PCI/credentials). Block publish if flagged.",
  });
  steps.push({
    name: "QA coaching",
    showYourWork:
      "Load QA rubric from QA_Evaluation_Prompt tab, then LLM-evaluate transcript + ticket fields; emit weighted score + red flags.",
  });

  return {
    ticketNumber: tn,
    datasetPath: wb.path,
    datasetLoadedAt: wb.loadedAt,
    sources,
    joins,
    aggregation: {
      caseContext: {
        ticketSource: isSim ? "sim" : "workbook",
        ticketNumber: tn,
        subject: (ticket?.Subject || "").trim(),
        descriptionChars: (ticket?.Description || "").length,
        transcriptChars: conversation?.Transcript ? conversation.Transcript.length : 0,
        transcriptPreviewChars: conversation?.Transcript ? Math.min(conversation.Transcript.length, 800) : 0,
        gapTranscriptTruncChars: conversation?.Transcript ? Math.min(conversation.Transcript.length, 1200) : 0,
        qaTranscriptTruncChars: conversation?.Transcript ? Math.min(conversation.Transcript.length, 8000) : 0,
        scriptId: (ticket?.Script_ID || "").trim(),
        kbArticleId: (ticket?.KB_Article_ID || "").trim(),
        generatedKbArticleId: (ticket?.Generated_KB_Article_ID || "").trim(),
      },
      steps,
    },
  };
}
