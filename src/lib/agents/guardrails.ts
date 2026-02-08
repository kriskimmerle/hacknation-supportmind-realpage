import { getOpenAI } from "@/lib/openai";
import { writeTraceArtifact } from "@/lib/trace";

export type GuardrailResult = {
  ok: boolean;
  reasons: string[];
  moderation?: unknown;
  artifactPath?: string;
};

export async function runGuardrails(params: {
  content: string;
  context: { ticketNumber?: string; kbDraftId?: string; scriptId?: string };
}): Promise<GuardrailResult> {
  const client = getOpenAI();
  const mod = await client.moderations.create({
    model: "omni-moderation-latest",
    input: params.content,
  });

  const flagged = mod.results.some((r) => r.flagged);
  const reasons: string[] = [];
  if (flagged) reasons.push("OpenAI moderation flagged this content.");

  // Lightweight additional checks aligned to prompt expectations.
  if (params.content.includes("<")) {
    // placeholders are expected; no action.
  }
  if (/\b(card number|cvv|ssn|password)\b/i.test(params.content)) {
    reasons.push("Potential sensitive data handling issue (PCI/credentials). Review required.");
  }

  // PII-ish detection for enterprise demo (synthetic-safe but demonstrates policy).
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(params.content)) {
    reasons.push("Potential PII: email address detected in content.");
  }
  if (/\b\+?1?[-.\s]?(\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(params.content)) {
    reasons.push("Potential PII: phone number detected in content.");
  }
  if (/https?:\/\//i.test(params.content)) {
    reasons.push("External link detected. For compliance, require review before publishing.");
  }

  // Consistency checks: if ticket links a script, KB should mention it.
  const scriptId = (params.context.scriptId || "").trim();
  if (scriptId && !params.content.includes(scriptId)) {
    reasons.push(`Script_ID ${scriptId} present on ticket but not referenced in KB draft.`);
  }

  const artifactPath = writeTraceArtifact({
    ticketNumber: params.context.ticketNumber,
    scope: "guardrail",
    kind: "moderation",
    data: {
      model: "omni-moderation-latest",
      context: params.context,
      contentChars: params.content.length,
      contentPreview: params.content.slice(0, 900),
      moderation: mod,
      reasons,
      ok: reasons.length === 0,
    },
  });

  return { ok: reasons.length === 0, reasons, moderation: mod, artifactPath };
}
