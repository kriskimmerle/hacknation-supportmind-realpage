import { z } from "zod";

import { getOpenAI } from "@/lib/openai";
import { loadWorkbook } from "@/lib/dataset";
import type { EvidenceCitation, KBDraft } from "@/lib/agents/types";
import { traceLLMCall, writeTraceArtifact } from "@/lib/trace";

const PatchSchema = z.object({
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
  references: z.array(z.object({ type: z.enum(["SCRIPT", "KB", "TICKET"]), id: z.string() })).default([]),
  changeLog: z.array(z.string()).default([]),
  modelNotes: z.string().default(""),
});

export async function patchKnowledgeArticle(params: {
  ticketNumber: string;
  kbArticleId: string;
  existingTitle?: string;
  existingBody?: string;
  subject?: string;
  description?: string;
  resolution?: string;
  transcript?: string;
  scriptId?: string;
  scriptText?: string;
  evidence: EvidenceCitation[];
}): Promise<{ draft: KBDraft; changeLog: string[] }> {
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

  const client = getOpenAI();
  const prompt = `You are a governed Tier-3 KB editor.

Patch (update) an EXISTING KB article using ONLY the provided evidence.

Constraints:
- Evidence-only. Do not invent IDs, commands, or confirmations.
- Keep KB_Article_ID unchanged.
- Preserve working steps; improve clarity, fix incorrect parts, add missing verification/escalation guidance.
- If a script is referenced, describe when to use it and list required placeholders as "Required Inputs".
- Include: Symptoms, Cause (if evidenced), Resolution Steps, Verification Steps, Escalation Notes, and References.
- Output JSON only.

Return JSON:
{
  title: string,
  bodyMarkdown: string,
  tags: string[],
  module?: string,
  category?: string,
  requiredInputs: [{placeholder, meaning?, example?}],
  references: [{type:"SCRIPT"|"KB"|"TICKET", id:string}],
  changeLog: string[],
  modelNotes: string
}

KB_Article_ID: ${params.kbArticleId}
EXISTING_TITLE:
${params.existingTitle || ""}

EXISTING_BODY:
${(params.existingBody || "").slice(0, 5000)}

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
  .slice(0, 10)
  .map((e) => `- [${e.sourceType}] ${e.sourceId}: ${e.snippet}`)
  .join("\n")}
`;

  const started = Date.now();
  const resp = await client.responses.create({ model: "gpt-4.1-mini", input: prompt });
  const durationMs = Date.now() - started;

  const outputText = resp.output_text;
  const json = safeJsonParse(outputText);
  const parsed = PatchSchema.safeParse(json);

  const artifactPath = writeTraceArtifact({
    ticketNumber: params.ticketNumber,
    scope: "kb_patch",
    kind: "llm",
    data: { model: "gpt-4.1-mini", prompt, outputText, kbArticleId: params.kbArticleId },
  });
  traceLLMCall({
    ticketNumber: params.ticketNumber,
    stage: "kb_patch",
    model: "gpt-4.1-mini",
    input: prompt,
    outputText,
    durationMs,
    parseOk: parsed.success,
    artifactPath,
  });

  if (!parsed.success) {
    throw new Error(`KB patch JSON parse failed: ${parsed.error.message}. Raw: ${outputText.slice(0, 400)}`);
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
      kbArticleId: params.kbArticleId,
      sourceType: "Ticket",
      sourceId: params.ticketNumber,
      relationship: "CREATED_FROM",
      evidenceSnippet: (params.subject || params.description || "Patch informed by ticket").slice(0, 180),
    },
    {
      kbArticleId: params.kbArticleId,
      sourceType: "Ticket",
      sourceId: params.ticketNumber,
      relationship: "PATCHES",
      evidenceSnippet: `Patched KB_Article_ID ${params.kbArticleId} using evidence from ticket ${params.ticketNumber}.`,
    },
  ];

  if (params.transcript) {
    lineage.push({
      kbArticleId: params.kbArticleId,
      sourceType: "Conversation",
      sourceId: "",
      relationship: "CREATED_FROM",
      evidenceSnippet: params.transcript.slice(0, 180).replace(/\s+/g, " "),
    });
  }
  if (params.scriptId) {
    lineage.push({
      kbArticleId: params.kbArticleId,
      sourceType: "Script",
      sourceId: params.scriptId,
      relationship: "REFERENCES",
      evidenceSnippet: `KB patch references Script_ID ${params.scriptId} for backend procedure.`,
    });
  }

  const draft: KBDraft = {
    kbDraftId: params.kbArticleId,
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

  return { draft, changeLog: parsed.data.changeLog };
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
