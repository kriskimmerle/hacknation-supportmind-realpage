import { z } from "zod";

import { getOpenAI } from "@/lib/openai";
import { retrieveEvidence } from "@/lib/agents/retrieve";
import type { GapDecision } from "@/lib/agents/types";

const GapSchema = z.object({
  gapDetected: z.boolean(),
  action: z.enum(["draft_new_kb", "patch_existing_kb", "no_action"]),
  reason: z.string().min(1),
  answerTypeSuggested: z.enum(["KB", "SCRIPT", "TICKET_RESOLUTION"]),
});

type GapCore = z.infer<typeof GapSchema>;

export async function detectGap(params: {
  ticketNumber: string;
  subject?: string;
  description?: string;
  resolution?: string;
  transcript?: string;
  scriptId?: string;
  kbId?: string;
  generatedKbId?: string;
}): Promise<GapDecision> {
  const query = [
    params.subject || "",
    params.description || "",
    params.transcript ? params.transcript.slice(0, 1200) : "",
  ]
    .filter(Boolean)
    .join("\n");

  const kbEvidence = retrieveEvidence({ query, corpus: "KB", k: 5 });
  const scriptEvidence = retrieveEvidence({ query, corpus: "SCRIPT", k: 5 });
  const ticketEvidence = retrieveEvidence({ query, corpus: "TICKET_RESOLUTION", k: 5 });

  const evidence = [...kbEvidence.slice(0, 3), ...scriptEvidence.slice(0, 2), ...ticketEvidence.slice(0, 2)];

  // Heuristic guardrail: if already has a generated KB, typically no action.
  const heuristicNoAction = Boolean(params.generatedKbId && params.generatedKbId.startsWith("KB-SYN-"));

  const client = getOpenAI();
  const prompt = `You are a support knowledge governance agent.

Given the case and retrieved evidence, decide if there is a knowledge gap that should trigger drafting a new KB article, patching an existing KB, or taking no action.

Rules:
- Be evidence-only: do not invent facts.
- If the case already has a Generated_KB_Article_ID, prefer no_action unless there is clear evidence the KB is stale or wrong.
- If scriptRequired is implied (Tier 3 / Script_ID present), bias toward KB creation that references the script and required inputs.

Return JSON with:
{gapDetected:boolean, action:"draft_new_kb"|"patch_existing_kb"|"no_action", reason:string, answerTypeSuggested:"KB"|"SCRIPT"|"TICKET_RESOLUTION"}

Case:
Ticket_Number: ${params.ticketNumber}
Subject: ${params.subject || ""}
Description: ${params.description || ""}
Resolution: ${params.resolution || ""}
Script_ID: ${params.scriptId || ""}
KB_Article_ID: ${params.kbId || ""}
Generated_KB_Article_ID: ${params.generatedKbId || ""}

Evidence (top hits):
${evidence
  .map((e) => `- [${e.sourceType}] ${e.sourceId} (${e.score}): ${e.snippet}`)
  .join("\n")}
`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const text = resp.output_text;
  const json = safeJsonParse(text);
  const parsed = GapSchema.safeParse(json);
  const base: GapCore = parsed.success
    ? parsed.data
    : {
        gapDetected: !heuristicNoAction,
        action: heuristicNoAction ? "no_action" : "draft_new_kb",
        reason: "Fallback: could not parse model output; using heuristic.",
        answerTypeSuggested: params.scriptId ? "SCRIPT" : "KB",
      };

  if (heuristicNoAction) {
    return {
      ...base,
      gapDetected: false,
      action: "no_action",
      reason: base.reason || "Ticket already linked to a generated KB; no new knowledge action required.",
      evidence,
    };
  }

  return { ...base, evidence };
}

function safeJsonParse(s: string): unknown {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}
