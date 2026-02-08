import { z } from "zod";

import { getOpenAI } from "@/lib/openai";
import { loadWorkbook } from "@/lib/dataset";
import { newId } from "@/lib/storage";
import type { EvidenceCitation, KBDraft } from "@/lib/agents/types";

const DraftSchema = z.object({
  title: z.string().min(6),
  bodyMarkdown: z.string().min(40),
  tags: z.array(z.string()).default([]),
  module: z.string().optional(),
  category: z.string().optional(),
  requiredInputs: z
    .array(
      z.object({
        placeholder: z.string(),
        meaning: z.string().optional(),
        example: z.string().optional(),
      })
    )
    .default([]),
  references: z
    .array(z.object({ type: z.enum(["SCRIPT", "KB", "TICKET"]), id: z.string() }))
    .default([]),
  modelNotes: z.string().default(""),
});

export async function draftKnowledgeArticle(params: {
  ticketNumber: string;
  subject?: string;
  description?: string;
  resolution?: string;
  transcript?: string;
  scriptId?: string;
  scriptText?: string;
  evidence: EvidenceCitation[];
  kbArticleIdProposed?: string;
}): Promise<KBDraft> {
  const wb = loadWorkbook();
  const placeholders = wb.sheets["Placeholder_Dictionary"] || [];
  const placeholderMap = new Map(
    placeholders
      .map((r) => {
        const p = (r.Placeholder || "").trim();
        if (!p) return null;
        return [p, { meaning: (r.Meaning || "").trim(), example: (r.Example || "").trim() }] as const;
      })
      .filter(Boolean) as Array<readonly [string, { meaning: string; example: string }]>
  );

  const kbId = params.kbArticleIdProposed || `KB-DRAFT-${newId("kb")}`;
  const client = getOpenAI();

  const prompt = `You are a Tier-3 knowledge authoring agent building a governed knowledge base.

Write a KB article DRAFT from the provided case and evidence.

Constraints:
- Evidence-only. Do not invent IDs, commands, or confirmations.
- If a script is referenced, describe when to use it and list required placeholders as "Required Inputs".
- Include: Symptoms, Cause (if evidenced), Resolution Steps, Verification Steps, Escalation Notes, and References.
- Use concise operational language suitable for support.
- Output must be JSON only.

Return JSON with:
{
  title: string,
  bodyMarkdown: string,
  tags: string[],
  module?: string,
  category?: string,
  requiredInputs: [{placeholder, meaning?, example?}],
  references: [{type:"SCRIPT"|"KB"|"TICKET", id:string}],
  modelNotes: string
}

Case:
Ticket_Number: ${params.ticketNumber}
Subject: ${params.subject || ""}
Description: ${params.description || ""}
Resolution: ${params.resolution || ""}

Transcript (may be truncated):
${(params.transcript || "").slice(0, 3500)}

Script_ID: ${params.scriptId || ""}
Script_Text_Sanitized:
${(params.scriptText || "").slice(0, 2200)}

Evidence snippets:
${params.evidence
  .slice(0, 8)
  .map((e) => `- [${e.sourceType}] ${e.sourceId}: ${e.snippet}`)
  .join("\n")}
`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const json = safeJsonParse(resp.output_text);
  const parsed = DraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `KB draft JSON parse failed: ${parsed.error.message}. Raw: ${resp.output_text.slice(0, 400)}`
    );
  }

  const requiredInputs = parsed.data.requiredInputs.map((ri) => {
    const p = ri.placeholder.trim();
    const info = placeholderMap.get(p);
    return {
      placeholder: p,
      meaning: ri.meaning || info?.meaning,
      example: ri.example || info?.example,
    };
  });

  const lineage: KBDraft["lineage"] = [
    {
      kbArticleId: kbId,
      sourceType: "Ticket",
      sourceId: params.ticketNumber,
      relationship: "CREATED_FROM",
      evidenceSnippet: (params.subject || params.description || "Derived from ticket").slice(0, 180),
    },
  ];

  if (params.transcript) {
    // Conversation_ID isn't passed here; caller can patch it later.
    lineage.push({
      kbArticleId: kbId,
      sourceType: "Conversation",
      sourceId: "",
      relationship: "CREATED_FROM",
      evidenceSnippet: params.transcript.slice(0, 180).replace(/\s+/g, " "),
    });
  }
  if (params.scriptId) {
    lineage.push({
      kbArticleId: kbId,
      sourceType: "Script",
      sourceId: params.scriptId,
      relationship: "REFERENCES",
      evidenceSnippet: `KB references Script_ID ${params.scriptId} for backend fix procedure.`,
    });
  }

  return {
    kbDraftId: kbId,
    title: parsed.data.title,
    bodyMarkdown: parsed.data.bodyMarkdown,
    tags: parsed.data.tags,
    module: parsed.data.module,
    category: parsed.data.category,
    requiredInputs,
    references: parsed.data.references,
    lineage,
    modelNotes: parsed.data.modelNotes,
  };
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
